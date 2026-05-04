import JSZip from "jszip";

function addDuplicateSuffix(fileName: string, sequence: number): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) return `${fileName} (${sequence})`;

  const base = fileName.slice(0, dotIndex);
  const extension = fileName.slice(dotIndex);
  return `${base} (${sequence})${extension}`;
}

function getUniqueZipFileName(fileName: string, usedNames: Set<string>): string {
  const safeName = fileName.trim() || "file";
  let candidate = safeName;
  let sequence = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = addDuplicateSuffix(safeName, sequence);
    sequence += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

export async function buildSubmissionArchive(files: File[]): Promise<{
  fileList: string[];
  archive: Blob | null;
}> {
  if (files.length === 0) {
    return { fileList: [], archive: null };
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();
  const entries = await Promise.all(
    files.map(async (file) => {
      const uniqueFileName = getUniqueZipFileName(file.name, usedNames);
      return {
        name: uniqueFileName,
        data: await file.arrayBuffer(),
      };
    })
  );

  for (const entry of entries) {
    zip.file(entry.name, entry.data);
  }

  return {
    fileList: entries.map((entry) => entry.name),
    archive: await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    }),
  };
}
