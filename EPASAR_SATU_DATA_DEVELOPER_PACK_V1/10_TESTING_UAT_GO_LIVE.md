# TESTING, UAT, DAN GO-LIVE GATE

## Mobile UX
PASS bila:
- 360px tanpa overflow;
- input mudah disentuh;
- keyboard numeric untuk NIK;
- sticky next bekerja;
- progress benar;
- back tidak menghapus data;
- error fokus ke field;
- kamera Android bekerja;
- koneksi lambat punya state jelas;
- double submit dicegah.

## Form logic
- NIK bukan 16 digit ditolak.
- WA dinormalisasi.
- branch pasar benar.
- SKPT hanya untuk pengguna unit pasar.
- review sesuai data.
- checkbox tidak prechecked.
- registration code terbuat.

## Image
- foto besar terkompres;
- output WebP;
- hard cap dipatuhi;
- media terpisah;
- list trader tidak mengunduh Base64;
- Base64 tidak diindeks.

## Security emulator
WAJIB:
- anonymous create valid intake;
- anonymous cannot read intake;
- anonymous cannot list trader;
- anonymous cannot mutate master;
- anonymous cannot approve;
- malformed keys rejected;
- Market Head hanya scope pasar;
- Market Head correction mencatat audit;
- Kadis mendapat notification;
- Market Head tidak dapat Kadis approve;
- issued SKPT tidak dapat diubah diam-diam.

## Integritas
- same NIK tidak menghasilkan dua master;
- submission baru dapat di-link ke trader existing;
- satu unit tidak punya dua occupancy aktif tanpa conflict resolution;
- claim != verified unit;
- annual validation tidak mengubah validUntil;
- legacy tetap expired.

## Spark budget
- storage current dicatat;
- proyeksi 2.000 pedagang dihitung;
- target e-Pasar <450 MB;
- foto sesuai cap;
- pagination dipakai;
- tidak ada realtime listener besar yang tidak perlu.

## Regression
- LPG tetap berjalan;
- BBM tetap berjalan;
- Pasar tetap berjalan;
- berita/build sukses;
- Media Intelligence tidak terganggu;
- `market-engine.js` tidak diubah untuk Base64.

## GO
GO jika:
- security PASS;
- mobile UAT PASS;
- synthetic 50 cases PASS;
- build PASS;
- owner approve;
- role nyata tersedia;
- master pasar awal tersedia;
- privacy text disetujui;
- template SKPT/TTE workflow disetujui.

NO-GO hanya ketika ada failure aktif. Setelah fix + retest PASS, boleh GO.
