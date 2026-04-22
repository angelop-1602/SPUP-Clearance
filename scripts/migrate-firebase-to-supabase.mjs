import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldPath, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { createClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";

const DEFAULT_SUPABASE_BUCKET = "submission-files";
const DEFAULT_COLLECTION = "submissions";
const FILE_CHECK_TIMEOUT_MS = 30000;
const FILE_DOWNLOAD_TIMEOUT_MS = 120000;
const STANDARD_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;
const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex < 0) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value.replace(/\\n/g, "\n");
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(process.cwd(), ".env.local"));

function hasArg(name) {
  return process.argv.includes(name);
}

function getArgValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

const isDryRun = hasArg("--dry-run");
const includeExportedFiles = hasArg("--include-exported-files");
const skipFiles = hasArg("--skip-files");
const skipExisting = hasArg("--skip-existing");
const onlyId = getArgValue("--only-id");
const diagnoseId = getArgValue("--diagnose-id");
const audit = hasArg("--audit");
const auditIdsOnly = hasArg("--audit-ids-only");
const limit = Number.parseInt(getArgValue("--limit") ?? "", 10);
const collectionName = getArgValue("--collection") || DEFAULT_COLLECTION;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getServiceAccount() {
  const explicitPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (explicitPath) {
    return JSON.parse(readFileSync(resolve(process.cwd(), explicitPath), "utf8"));
  }

  return {
    projectId: requireEnv("FIREBASE_PROJECT_ID"),
    clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
    privateKey: requireEnv("FIREBASE_PRIVATE_KEY"),
  };
}

function normalizeResearchType(value) {
  if (value === "Non-Thesis") return "Not Applicable";
  if (
    value === "Capstone" ||
    value === "Thesis" ||
    value === "Dissertation" ||
    value === "Not Applicable"
  ) {
    return value;
  }

  return "Thesis";
}

function normalizeLevel(value) {
  if (value === "undergrad" || value === "grad") return value;
  return null;
}

function sanitizeStorageSegment(value) {
  return (
    String(value || "student")
      .replace(/[^a-zA-Z0-9\s_-]/g, "")
      .trim()
      .replace(/\s+/g, "_") || "student"
  );
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000).toISOString();
  }
  return null;
}

function normalizeGroupMembers(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((member) => ({
      name: typeof member?.name === "string" ? member.name.trim() : "",
      studentID:
        typeof member?.studentID === "string"
          ? member.studentID.trim()
          : typeof member?.studentId === "string"
            ? member.studentId.trim()
            : "",
      isCleared:
        typeof member?.isCleared === "boolean" ? member.isCleared : undefined,
    }))
    .filter((member) => member.name || member.studentID);
}

function normalizeFileList(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : [];
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

function getSupabaseTusEndpoint(supabaseUrl) {
  const { hostname, protocol } = new URL(supabaseUrl);
  const projectRef = hostname.split(".")[0];
  return `${protocol}//${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
}

function formatMegabytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isSupabaseSizeLimitError(error) {
  const message = error?.message ?? String(error);
  return (
    message.includes("Maximum size exceeded") ||
    message.includes("exceeded the maximum allowed size") ||
    message.includes("response code: 413")
  );
}

async function ensureSupabaseBucket(supabase, bucketName) {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(error.message);

  if (data.some((bucket) => bucket.id === bucketName)) return;

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: false,
  });
  if (createError) throw new Error(createError.message);
}

async function getExistingSubmissionIds(supabase) {
  const ids = new Set();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("submissions")
      .select("id")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      ids.add(row.id);
    }

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return ids;
}

async function downloadFromFirebaseStorage(bucket, firebasePath, fallbackUrl) {
  const file = bucket.file(firebasePath);
  const [exists] = await withTimeout(
    file.exists(),
    FILE_CHECK_TIMEOUT_MS,
    `Checking ${firebasePath}`
  );

  if (exists) {
    const [buffer] = await withTimeout(
      file.download(),
      FILE_DOWNLOAD_TIMEOUT_MS,
      `Downloading ${firebasePath}`
    );
    return buffer;
  }

  if (fallbackUrl && /^https?:\/\//i.test(fallbackUrl)) {
    const response = await fetch(fallbackUrl, {
      signal: AbortSignal.timeout(FILE_DOWNLOAD_TIMEOUT_MS),
    });
    if (response.ok) {
      return Buffer.from(await response.arrayBuffer());
    }
  }

  return null;
}

async function findFirebaseFileForDryRun(bucket, firebasePath, fallbackUrl) {
  const [exists] = await withTimeout(
    bucket.file(firebasePath).exists(),
    FILE_CHECK_TIMEOUT_MS,
    `Checking ${firebasePath}`
  );
  if (exists) return true;

  if (fallbackUrl && /^https?:\/\//i.test(fallbackUrl)) {
    const response = await fetch(fallbackUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(FILE_CHECK_TIMEOUT_MS),
    });
    return response.ok;
  }

  return false;
}

async function uploadToSupabaseStorageWithTus({
  supabaseUrl,
  supabaseServiceRoleKey,
  bucketName,
  path,
  buffer,
}) {
  const endpoint = getSupabaseTusEndpoint(supabaseUrl);
  let lastLoggedPercent = -1;

  await new Promise((resolve, reject) => {
    const upload = new tus.Upload(buffer, {
      endpoint,
      chunkSize: TUS_CHUNK_SIZE_BYTES,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      uploadSize: buffer.length,
      headers: {
        authorization: `Bearer ${supabaseServiceRoleKey}`,
        "x-upsert": "true",
      },
      metadata: {
        bucketName,
        objectName: path,
        contentType: "application/zip",
        cacheControl: "3600",
      },
      onError(error) {
        reject(error);
      },
      onProgress(bytesUploaded, bytesTotal) {
        const percent = Math.floor((bytesUploaded / bytesTotal) * 100);
        if (percent >= lastLoggedPercent + 10 || percent === 100) {
          lastLoggedPercent = percent;
          console.log(`Large upload ${path}: ${percent}%`);
        }
      },
      onSuccess() {
        resolve();
      },
    });

    upload.start();
  });
}

async function uploadToSupabaseStorage(
  supabase,
  bucketName,
  path,
  buffer,
  uploadOptions
) {
  if (buffer.length > STANDARD_UPLOAD_LIMIT_BYTES) {
    await uploadToSupabaseStorageWithTus({
      ...uploadOptions,
      bucketName,
      path,
      buffer,
    });
    return;
  }

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(path, buffer, {
      contentType: "application/zip",
      upsert: true,
    });
  if (error) throw new Error(error.message);
}

async function uploadToSupabaseStorageWithRetry(
  supabase,
  bucketName,
  path,
  buffer,
  uploadOptions
) {
  const errors = [];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await uploadToSupabaseStorage(
        supabase,
        bucketName,
        path,
        buffer,
        uploadOptions
      );
      return;
    } catch (error) {
      if (isSupabaseSizeLimitError(error)) {
        throw new Error(
          `Supabase rejected ${path} (${formatMegabytes(
            buffer.length
          )}) because it exceeds the project or bucket file size limit. Increase the Supabase Storage global file size limit, then rerun this record.`
        );
      }

      errors.push(error.message);
      const delayMs = attempt * 3000;
      console.warn(`Upload attempt ${attempt} failed for ${path}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(errors.at(-1) ?? `Failed to upload ${path}`);
}

async function getFirebaseFileInfo(bucket, firebasePath, fallbackUrl) {
  const file = bucket.file(firebasePath);
  const info = {
    expectedPath: firebasePath,
    pathExists: false,
    pathSize: null,
    fallbackUrl: fallbackUrl || null,
    fallbackUrlReachable: false,
    error: null,
  };

  try {
    const [exists] = await withTimeout(
      file.exists(),
      FILE_CHECK_TIMEOUT_MS,
      `Checking ${firebasePath}`
    );
    info.pathExists = exists;

    if (exists) {
      const [metadata] = await withTimeout(
        file.getMetadata(),
        FILE_CHECK_TIMEOUT_MS,
        `Reading metadata ${firebasePath}`
      );
      info.pathSize = metadata.size ?? null;
    }
  } catch (error) {
    info.error = error.message;
  }

  if (fallbackUrl && /^https?:\/\//i.test(fallbackUrl)) {
    try {
      const response = await fetch(fallbackUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(FILE_CHECK_TIMEOUT_MS),
      });
      info.fallbackUrlReachable = response.ok;
    } catch (error) {
      info.fallbackUrlReachable = false;
      info.error = info.error ?? error.message;
    }
  }

  return info;
}

function mapSubmissionDoc(doc) {
  const data = doc.data();
  const level = normalizeLevel(data.level);
  if (!level) {
    throw new Error(`Invalid or missing level for ${doc.id}`);
  }

  return {
    id: doc.id,
    level,
    name: String(data.name ?? ""),
    email: String(data.email ?? ""),
    student_id: String(data.studentId ?? data.student_id ?? ""),
    adviser: String(data.adviser ?? ""),
    course: String(data.course ?? ""),
    graduation_month: String(data.graduationMonth ?? data.graduation_month ?? ""),
    graduation_year: String(data.graduationYear ?? data.graduation_year ?? ""),
    research_title: String(data.researchTitle ?? data.research_title ?? ""),
    research_type: normalizeResearchType(data.researchType ?? data.research_type),
    group_members: normalizeGroupMembers(data.groupMembers ?? data.group_members),
    file_list: normalizeFileList(data.fileList ?? data.file_list),
    zip_path: null,
    status: data.status === "Cleared" ? "Cleared" : "Submitted",
    leader_cleared:
      typeof data.leaderCleared === "boolean" ? data.leaderCleared : null,
    is_exported: Boolean(data.isExported),
    exported_at: toIso(data.exportedAt),
    submitted_at: toIso(data.submittedAt) ?? new Date().toISOString(),
    updated_at: toIso(data.updatedAt),
    export_link: typeof data.exportLink === "string" ? data.exportLink : null,
    original_zip_url: typeof data.zipFile === "string" ? data.zipFile : null,
  };
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const firebaseStorageBucket = requireEnv("FIREBASE_STORAGE_BUCKET");
  const supabaseBucket =
    process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_SUPABASE_BUCKET;

  const serviceAccount = getServiceAccount();
  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: firebaseStorageBucket,
    });
  }

  const firestore = getFirestore();
  firestore.settings({ preferRest: true });
  const firebaseBucket = getStorage().bucket(firebaseStorageBucket);
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  if (!isDryRun) {
    await ensureSupabaseBucket(supabase, supabaseBucket);
  }

  if (diagnoseId) {
    const doc = await firestore.collection(collectionName).doc(diagnoseId).get();
    if (!doc.exists) {
      console.log(`Firebase document not found: ${diagnoseId}`);
      return;
    }

    const mapped = mapSubmissionDoc(doc);
    const sanitizedName = sanitizeStorageSegment(mapped.name);
    const oldFirebasePath = `submissions/${sanitizedName}_${mapped.id}.zip`;
    const newSupabasePath = `submissions/${mapped.id}/${sanitizedName}_${mapped.id}.zip`;
    const firebaseFileInfo = await getFirebaseFileInfo(
      firebaseBucket,
      oldFirebasePath,
      mapped.original_zip_url
    );
    const { data: supabaseRow, error: rowError } = await supabase
      .from("submissions")
      .select("id,zip_path,is_exported,file_list")
      .eq("id", mapped.id)
      .maybeSingle();

    const { data: supabaseFiles, error: listError } = await supabase.storage
      .from(supabaseBucket)
      .list(`submissions/${mapped.id}`);

    console.log(
      JSON.stringify(
        {
          id: mapped.id,
          name: mapped.name,
          expectedFirebasePath: oldFirebasePath,
          expectedSupabasePath: newSupabasePath,
          firebaseFileInfo,
          supabaseRowError: rowError?.message ?? null,
          supabaseRow,
          supabaseStorageListError: listError?.message ?? null,
          supabaseStorageFiles: supabaseFiles,
        },
        null,
        2
      )
    );
    return;
  }

  if (audit || auditIdsOnly) {
    const firebaseSnapshot = await firestore.collection(collectionName).get();
    const firebaseIds = new Set(firebaseSnapshot.docs.map((doc) => doc.id));
    const supabaseIds = await getExistingSubmissionIds(supabase);
    const missingInSupabase = [...firebaseIds]
      .filter((id) => !supabaseIds.has(id))
      .sort();

    if (auditIdsOnly) {
      console.log(
        JSON.stringify(
          {
            firebaseCount: firebaseIds.size,
            supabaseCount: supabaseIds.size,
            missingInSupabase,
          },
          null,
          2
        )
      );
      return;
    }

    const partialStorageRows = [];
    const { data: rows, error: rowsError } = await supabase
      .from("submissions")
      .select("id,zip_path,file_list,is_exported")
      .order("id");
    if (rowsError) throw new Error(rowsError.message);

    for (const row of rows ?? []) {
      if (!firebaseIds.has(row.id)) continue;
      if (!row.zip_path && row.file_list?.length > 0 && !row.is_exported) {
        partialStorageRows.push(row.id);
        continue;
      }

      if (row.zip_path) {
        const folder = row.zip_path.split("/").slice(0, -1).join("/");
        const fileName = row.zip_path.split("/").pop();
        const { data: files, error: listError } = await supabase.storage
          .from(supabaseBucket)
          .list(folder);
        if (listError || !files?.some((file) => file.name === fileName)) {
          partialStorageRows.push(row.id);
        }
      }
    }

    console.log(
      JSON.stringify(
        {
          firebaseCount: firebaseIds.size,
          supabaseCount: supabaseIds.size,
          missingInSupabase,
          partialStorageRows: [...new Set(partialStorageRows)].sort(),
        },
        null,
        2
      )
    );
    return;
  }

  let query = firestore.collection(collectionName).orderBy(FieldPath.documentId());
  if (onlyId) {
    query = query.where(FieldPath.documentId(), "==", onlyId);
  }
  if (Number.isFinite(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const existingSubmissionIds =
    skipExisting && !isDryRun ? await getExistingSubmissionIds(supabase) : new Set();
  if (skipExisting && !isDryRun) {
    console.log(`Loaded ${existingSubmissionIds.size} existing Supabase submission IDs.`);
  }

  console.log(`Reading Firebase collection: ${collectionName}`);
  const snapshot = await query.get();
  console.log(`Found ${snapshot.size} Firebase documents in ${collectionName}.`);
  if (isDryRun) console.log("Dry run enabled: no Supabase writes will be made.");

  const results = {
    migrated: 0,
    filesUploaded: 0,
    fileMissing: 0,
    skipped: 0,
    failed: 0,
  };

  for (const doc of snapshot.docs) {
    try {
      if (existingSubmissionIds.has(doc.id)) {
        results.skipped += 1;
        console.log(`Skipped existing ${doc.id}`);
        continue;
      }

      const mapped = mapSubmissionDoc(doc);
      const sanitizedName = sanitizeStorageSegment(mapped.name);
      const oldFirebasePath = `submissions/${sanitizedName}_${mapped.id}.zip`;
      const newSupabasePath = `submissions/${mapped.id}/${sanitizedName}_${mapped.id}.zip`;

      if (!skipFiles && (!mapped.is_exported || includeExportedFiles)) {
        const hasFile = isDryRun
          ? await findFirebaseFileForDryRun(
              firebaseBucket,
              oldFirebasePath,
              mapped.original_zip_url
            )
          : false;
        const zipBuffer = isDryRun
          ? null
          : await downloadFromFirebaseStorage(
              firebaseBucket,
              oldFirebasePath,
              mapped.original_zip_url
            );

        if (zipBuffer || hasFile) {
          mapped.zip_path = newSupabasePath;

          if (!isDryRun) {
            await uploadToSupabaseStorageWithRetry(
              supabase,
              supabaseBucket,
              newSupabasePath,
              zipBuffer,
              {
                supabaseUrl,
                supabaseServiceRoleKey,
              }
            );
          }

          results.filesUploaded += 1;
        } else if (mapped.file_list.length > 0) {
          results.fileMissing += 1;
          console.warn(`File missing for ${mapped.id}: ${oldFirebasePath}`);
        }
      }

      const { original_zip_url, ...row } = mapped;

      if (!isDryRun) {
        const { error } = await supabase
          .from("submissions")
          .upsert(row, { onConflict: "id" });
        if (error) throw new Error(error.message);
      }

      results.migrated += 1;
      console.log(`Migrated ${mapped.id}`);
    } catch (error) {
      results.failed += 1;
      console.error(`Failed ${doc.id}:`, error.message);
    }
  }

  console.log("Migration complete:", results);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
