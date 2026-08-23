-- Supabase-specific setup: FK constraints to auth.users and RLS policies.
-- Not part of the portable Drizzle schema because local dev (PGlite) has no
-- `auth` schema. Safe to re-run: every statement drops-then-creates.

-- ---- FK constraints to auth.users(id) --------------------------------------

alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

alter table user_swipes drop constraint if exists user_swipes_user_id_fkey;
alter table user_swipes add constraint user_swipes_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table user_dna_state drop constraint if exists user_dna_state_user_id_fkey;
alter table user_dna_state add constraint user_dna_state_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table user_saved_profiles drop constraint if exists user_saved_profiles_user_id_fkey;
alter table user_saved_profiles add constraint user_saved_profiles_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table user_preferences drop constraint if exists user_preferences_user_id_fkey;
alter table user_preferences add constraint user_preferences_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table travel_dna_snapshots drop constraint if exists travel_dna_snapshots_user_id_fkey;
alter table travel_dna_snapshots add constraint travel_dna_snapshots_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- ---- RLS: user-scoped tables, keyed on auth.uid() --------------------------

alter table profiles enable row level security;
drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

alter table user_swipes enable row level security;
drop policy if exists "user_swipes_select_own" on user_swipes;
create policy "user_swipes_select_own" on user_swipes for select using (auth.uid() = user_id);
drop policy if exists "user_swipes_insert_own" on user_swipes;
create policy "user_swipes_insert_own" on user_swipes for insert with check (auth.uid() = user_id);

alter table user_dna_state enable row level security;
drop policy if exists "user_dna_state_select_own" on user_dna_state;
create policy "user_dna_state_select_own" on user_dna_state for select using (auth.uid() = user_id);
drop policy if exists "user_dna_state_insert_own" on user_dna_state;
create policy "user_dna_state_insert_own" on user_dna_state for insert with check (auth.uid() = user_id);
drop policy if exists "user_dna_state_update_own" on user_dna_state;
create policy "user_dna_state_update_own" on user_dna_state for update using (auth.uid() = user_id);

alter table user_saved_profiles enable row level security;
drop policy if exists "user_saved_profiles_select_own" on user_saved_profiles;
create policy "user_saved_profiles_select_own" on user_saved_profiles for select using (auth.uid() = user_id);
drop policy if exists "user_saved_profiles_insert_own" on user_saved_profiles;
create policy "user_saved_profiles_insert_own" on user_saved_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "user_saved_profiles_delete_own" on user_saved_profiles;
create policy "user_saved_profiles_delete_own" on user_saved_profiles for delete using (auth.uid() = user_id);

alter table travel_dna_snapshots enable row level security;
drop policy if exists "travel_dna_snapshots_select_own" on travel_dna_snapshots;
create policy "travel_dna_snapshots_select_own" on travel_dna_snapshots for select using (auth.uid() = user_id);
drop policy if exists "travel_dna_snapshots_insert_own" on travel_dna_snapshots;
create policy "travel_dna_snapshots_insert_own" on travel_dna_snapshots for insert with check (auth.uid() = user_id);

alter table user_preferences enable row level security;
drop policy if exists "user_preferences_select_own" on user_preferences;
create policy "user_preferences_select_own" on user_preferences for select using (auth.uid() = user_id);
drop policy if exists "user_preferences_insert_own" on user_preferences;
create policy "user_preferences_insert_own" on user_preferences for insert with check (auth.uid() = user_id);
drop policy if exists "user_preferences_update_own" on user_preferences;
create policy "user_preferences_update_own" on user_preferences for update using (auth.uid() = user_id);

-- ---- RLS: shared content tables, public read-only --------------------------
-- Writes only ever happen via the service-role key (migration/import
-- scripts), which bypasses RLS entirely, so no write policies are needed.

alter table destinations enable row level security;
drop policy if exists "destinations_public_read" on destinations;
create policy "destinations_public_read" on destinations for select using (true);

alter table domains enable row level security;
drop policy if exists "domains_public_read" on domains;
create policy "domains_public_read" on domains for select using (true);

alter table subdimensions enable row level security;
drop policy if exists "subdimensions_public_read" on subdimensions;
create policy "subdimensions_public_read" on subdimensions for select using (true);

alter table cards enable row level security;
drop policy if exists "cards_public_read" on cards;
create policy "cards_public_read" on cards for select using (true);

alter table dimensions enable row level security;
drop policy if exists "dimensions_public_read" on dimensions;
create policy "dimensions_public_read" on dimensions for select using (true);

alter table tensions enable row level security;
drop policy if exists "tensions_public_read" on tensions;
create policy "tensions_public_read" on tensions for select using (true);
