# Backend penerbitan e-SKPT

Layanan Node.js ini menyediakan dua endpoint tepercaya:

- `POST /v1/skpt/{applicationId}/upload-tte`: menerima satu PDF multipart pada field `pdf`, memvalidasi MIME/header/ukuran, menghitung SHA-256, mengunggah ke Google Drive, mengunduh ulang, lalu mencocokkan ukuran dan hash.
- `POST /v1/skpt/{applicationId}/finalize`: membuat dokumen final dan cermin verifikasi publik dalam transaksi Firestore atomik.

Keduanya membutuhkan header `Authorization: Bearer <Firebase ID token>` milik akun aktif dengan role `KADIS`. Endpoint finalisasi menerima header opsional `X-Official-Reference`.

## Menjalankan lokal

1. Gunakan Node.js 22 atau lebih baru.
2. Salin konfigurasi root `.env.example` ke environment server. Jangan commit `.env`.
3. Atur `GOOGLE_APPLICATION_CREDENTIALS` ke service account yang memiliki akses ke folder Drive dan project Firebase.
4. Jalankan `npm ci`, `npm test`, lalu `npm start` dari folder `backend`.
5. Uji `GET /healthz`; nilai `storage` harus `configured`.

Tanpa credential, unit test tetap dapat dijalankan tetapi server tidak dapat memverifikasi token, membaca Firestore, atau mengunggah PDF.

## Deploy container

`Dockerfile` disiapkan untuk Cloud Run atau server container Pemkab. Credential dipasang melalui secret manager/workload identity, bukan disalin ke image. Setelah memperoleh URL HTTPS:

1. isi URL tersebut pada `window.EPASAR_BACKEND_URL` di `js/epasar/backend-config.js` saat proses deployment;
2. isi `ALLOWED_ORIGINS` dengan origin Firebase Hosting/domain Pemkab;
3. pastikan service account hanya memiliki akses yang dibutuhkan;
4. lakukan satu uji terkendali pada aplikasi utama sampai status `ISSUED`, cocokkan SHA-256 hasil unduhan, lalu bersihkan data uji sesuai manifest.

Folder sementara yang disetujui adalah `1q0k68owb_9tLiPlUlu6orwvcIaTlkpM7`. ID tersebut bukan kredensial. Backend tetap membutuhkan identitas Google/service account yang diberi akses minimum ke folder itu. Sampai backend HTTPS dikonfigurasi, antarmuka Kadis sengaja menonaktifkan reservasi nomor, upload TTE, dan finalisasi (fail-closed), sementara pendataan dan verifikasi sebelumnya tetap dapat berjalan.

## Pemulihan kegagalan

- Kegagalan saat upload mengembalikan aplikasi ke `TTE_PENDING` dengan `storageStatus: FAILED`.
- Kegagalan setelah arsip terverifikasi mempertahankan `TTE_UPLOADED`, sehingga finalisasi dapat diulang tanpa upload baru.
- Finalisasi yang sudah berhasil bersifat idempoten dan mengembalikan dokumen yang sama.
