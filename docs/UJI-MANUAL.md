# Uji Manual di Dua HP

Checklist sebelum Rindu Berat dipakai untuk momen penting. Uji di HP kalian berdua yang sebenarnya.

## Persiapan

HP tidak bisa memakai Supabase lokal (`127.0.0.1`) dan kamera butuh HTTPS. Jadi uji manual dilakukan di
**deploy Vercel** (preview atau production) yang tersambung ke **proyek Supabase cloud**. Langkahnya ada di README bagian Deploy.

- [ ] Migrasi sudah diterapkan ke Supabase cloud (`pnpm exec supabase db push`).
- [ ] Semua env sudah diisi di Vercel, termasuk `TURN_KEY_ID` dan `TURN_KEY_API_TOKEN` (wajib untuk jaringan seluler).
- [ ] Catat merek/model HP, OS, dan browser masing-masing.

## Fase 1: alur inti

Jalankan sekali di Wi-Fi dan sekali dengan **kedua HP di jaringan seluler** (matikan Wi-Fi).

| #   | Langkah                                                                               | Hasil yang diharapkan                                                                                             | Wi-Fi | Seluler |
| --- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----- | ------- |
| 1   | HP A: buka situs, isi kode akses, ketuk "Buat booth"                                  | Masuk ruang booth, kode 6 karakter terlihat                                                                       | ☐     | ☐       |
| 2   | HP A: kode akses salah                                                                | Pesan "Kode aksesnya belum pas", tidak masuk                                                                      | ☐     | ☐       |
| 3   | HP A: ketuk "Kirim lewat WhatsApp" lalu kirim ke HP B                                 | WhatsApp terbuka dengan teks dan link                                                                             | ☐     | ☐       |
| 4   | HP B: buka link dari WhatsApp lewat **Chrome/Safari** (salin link, tempel di browser) | Layar "Kamu diajak foto bareng!"                                                                                  | ☐     | ☐       |
| 5   | HP B: buka link langsung di **browser bawaan WhatsApp**                               | Catat hasilnya. Layar "Buka di Chrome/Safari" baru dibuat di Fase 2, jadi kamera mungkin gagal di sini            | ☐     | ☐       |
| 6   | HP B: "Masuk booth"                                                                   | HP A menampilkan "Pasanganmu sudah masuk" dengan hati berdenyut                                                   | ☐     | ☐       |
| 7   | Keduanya: "Nyalakan kamera"                                                           | Prompt izin muncul **setelah** tombol ditekan, bukan saat halaman dibuka                                          | ☐     | ☐       |
| 8   | Preview pasangan                                                                      | Wajah pasangan muncul di jendela "Dia" dalam ±5 detik                                                             | ☐     | ☐       |
| 9   | HP ketiga (atau browser lain): buka link yang sama                                    | "Booth ini sudah penuh"                                                                                           | ☐     | ☐       |
| 10  | Keduanya: "Siap!"                                                                     | Hitung mundur 3-2-1 muncul di kedua HP pada saat yang sama                                                        | ☐     | ☐       |
| 11  | Rekam layar HP A sambil melihat HP B (atau sebaliknya)                                | Kilat "Cekrek!" di kedua HP berselisih ≤ 0,3 detik di keempat jepretan                                            | ☐     | ☐       |
| 12  | Tunggu setelah jepretan ke-4                                                          | "Lagi nyusun photostrip..." lalu strip muncul dengan confetti, kurang dari ±5 detik                               | ☐     | ☐       |
| 13  | Cek strip                                                                             | Foto pembuat booth di kolom kiri dan tamu di kanan, 4 baris, tidak terbalik (tidak mirror), wajah tidak terpotong | ☐     | ☐       |
| 14  | "Unduh PNG"                                                                           | File PNG 600×1800 tersimpan di galeri/unduhan                                                                     | ☐     | ☐       |
| 15  | Setelah strip jadi                                                                    | Indikator kamera di status bar HP mati                                                                            | ☐     | ☐       |
| 16  | "Buka halaman hasil"                                                                  | Halaman `/s/...` menampilkan strip dan tombol unduh                                                               | ☐     | ☐       |
| 17  | Waktu total dari link dibuka (langkah 4) sampai strip jadi                            | Kurang dari 3 menit                                                                                               | ☐     | ☐       |

## Ketahanan sederhana

- [ ] Refresh HP B di ruang tunggu: tetap masuk sebagai tamu yang sama (tidak "penuh"), dan preview tersambung lagi.
- [ ] Mode pesawat dinyalakan 5 detik di tengah unggahan lalu dimatikan: muncul "Sinyal lagi lemot..." dan strip tetap jadi.
- [ ] Mode gelap HP aktif: warna terbaca jelas.

## Catat bila gagal

Browser dan versinya, langkah ke berapa, screenshot, dan jam kejadian (untuk dicocokkan dengan log Vercel).
