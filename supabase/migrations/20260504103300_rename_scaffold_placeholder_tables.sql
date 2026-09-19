-- The target project started as a blank Lovable-Cloud scaffold with placeholder
-- tables that don't match this app's real schema (created outside migrations).
-- Rename them out of the way (no data loss — all were empty) so the real
-- migrations below can create the actual tables under these names.
alter table if exists public."UiPair Social Network" rename to _deprecated_uipair_social_network;
alter table if exists public."UiPair" rename to _deprecated_uipair;
alter table if exists public.messages rename to _deprecated_messages_scaffold;
alter table if exists public.thread_participants rename to _deprecated_thread_participants;
alter table if exists public.threads rename to _deprecated_threads;
alter table if exists public.profiles rename to _deprecated_profiles_scaffold;
