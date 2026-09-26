# MASTER DIRECTIVE UNTUK DEVELOPER / VS CODE AGENT

## Misi
Bangun modul baru **e-Pasar — Satu Data Pedagang Kabupaten Pinrang** di repositori yang ada.

Sistem harus menjadi sumber induk pedagang seluruh Kabupaten Pinrang: toko, kaki lima, pasar, rumahan, keliling, kuliner, distributor, usaha produksi, dan kerajinan. Dari satu data ini kemudian dapat dibuat klasifikasi perdagangan, industri, kerajinan/Dekranasda, UMKM, dan kategori lain.

## Larangan
DILARANG:
- `allow read, write: if true` untuk collection baru;
- memakai NIK sebagai URL/QR/card/public ID;
- menaruh foto Base64 di `traders`;
- load seluruh foto saat membuka daftar pedagang;
- menyimpan PDF TTE besar sebagai Base64;
- memanggil `firebase.storage()`;
- menambah Cloud Functions;
- menyimpan password/private key/service-account/token TTE di Git;
- menganggap nomor los input pedagang sudah resmi sebelum diverifikasi;
- mengaktifkan SKPT lama;
- menghapus/refactor besar modul lama tanpa kebutuhan.

## Git
Gunakan branch:
`feature/epasar-satu-data-v1`

Sebelum coding:
1. `git status`;
2. catat modified/untracked;
3. jangan `reset --hard`;
4. snapshot file yang akan disentuh bila workspace tidak bersih.

## Struktur file rekomendasi
```text
epasar.html
epasar-status.html
verifikasi-skpt.html
css/epasar.css
js/epasar/
  constants.js
  validators.js
  trader-form.js
  trader-service.js
  business-service.js
  market-claim-service.js
  correction-service.js
  skpt-service.js
  image-compress.js
  media-service.js
  notification-service.js
  admin-epasar.js
  market-verification.js
  kadis-approval.js
  public-verification.js
  wa-email-share.js
```

Prefer module baru daripada menambah ratusan baris ke `js/admin.js`.

## Build
Karena Hosting memakai `dist`, update `scripts/build_production.py` agar file e-Pasar masuk `dist`.

Validasi minimal:
```bash
test -s dist/epasar.html
test -s dist/verifikasi-skpt.html
test -s dist/js/epasar/trader-form.js
test -s dist/js/epasar/image-compress.js
```

## Urutan implementasi
1. UI mobile-first.
2. Form state + review.
3. Kompresi foto.
4. Public intake Firestore.
5. Admin intake queue.
6. Deduplikasi NIK dan master trader.
7. Bisnis/lokasi/klasifikasi.
8. Klaim unit pasar.
9. Verifikasi Kepala Pasar.
10. Permohonan koreksi.
11. Notifikasi + review Kadis.
12. SKPT metadata + annual validation.
13. WA/email share.
14. Emulator security tests.
15. UAT.
16. Go-live.

## Target UX
Pedagang umum selesai 3–5 menit bila data/foto siap. Tambahan pengajuan SKPT 2–4 menit di luar membaca ketentuan.
