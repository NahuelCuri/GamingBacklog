-- Run after trips_sharing.sql once the new app is live and both members have
-- checked their trips. trip_members is no longer read by any policy.

begin;
drop policy if exists members_read_self on public.trip_members;
drop table if exists public.trip_members;
commit;
