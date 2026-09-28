-- CCA-F Roadmap: one progress document per user.
-- Run once in Supabase → SQL Editor (or `supabase db push` with the CLI).

create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  -- Bumped on every write; an update only matches the version it read (optimistic concurrency).
  version    bigint      not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

-- Some projects grant every privilege on new public tables to anon and authenticated. Policies
-- don't take grants back, so set them explicitly: signed-out visitors get nothing, and signed-in
-- users may read, create and update rows (the policies below limit that to their own row).
revoke all on table public.progress from anon, authenticated;
grant select, insert, update on table public.progress to authenticated;

drop policy if exists "Users read their own progress" on public.progress;
create policy "Users read their own progress"
  on public.progress for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users create their own progress" on public.progress;
create policy "Users create their own progress"
  on public.progress for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own progress" on public.progress;
create policy "Users update their own progress"
  on public.progress for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No delete policy: reset is an update to an empty document, and deleting an account
-- (admin page, secret key) removes its row through the foreign key's on delete cascade.
