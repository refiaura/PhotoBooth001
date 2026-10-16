-- Index untuk mencari booth berdasarkan kode (GET /api/booths/:code, join).
-- Pencarian mengambil booth TERBARU dengan kode tsb. tanpa memfilter status, agar booth yang sudah
-- kedaluwarsa tetap ketemu untuk halaman "booth sudah ditutup". Index parsial booths_code_active_key
-- (khusus booth aktif, untuk keunikan) tidak bisa dipakai query itu.
-- Rollback: drop index if exists public.booths_code_created_at_idx;
create index booths_code_created_at_idx on public.booths (code, created_at desc);
