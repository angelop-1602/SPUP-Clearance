# Firebase to Supabase Migration

The Firebase web app config identifies the old project, but it is not enough to
export Firestore and Storage data. Use a Firebase service account for the
one-time migration.

1. In Firebase Console, open Project settings > Service accounts.
2. Generate a new private key JSON.
3. Save it locally as `firebase-service-account.json` in the project root.
4. Add these values to `.env.local`:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json
FIREBASE_STORAGE_BUCKET=student-clearance-acdd8.firebasestorage.app
```

Your existing Supabase values are reused:

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Run a no-write test first:

```bash
node scripts/migrate-firebase-to-supabase.mjs --dry-run --limit=5
```

For a fast metadata-only dry run that skips Storage checks:

```bash
node scripts/migrate-firebase-to-supabase.mjs --dry-run --skip-files --limit=5
```

Run the real migration:

```bash
node scripts/migrate-firebase-to-supabase.mjs
```

Large ZIP files are uploaded to Supabase Storage with the TUS resumable upload
endpoint. Smaller ZIP files use the normal Supabase Storage upload API.

Retry only one failed record:

```bash
node scripts/migrate-firebase-to-supabase.mjs --only-id=SPUP_Clearance_2025_SCW0HG
```

Diagnose a failed record without writing anything:

```bash
node scripts/migrate-firebase-to-supabase.mjs --diagnose-id=SPUP_Clearance_2025_SCW0HG
```

Audit Firebase vs Supabase to find missing or partial records:

```bash
node scripts/migrate-firebase-to-supabase.mjs --audit
```

Rerun the migration while skipping records that are already in Supabase:

```bash
node scripts/migrate-firebase-to-supabase.mjs --skip-existing
```

By default, records marked `isExported` keep their metadata but do not copy old
ZIP files. To try copying those files too:

```bash
node scripts/migrate-firebase-to-supabase.mjs --include-exported-files
```
