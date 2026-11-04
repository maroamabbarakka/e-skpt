# Kontrak Backend Penerbitan SKPT

## Prinsip keamanan

Browser hanya boleh membuat draft dan reservasi nomor. Browser tidak boleh:

- menetapkan arsip PDF sebagai `VERIFIED`;
- mengubah aplikasi menjadi `ISSUED`;
- membuat `skpt_documents`;
- membuat `public_skpt_verification`.

Seluruh operasi final dijalankan layanan backend tepercaya menggunakan Firebase Admin SDK. Firestore Rules sengaja menolak operasi final dari client, termasuk akun Kadis dan Super Admin.

## Urutan proses

1. Kadis menyetujui permohonan dan mereservasi nomor. Status menjadi `TTE_PENDING`.
2. Backend mengambil aplikasi, klaim, hasil verifikasi pasar, nomor reservasi, dan draft.
3. Backend mengubah status menjadi `TTE_UPLOADING`.
4. Backend menerima PDF hasil TTE dan memvalidasi:
   - awalan berkas `%PDF-`;
   - MIME `application/pdf`;
   - ukuran lebih dari 100 byte dan di bawah batas operasional;
   - SHA-256 dari byte PDF;
   - nomor reservasi dan identitas permohonan;
   - lokasi objek penyimpanan yang dapat dibaca kembali oleh backend.
5. Backend menyimpan descriptor provider-neutral pada `activeStorage` dan menetapkan status `TTE_UPLOADED` hanya jika pembacaan ulang menghasilkan hash yang sama.
6. Backend menjalankan transaksi final atomik:
   - membuat `skpt_documents/{documentId}`;
   - membuat `public_skpt_verification/{verificationToken}`;
   - mengubah `skpt_applications/{applicationId}` menjadi `ISSUED`;
   - mengubah reservasi nomor menjadi `ISSUED`;
   - memperbarui `public_status` menjadi `ISSUED`;
   - memperbarui statistik agregat.

Jika salah satu operasi gagal, tidak boleh ada dokumen publik parsial.

## Struktur `activeStorage`

```json
{
  "provider": "GOOGLE_DRIVE",
  "objectId": "opaque-provider-object-id",
  "location": "opaque-or-internal-location",
  "syncStatus": "VERIFIED",
  "documentHash": "64-character-lowercase-sha256",
  "binaryBytes": 123456,
  "mimeType": "application/pdf",
  "revision": 1,
  "verifiedAt": "server timestamp"
}
```

Provider yang didukung adapter saat ini: `GOOGLE_DRIVE`, `PEMKAB_SERVER`, dan `FIREBASE_STORAGE`. URL publik permanen tidak boleh dijadikan identitas utama; gunakan `objectId` dan simpan lokasi sebagai metadata yang dapat diganti.

## Folder Google Drive yang dipilih

Folder tujuan sementara yang ditetapkan pada 29 Oktober 2026:

- nama: `SKPT-PDF`;
- folder ID: `1q0k68owb_9tLiPlUlu6orwvcIaTlkpM7`;
- URL: `https://drive.google.com/drive/folders/1q0k68owb_9tLiPlUlu6orwvcIaTlkpM7`;
- konfigurasi backend: `GOOGLE_DRIVE_SKPT_FOLDER_ID` pada `.env.example`;
- status aktivasi: `TEMPORARY_ACTIVE` berdasarkan persetujuan penggunaan sementara pada 29 Oktober 2026.

Hasil pemeriksaan metadata menunjukkan folder masih berada pada My Drive pribadi, bukan Shared Drive organisasi, dan memiliki izin `anyone: writer`. Kondisi ini tidak memenuhi persyaratan arsip permanen. Penggunaan sementara dicatat dengan `GOOGLE_DRIVE_TEMPORARY_PERMISSION_EXCEPTION=true`; pengecualian ini tidak boleh mengaktifkan tautan Drive langsung kepada publik.

Selama penggunaan sementara:

1. backend tetap menghitung dan memverifikasi SHA-256 setiap PDF;
2. Firestore hanya menyimpan ID objek dan metadata, bukan URL publik Drive;
3. QR tetap menunjuk ke halaman verifikasi aplikasi;
4. setiap PDF wajib memiliki salinan/backup dan audit aplikasi;
5. file tidak boleh dihapus otomatis saat migrasi;
6. tujuan migrasi tetap `PEMKAB_SERVER`.

Sebelum folder dinyatakan sebagai penyimpanan permanen:

1. cabut izin edit untuk siapa pun yang memiliki tautan;
2. berikan akses langsung hanya kepada akun layanan backend dan administrator resmi;
3. idealnya pindahkan folder ke Shared Drive milik Pemkab/OPD;
4. pastikan backend dapat membuat, membaca ulang, tetapi tidak membagikan PDF secara publik;
5. ulangi pemeriksaan metadata dan uji satu PDF produksi terbatas.

Folder ID bukan secret, tetapi credential akun layanan tetap wajib berada di secret manager. Aplikasi browser dan dokumen Firestore publik tidak boleh menerima credential Google Drive.

## Migrasi Google Drive ke server Pemkab

Migrasi tidak mengubah `verificationToken`, nomor SKPT, maupun `documentHash`.

1. Backend membaca byte dari objek Google Drive.
2. Hitung ulang SHA-256 dan cocokkan dengan `activeStorage.documentHash`.
3. Unggah byte yang sama ke server Pemkab.
4. Baca ulang dari server Pemkab dan cocokkan hash sekali lagi.
5. Tambahkan descriptor lama ke riwayat revisi dengan status `SUPERSEDED`.
6. Ganti `activeStorage` menjadi provider `PEMKAB_SERVER` dengan `revision + 1`.

Dokumen tidak boleh dimigrasikan jika hash sumber atau tujuan berbeda.

## Autentikasi backend

- Gunakan service account hanya pada server, secret manager, atau environment terlindungi.
- Jangan memasukkan private key, refresh token Google Drive, atau credential Pemkab ke HTML, JavaScript browser, Git, ZIP, maupun Firebase Hosting.
- Endpoint upload harus memverifikasi Firebase ID token dan role server-side, tetapi keputusan final tetap dilakukan Admin SDK setelah validasi ulang data Firestore.
- Terapkan idempotency key berbasis `applicationId`, `numberReservationId`, dan hash PDF.

## Kondisi aktif produksi

Penerbitan baru boleh diaktifkan setelah tersedia:

- endpoint backend HTTPS;
- akun layanan dan folder Drive/server tujuan;
- pembatasan ukuran dan timeout upload;
- audit log immutable;
- retry idempoten;
- backup dan prosedur pemulihan;
- pengujian satu dokumen penuh di staging;
- verifikasi bahwa file yang diunduh memiliki hash identik dengan metadata publik.
Persetujuan Kadis dan reservasi nomor juga wajib melalui endpoint backend
`POST /v1/skpt/{applicationId}/approve-tte`. Backend menentukan tahun dan bulan
administratif pada zona `Asia/Makassar`, menaikkan counter tahunan secara
atomik, dan mengembalikan reservasi yang sama jika request identik diulang.
Browser dan Firestore Rules tidak memiliki izin menulis counter/reservasi.
