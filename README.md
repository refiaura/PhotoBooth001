# Rindu Berat

Photobooth online untuk satu pasangan LDR: dua HP, hitung mundur yang sinkron, satu photostrip bersama.
Ini aplikasi pribadi, bukan layanan publik.

- Spesifikasi produk: [`docs/PRD.md`](docs/PRD.md)
- Rencana implementasi dan keputusan: [`docs/PLAN.md`](docs/PLAN.md)

Stack: Next.js 16 (App Router, TypeScript strict) + Tailwind CSS v4 di Vercel (region `sin1`),
Supabase (Postgres, Realtime, Storage privat), WebRTC P2P, dan `sharp` untuk komposisi.

## Prasyarat

- Node.js 24+ dan pnpm 12 (`corepack enable`)
- Docker Desktop yang sedang berjalan (untuk Supabase lokal)

## Menjalankan di lokal

```bash
pnpm install
pnpm db:start                 # Supabase lokal via Docker + terapkan migrasi
pnpm exec supabase status     # catat API URL, anon key, service_role key, JWT secret
cp .env.example .env.local    # lalu isi nilainya (lihat komentar di file)
pnpm dev                      # http://localhost:3000
```

Isi `.env.local` untuk lokal:

| Variabel                            | Nilai lokal                                                          |
| ----------------------------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`          | `API URL` dari `supabase status` (biasanya `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`     | `ANON_KEY`                                                           |
| `SUPABASE_SERVICE_ROLE_KEY`         | `SERVICE_ROLE_KEY`                                                   |
| `SUPABASE_JWT_SECRET`               | `JWT_SECRET`                                                         |
| `ACCESS_CODE`                       | kode akses buatanmu (≥ 8 karakter)                                   |
| `TURN_KEY_ID`, `TURN_KEY_API_TOKEN` | boleh kosong di lokal (hanya STUN)                                   |
| `CRON_SECRET`                       | string acak ≥ 16 karakter                                            |

> Kamera (`getUserMedia`) hanya jalan di konteks aman. `localhost` dianggap aman, tetapi untuk
> membuka dari HP di jaringan yang sama kamu butuh HTTPS, misalnya `pnpm dev --experimental-https`
> atau deploy preview di Vercel.

### Skrip

| Perintah                | Fungsi                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm lint`             | ESLint                                                                                           |
| `pnpm typecheck`        | Generate tipe route Next.js + `tsc --noEmit`                                                     |
| `pnpm test`             | Unit test (Vitest)                                                                               |
| `pnpm test:integration` | Integration test terhadap Supabase **lokal** (butuh `pnpm db:start`)                             |
| `pnpm test:e2e`         | Playwright (Chromium mobile, kamera palsu). Sekali saja: `pnpm exec playwright install chromium` |
| `pnpm db:reset`         | Hapus database lokal lalu jalankan ulang semua migrasi                                           |
| `pnpm db:types`         | Generate ulang `src/server/database.types.ts` dari skema lokal                                   |
| `pnpm db:stop`          | Matikan Supabase lokal                                                                           |

### Migrasi database

- Migrasi berversi ada di `supabase/migrations/`. Buat yang baru dengan
  `pnpm exec supabase migration new <nama>`, uji dengan `pnpm db:reset`, lalu jalankan `pnpm db:types`.
- Supabase CLI tidak punya _down migration_. Skrip rollback manual disimpan di `supabase/rollbacks/`.
- Semua tabel memakai RLS tanpa policy, dan hak `anon`/`authenticated` dicabut. Akses data hanya
  lewat service role dari API route. Ini diuji di `tests/integration/schema.test.ts`.

## Deploy

### 1. Supabase (production)

1. Buat proyek di [supabase.com](https://supabase.com), pilih region **Southeast Asia (Singapore)**.
2. Terapkan migrasi dari komputer lokal:
   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <project-ref>
   pnpm exec supabase db push
   ```
3. Catat dari dashboard: Project URL, anon key, service_role key, dan JWT secret
   (Project Settings → API / JWT Keys; pakai _legacy JWT secret_).

### 2. TURN (Cloudflare Realtime)

1. Di dashboard Cloudflare: Realtime → TURN Server → buat TURN key.
2. Simpan **Turn Token ID** sebagai `TURN_KEY_ID` dan **API Token** sebagai `TURN_KEY_API_TOKEN`.

### 3. Vercel

1. Import repo ini di Vercel (framework Next.js, terdeteksi otomatis). Region Functions sudah diatur ke
   `sin1` lewat `vercel.json`.
2. Isi semua variabel dari `.env.example` di Settings → Environment Variables (Production, dan Preview bila perlu).
   `CRON_SECRET` dipakai Vercel Cron secara otomatis.
3. Push ke `main` akan deploy ke production. Setiap pull request mendapat preview URL.
4. Cron harian (`/api/cron/daily`, 02.00 WIB) melakukan ping ke database agar proyek Supabase gratis
   tidak dijeda. Pembersihan data kedaluwarsa menyusul di Fase 2.

## Uji di HP

Kamera di HP butuh HTTPS, dan HP tidak bisa menjangkau Supabase lokal. Karena itu uji di HP dilakukan lewat deploy
Vercel (preview URL dari pull request sudah cukup) yang tersambung ke proyek Supabase cloud. Checklist lengkap ada di
[`docs/UJI-MANUAL.md`](docs/UJI-MANUAL.md).

## CI

GitHub Actions (`.github/workflows/ci.yml`) berjalan di setiap pull request dan push ke `main`:

- **checks**: lint, typecheck, unit test
- **integration**: menjalankan Supabase lokal di Docker, memastikan `database.types.ts` sinkron dengan
  migrasi, lalu menjalankan integration test
