-- Rollback untuk migrations/20261016000000_init.sql.
-- Jalankan manual (Supabase CLI tidak punya "down migration"), lalu hapus baris
-- versi 20261016000000 dari supabase_migrations.schema_migrations.
-- PERINGATAN: menghapus seluruh data booth, peserta, foto, dan strip.

-- Hapus file dulu agar bucket bisa dihapus.
delete from storage.objects where bucket_id = 'booth-media';
delete from storage.buckets where id = 'booth-media';

alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to public, anon, authenticated;

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
