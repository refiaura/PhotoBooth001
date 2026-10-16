-- Rollback untuk migrations/20261017000000_session_runtime.sql (jalankan manual),
-- lalu hapus baris versi 20261017000000 dari supabase_migrations.schema_migrations.

drop policy if exists "peserta mengirim pesan ke booth sendiri" on realtime.messages;
drop policy if exists "peserta menerima pesan booth sendiri" on realtime.messages;

alter table public.booths
  drop constraint if exists booths_fire_at_only_capturing,
  drop constraint if exists booths_shots_shape;

alter table public.booths
  drop column if exists strip_slug,
  drop column if exists compose_started_at,
  drop column if exists shot_fire_at,
  drop column if exists shots,
  drop column if exists ready_guest,
  drop column if exists ready_host;
