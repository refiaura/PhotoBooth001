# Rencana Implementasi: Rindu Berat

Status: **draf, menunggu persetujuan**. Sumber kebenaran: [`docs/PRD.md`](./PRD.md).
Dokumen ini hanya merangkum _bagaimana_ PRD dikerjakan. Bila ada perbedaan, PRD yang berlaku.

---

## 1. Ringkasan arsitektur

```
HP Kamu ──WebRTC P2P (preview saja; STUN + TURN)── HP Pasangan
   │  ▲                                              │  ▲
   │  └── Supabase Realtime (broadcast + presence) ──┘  │
   │       • server → klien: session:state, shot:scheduled, strip:ready
   │       • klien ↔ klien:  rtc:signal (SDP/ICE)
   │
   ├── HTTP ke Next.js API route (Vercel, sin1) — SATU-SATUNYA yang mengubah status
   │       └── Postgres (service role) + broadcast dari server
   │
   └── Upload foto langsung ke Supabase Storage (signed upload URL, bucket privat)
              └── API compose (Node runtime + sharp) → strip PNG + Story JPEG
```

Prinsip:

- **Server authoritative.** Klien hanya mengirim _niat_ lewat HTTP (`ready`, `captured`, `retake`, `config`).
  API route memuat booth, menjalankan fungsi transisi murni, menyimpan hasilnya dengan
  _optimistic concurrency_ (`UPDATE … WHERE status = $lama AND version = $v`), lalu menyiarkan `session:state`.
- **Tanpa timer di server.** Vercel tidak menahan proses, jadi semua batas waktu (PAUSED 2 menit,
  booth 24 jam, presence 20 detik) dihitung secara _lazy_ oleh fungsi murni `reconcile(booth, now)`
  di setiap request, ditambah cron harian sebagai penyapu.
- **Jepretan dijadwalkan per event.** `ready` kedua → server siarkan `shot:scheduled{shotIndex:0, fireAt}`.
  Konfirmasi `captured` terakhir untuk shot _i_ → jadwalkan shot _i+1_. Tidak perlu antrean.

---

## 2. Struktur folder

```
.
├─ .github/workflows/ci.yml        # lint, typecheck, unit, integration (Supabase lokal via Docker)
├─ docs/  PRD.md · PLAN.md
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/                  # SQL berversi (+ file down/rollback di komentar)
│  └─ seed.sql                     # tema aktif
├─ assets/                         # dipakai server (sharp), tidak dikirim ke browser
│  ├─ fonts/                       # Fredoka + font isi (lisensi OFL) untuk teks di strip
│  └─ themes/<themeId>/            # frame SVG/PNG per tema
├─ public/                         # manifest PWA, ikon
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                  # landing: kode akses → "Buat Booth"
│  │  ├─ b/[code]/page.tsx         # ruang booth (tunggu, jepret, review)
│  │  ├─ s/[slug]/page.tsx         # halaman hasil + og:image
│  │  └─ api/
│  │     ├─ time/                  # GET  waktu server (kalibrasi jam)
│  │     ├─ themes/                # GET  tema aktif
│  │     ├─ booths/                # POST buat booth (ACCESS_CODE)
│  │     │  └─ [code]/
│  │     │     ├─ route.ts         # GET info publik · DELETE hapus booth + foto
│  │     │     ├─ join/            # POST tamu masuk / rejoin
│  │     │     ├─ session/         # GET snapshot + token realtime + kredensial TURN
│  │     │     ├─ heartbeat/       # POST perbarui last_seen_at / laporkan pasangan hilang
│  │     │     ├─ ready/           # POST tombol "Siap!"
│  │     │     ├─ shots/captured/  # POST konfirmasi foto lokal sudah diambil
│  │     │     ├─ shots/retake/    # POST ulang satu jepretan (dari REVIEW)
│  │     │     ├─ config/          # POST tema, caption, tanggal, tanda (host saja)
│  │     │     ├─ photos/upload-url/
│  │     │     ├─ photos/          # POST konfirmasi unggahan (+ validasi isi file)
│  │     │     └─ strips/          # POST mulai komposisi (idempoten)
│  │     ├─ strips/[slug]/         # GET data + signed URL unduhan
│  │     └─ cron/daily/            # cleanup + ping Supabase (CRON_SECRET)
│  ├─ domain/                      # MURNI, tanpa I/O — semua di-unit-test
│  │  ├─ session-machine.ts        # status, event, transition(), reconcile()
│  │  ├─ clock-sync.ts             # offset dari 5 ping, median
│  │  ├─ booth-code.ts             # kode 6 karakter (alfabet 32 simbol)
│  │  ├─ themes/                   # definisi tema + hitung layout slot
│  │  └─ pose-hints.ts
│  ├─ server/                      # import "server-only"
│  │  ├─ env.ts                    # validasi env (zod), gagal cepat
│  │  ├─ supabase-admin.ts         # klien service role
│  │  ├─ repo/                     # akses data booths/participants/photos/strips
│  │  ├─ auth.ts                   # hash token, Bearer, perbandingan ACCESS_CODE timing-safe
│  │  ├─ rate-limit.ts             # berbasis Postgres (tanpa Redis)
│  │  ├─ broadcast.ts              # kirim event Realtime dari server
│  │  ├─ turn.ts                   # kredensial TURN per sesi
│  │  └─ compose/                  # sharp: crop, tempel, teks, ekspor
│  ├─ client/                      # khusus browser
│  │  ├─ camera.ts · capture.ts · upload.ts (retry 1-2-4 dtk)
│  │  ├─ rtc.ts · realtime.ts · clock.ts · in-app-browser.ts
│  ├─ components/                  # UI (Tailwind)
│  └─ i18n/                        # kamus id (+ en di Fase 2)
├─ tests/
│  ├─ unit/ · integration/ · e2e/
├─ .env.example
├─ next.config.ts                  # header keamanan
└─ vercel.json                     # regions ["sin1"], crons
```

---

## 3. Model data (Fase 0)

Mengikuti PRD, plus satu tabel bantu. Semua tabel **RLS aktif tanpa policy untuk anon** (deny-all);
seluruh akses data lewat service role dari server.

| Tabel             | Kolom penting / constraint                                                                                                                                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `booths`          | `id uuid`, `code char(6)` unik parsial (selama status aktif), `status` (enum 8 status), `paused_from`, `paused_at`, `current_shot`, `retake_shot`, `theme_id`, `caption varchar(40)`, `strip_date`, `show_mark`, `version int` (concurrency), `created_at`, `expires_at`; indeks `code`, `expires_at` |
| `participants`    | `booth_id` FK cascade, `role` (`host`/`guest`), **`UNIQUE(booth_id, role)` ⇒ maksimal 2 peserta dijamin DB**, `token_hash` (SHA-256 dari token 256-bit), `last_seen_at`, `user_agent`                                                                                                                 |
| `photos`          | `UNIQUE(booth_id, participant_id, shot_index, version)`, `shot_index 0–3` (CHECK), `storage_key`, `width`, `height`, `captured_at`, `uploaded_at`                                                                                                                                                     |
| `strips`          | `format` (`strip`/`story`), `storage_key`, `public_slug` 22 karakter unik, `expires_at` (+30 hari)                                                                                                                                                                                                    |
| `themes`          | `id`, `name`, `layout_json`, `asset_keys`, `is_active`                                                                                                                                                                                                                                                |
| `rate_limit_hits` | `key`, `window_start`, `count` + fungsi SQL atomik `hit_rate_limit()`                                                                                                                                                                                                                                 |

Bucket Storage `booth-media` privat, batas ukuran 5 MB, MIME `image/webp|image/jpeg|image/png`.

---

## 4. State machine (rancangan untuk disetujui)

```
WAITING_GUEST ──tamu join──▶ WAITING_READY ──dua-duanya siap──▶ CAPTURING
                                                                  │ shot 0..3 (fireAt)
                                                                  ▼ 8 foto ter-captured
REVIEW ◀──strip jadi── COMPOSING ◀─────────────────────────────────┘
  │  ├──retake(shotIndex)──▶ CAPTURING (satu shot) ──▶ COMPOSING
  │  └──selesai──▶ DONE
WAITING_READY / CAPTURING ──presence hilang > 20 dtk──▶ PAUSED ──kembali──▶ status sebelumnya
semua kecuali DONE ──now ≥ expires_at (24 jam)──▶ EXPIRED
```

Diimplementasi sebagai `transition(state, event, now) → { state, effects[] }` murni
(efek misalnya `schedule_shot`, `start_compose`, `broadcast`), sehingga bisa di-unit-test penuh.

---

## 5. Urutan pekerjaan per fase

Setiap fase diakhiri: `pnpm lint && pnpm typecheck && pnpm test` (+ e2e bila relevan), laporan,
cara uji di HP, lalu **berhenti**. Commit kecil per langkah.

### Fase 0 — Setup

1. `create-next-app` (App Router, TS strict, Tailwind v4, ESLint), pnpm, Prettier, alias `@/`.
2. Vitest (unit + integration) dan Playwright (konfigurasi saja, dengan flag kamera palsu).
3. Supabase CLI: `supabase init`, migrasi skema + RLS + bucket + fungsi rate limit, `seed.sql`.
4. `src/server/env.ts` (validasi zod) + `.env.example` tanpa nilai asli.
5. Klien Supabase: admin (server-only) dan browser (anon, hanya untuk Realtime).
6. `vercel.json` (`sin1`, cron harian), CI GitHub Actions (lint, typecheck, unit, integration dengan `supabase start`).
7. README: jalankan lokal (Docker + Supabase lokal), buat proyek Supabase/Vercel, set env, deploy.
8. Tes asap: migrasi berjalan, tes RLS memastikan anon **tidak** bisa membaca/menulis tabel.

### Fase 1 — Prototipe (alur berdua, 1 tema, unduh PNG)

1. Domain murni + unit test dulu (TDD): `session-machine`, `clock-sync`, `booth-code`, layout tema.
2. API: `time`, `booths` (ACCESS_CODE + rate limit), `booths/[code]` GET, `join`/rejoin, `session`,
   `heartbeat`, `ready`, `shots/captured`, `photos/upload-url`, `photos`, `strips`, `strips/[slug]` — dengan integration test.
3. Realtime: kanal per booth, server broadcast `session:state` / `shot:scheduled` / `strip:ready`, presence.
4. Klien: kalibrasi jam (5 ping, median), kamera setelah tombol ditekan, preview sendiri (mirror) +
   preview pasangan via WebRTC (STUN + TURN), hitung mundur dari `fireAt - offset`.
5. Jepret lokal (ImageCapture → fallback canvas, tanpa mirror) → WebP 0,85 / JPEG → unggah dengan retry 3x.
6. Komposisi `sharp`: 1 tema, strip PNG 600×1800 → REVIEW → unduh PNG. Kamera dimatikan saat selesai.
7. Halaman UI dasar bertema pastel (landing, booth, hasil), mobile-first 360 px.
8. E2E Playwright: dua konteks Chromium dengan kamera palsu menjalani alur lengkap.
9. Checklist uji manual dua HP nyata (termasuk link dari WhatsApp dan jaringan seluler).

### Fase 2 — Seluruh P0

1. 6 tema frame + pemilih tema (host), caption ≤ 40 karakter, tanggal, tanda opsional; versi Story 1080×1920.
2. Ulang satu jepretan dari REVIEW; pose hint acak; hitung mundur dengan bunyi + getar.
3. PAUSED (presence 20 dtk, tunggu 2 menit, batalkan jadwal), rejoin dengan token; fallback preview foto statis bila WebRTC gagal.
4. Deteksi in-app browser (WhatsApp/IG/TikTok/Line) → layar "Buka di Chrome/Safari" (salin link + intent Android); panduan izin kamera per browser.
5. Web Share API (HP) / salin link (desktop), halaman `/s/[slug]` dengan `og:image`, tombol "Hapus booth dan semua foto".
6. Cron harian: hapus foto mentah > 7 hari, strip > 30 hari, booth kedaluwarsa; ping Supabase.
   File Storage dihapus lebih dulu lewat Storage API, baru barisnya (cascade hanya menghapus baris).
   Booth dihapus setelah fotonya kedaluwarsa (7 hari). Strip tetap hidup karena `booth_id` menjadi NULL.
7. Header keamanan (CSP, HSTS, `Permissions-Policy: camera=(self)`, nosniff), PWA manifest, teks UI id + en, mode gelap, audit kontras/axe.
8. E2E diperluas (retake, PAUSED/rejoin, tamu ketiga ditolak), checklist uji manual dua HP.

### Fase 3 — P1

Hanya jika diminta.

---

## 6. Konflik dan celah yang saya temukan

1. **Lokasi PRD.** `docs/PRD.md` belum ada di repo. File aslinya ada tanpa di-commit di checkout utama
   dengan nama `docs/PRD — Photobooth Online untuk Pasangan LDR.md`. Saya menyalinnya apa adanya ke `docs/PRD.md` di branch ini.
2. **Diagram PRD tidak terbaca.** Tiga diagram tertanam (alur 7 langkah, arsitektur, state machine 8 status)
   hanya muncul sebagai placeholder `[embedded content]`. State machine di §4 adalah rekonstruksi saya dari teks PRD.
3. **"Event klien → server" lewat Realtime.** Tabel event PRD menulis `booth:join`, `time:ping`, `participant:ready`, dll.
   sebagai event kanal Realtime. Broadcast Supabase tidak menjalankan logika server, jadi semua niat klien
   dikirim lewat **HTTP API route**. Realtime hanya dipakai untuk siaran server → klien, `rtc:signal`, dan presence.
   Isi payload tetap sama dengan PRD. Ini sejalan dengan prompt ("status hanya diubah oleh API route").
4. **Signed upload URL 5 menit.** Sepengetahuan saya, `createSignedUploadUrl` Supabase berlaku tetap 2 jam dan masa berlakunya
   tidak bisa diatur. Mitigasinya: satu URL hanya untuk satu path acak, tanpa upsert, ditambah validasi isi file saat konfirmasi.
   Akan saya verifikasi di Fase 1.
5. **Daftar endpoint PRD belum lengkap** untuk alur server-authoritative. Saya menambah `/api/time`, `session`, `heartbeat`, `ready`,
   `shots/captured`, `shots/retake`, `config`, dan `cron/daily`.
6. **Vercel Cron di paket Hobby** hanya bisa berjalan sekali sehari. Karena itu batas waktu PAUSED dan booth dihitung secara lazy (§1).
   Satu cron harian sudah cukup untuk pembersihan dan ping Supabase.
7. **E2E di Firefox dan WebKit** (PRD) tidak sejalan dengan flag kamera palsu dari prompt, yang hanya berlaku di Chromium.
   Usulan saya: E2E otomatis di Chromium, Firefox opsional lewat preferensi `media.navigator.streams.fake`, dan Safari iOS diuji manual.
8. **Hal P0 di PRD yang tidak disebut di daftar fase prompt** saya masukkan ke Fase 2 karena termasuk "seluruh P0":
   pose hint, bunyi/getar, panduan izin kamera, hapus booth, i18n id+en, PWA manifest, dan `og:image`.

---

## 7. Keputusan (K1–K10 disetujui 16 Okt 2026 sesuai usulan)

| #   | Pertanyaan                                                                     | Usulan saya                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | **Otorisasi kanal Realtime.** Peserta tidak punya akun Supabase.               | Kanal privat dengan JWT pendek yang ditandatangani server (klaim `booth_id`, `participant_id`) dan policy RLS di `realtime.messages`. Butuh env tambahan `SUPABASE_JWT_SECRET`. Alternatif yang lebih sederhana tapi lebih lemah: nama kanal rahasia acak. |
| K2  | **Penyedia TURN**                                                              | Cloudflare Realtime TURN: kredensial dibuat via API dan berumur pendek, kuota gratis besar. Env: `TURN_KEY_ID` dan `TURN_KEY_API_TOKEN`. Alternatif: Metered.ca.                                                                                           |
| K3  | **Setelah PAUSED lewat 2 menit** (PRD tidak menyebut)                          | Booth → `EXPIRED` dengan layar ramah "Buat booth baru". Alternatif: tetap PAUSED sampai 24 jam.                                                                                                                                                            |
| K4  | **Jalur retake**                                                               | REVIEW → CAPTURING (hanya `retake_shot`, kedua peserta jepret ulang shot itu) → COMPOSING. Cocokkan dengan diagram aslinya bila ada.                                                                                                                       |
| K5  | **PAUSED berlaku di status mana**                                              | Hanya WAITING_READY dan CAPTURING. Di COMPOSING dan REVIEW, server tetap bekerja walau satu pihak terputus.                                                                                                                                                |
| K6  | **Tema untuk Fase 1** (pertanyaan terbuka PRD)                                 | "Kangen Berat" (amplop + perangko), aset SVG saya gambar sendiri secara sederhana.                                                                                                                                                                         |
| K7  | **Sumber data tema**                                                           | Definisi layout di kode (bertipe, di-unit-test). Tabel `themes` di-seed untuk `is_active` sebagai feature flag. Menambah tema tetap perlu deploy, dan itu wajar untuk skala pribadi.                                                                       |
| K8  | **Analitik dan observability** (PRD menyebut PostHog dan Sentry, prompt tidak) | Fase 2: event dicatat ke tabel Postgres `events` + log Vercel. PostHog/Sentry ditunda kecuali diminta.                                                                                                                                                     |
| K9  | **Lingkungan**                                                                 | `development` = Supabase lokal (Docker sudah terpasang). `production` = 1 proyek Supabase. Staging (proyek Supabase ke-2) opsional.                                                                                                                        |
| K10 | **Tooling**                                                                    | pnpm, Node 24, Next.js stabil terbaru, Tailwind v4, Vitest, Playwright, zod.                                                                                                                                                                               |
| K11 | **Pertanyaan terbuka PRD**                                                     | HP/browser kalian berdua (terutama: adakah iPhone?) dan nama domain. Belum memblokir Fase 0.                                                                                                                                                               |

---

## 8. Risiko teknis yang akan di-_spike_ lebih awal

- **Teks di `sharp` pada Vercel**: tidak ada font sistem, jadi font di-bundle dan dirender lewat SVG/`text` dengan `fontfile`. Dicoba di Fase 1 langkah 6.
- **Selisih hitung mundur ≤ 300 ms**: diukur di E2E (log `fireAt` vs waktu jepret aktual di dua konteks) dan saat uji manual.
- **Safari iOS**: `playsinline` + `muted`, ImageCapture tidak tersedia (jalur canvas), WebP encode via canvas mungkin tidak didukung (fallback JPEG).

## 9. Catatan implementasi Fase 1

Keputusan dan penyimpangan yang muncul saat implementasi:

- **Snapshot sesi di satu baris `booths`.** Status siap (`ready_host`/`ready_guest`) dan progres jepretan
  (`shots` jsonb) disimpan bersama status, lalu diubah dengan compare-and-swap pada `version`. Rancangan awal
  memakai `participants.ready` dan status foto dari tabel `photos`. Itu bisa membuat sesi macet saat dua peserta
  menjepret bersamaan, karena PostgREST tidak punya transaksi lintas tabel. Tabel `photos` tetap menyimpan metadata file.
- **`shot:captured` digabung dengan `POST /photos/upload-url`.** Permintaan signed upload URL sekaligus menandai
  "sudah dijepret", jadi satu round-trip di momen kritis. Endpoint `shots/captured` di §2 tidak dibuat.
- **Endpoint `heartbeat`, `config`, `shots/retake` belum ada.** Semuanya untuk Fase 2 (PAUSED, tema/teks, ulang
  jepretan). State machine murni sudah mendukung PAUSED, retake, dan kedaluwarsa, lengkap dengan unit test.
- **Strip tanpa teks.** Hiasan tema dibuat dari SVG murni tanpa font. Caption, tanggal, dan tanda menyusul di Fase 2
  bersama font TTF yang di-bundle (rencana: paket npm `@expo-google-fonts/fredoka`).
- **ImageCapture tidak dipakai.** Foto diambil dari frame `<video>` kamera lokal lewat canvas pada resolusi penuh
  stream (diminta ideal 1920×1080). Latensi `takePhoto()` tidak menentu dan bisa merusak target sinkron ≤ 300 ms.
- **WebRTC satu arah.** Host selalu membuat offer, tamu menjawab dan mengirim `hello` saat siap. Ini lebih tahan
  terhadap urutan masuk dan refresh dibanding perfect negotiation dua arah.
- **Signed upload URL Supabase berlaku 2 jam** (tidak bisa diatur menjadi 5 menit seperti di PRD). Mitigasinya:
  satu URL untuk satu path acak dan isi file divalidasi saat konfirmasi.
- **`next/font`:** Fredoka dipakai sebagai variable font. Mengisi `weight: [...]` memicu bug build Turbopack di Next 16.4.
- **Hasil E2E:** selisih momen jepret antarperangkat terukur 5–42 ms (target ≤ 300 ms), dengan dua konteks
  Chromium dan kamera palsu di satu mesin. Angka di jaringan nyata perlu diukur lewat uji manual.
