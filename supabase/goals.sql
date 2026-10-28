-- Yearly goals ("read 24 books in 2026"), one row per user, library and year.
-- Run once in the Supabase SQL Editor. Only the target is stored: progress is
-- counted from the library itself (lib/goals.ts).

begin;

create table if not exists public.goals (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  collection text not null,
  year       int  not null check (year between 1900 and 2200),
  target     int  not null check (target > 0 and target <= 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, year)
);

alter table public.goals enable row level security;

drop policy if exists "own goals" on public.goals;
create policy "own goals" on public.goals for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;
