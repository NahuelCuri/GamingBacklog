-- Trips per user, shared per trip (docs/TRIPS_SHARING_PLAN.md).
-- Run once in the Supabase SQL Editor. It runs in one transaction: if any
-- statement fails, nothing changes.
--
-- After it: every trip has an owner; the owner sees and edits it, and so does
-- anyone in trip_shares for that trip. The current trips go to the admin
-- account, with the second member as editor, so both keep seeing them.
-- trip_members stays (unused) until trips_sharing_cleanup.sql.

begin;

-- ------------------------------------------------------------ columns

alter table public.trips add column if not exists owner_id uuid references auth.users(id) on delete cascade;
update public.trips set owner_id = '8ca752c7-962b-4bcf-98a6-392d168b6481' where owner_id is null;
alter table public.trips alter column owner_id set default auth.uid();
alter table public.trips alter column owner_id set not null;
create index if not exists trips_owner_id on public.trips(owner_id);

-- The card's trip, as a column RLS can use. Comes from data.trip, so the client doesn't change.
alter table public.trip_cards add column if not exists trip_id text generated always as (data->>'trip') stored;
create index if not exists trip_cards_trip_id on public.trip_cards(trip_id);

-- ------------------------------------------------------------ shares

create table if not exists public.trip_shares (
  trip_id    text not null references public.trips(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'editor' check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index if not exists trip_shares_user_id on public.trip_shares(user_id);

insert into public.trip_shares (trip_id, user_id, role)
select id, '7576f6af-09b6-4c22-8357-2e42dd418b94', 'editor' from public.trips
on conflict do nothing;

-- ------------------------------------------------------------ access helpers
-- SECURITY DEFINER so the policies below can read trips/trip_shares without
-- recursing into their own RLS.

create or replace function public.is_trip_owner(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips where id = t and owner_id = auth.uid());
$$;

create or replace function public.can_read_trip(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips where id = t and owner_id = auth.uid())
      or exists (select 1 from trip_shares where trip_id = t and user_id = auth.uid());
$$;

create or replace function public.can_edit_trip(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips where id = t and owner_id = auth.uid())
      or exists (select 1 from trip_shares where trip_id = t and user_id = auth.uid() and role = 'editor');
$$;

-- ------------------------------------------------------------ triggers

-- The owner never changes, whoever writes the row.
create or replace function public.trips_keep_owner() returns trigger
language plpgsql as $$
begin
  new.owner_id := old.owner_id;
  return new;
end $$;
drop trigger if exists trips_keep_owner on public.trips;
create trigger trips_keep_owner before update on public.trips
  for each row execute function public.trips_keep_owner();

-- Deleting a trip deletes its cards (the client does too; this catches the rest).
create or replace function public.trips_delete_cards() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from trip_cards where trip_id = old.id;
  return old;
end $$;
drop trigger if exists trips_delete_cards on public.trips;
create trigger trips_delete_cards after delete on public.trips
  for each row execute function public.trips_delete_cards();

-- ------------------------------------------------------------ policies

alter table public.trips enable row level security;
alter table public.trip_cards enable row level security;
alter table public.trip_shares enable row level security;

drop policy if exists trips_members on public.trips;
drop policy if exists cards_members on public.trip_cards;

drop policy if exists trips_select on public.trips;
drop policy if exists trips_insert on public.trips;
drop policy if exists trips_update on public.trips;
drop policy if exists trips_delete on public.trips;
-- owner_id = auth.uid() first: an upsert checks the SELECT policy against the
-- new row too, and can_read_trip() can't see a row that isn't stored yet.
create policy trips_select on public.trips for select using (owner_id = auth.uid() or public.can_read_trip(id));
create policy trips_insert on public.trips for insert with check (owner_id = auth.uid());
create policy trips_update on public.trips for update
  using (owner_id = auth.uid() or public.can_edit_trip(id))
  with check (owner_id = auth.uid() or public.can_edit_trip(id));
create policy trips_delete on public.trips for delete using (owner_id = auth.uid());

drop policy if exists cards_select on public.trip_cards;
drop policy if exists cards_insert on public.trip_cards;
drop policy if exists cards_update on public.trip_cards;
drop policy if exists cards_delete on public.trip_cards;
create policy cards_select on public.trip_cards for select using (public.can_read_trip(trip_id));
create policy cards_insert on public.trip_cards for insert with check (public.can_edit_trip(trip_id));
create policy cards_update on public.trip_cards for update using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy cards_delete on public.trip_cards for delete using (public.can_edit_trip(trip_id));

-- Shares are added only through share_trip(). The owner can remove anyone; a
-- guest can remove themselves (leave the trip).
drop policy if exists shares_select on public.trip_shares;
drop policy if exists shares_delete on public.trip_shares;
create policy shares_select on public.trip_shares for select using (user_id = auth.uid() or public.is_trip_owner(trip_id));
create policy shares_delete on public.trip_shares for delete using (user_id = auth.uid() or public.is_trip_owner(trip_id));

-- ------------------------------------------------------------ RPCs

-- Invite by exact email. Returns 'ok', 'not_found', 'self' or 'not_owner' and
-- nothing else, so it can't be used to list accounts.
create or replace function public.share_trip(p_trip text, p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v uuid;
begin
  if not is_trip_owner(p_trip) then return 'not_owner'; end if;
  select id into v from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v is null then return 'not_found'; end if;
  if v = auth.uid() then return 'self'; end if;
  insert into trip_shares (trip_id, user_id) values (p_trip, v) on conflict do nothing;
  return 'ok';
end $$;

-- Who is in each trip the caller can see: the owner and every guest.
create or replace function public.trip_people()
returns table (trip_id text, user_id uuid, email text, role text)
language sql stable security definer set search_path = public as $$
  select t.id, t.owner_id, u.email::text, 'owner'
    from trips t join auth.users u on u.id = t.owner_id
   where can_read_trip(t.id)
  union all
  select s.trip_id, s.user_id, u.email::text, s.role
    from trip_shares s join auth.users u on u.id = s.user_id
   where can_read_trip(s.trip_id);
$$;

revoke execute on function public.share_trip(text, text) from public, anon;
revoke execute on function public.trip_people() from public, anon;
grant execute on function public.share_trip(text, text) to authenticated;
grant execute on function public.trip_people() to authenticated;

-- ------------------------------------------------------------ realtime
-- Guests learn about new and removed shares live.

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'trip_shares') then
    alter publication supabase_realtime add table public.trip_shares;
  end if;
end $$;

commit;
