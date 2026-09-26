# SECURITY RULES, PRIVASI, DAN PUBLIC INTAKE

## Prinsip
Form publik hanya boleh `create` ke collection intake/koreksi dengan schema ketat.

Publik TIDAK boleh:
- membaca/list data pedagang;
- update/delete master;
- menulis role;
- mengubah approval;
- menerbitkan SKPT;
- menulis notifikasi Kadis.

Karena arsitektur Spark-only tanpa trusted Firebase backend, submission publik adalah **untrusted intake**, bukan master resmi.

## NIK unik
Unique NIK ditegakkan ketika Admin membentuk master.

Alur:
1. public submit → `trader_intake`;
2. admin review;
3. hitung SHA-256 NIK ternormalisasi pada client internal terautentikasi;
4. transaksi baca `nik_registry/{hash}`;
5. jika ada → link/merge;
6. jika belum → buat `traders` + `trader_private` + `nik_registry`.

Jangan gunakan NIK sebagai ID publik.

## Role rekomendasi
- `SUPER_ADMIN`
- `DISPERINDAG_ADMIN`
- `TRADE_ADMIN`
- `MARKET_ADMIN`
- `MARKET_HEAD`
- `KADIS`
- `TECH_ADMIN`

Jangan mempercayai role dari localStorage. Role efektif harus konsisten dengan Firebase Auth/profile Firestore yang dilindungi.

## Matriks akses

### trader_intake
- public: create valid only
- public read/list/update/delete: false
- admin: read/process

### traders
- public: false
- authorized staff: read
- admin: write

### trader_private / nik_registry
- public: false
- restricted authorized roles only

### trader_media
- public: no read
- public create hanya bila schema, owner intake, type, dan panjang memenuhi aturan
- staff: sesuai role

### market_claims
- public read: false
- Market Head/Admin: read
- verification write: Market Head/Admin sesuai scope

### correction_requests
- public create
- public read/update/delete false
- staff process

### notifications
- recipient/admin read
- write hanya workflow yang berwenang

### skpt_documents
- public raw read false
- internal staff read
- controlled write
- public verification melalui mirror aman

## Schema validation public
Rules harus membatasi:
- known keys only;
- string length;
- enum;
- NIK 16 digit;
- nomor telepon panjang masuk akal;
- status awal wajib `SUBMITTED`;
- client tidak boleh kirim `approvedBy`, `role`, `isAdmin`, `verificationStatus=VERIFIED`.

## Media
Rules dapat membatasi panjang string Base64/metadata, tetapi validasi kualitas gambar tetap client + admin.

## Existing rules
Repositori saat ini memiliki beberapa collection lama dengan write publik. Modul e-Pasar tidak boleh meniru pola ini. Hardening modul lama sebaiknya PR terpisah agar regresi mudah ditelusuri.

## Privasi public verification
Jangan tampilkan:
- NIK penuh;
- KTP;
- alamat lengkap;
- WA;
- tanggal lahir lengkap bila tidak perlu.

## Emulator tests wajib
- anonymous dapat create intake valid;
- anonymous tidak dapat read/list intake;
- anonymous tidak dapat read trader/private;
- anonymous tidak dapat set APPROVED;
- malformed/oversized ditolak;
- Market Head tidak dapat approve sebagai Kadis;
- Market Head hanya scope pasar;
- correction request tidak dapat mutate master;
- Kadis dapat review record sah.
