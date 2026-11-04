# Audit Rekomendasi Teknis e-SKPT — 29 Oktober 2026

Baseline: `ee002e4cb905609baf7958faa5a1e4ffb03e50bc`  
Branch kerja: `audit/rekomendasi-teknis-20261029`  
Kebijakan: Firebase Spark, tanpa deploy produksi, tanpa mutasi/purge data produksi.

## Kesimpulan eksekutif

Status: **SIAP TAYANG TERBATAS DI APLIKASI UTAMA** untuk pendataan, administrasi, verifikasi pasar, dan review UPTD. Pemisahan kewenangan Kadis, penguncian penerbitan dari browser, alur UPTD, validasi PDF, hash SHA-256, dan adapter Google Drive telah tersedia serta lulus tes lokal. Sesuai keputusan pemilik sistem, staging dan domain Pemkab tidak menjadi prasyarat tayang. Penerbitan SKPT resmi tetap fail-closed sampai backend HTTPS, identitas Google, audit ledger, dan PDF TTE asli tersedia.

## Matriks P0

| ID | Status | Bukti/hasil | Sisa pekerjaan |
|---|---|---|---|
| P0-01 Rules least privilege | Dikerjakan, perlu regresi lebih luas | `MARKET_ADMIN` dibatasi berdasarkan `marketId`; list intake/notification memakai evaluasi scope; master `traders`, `trader_private`, usaha dan lokasi tidak dapat disisir akun wilayah; emulator role-boundary lulus | Tambahkan proyeksi privat per wilayah bila petugas wilayah harus melihat detail privat tertentu; ukur seluruh query UI dengan Rules emulator |
| P0-02 Kadis vs Super Admin | Selesai lokal | `kadis()` hanya menerima `KADIS`; client dan backend hanya menerima Kadis; tes negatif Super Admin tersedia | Uji REST dengan token staging nyata |
| P0-03 Penolakan Kadis | Selesai lokal | Cabang `REJECTED` terpisah dari `TTE_PENDING`, alasan dan audit wajib, emulator lulus | Uji browser staging |
| P0-04 TTE manual Srikandi | Implementasi lokal, belum operasional | Backend memvalidasi role, MIME, `%PDF-`, ukuran, SHA-256, upload/verifikasi Drive, revisi, dan finalisasi atomik | Deploy backend non-Firebase ber-Admin SDK; pasang service account/Shared Drive; uji PDF TTE asli dan verifikasi sertifikat bila komponen resmi tersedia |
| P0-05 Kepala UPTD | Selesai lokal | Dua wilayah dikunci, transisi wajib melewati `UPTD_REVIEW`, pengembalian tidak menghapus okupansi | Tambahkan E2E staging dua wilayah |
| P0-06 Maksimal dua tempat/NIK/pasar | Selesai lokal, menunggu audit/backfill staging | Ledger atomik `traderId + marketId` ditulis bersama klaim; Rules mewajibkan klaim schema 2 tercantum di ledger dan membatasi dua ID; intake menolak tempat ketiga; tes unit dan emulator lulus | Jalankan audit live read-only, selesaikan konflik historis, backfill staging, lalu uji dua transaksi paralel dengan Admin SDK |
| P0-07 Nomor SKPT | Selesai lokal, menunggu integrasi staging | Persetujuan dan reservasi dipindahkan ke backend; waktu administratif WITA, master kode pasar, counter tahunan, token kriptografis, transaksi, dan retry idempoten tersedia. Client/Rules tidak lagi dapat menulis counter | Uji paralel, rollover bulan/tahun, retry, dan VOID pada staging dengan Admin SDK nyata |

## Matriks P1

| ID | Status | Catatan |
|---|---|---|
| P1-01 Kuota Spark | Sebagian selesai | Pagination/cursor dan limit tersedia pada beberapa halaman; `database-pedagang.js` masih memiliki jalur ekspor/full-read yang harus dipisahkan dari tampilan harian dan diberi telemetry reads |
| P1-02 Koreksi foto Kepala Pasar | Selesai lokal | Revisi disimpan append-only dengan media lama/baru, jenis, alasan, klaim, aplikasi, pasar, aktor, dan timestamp server. Rules menolak lintas pasar dan menolak koreksi setelah berkas masuk UPTD/Kadis sampai dikembalikan ke verifikasi pasar |
| P1-03 Kamera/file | Selesai lokal | Kamera dan file/galeri dipisahkan; input file tidak memakai `capture`; keduanya memakai kompresi, validasi, buffer, status, dan pratinjau yang sama |
| P1-04 Pedagang luar pasar | Sebagian selesai | `applySkpt` mensyaratkan unit pasar dan alur non-pasar dapat berhenti pada `REGISTERED`; perlu tes Rules/report/dashboard khusus Admin Perdagangan |
| P1-05 Konsistensi | Sebagian selesai | Penerbitan publik dikunci pada `ISSUED`; pesan Kepala Pasar menuju UPTD; dataset contoh luar pasar dinonaktifkan pada mode produksi dan hanya dapat dimuat dengan `?demo=1`. Seluruh template komunikasi tetap memerlukan persetujuan konten sebelum rilis |

## Perubahan database dan kompatibilitas

| Area | Perubahan | Kompatibilitas | Migrasi produksi |
|---|---|---|---|
| `users` | Validasi 8 role dan scope pasar/UPTD | Dokumen lama tetap dapat dibaca; akun tanpa scope perlu koreksi | Tidak dijalankan |
| `skpt_applications` | Status TTE, metadata penyimpanan, approval/audit | Dokumen historis tetap terbaca | Tidak dijalankan |
| `skpt_documents` | Dokumen final hanya dibuat backend | Dokumen UAT lama tetap terbaca, tidak menjadi syarat penerbitan baru | Tidak dijalankan |
| `market_trader_directory` | Proyeksi pasar untuk akses wilayah | Master pedagang tidak diubah | Backfill harus dry-run + snapshot |
| `trader_market_place_ledgers` | Sudah diimplementasikan lokal secara additive | Klaim schema lama tetap terbaca; klaim schema 2 wajib tercantum pada ledger dan maksimum dua ID tempat per pedagang/pasar | Audit live read-only, rekonsiliasi konflik, snapshot, lalu backfill staging idempoten masih wajib |

## Backup dan rollback

1. Ambil snapshot koleksi terdampak sebelum migrasi: `users`, `traders`, `trader_private`, `nik_registry`, `businesses`, `business_locations`, `market_claims`, `market_occupancies`, `skpt_applications`, reservasi nomor, dan dokumen SKPT.
2. Catat jumlah dokumen dan hash manifest sebelum/sesudah.
3. Jalankan migrasi dengan mode dry-run; perubahan schema harus additive dan idempotent.
4. Jangan hapus field/dokumen historis pada tahap awal.
5. Rollback dilakukan dengan menonaktifkan fitur baru dan memulihkan hanya dokumen yang tercatat pada manifest migrasi; jangan memakai reset koleksi.
6. Uji restore pada project emulator/staging terpisah sebelum persetujuan produksi.

## Bukti pengujian lokal

- `npm run test:skpt`: lulus.
- `npm run test:flow`: lulus.
- `npm run test:rules`: lulus; penolakan yang terlihat pada log adalah kasus negatif yang memang diharapkan.
- `npm run check`: lulus setelah kontrak preflight diperbarui.
- `npm --prefix backend test`: lulus.
- Audit dependency root dan backend: `0 vulnerabilities`.
- Build produksi: lulus; 193 file/28.176.818 byte, tanpa backend, dependency server, halaman/aset UAT, skrip, test, atau konfigurasi Firebase internal.
- Pemindaian pola kredensial: tidak menemukan private key, API key Google, atau client secret tertanam.
- `git diff --check`: lulus; hanya peringatan normalisasi LF/CRLF, tanpa whitespace error.

## Gerbang rilis

Aktivasi penerbitan SKPT resmi dilarang sampai seluruh hal berikut terpenuhi:

- P0-06 ledger batas dua lokasi lulus audit/backfill dan tes paralel staging.
- P0-07 harus lulus integrasi staging dengan Admin SDK dan waktu backend WITA.
- Backend memiliki URL, kredensial organisasi, dan folder privat yang benar.
- Upload, retry, revisi, idempotensi, restore, dan migrasi Drive ke server Pemkab diuji.
- Rules, browser E2E lintas role, responsivitas, serta pengukuran reads lulus di staging.
- Pemilik proses menyetujui checklist rilis dan tidak ada data produksi yang diubah selama UAT.
