create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id text primary key,
  level text not null check (level in ('undergrad', 'grad')),
  name text not null,
  email text not null,
  student_id text not null,
  adviser text not null default '',
  course text not null,
  graduation_month text not null,
  graduation_year text not null,
  research_title text not null default '',
  research_type text not null check (
    research_type in (
      'Capstone',
      'Thesis',
      'Dissertation',
      'Not Applicable',
      'Non-Thesis'
    )
  ),
  group_members jsonb not null default '[]'::jsonb,
  file_list text[] not null default '{}',
  zip_path text,
  status text not null default 'Submitted' check (status in ('Submitted', 'Cleared')),
  leader_cleared boolean,
  is_exported boolean not null default false,
  exported_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz,
  export_link text
);

create index if not exists submissions_submitted_at_idx
  on public.submissions (submitted_at desc);

create index if not exists submissions_status_idx
  on public.submissions (status);

create index if not exists submissions_student_id_idx
  on public.submissions (student_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_submissions_updated_at on public.submissions;
create trigger set_submissions_updated_at
before update on public.submissions
for each row
execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "Admins can read themselves" on public.admin_users;
create policy "Admins can read themselves"
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read submissions" on public.submissions;
create policy "Admins can read submissions"
on public.submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Admins can update submissions" on public.submissions;
create policy "Admins can update submissions"
on public.submissions
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Admins can delete submissions" on public.submissions;
create policy "Admins can delete submissions"
on public.submissions
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public, file_size_limit)
values ('submission-files', 'submission-files', false, 52428800)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'submissions'
  ) then
    alter publication supabase_realtime add table public.submissions;
  end if;
end;
$$;
