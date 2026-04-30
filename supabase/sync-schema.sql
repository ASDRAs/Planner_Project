-- Sync metadata required by the planner web app.
-- Run this once in the Supabase SQL editor before deploying the sync changes.

alter table public.memos
  add column if not exists "updatedAt" bigint,
  add column if not exists "deletedAt" bigint;

update public.memos
set "updatedAt" = coalesce(
  "updatedAt",
  "createdAt",
  floor(extract(epoch from now()) * 1000)::bigint
)
where "updatedAt" is null;

create index if not exists memos_user_id_updated_at_idx
  on public.memos ("userId", "updatedAt");

create table if not exists public.daily_quests (
  id text primary key,
  "userId" text not null,
  title text not null,
  "createdAt" bigint not null,
  "updatedAt" bigint not null,
  "order" integer not null default 0,
  "lastCompletedDate" text,
  "deletedAt" bigint
);

create index if not exists daily_quests_user_id_updated_at_idx
  on public.daily_quests ("userId", "updatedAt");

alter table public.daily_quests enable row level security;

drop policy if exists "daily_quests_select_own" on public.daily_quests;
create policy "daily_quests_select_own"
  on public.daily_quests
  for select
  using ("userId" = auth.uid()::text);

drop policy if exists "daily_quests_insert_own" on public.daily_quests;
create policy "daily_quests_insert_own"
  on public.daily_quests
  for insert
  with check ("userId" = auth.uid()::text);

drop policy if exists "daily_quests_update_own" on public.daily_quests;
create policy "daily_quests_update_own"
  on public.daily_quests
  for update
  using ("userId" = auth.uid()::text)
  with check ("userId" = auth.uid()::text);
