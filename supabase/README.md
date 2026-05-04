# Supabase Setup

Run `schema.sql` in the Supabase SQL editor before using the app.

After creating an admin account in Supabase Auth, insert that user into
`public.admin_users`:

```sql
insert into public.admin_users (user_id, email)
values ('AUTH_USER_UUID', 'admin@example.com')
on conflict (user_id) do update set email = excluded.email;
```

The app uses a private Storage bucket named `submission-files` with no
per-bucket file-size limit. Supabase may still enforce the project's global
Storage object-size limit. The SQL setup creates or updates the bucket, and the
submission API also attempts to create or update it before uploading files.
