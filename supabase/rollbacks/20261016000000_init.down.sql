-- Rollback untuk migrations/20261016000000_init.sql.
-- Supabase CLI tidak punya "down migration", jadi jalankan manual:
--
--   1. Kosongkan dan hapus bucket `booth-media` lewat Storage API
--      (Dashboard > Storage, atau supabase-js `emptyBucket` lalu `deleteBucket`).
--      JANGAN menghapus baris storage.objects/storage.buckets langsung dengan SQL:
--      file fisiknya tertinggal dan Supabase memblokir operasi itu.
--   2. Jalankan SQL di bawah.
--   3. Hapus baris versi 20261016000000 dari supabase_migrations.schema_migrations.
--
-- PERINGATAN: menghapus seluruh data booth, peserta, foto, dan strip.

-- Kembalikan default privilege seperti sebelum migrasi.
alter default privileges for role postgres grant execute on functions to public;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;

drop function if exists public.hit_rate_limit(text, integer, integer);

drop table if exists public.rate_limit_hits;
drop table if exists public.strips;
drop table if exists public.photos;
drop table if exists public.participants;
drop table if exists public.booths;
drop table if exists public.themes;

drop type if exists public.strip_format;
drop type if exists public.participant_role;
drop type if exists public.booth_status;
