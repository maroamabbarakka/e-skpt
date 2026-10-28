# Penyimpanan PDF e-SKPT dan Migrasi ke Server Pemkab

## Prinsip

PDF tidak disimpan sebagai Base64 dalam Firestore. Firestore menyimpan workflow, metadata, hash SHA-256, identitas objek, revisi, serta audit. Lokasi file diperlakukan sebagai penyedia yang dapat diganti tanpa mengubah nomor SKPT, token verifikasi, atau QR.

Penyedia yang disiapkan oleh aplikasi:

- `GOOGLE_DRIVE`
- `FIREBASE_STORAGE`
- `PEMKAB_SERVER`

Dokumen hanya boleh diterbitkan ketika `activeStorage.syncStatus` bernilai `VERIFIED`.

## Struktur metadata

```json
{
  "activeStorage": {
    "provider": "GOOGLE_DRIVE",
    "objectId": "drive-file-id",
    "location": "shared-drive-folder-id",
    "syncStatus": "VERIFIED",
    "documentHash": "sha256-64-hex",
    "binaryBytes": 348210,
    "mimeType": "application/pdf",
    "revision": 1,
    "verifiedAt": "server timestamp"
  }
}
```

## Tahap Google Drive

Gunakan Shared Drive milik organisasi, bukan My Drive pribadi. Upload harus dilakukan backend; kredensial service account tidak boleh berada di JavaScript browser. File tidak dibagikan menggunakan `anyone with the link`.

Backend melakukan:

1. Autentikasi pengguna dan pemeriksaan role Kadis.
2. Validasi ukuran, MIME, dan header PDF.
3. Perhitungan SHA-256.
4. Resumable upload ke Shared Drive.
5. Pembacaan ulang metadata Drive.
6. Pencocokan ukuran dan checksum.
7. Penulisan metadata `VERIFIED` ke Firestore.

Gunakan `applicationId + revision + documentHash` sebagai idempotency key agar retry tidak menghasilkan duplikat.

## Tahap server Pemkab

Server Pemkab harus menyediakan HTTPS, storage persisten, backup, endpoint privat, audit, monitoring kapasitas, pembatasan ukuran, dan pemeriksaan hash. Object storage kompatibel S3 seperti MinIO lebih disarankan daripada folder publik web.

Migrasi dilakukan per file:

```text
DISCOVERED
→ SOURCE_HASH_VERIFIED
→ UPLOADED_TO_PEMKAB
→ TARGET_HASH_VERIFIED
→ METADATA_UPDATED
→ PUBLIC_ACCESS_TESTED
→ MIGRATED
```

Drive tetap dipertahankan sebagai replika sampai seluruh hash, jumlah file, ukuran, dan akses aplikasi selesai direkonsiliasi. File sumber tidak dihapus otomatis.

## Aturan QR dan akses publik

QR menunjuk ke halaman verifikasi aplikasi, bukan URL Drive atau path server. Backend memilih penyimpanan aktif. Perpindahan penyimpanan tidak mengubah QR.

Arsip PDF tetap privat. Bila unduhan publik diizinkan, backend harus memeriksa token, status `ISSUED`, status pencabutan, rate limit, dan mencatat audit akses.

## Status kegagalan

- `PENDING_UPLOAD`
- `UPLOADING`
- `UPLOADED`
- `VERIFIED`
- `FAILED`
- `SUPERSEDED`
- `REVOKED`

PDF pengganti dibuat sebagai revisi baru. Revisi lama tidak ditimpa atau dihapus; statusnya menjadi `SUPERSEDED` setelah revisi baru terverifikasi.

## Konfigurasi yang masih diperlukan

Sebelum upload produksi diaktifkan, tetapkan:

1. Penyedia penyimpanan sementara.
2. Backend upload dan URL endpoint.
3. Shared Drive/folder tujuan bila menggunakan Drive.
4. Akun layanan dan pembatasan aksesnya.
5. Batas ukuran PDF.
6. Retensi dan backup.
7. Kebijakan akses PDF publik.
8. Format referensi Srikandi.
9. Pejabat penandatangan resmi.
10. SOP pembatalan nomor dan penggantian PDF.
