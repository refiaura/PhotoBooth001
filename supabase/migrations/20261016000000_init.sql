-- Skema awal Rindu Berat (PRD: "Model Data dan API").
-- Rollback: supabase/rollbacks/20261016000000_init.down.sql
--
-- Prinsip akses: semua tabel RLS aktif TANPA policy, dan hak anon/authenticated dicabut.
-- Satu-satunya jalur baca/tulis adalah service role dari API route (server authoritative).

-- ---------------------------------------------------------------------------
-- Tipe
-- ---------------------------------------------------------------------------
create type public.booth_status as enum (
  'WAITING_GUEST',
  'WAITING_READY',
  'CAPTURING',
  'COMPOSING',
  'REVIEW',
  'DONE',
  'PAUSED',
  'EXPIRED'
);

create type public.participant_role as enum ('host', 'guest');

create type public.strip_format as enum ('strip', 'story');

-- ---------------------------------------------------------------------------
-- Tema frame. Layout sumber kebenarannya ada di kode (src/domain/themes);
-- tabel ini dipakai sebagai daftar + feature flag (is_active).
-- ---------------------------------------------------------------------------
create table public.themes (
  id          text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  name        text not null check (char_length(name) between 1 and 60),
  layout_json jsonb not null default '{}'::jsonb,
  asset_keys  text[] not null default '{}',
  is_active   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Booth = satu sesi foto berdua.
-- ---------------------------------------------------------------------------
create table public.booths (
  id           uuid primary key default gen_random_uuid(),
  -- 6 karakter dari 32 simbol (tanpa 0/1/I/O agar tidak tertukar saat dibaca).
  code         text not null check (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$'),
  status       public.booth_status not null default 'WAITING_GUEST',
  -- Status sebelum PAUSED, untuk kembali saat peserta tersambung lagi.
  paused_from  public.booth_status,
  paused_at    timestamptz,
  current_shot smallint check (current_shot between 0 and 3),
  retake_shot  smallint check (retake_shot between 0 and 3),
  theme_id     text not null references public.themes (id),
  caption      text check (char_length(caption) <= 40),
  strip_date   date,
  show_mark    boolean not null default true,
  -- Dinaikkan di setiap transisi; dipakai untuk optimistic concurrency.
  version      integer not null default 0 check (version >= 0),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '24 hours',

  constraint booths_expires_after_created check (expires_at > created_at),
  -- PAUSED wajib punya kedua field; status lain wajib mengosongkan keduanya.
  constraint booths_paused_fields check (
    (status = 'PAUSED' and paused_from is not null and paused_at is not null)
    or (status <> 'PAUSED' and paused_from is null and paused_at is null)
  ),
  constraint booths_paused_from_valid check (
    paused_from is null or paused_from in ('WAITING_READY', 'CAPTURING')
  )
);

-- Kode hanya perlu unik selama booth masih aktif. Query pencarian harus mengulang
-- predikat yang sama (status not in ('DONE','EXPIRED')) agar indeks ini terpakai,
-- dan menambah expires_at > now() karena status EXPIRED diset secara lazy.
create unique index booths_code_active_key
  on public.booths (code)
  where status not in ('DONE', 'EXPIRED');

create index booths_expires_at_idx on public.booths (expires_at);
create index booths_theme_id_idx on public.booths (theme_id);

-- ---------------------------------------------------------------------------
-- Peserta. UNIQUE (booth_id, role) + enum dua nilai => maksimal 2 peserta per booth,
-- dijamin oleh database walau ada dua request join bersamaan.
-- ---------------------------------------------------------------------------
create table public.participants (
  id           uuid primary key default gen_random_uuid(),
  booth_id     uuid not null references public.booths (id) on delete cascade,
  role         public.participant_role not null,
  -- SHA-256 dari token acak 256-bit; token asli tidak pernah disimpan.
  token_hash   bytea not null check (octet_length(token_hash) = 32),
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent   text check (char_length(user_agent) <= 512),

  constraint participants_booth_role_key unique (booth_id, role),
  constraint participants_token_hash_key unique (token_hash),
  -- Target composite FK dari photos (memastikan foto milik peserta di booth yang sama).
  constraint participants_id_booth_key unique (id, booth_id)
);

-- ---------------------------------------------------------------------------
-- Foto mentah per jepretan. version naik setiap ulang jepretan.
-- ---------------------------------------------------------------------------
create table public.photos (
  id             uuid primary key default gen_random_uuid(),
  booth_id       uuid not null references public.booths (id) on delete cascade,
  participant_id uuid not null,
  shot_index     smallint not null check (shot_index between 0 and 3),
  version        smallint not null default 1 check (version >= 1),
  storage_key    text not null,
  mime_type      text check (mime_type in ('image/webp', 'image/jpeg')),
  width          integer check (width > 0),
  height         integer check (height > 0),
  size_bytes     integer check (size_bytes between 1 and 5242880),
  captured_at    timestamptz not null default now(),
  uploaded_at    timestamptz,
  created_at     timestamptz not null default now(),

  constraint photos_participant_fk
    foreign key (participant_id, booth_id)
    references public.participants (id, booth_id) on delete cascade,
  constraint photos_participant_shot_version_key unique (participant_id, shot_index, version),
  constraint photos_storage_key_key unique (storage_key)
);

create index photos_booth_id_idx on public.photos (booth_id);
create index photos_created_at_idx on public.photos (created_at);

-- ---------------------------------------------------------------------------
-- Hasil photostrip. Satu komposisi menghasilkan dua baris (strip + story)
-- yang berbagi public_slug, sehingga halaman /s/:slug bisa menampilkan keduanya.
-- Strip hidup 30 hari, lebih lama dari booth (24 jam), jadi booth_id menjadi NULL
-- saat booth dihapus, bukan ikut terhapus.
-- Catatan pembersihan (Fase 2): cascade hanya menghapus BARIS. File di Storage
-- (photos.storage_key, strips.storage_key) harus dihapus dulu lewat Storage API
-- sebelum barisnya dihapus, agar tidak ada file yatim.
-- ---------------------------------------------------------------------------
create table public.strips (
  id          uuid primary key default gen_random_uuid(),
  booth_id    uuid references public.booths (id) on delete set null,
  format      public.strip_format not null,
  storage_key text not null,
  public_slug text not null check (public_slug ~ '^[A-Za-z0-9_-]{22}$'),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days',

  constraint strips_slug_format_key unique (public_slug, format),
  constraint strips_storage_key_key unique (storage_key)
);

create index strips_booth_id_idx on public.strips (booth_id);
create index strips_expires_at_idx on public.strips (expires_at);

-- ---------------------------------------------------------------------------
-- Rate limit berbasis Postgres (tanpa Redis). Fixed window per key.
-- ---------------------------------------------------------------------------
create table public.rate_limit_hits (
  key          text not null check (char_length(key) between 1 and 200),
  window_start timestamptz not null,
  count        integer not null default 0 check (count >= 0),

  primary key (key, window_start)
);

create index rate_limit_hits_window_start_idx on public.rate_limit_hits (window_start);

-- Mengembalikan true bila percobaan masih di bawah batas. Atomik (satu upsert).
create function public.hit_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count  integer;
begin
  if p_window_seconds is null or p_window_seconds <= 0 or p_max is null or p_max <= 0 then
    raise exception 'hit_rate_limit: argumen tidak valid';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limit_hits as r (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;

  return v_count <= p_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS + hak akses: deny-all untuk anon/authenticated.
-- ---------------------------------------------------------------------------
alter table public.themes          enable row level security;
alter table public.booths          enable row level security;
alter table public.participants    enable row level security;
alter table public.photos          enable row level security;
alter table public.strips          enable row level security;
alter table public.rate_limit_hits enable row level security;

revoke all on table
  public.themes,
  public.booths,
  public.participants,
  public.photos,
  public.strips,
  public.rate_limit_hits
from anon, authenticated;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

-- Tabel/fungsi baru di masa depan juga tertutup secara default.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
-- EXECUTE ke PUBLIC adalah default GLOBAL Postgres; revoke per-schema tidak bisa
-- mencabutnya, jadi harus dalam bentuk global untuk role pemilik migrasi.
alter default privileges for role postgres revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Storage: bucket privat. Tanpa policy di storage.objects untuk anon, sehingga
-- akses hanya lewat signed URL yang dibuat server.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booth-media',
  'booth-media',
  false,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Data referensi: tema pertama (K6). Tema lain ditambahkan di Fase 2.
-- Diletakkan di migrasi (bukan seed) agar ikut ke production.
-- ---------------------------------------------------------------------------
insert into public.themes (id, name, is_active)
values ('kangen-berat', 'Kangen Berat', true)
on conflict (id) do nothing;
