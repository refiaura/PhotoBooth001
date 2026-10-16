# PRD — Photobooth Online untuk Pasangan LDR

Oct 16, 2026 · @Refi Refi

## Ringkasan Produk

**R****indu**** ****B****erat** (nama kerja) adalah photobooth online berbasis web tempat dua orang di kota atau negara berbeda berfoto bersama secara real-time dan langsung mendapat satu photostrip gabungan. Aplikasi ini dibuat untuk dipakai pribadi oleh satu pasangan, dan fokus pada satu hal: membuat sesi foto berdua yang terasa "seperti di photobox mall", walau terpisah jarak.

**Masalah.** Pasangan LDR sering video call, tapi hasil kenangannya hanya screenshot yang berantakan: wajah terpotong, UI aplikasi ikut terekam, dan tidak bisa dicetak. Photobox fisik yang sedang tren justru tidak bisa mereka pakai berdua.

**Solusi.** Satu orang membuat "booth", membagikan link ke pasangannya, lalu keduanya berpose dengan hitung mundur yang sinkron. Sistem menggabungkan kedua kamera ke dalam frame bertema lucu dan menghasilkan photostrip siap unduh, simpan, atau cetak.

## Tujuan dan Non-Goals

**Tujuan v1**

1. Sesi foto berdua selalu berhasil dari HP kamu dan HP pasangan, baik lewat seluler maupun Wi-Fi.
2. Dari link dibuka sampai photostrip jadi, kurang dari 3 menit.
3. Hasilnya cukup bagus untuk disimpan, dicetak, dan diunggah ke Story tanpa perlu diedit lagi.
4. Biaya operasional nol rupiah di luar domain, dengan perawatan seminimal mungkin.

**Non-goals v1**

- **Pengguna publik.** Tidak ada pendaftaran, halaman pemasaran, atau fitur pertumbuhan; aplikasi hanya untuk kalian berdua.
- **Video call penuh.** WhatsApp atau Zoom sudah cukup; aplikasi hanya butuh preview kamera selama sesi.
- **Aplikasi mobile native.** Web responsif yang bisa ditambahkan ke layar utama sudah cukup.
- **Lebih dari dua orang per booth.** Dirancang khusus untuk pasangan.
- **Editor foto lengkap.** Cukup frame, teks, dan stiker bawaan.
- **Monetisasi.** Tidak ada fitur berbayar, iklan, atau tema premium.

## Pengguna

Penggunanya hanya dua orang: kamu dan pasanganmu, yang menjalani hubungan jarak jauh.

| Peran | Situasi | Kebutuhan utama |
| --- | --- | --- |
| **Kamu** (pembuat booth, pemilik aplikasi) | Memegang kode akses, membuat booth, memilih tema | Membuat sesi dalam hitungan detik untuk momen spesial maupun iseng sehari-hari |
| **Pasangan** (tamu booth) | Diajak lewat link, biasanya dari WhatsApp | Masuk dengan satu klik dari HP, tanpa install atau daftar akun |

Jika kalian beda zona waktu atau jadwal sering tidak cocok, mode foto bergantian (P1) menjadi cadangan.

## User Stories

**Pembuat booth**

1. Sebagai pembuat booth, saya ingin membuat ruang foto dan membagikan link ke pasangan agar kami bisa berfoto bersama tanpa aplikasi tambahan.
2. Sebagai pembuat booth, saya ingin memilih tema frame sebelum mulai agar hasilnya sesuai suasana (anniversary, kangen, ulang tahun).
3. Sebagai pembuat booth, saya ingin menambahkan teks pendek dan tanggal di photostrip agar kenangannya punya cerita.

**Tamu booth (pasangan)**

4. Sebagai tamu, saya ingin masuk ke booth hanya dengan membuka link dan mengizinkan kamera agar tidak perlu daftar akun.
5. Sebagai tamu, saya ingin melihat preview wajah pasangan di layar agar bisa menyamakan pose (mis. "pose love berdua").

**Keduanya**

6. Sebagai pasangan, kami ingin hitung mundur berjalan bersamaan di kedua layar agar foto terasa diambil di momen yang sama.
7. Sebagai pasangan, kami ingin mengulang satu jepretan yang jelek tanpa mengulang seluruh sesi.
8. Sebagai pasangan, kami ingin mengunduh photostrip dan membagikannya ke Instagram/WhatsApp agar bisa dipamerkan.
9. Sebagai pasangan, kami ingin galeri "kenangan kita" yang menyimpan semua photostrip agar bisa dilihat lagi nanti.

**Kasus tepi**

10. Sebagai pengguna dengan koneksi lambat, saya ingin foto saya tetap diambil dalam kualitas penuh di perangkat sendiri walau preview pasangan patah-patah.
11. Sebagai pengguna yang kameranya ditolak atau tidak tersedia, saya ingin pesan jelas cara mengaktifkannya, atau opsi unggah foto sebagai gantinya.
12. Sebagai pengguna yang pasangannya terputus di tengah sesi, saya ingin sesi tertahan dan bisa dilanjutkan saat ia masuk kembali.

## Alur Pengguna Utama

Satu sesi lengkap berjalan dalam tujuh langkah, dan hanya pembuat booth yang perlu melakukan sesuatu sebelum pasangannya masuk.

&#91;embedded content: alur sesi photobooth · 7 langkah, 1 keputusan\]

Jika hasil belum memuaskan, pasangan cukup mengulang satu jepretan tertentu tanpa mengulang seluruh sesi.

## Kebutuhan Fungsional

### P0 — wajib ada saat rilis

**F1. Buat booth dan undang pasangan**

- [ ] Pembuat menekan "Buat Booth" dan langsung mendapat link unik + kode 6 karakter, tanpa wajib login.
- [ ] Link bisa disalin dan dibagikan langsung ke WhatsApp dari tombol share.
- [ ] Link kedaluwarsa setelah 24 jam atau setelah sesi selesai; link kedaluwarsa menampilkan halaman ramah, bukan error.
- [ ] Booth hanya menerima 2 peserta; orang ketiga melihat pesan "Booth ini sudah penuh".

**F2. Ruang tunggu dan izin kamera**

- [ ] Setiap peserta melihat preview kamera sendiri dan status pasangan ("Menunggu Raka..." / "Raka sudah masuk").
- [ ] Jika izin kamera ditolak, tampil panduan per browser (Chrome, Safari iOS) untuk mengaktifkannya.
- [ ] Tombol "Siap!" di kedua sisi; sesi baru bisa dimulai bila keduanya siap.

**F3. Sesi foto sinkron**

- [ ] Satu sesi = 4 jepretan; hitung mundur 3-2-1 tampil di kedua layar dengan selisih maksimal 300 ms.
- [ ] Foto diambil dari kamera lokal masing-masing dalam resolusi penuh, lalu diunggah; bukan screenshot stream video.
- [ ] Selama hitung mundur, preview pasangan tampil berdampingan agar bisa menyamakan pose.
- [ ] Ada saran pose lucu acak sebelum tiap jepretan (mis. "pose finger heart", "pura-pura cubit pipi").

**F4. Komposisi photostrip**

- [ ] Sistem menempatkan foto kedua orang berdampingan per baris dalam frame tema yang dipilih.
- [ ] Pengguna bisa memilih minimal 6 tema frame dan menambahkan teks maksimal 40 karakter + tanggal.
- [ ] Pengguna bisa mengulang satu jepretan tertentu sebelum menyimpan.
- [ ] Hasil identik di kedua perangkat.

**F5. Unduh dan bagikan**

- [ ] Unduh dalam format PNG (strip vertikal 2×6 inci) dan versi 9:16 untuk Story.
- [ ] Tombol bagikan memakai Web Share API di HP; di desktop, tombol salin link hasil.
- [ ] Tanda kecil opsional di bagian bawah strip (mis. inisial kalian dan tanggal), bisa dimatikan.

**F6. Penanganan koneksi**

- [ ] Jika satu peserta terputus, sesi berhenti dan menunggu hingga 2 menit untuk tersambung kembali.
- [ ] Jika unggahan foto gagal, sistem mencoba ulang otomatis hingga 3 kali sebelum menampilkan pesan.

### P1 — menyusul cepat setelah rilis

- **Galeri "Kenangan Kita"**: semua photostrip kalian tersimpan dalam satu galeri pribadi yang dilindungi kode akses, tanpa perlu login.
- **Stiker dan filter**: stiker yang bisa ditempel setelah sesi, filter warna (vintage, pastel, hitam-putih).
- **Mode bergantian (async)**: satu orang berfoto lebih dulu, pasangannya melengkapi kemudian dalam 48 jam; untuk pasangan beda zona waktu.
- **Countdown hari ketemu**: hitung mundur menuju tanggal ketemu yang bisa dicetak di strip.
- **Fallback unggah foto**: bila kamera tidak tersedia, peserta bisa mengunggah 4 foto dari galeri.

### P2 — pertimbangan masa depan

- GIF/boomerang singkat dari tiap jepretan.
- Ekspor siap cetak untuk dibawa ke tempat cetak foto terdekat.
- Tema custom buatan sendiri, misalnya memakai foto kota kalian atau tanggal jadian.
- Kalender kenangan: photostrip dikelompokkan per bulan.

## Tema dan Arahan Visual

Nuansanya manis dan jenaka, seperti surat cinta yang dihias stiker: warna pastel, bentuk membulat, dan teks yang menggoda ringan. Kesan yang dituju: "jauh di mata, dekat di frame".

**Prinsip visual**

- Palet pastel: pink stroberi, biru langit, krem susu, aksen merah hati. Mode gelap memakai latar ungu malam dengan bintang kecil.
- Tipografi bulat dan hangat (mis. Fredoka atau Baloo) untuk judul, sans-serif yang mudah dibaca untuk teks isi.
- Maskot opsional: dua karakter kecil (mis. awan dan bulan) yang berada di dua sisi layar dan "bertemu" saat sesi selesai.
- Animasi mikro: hati yang berdenyut saat pasangan masuk, confetti saat photostrip jadi, garis putus-putus seperti rute pesawat di antara dua foto.

**Contoh tema frame v1**

| Tema | Ide visual | Momen |
| --- | --- | --- |
| Kangen Berat | Dua amplop surat dengan perangko kota masing-masing | Sehari-hari |
| Beda Langit | Kiri siang (matahari), kanan malam (bulan) | Pasangan beda zona waktu |
| Paket Rindu | Kardus paket dengan label "Fragile: isi hati" | Kejutan |
| Tiket Ketemu | Boarding pass dengan nama kedua kota | Menjelang ketemu |
| Anniversary Manis | Pita, kue, dan lilin angka bulan jadian | Anniversary |
| Retro Photobox | Strip hitam-putih klasik ala photobox mall | Netral |

**Copywriting** memakai bahasa santai dan sedikit gombal, misalnya "Pasanganmu sudah masuk, rapikan poni dulu!" atau "3... 2... 1... senyum yang lebar, biar rindunya kelihatan." Semua teks UI tersedia dalam Bahasa Indonesia dan Inggris.

## Kebutuhan Non-Fungsional dan Teknis

| Aspek | Kebutuhan |
| --- | --- |
| Kompatibilitas | Chrome, Edge, Firefox (2 versi terakhir) dan Safari iOS 16+; mobile-first, layar 360 px ke atas |
| Performa | Halaman booth siap dalam 3 detik di 4G; photostrip jadi dalam 5 detik setelah jepretan terakhir |
| Real-time | WebRTC peer-to-peer untuk preview, dengan TURN server sebagai cadangan; sinyal hitung mundur lewat Supabase Realtime |
| Kualitas foto | Diambil lokal via `getUserMedia` minimal 1280×720, dikompresi sebelum unggah |
| Komposisi | Penggabungan di server agar hasil identik di kedua perangkat; template frame berupa aset SVG/PNG |
| Privasi | Stream video tidak direkam; foto mentah sesi tanpa akun dihapus otomatis setelah 7 hari; link hasil tidak bisa ditebak (ID acak) |
| Keamanan | Hanya HTTPS; batas 2 peserta per booth; rate limit pembuatan booth per IP |
| Aksesibilitas | Kontras teks memenuhi WCAG AA; hitung mundur juga berupa bunyi dan getar; semua tombol bisa dipakai lewat keyboard |
| Analitik | Event dicatat: booth\_dibuat, tamu\_masuk, sesi\_mulai, sesi\_selesai, strip\_diunduh, strip\_dibagikan |

## Spesifikasi Engineering

Bagian ini menerjemahkan kebutuhan produk menjadi rancangan teknis awal. Pilihan teknologi berstatus **usulan** dan difinalkan bersama tim engineering sebelum sprint pertama.

### Arsitektur Sistem

Preview video mengalir langsung antara dua browser, sementara server hanya mengatur sesi, menyimpan foto, dan menyusun photostrip.

&#91;embedded content: arsitektur sistem · 3 lapisan\]

Foto diunggah langsung dari browser ke Supabase Storage lewat signed URL, sehingga Vercel Functions tidak menanggung beban file besar.

### Stack Teknologi (usulan, skala pribadi)

Aplikasi dipakai pribadi oleh satu pasangan, jadi stack dipilih agar bisa dideploy di Vercel tanpa mengurus server sendiri dan sebisa mungkin memakai paket gratis. Satu-satunya biaya rutin yang pasti adalah domain. Batas paket gratis tiap layanan bisa berubah, jadi cek dokumentasinya sebelum mulai.

| Lapisan | Usulan | Alasan |
| --- | --- | --- |
| Hosting, domain, HTTPS | Vercel (paket Hobby) | Paket Hobby memang untuk pemakaian pribadi non-komersial; domain kustom dan HTTPS otomatis |
| Frontend dan API | Next.js (React + TypeScript) di Vercel, Functions di region Singapura (`sin1`) | Halaman, API route (buat booth, jadwal jepret, token TURN) dalam satu proyek |
| Kamera | `getUserMedia`, `<canvas>`, `ImageCapture` bila tersedia | Native browser, tanpa plugin |
| Preview video berdua | WebRTC peer-to-peer (`RTCPeerConnection`) | Hanya 2 peserta, tidak butuh media server |
| Real-time (sinyal, jadwal, kehadiran) | Supabase Realtime (broadcast + presence) | Vercel Functions tidak bisa menahan koneksi WebSocket; Supabase menggantikan server WebSocket dan Redis sekaligus |
| Database | Supabase Postgres | Satu penyedia dengan realtime dan storage, ada paket gratis |
| Penyimpanan foto | Supabase Storage dengan signed URL | Unggah langsung dari browser, akses dibatasi |
| Komposisi photostrip | Vercel Function dengan `sharp`, dipanggil saat 8 foto lengkap | Volume kecil, tidak perlu antrean |
| NAT traversal | STUN publik + layanan TURN terkelola (paket gratis) | Jaringan seluler banyak di balik CGNAT; tidak bisa dijalankan di Vercel |
| Pembersihan data | Vercel Cron harian | Menghapus foto dan booth yang kedaluwarsa |
| Akses | Kode akses pribadi di environment variable Vercel | Hanya kamu yang bisa membuat booth; pasangan masuk lewat link undangan, tanpa akun |
| Monitoring | Vercel Analytics + log Vercel; Sentry (opsional, paket gratis) | Cukup untuk melacak error di skala pribadi |

Catatan: proyek Supabase gratis bisa dijeda otomatis bila lama tidak dipakai. Buka dashboard sesekali atau siapkan ping berkala agar booth tetap siap saat dibutuhkan.

### Status Sesi (State Machine)

Setiap booth selalu berada di tepat satu dari delapan status, disimpan di Supabase Postgres dan hanya diubah oleh API route.

&#91;embedded content: state machine sesi · 8 status\]

Dari `PAUSED`, sesi kembali ke status sebelum terputus. Status apa pun yang belum `DONE` otomatis menjadi `EXPIRED` 24 jam setelah booth dibuat. Ulang jepretan dari `REVIEW` hanya mengulang satu `shotIndex`, lalu kembali ke `COMPOSING`.

### Protokol Real-time dan Sinkronisasi

Server adalah satu-satunya sumber kebenaran status sesi; klien hanya mengirim niat (siap, ulang) dan menjalankan jadwal dari server.

**Sinkronisasi hitung mundur**

1. Saat masuk booth, klien melakukan 5 kali `time:ping` dan menghitung selisih jam: `offset = serverTime - (t0 + t1) / 2`, lalu memakai nilai median.
2. Server tidak mengirim "jepret sekarang", melainkan `shot:scheduled` berisi `fireAt` (timestamp server, 3.500 ms ke depan).
3. Klien menampilkan hitung mundur berdasarkan `fireAt - offset` dan mengambil foto tepat pada waktu itu, sehingga perbedaan latensi jaringan tidak memengaruhi momen jepret.
4. Klien mengirim `shot:captured` setelah foto berhasil diambil secara lokal; unggahan berjalan terpisah di latar belakang.

**Daftar event real-time (channel Supabase Realtime)**

| Arah | Event | Payload utama | Keterangan |
| --- | --- | --- | --- |
| Klien → server | `booth:join` | `boothCode`, `participantToken?` | Token dipakai untuk bergabung kembali setelah terputus |
| Klien → server | `time:ping` | `t0` | Kalibrasi jam |
| Klien → server | `participant:ready` | `ready: boolean` | Tombol "Siap!" |
| Klien → server | `shot:captured` | `shotIndex`, `photoId` | Konfirmasi foto lokal sudah diambil |
| Klien → server | `shot:retake` | `shotIndex` | Ulang satu jepretan |
| Klien → server | `strip:configure` | `themeId`, `caption`, `date` | Hanya pembuat booth |
| Server → klien | `session:state` | snapshot status lengkap | Dikirim saat join, rejoin, dan setiap perubahan status |
| Server → klien | `shot:scheduled` | `shotIndex`, `fireAt`, `poseHint` | Jadwal jepretan berikutnya |
| Server → klien | `strip:ready` | `stripId`, `urls` | Komposisi selesai |
| Dua arah | `rtc:signal` | SDP offer/answer, ICE candidate | Diteruskan apa adanya ke pasangan |

**Koneksi dan reconnect**

- Kehadiran peserta dipantau lewat presence Supabase Realtime; peserta dianggap terputus bila presence-nya hilang lebih dari 20 detik.
- Saat terputus, sesi pindah ke status `PAUSED` dan menunggu maksimal 2 menit; jepretan yang terjadwal dibatalkan.
- `participantToken` disimpan di perangkat sehingga refresh halaman tidak dianggap peserta baru.
- Kegagalan WebRTC tidak menghentikan sesi: preview pasangan diganti foto statis terakhir, karena foto tetap diambil dari kamera lokal.

### Model Data dan API

Lima entitas inti cukup untuk P0; tabel `users` dan `couples` baru ditambahkan di P1 untuk galeri.

| Entitas | Kolom utama | Catatan |
| --- | --- | --- |
| `booths` | `id` (UUID), `code` (6 karakter), `status`, `theme_id`, `caption`, `strip_date`, `created_at`, `expires_at` | `code` unik selama booth aktif; indeks pada `code` dan `expires_at` |
| `participants` | `id`, `booth_id`, `role` (`host`/`guest`), `token_hash`, `joined_at`, `last_seen_at`, `user_agent` | Maksimal 2 baris per booth, dijaga constraint di database |
| `photos` | `id`, `booth_id`, `participant_id`, `shot_index` (0–3), `version`, `storage_key`, `width`, `height`, `created_at` | `version` naik setiap ulang jepretan; komposisi memakai versi terbaru |
| `strips` | `id`, `booth_id`, `format` (`strip`/`story`), `storage_key`, `public_slug`, `created_at` | `public_slug` acak 22 karakter untuk link hasil |
| `themes` | `id`, `name`, `layout_json`, `asset_keys`, `is_active` | Data template frame; tim desain bisa menambah tema tanpa deploy ulang |

**Endpoint HTTP (REST, JSON)**

| Metode | Path | Fungsi |
| --- | --- | --- |
| `POST` | `/api/booths` | Buat booth, kembalikan `code`, link undangan, dan token host |
| `GET` | `/api/booths/:code` | Info publik booth (status, penuh atau tidak, tema) |
| `POST` | `/api/booths/:code/join` | Bergabung sebagai tamu, kembalikan token tamu |
| `POST` | `/api/booths/:code/photos/upload-url` | Minta signed upload URL untuk unggah satu foto |
| `POST` | `/api/booths/:code/photos` | Konfirmasi unggahan selesai (`shotIndex`, `storageKey`) |
| `POST` | `/api/booths/:code/strips` | Mulai komposisi (dipicu otomatis setelah 8 foto lengkap) |
| `GET` | `/api/strips/:slug` | Data photostrip dan URL unduhan |
| `DELETE` | `/api/booths/:code` | Hapus booth beserta semua foto (hak hapus data) |
| `GET` | `/api/themes` | Daftar tema aktif |

Semua endpoint booth memerlukan header `Authorization: Bearer <participantToken>`, kecuali `GET` info publik dan halaman hasil.

### Pipeline Foto dan Penyimpanan

Foto diambil dari kamera lokal dalam kualitas penuh, diunggah langsung ke object storage, lalu digabung oleh worker, sehingga kualitas hasil tidak bergantung pada kualitas video call.

1. **Ambil.** Pada `fireAt`, klien menggambar frame dari `<video>` kamera ke `<canvas>` (minimal 1280×720, idealnya resolusi penuh lewat `ImageCapture.takePhoto()` bila didukung). Kamera depan di-*mirror* hanya di preview, tidak di foto akhir.
2. **Kompres.** Klien mengonversi ke WebP kualitas 0,85 (fallback JPEG di Safari lama), target di bawah 500 KB per foto, dan menghapus metadata EXIF termasuk lokasi.
3. **Unggah.** Klien meminta signed upload URL (berlaku 5 menit), mengunggah langsung ke storage, lalu mengonfirmasi ke API. Gagal unggah dicoba ulang hingga 3 kali dengan jeda bertahap (1, 2, 4 detik). Foto disimpan sementara di memori agar tidak hilang saat retry.
4. **Validasi.** Server memeriksa tipe file (dari isi file, bukan ekstensi), ukuran maksimal 5 MB, dan dimensi.
5. **Komposisi.** Setelah 8 foto (4 per orang) lengkap, API route memanggil Function komposisi di Vercel; library `sharp` memotong tiap foto ke rasio slot, menempatkannya sesuai `layout_json` tema, menambahkan teks, tanggal, dan watermark, lalu menghasilkan dua file: strip PNG 600×1800 px (2×6 inci pada 300 dpi) dan versi Story JPEG 1080×1920 px. Target selesai di bawah 5 detik.
6. **Distribusi.** Hasil disajikan lewat CDN dengan URL bertanda tangan; halaman `/s/:slug` menampilkan pratinjau dan meta Open Graph.

**Retensi**

| Data | Tanpa akun | Dengan akun (P1) |
| --- | --- | --- |
| Foto mentah per jepretan | Dihapus 7 hari setelah sesi | Dihapus 7 hari setelah sesi |
| Photostrip hasil | Dihapus 30 hari setelah dibuat | Disimpan sampai pengguna menghapusnya |
| Status sesi di database | Kedaluwarsa 24 jam | Kedaluwarsa 24 jam |

Penghapusan berjalan lewat Vercel Cron harian yang menghapus file dan baris data yang kedaluwarsa.

Catatan keputusan: komposisi di server diusulkan demi hasil yang identik dan HP yang ringan. Alternatifnya, komposisi di klien dengan Canvas lebih murah, tetapi berisiko beda hasil antarperangkat (font, rendering). Keputusan akhir di tangan engineering.

### Kompatibilitas Browser dan Fallback

Risiko terbesar bukan browser utama, melainkan link yang terbuka di browser bawaan WhatsApp, Instagram, atau TikTok, tempat akses kamera sering diblokir atau tidak stabil.

| Lingkungan | Dukungan v1 | Perlakuan |
| --- | --- | --- |
| Chrome / Edge Android dan desktop (2 versi terakhir) | Penuh | Jalur utama |
| Safari iOS 16+ | Penuh | Diuji khusus: izin kamera per sesi, autoplay video wajib `playsinline` + `muted` |
| Firefox desktop dan Android | Penuh | `ImageCapture` tidak tersedia, pakai jalur canvas |
| Samsung Internet | Penuh (diuji) | Banyak dipakai di Indonesia |
| In-app browser (WhatsApp, Instagram, TikTok, Line) | Terbatas | Deteksi lewat user agent, tampilkan layar "Buka di Chrome/Safari" dengan tombol salin link dan intent Android untuk membuka Chrome |
| Browser tanpa `getUserMedia` atau kamera ditolak | Tidak bisa jepret langsung | Panduan izin per browser; P1: unggah 4 foto dari galeri |

**Aturan implementasi**

- Deteksi fitur (`navigator.mediaDevices?.getUserMedia`, `RTCPeerConnection`), bukan hanya user agent, kecuali untuk in-app browser.
- Kamera hanya diminta setelah pengguna menekan tombol, bukan saat halaman dimuat, agar prompt izin tidak muncul tiba-tiba dan tingkat izin lebih tinggi.
- Seluruh situs wajib HTTPS karena `getUserMedia` hanya berjalan di konteks aman.
- Kamera dimatikan (`track.stop()`) saat sesi selesai atau tab ditutup, agar indikator kamera tidak terus menyala.

### Keamanan, Privasi, dan UU PDP

Karena dipakai pribadi, kewajiban penyelenggara layanan publik dalam UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi kemungkinan besar tidak berlaku (pemrosesan untuk kegiatan pribadi atau rumah tangga dikecualikan). Foto wajah tetap data sensitif, jadi kebiasaan baik di bawah ini tetap dipakai.

**Privasi**

- [ ] Foto hanya dipakai untuk membuat photostrip; tidak dibagikan ke pihak ketiga dan tidak dipakai melatih model.
- [ ] Tombol "Hapus booth dan semua foto" tersedia bagi kalian berdua.
- [ ] Stream video tidak direkam (relay TURN terenkripsi DTLS-SRTP).
- [ ] Bucket storage privat; foto dan strip hanya bisa diakses lewat signed URL berumur pendek.
- [ ] Kode akses, kunci Supabase, dan kredensial TURN hanya di environment variable Vercel, tidak di repository.

**Keamanan aplikasi**

| Ancaman | Kontrol |
| --- | --- |
| Menebak kode booth atau link hasil | Kode 6 karakter dari 32 simbol (sekitar 1 miliar kombinasi) + rate limit join 10 percobaan/menit per IP; slug hasil acak 22 karakter |
| Orang lain mengambil alih sesi | Token peserta acak 256-bit, disimpan sebagai hash di server; setiap event WebSocket divalidasi terhadap token dan booth |
| Unggah file berbahaya | Presigned URL dengan batas tipe dan ukuran, validasi isi file di server, file tidak pernah dieksekusi |
| Spam pembuatan booth | Pembuatan booth hanya dengan kode akses pribadi; tamu masuk lewat link undangan |
| XSS lewat teks caption | Teks di-escape di frontend dan dirender sebagai teks di worker, bukan HTML |
| Kebocoran rahasia | Kredensial TURN berumur pendek (dibuat per sesi, berlaku 1 jam); semua secret di environment variable, tidak di repo |

Header keamanan wajib: `Content-Security-Policy`, `Strict-Transport-Security`, `Permissions-Policy: camera=(self)`, `X-Content-Type-Options: nosniff`.

### Standar Web, Observability, Pengujian, dan Deployment

**Standar web**

| Area | Target |
| --- | --- |
| Core Web Vitals (persentil ke-75, HP 4G) | LCP < 2,5 s, INP < 200 ms, CLS < 0,1 |
| Ukuran bundle halaman booth | JavaScript awal < 200 KB gzip; aset tema dimuat saat dipilih |
| SEO dan share | Halaman landing di-SSR; halaman hasil punya `og:image` berupa photostrip agar preview WhatsApp menarik |
| PWA ringan | Manifest dan ikon agar bisa "Tambahkan ke layar utama"; tanpa offline mode di v1 |
| Aksesibilitas | WCAG 2.1 AA, diuji dengan axe dan VoiceOver/TalkBack |
| Internasionalisasi | Semua teks UI lewat file terjemahan (id, en); format tanggal mengikuti locale |

**Observability**

- Sentry di klien dan server, dengan tag browser, OS, dan in-app browser.
- Event funnel PostHog (lihat analitik) ditambah event teknis: `camera_denied`, `rtc_failed`, `rtc_relay_used`, `upload_retry`, `compose_failed`, beserta durasi tiap tahap.
- Dashboard: tingkat sesi gagal per browser, persentase koneksi lewat TURN, median waktu komposisi, dan biaya bandwidth TURN harian.
- Notifikasi email dari Sentry bila muncul error baru.

**Pengujian**

- Unit test untuk state machine sesi, kalkulasi offset jam, dan layout tema.
- Integration test API dan event WebSocket (dua klien simulasi dalam satu tes).
- End-to-end dengan Playwright memakai kamera palsu (`--use-fake-device-for-media-stream`) di Chromium, Firefox, dan WebKit.
- Uji manual di HP kamu dan HP pasangan, di jaringan yang biasa kalian pakai (seluler dan Wi-Fi), termasuk membuka link dari WhatsApp, sebelum dipakai untuk momen penting.
- Uji jaringan buruk dengan throttling (3G, packet loss 5%) untuk memastikan foto tetap jadi.

**Deployment dan operasional**

- Lingkungan: `development`, `staging` (data palsu), `production`.
- CI di setiap pull request: lint, type check, unit dan integration test; E2E di staging sebelum rilis.
- Seluruh aplikasi di Vercel: push ke branch main otomatis deploy ke production, tiap pull request mendapat preview URL, dan domain kustom diatur di dashboard Vercel.
- Migrasi database berversi dan bisa di-rollback; feature flag untuk tema baru dan fitur P1.
- Backup PostgreSQL harian dengan retensi 7 hari.

## Kriteria Keberhasilan

Untuk pemakaian berdua, ukurannya bukan pertumbuhan pengguna, melainkan apakah aplikasi bisa diandalkan setiap kali kalian ingin berfoto. Angka dibaca dari log Vercel dan event analitik setelah sekitar 10 sesi pertama.

| Kriteria | Target |
| --- | --- |
| Sesi yang selesai sampai photostrip | Minimal 9 dari 10 sesi |
| Waktu dari link dibuka sampai strip jadi | Kurang dari 3 menit |
| Berjalan di HP kalian berdua (browser bawaan dan lewat link WhatsApp) | Tanpa langkah manual selain izin kamera |
| Kualitas hasil | Layak cetak 2×6 inci tanpa edit tambahan |
| Biaya bulanan di luar domain | Rp0 (masih dalam paket gratis) |
| Waktu perawatan | Kurang dari 1 jam per bulan |

## Pertanyaan Terbuka, Risiko, dan Fase

**Pertanyaan terbuka**

- [ ] HP dan browser apa yang kalian pakai? Ini menentukan prioritas pengujian (terutama bila salah satu memakai iPhone).
- [ ] Apakah paket gratis layanan TURN cukup untuk frekuensi sesi kalian? Perlu dicek setelah beberapa sesi lewat jaringan seluler.
- [ ] Nama domain yang ingin dipakai.
- [ ] Tema frame mana yang dibuat lebih dulu dari enam usulan.

**Risiko utama**

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Link dibuka di browser bawaan WhatsApp dan kamera tidak jalan | Sesi gagal di awal | Deteksi in-app browser dan tombol "Buka di Chrome/Safari" |
| Koneksi salah satu pihak lambat | Preview patah-patah atau sesi tertunda | Foto diambil lokal, retry unggah otomatis, sesi bisa dilanjutkan |
| Proyek Supabase gratis dijeda karena lama tidak dipakai | Booth tidak bisa dibuat saat dibutuhkan | Ping berkala lewat Vercel Cron |
| Batas paket gratis terlampaui | Layanan berhenti sementara | Pantau pemakaian di dashboard; volume pribadi seharusnya jauh di bawah batas |
| Link booth tersebar ke orang lain | Orang asing masuk booth | Booth hanya 2 peserta, link kedaluwarsa 24 jam, pembuatan booth butuh kode akses |

**Fase pengerjaan**

1. **Prototipe**: sesi sinkron berdua, satu tema, unduh PNG. Dicoba langsung di HP kalian.
2. **Versi utama (seluruh P0)**: enam tema, teks dan tanggal, share, penanganan koneksi, deploy di domain sendiri.
3. **Tambahan (P1)**: galeri pribadi, stiker dan filter, mode bergantian, countdown hari ketemu.
4. **Kalau sempat (P2)**: GIF, ekspor siap cetak, tema custom, kalender kenangan.
