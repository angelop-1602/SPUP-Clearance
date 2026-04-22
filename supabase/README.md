# Supabase Setup

Run `schema.sql` in the Supabase SQL editor before using the app.

After creating an admin account in Supabase Auth, insert that user into
`public.admin_users`:

```sql
insert into public.admin_users (user_id, email)
values ('AUTH_USER_UUID', 'admin@example.com')
on conflict (user_id) do update set email = excluded.email;
```

The app uses a private Storage bucket named `submission-files`. The SQL setup
creates it if it does not exist, and the submission API also attempts to create
it before uploading files.
