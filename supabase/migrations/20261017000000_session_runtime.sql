-- Kolom runtime sesi foto + otorisasi kanal Realtime privat (keputusan K1).
-- Rollback: supabase/rollbacks/20261017000000_session_runtime.down.sql
--
-- Seluruh snapshot state machine (status, siap, progres jepretan, jadwal) disimpan
-- di SATU baris booths dan diubah dengan compare-and-swap pada kolom version.
-- Dengan begitu dua peserta yang menjepret bersamaan tidak bisa membuat sesi macet
-- (PostgREST tidak punya transaksi lintas tabel).

alter table public.booths
  -- Tombol "Siap!" per peserta.
  add column ready_host boolean not null default false,
  add column ready_guest boolean not null default false,
  -- Progres per peserta per shot: {"host":[{"captured":bool,"uploaded":bool} x4],"guest":[...]}.
  add column shots jsonb not null default
    '{"host":[{"captured":false,"uploaded":false},{"captured":false,"uploaded":false},{"captured":false,"uploaded":false},{"captured":false,"uploaded":false}],"guest":[{"captured":false,"uploaded":false},{"captured":false,"uploaded":false},{"captured":false,"uploaded":false},{"captured":false,"uploaded":false}]}'::jsonb,
  -- Waktu jepret terjadwal (jam server) untuk shot berikutnya; NULL bila tidak ada jadwal.
  add column shot_fire_at timestamptz,
  -- Penjaga komposisi agar hanya satu request yang menyusun photostrip.
  add column compose_started_at timestamptz,
  -- public_slug hasil komposisi terakhir.
  add column strip_slug text check (strip_slug ~ '^[A-Za-z0-9_-]{22}$');

alter table public.booths
  add constraint booths_shots_shape check (
    jsonb_typeof(shots -> 'host') = 'array'
    and jsonb_typeof(shots -> 'guest') = 'array'
    and jsonb_array_length(shots -> 'host') = 4
    and jsonb_array_length(shots -> 'guest') = 4
  ),
  -- Jadwal jepret hanya bermakna saat CAPTURING.
  add constraint booths_fire_at_only_capturing check (shot_fire_at is null or status = 'CAPTURING');

-- ---------------------------------------------------------------------------
-- Realtime: kanal privat `booth:<booth_id>`.
-- Peserta memakai JWT pendek buatan server (role authenticated, klaim booth_id).
-- Peserta hanya bisa mendengar/mengirim di kanal booth-nya sendiri.
-- Server menyiarkan dengan service role (melewati RLS).
-- ---------------------------------------------------------------------------
create policy "peserta menerima pesan booth sendiri"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.topic() = 'booth:' || (auth.jwt() ->> 'booth_id')
    and realtime.messages.extension in ('broadcast', 'presence')
  );

create policy "peserta mengirim pesan ke booth sendiri"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.topic() = 'booth:' || (auth.jwt() ->> 'booth_id')
    and realtime.messages.extension in ('broadcast', 'presence')
  );
