# Audit Pascadeploy e-PASAR — 29 Oktober 2026

## Identitas rilis

- URL: https://e-skpt.web.app
- Hosting version: `8e5ebb2669c90554`
- Release live: `1793255256335000`
- Waktu rilis: 29 Oktober 2026 14.27 WITA
- Firestore ruleset: `e3232133-be84-46b3-b511-2e63533f0cb6`
- Composite indexes: 11, seluruhnya `READY`

## Hasil verifikasi

- Halaman publik, login, dashboard, database pedagang, JavaScript utama, CSS, dan GeoJSON merespons HTTP 200.
- Header `nosniff`, `SAMEORIGIN`, kebijakan referrer, permissions policy, dan no-cache untuk HTML/JS aktif.
- Kode live memuat `bounded-operational-page`, batas server 30 klaim, cooldown 30 detik, dan penonaktifan full scan.
- Skrip internal, `.env`, `.git`, konfigurasi lokal, `package.json`, dan backend tidak dipublikasikan (HTTP 404).
- Rules berhasil dikompilasi dan dirilis. Pengujian role boundaries pada emulator selesai dengan exit code 0; pesan `PERMISSION_DENIED` adalah assertion negatif yang memang diharapkan.
- Static preflight, kontrak workflow, place limit, workflow SKPT, dan tes optimasi kuota lulus.

## Blocker aktif

Satu pembacaan langsung `public_stats/summary` setelah deploy masih menerima HTTP 429. Artinya kuota baca Spark hari berjalan belum reset. Deployment Hosting dan Rules berhasil, tetapi operasi Firestore live yang membutuhkan read belum dapat dinyatakan normal sampai reset kuota.

Tidak dilakukan inventory, backup, login massal, ataupun full scan setelah deploy. Audit live dibatasi pada HTTP Hosting dan satu pembacaan dokumen untuk menghindari penambahan beban.

## Keputusan kesiapan

- Hosting: LULUS.
- Aset dan header keamanan: LULUS.
- Rules dan indexes: LULUS.
- Build dan pengujian lokal/emulator: LULUS.
- Firestore live saat audit: TERHALANG KUOTA 429.
- Status keseluruhan: rilis aktif, tetapi belum dapat dinyatakan operasional penuh sampai kuota Spark harian reset. Kebijakan proyek tetap Spark; aplikasi tidak meminta upgrade paket.
