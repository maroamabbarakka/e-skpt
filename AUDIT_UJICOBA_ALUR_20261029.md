# Audit Uji Coba Alur Keseluruhan e-PASAR/e-SKPT

Tanggal audit: 29 Oktober 2026  
Lingkup: kode lokal, Firestore Rules emulator, kontrak status, pintu masuk publik, media, peran internal, TTE, penerbitan, dan build produksi.

## Kesimpulan

Status keseluruhan: **LULUS BERSYARAT / BELUM SIAP GO-LIVE PENUH**.

Alur dari pendaftaran sampai reservasi nomor dan penyerahan ke proses TTE telah memiliki kontrak yang konsisten dan pengamanan peran. Penerbitan final `ISSUED`, penciptaan dokumen final, sinkronisasi PDF permanen, dan cermin verifikasi publik sengaja tidak dapat dilakukan browser. Tahap tersebut baru dapat dinyatakan lulus setelah backend tepercaya berbasis Admin SDK tersedia dan diuji dengan penyimpanan Google Drive atau server Pemkab.

## Matriks hasil alur

| Tahap | Aktor | Status hasil | Hasil audit |
|---|---|---|---|
| Pendaftaran publik | Pedagang | `SUBMITTED` | Lulus emulator: create valid diizinkan; read/list anonim ditolak |
| Unggah lampiran | Pedagang | `PENDING` | Lulus emulator: relasi intake/token, proteksi baca, dan batas ukuran |
| Review administrasi | Admin | `ADMIN_REVIEW` / `CORRECTION_REQUIRED` / `REJECTED` | Kontrak transisi lulus |
| Pembentukan klaim pasar | Admin | `MARKET_VERIFICATION` | Kontrak status dan scope pasar tersedia |
| Verifikasi faktual | Kepala Pasar | `UPTD_REVIEW` / `CONFLICT` / `NOT_FOUND` | Kontrak transisi dan pembatasan pasar lulus |
| Telaah wilayah | Kepala UPTD | `KADIS_REVIEW` / kembali `MARKET_VERIFICATION` | Rules scope wilayah dan kontrak keputusan lulus |
| Keputusan Kadis | Kadis | `TTE_PENDING` / `REJECTED` | Lulus setelah kontrak rules persetujuan dan penolakan dipisahkan |
| Proses TTE | Backend/operator resmi | `TTE_UPLOADING` / `TTE_UPLOADED` / `TTE_REJECTED` | Kontrak status lulus; integrasi nyata belum tersedia |
| Penerbitan final | Backend Admin SDK | `ISSUED` | Client terkunci dengan benar; backend nyata belum tersedia |
| Verifikasi publik | Publik | hanya dokumen `ISSUED` | Rules terkunci; belum dapat diuji end-to-end tanpa backend penerbitan |
| Pengesahan tahunan | Kepala Pasar/reviewer | `PENDING_REVIEW` / `VALIDATED` / `RETURNED` | Rules tersedia; membutuhkan dokumen `ISSUED` nyata untuk E2E |

## Skenario yang diverifikasi

1. Alur utama: `SUBMITTED → ADMIN_REVIEW → MARKET_VERIFICATION → MARKET_VERIFIED → UPTD_REVIEW → KADIS_REVIEW → TTE_PENDING → TTE_UPLOADING → TTE_UPLOADED → ISSUED`.
2. Koreksi administrasi dan pengajuan ulang.
3. Konflik unit pasar dan pemeriksaan ulang.
4. Unit tidak ditemukan dan verifikasi ulang.
5. Pengembalian berkas oleh Kepala UPTD.
6. Penolakan final oleh Kepala Dinas.
7. Penolakan hasil TTE dan pengulangan proses TTE.
8. Pembatalan sebelum TTE selesai.
9. Penolakan lompatan status langsung dari Kadis/TTE Pending ke `ISSUED`.
10. Penolakan penerbitan jika arsip belum `VERIFIED` atau hash PDF tidak valid.

## Temuan dan perbaikan audit ini

### 1. Kontrak penolakan Kadis tidak dapat dieksekusi

Sebelumnya satu cabang Firestore Rules menangani `TTE_PENDING` dan `REJECTED` sekaligus. Akibatnya keputusan penolakan ikut diwajibkan membawa `draftNumber`, `numberReservationId`, dan `verificationToken`, padahal field tersebut hanya relevan untuk persetujuan menuju TTE.

Perbaikan:

- cabang persetujuan hanya menerima `KADIS_REVIEW → TTE_PENDING`;
- cabang penolakan hanya menerima `KADIS_REVIEW → REJECTED`;
- catatan penolakan wajib berisi 1–500 karakter;
- aktor penolakan client dibatasi hanya role `KADIS`;
- pengujian emulator memastikan aplikasi dan status publik dapat berubah menjadi `REJECTED`.

### 2. Skrip media emulator memakai fixture lama

Fixture lama tidak memuat `statementAccepted` dan metadata pernyataan elektronik. Rules menolaknya secara benar. Fixture telah disesuaikan dengan kontrak produksi dan kembali lulus.

### 3. Skrip simulasi browser lama tidak lagi representatif

`scripts/simulate_all_flows.js` masih mencari tombol **Terbitkan Dokumen Uji Coba** dan mengharapkan browser membuat status `ISSUED`. Asumsi ini bertentangan dengan arsitektur produksi terbaru. Hasil lama dari skrip tersebut tidak boleh dipakai sebagai bukti kesiapan penerbitan.

Pengganti yang aman adalah `npm run test:flow`, yang menguji kontrak semua cabang tanpa menulis data uji ke Firebase produksi.

## Bukti pengujian

- `npm run test:flow`: lulus.
- `npm run test:skpt`: lulus.
- Firestore Rules role boundaries: lulus pada emulator.
- Anonymous intake smoke test: lulus.
- Media parent-link/read-protection/size smoke test: lulus.
- Document requirement separation: lulus.
- NIK registry preflight control: lulus.
- Read quota optimizations: lulus.
- Regional report scope isolation: lulus.
- `npm run check`: lulus.
- `npm audit`: 0 kerentanan.
- Build produksi: lulus.

## Syarat sebelum deploy produksi penuh

1. Implementasikan backend penerbitan sebagaimana kontrak `BACKEND_PENERBITAN_SKPT.md`.
2. Uji unggah PDF TTE asli, verifikasi hash SHA-256, dan status penyimpanan `VERIFIED`.
3. Uji transaksi atomik backend: aplikasi menjadi `ISSUED`, dokumen final dibuat, reservasi nomor ditutup, dan cermin publik dibuat.
4. Uji kegagalan parsial dan idempotensi agar nomor SKPT tidak ganda.
5. Uji migrasi penyimpanan Google Drive ke server Pemkab tanpa mengubah token verifikasi publik.
6. Jalankan E2E staging dengan akun peran lengkap dan data khusus staging, lalu bersihkan seluruh data uji.

Sebelum enam syarat tersebut selesai, build layak untuk pengujian staging tetapi belum layak dinyatakan sebagai penerbitan SKPT produksi penuh.
