-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Each user gets one row holding their whole planner (recipes, pantry, meals) as JSON.

create table if not exists public.planner_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security: people can only ever see and change their own row.
alter table public.planner_state enable row level security;

drop policy if exists "read own" on public.planner_state;
drop policy if exists "insert own" on public.planner_state;
drop policy if exists "update own" on public.planner_state;
drop policy if exists "delete own" on public.planner_state;

create policy "read own" on public.planner_state for select using ((select auth.uid()) = user_id);
create policy "insert own" on public.planner_state for insert with check ((select auth.uid()) = user_id);
create policy "update own" on public.planner_state for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own" on public.planner_state for delete using ((select auth.uid()) = user_id);
