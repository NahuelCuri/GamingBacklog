-- Fix for trips_sharing.sql: creating a trip failed with
--   new row violates row-level security policy for table "trips".
-- The client writes with upsert (INSERT ... ON CONFLICT DO UPDATE), and for
-- that Postgres also checks the SELECT policy against the new row. The policy
-- only asked can_read_trip(id), which looks the trip up in the table, where the
-- new row isn't yet. The row's own owner_id is enough for its owner.

begin;

drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select using (owner_id = auth.uid() or public.can_read_trip(id));

drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips for update
  using (owner_id = auth.uid() or public.can_edit_trip(id))
  with check (owner_id = auth.uid() or public.can_edit_trip(id));

commit;
