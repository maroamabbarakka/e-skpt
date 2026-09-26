# Register Penugasan Akun Kepala Pasar e-PASAR V1

Dokumen operasional ini menjadi acuan penugasan akun Kepala Pasar. Dokumen tidak memuat password dan tidak dengan sendirinya membuktikan bahwa akun Firebase Authentication telah dibuat.

## Sumber dan aturan

- Master resmi: `assets/data/markets.json`.
- Role Firestore: `MARKET_HEAD`.
- Kewenangan ditentukan oleh array `marketIds` pada profil `users/{uid}`.
- ID pasar wajib memakai format kanonis `MKT-001` sampai `MKT-011`.
- Alamat email adalah identitas login jabatan dan boleh tetap digunakan ketika pejabat berganti.
- Perubahan penugasan dilakukan Super Admin dan harus diuji agar akun tidak dapat membaca pasar lain.

## Register resmi

| No | ID | Pasar | Email jabatan yang direkomendasikan |
|---:|---|---|---|
| 1 | `MKT-001` | Pasar Rakyat Bungi | `kepala.pasar-bungi@eskpt.id` |
| 2 | `MKT-002` | Pasar Rakyat Cempa | `kepala.pasar-cempa@eskpt.id` |
| 3 | `MKT-003` | Pasar Rakyat Kampung Jaya | `kepala.pasar-kampung-jaya@eskpt.id` |
| 4 | `MKT-004` | Pasar Rakyat Kariango | `kepala.pasar-kariango@eskpt.id` |
| 5 | `MKT-005` | Pasar Rakyat Langnga | `kepala.pasar-langnga@eskpt.id` |
| 6 | `MKT-006` | Pasar Rakyat Lanrisang | `kepala.pasar-lanrisang@eskpt.id` |
| 7 | `MKT-007` | Pasar Rakyat Leppangang | `kepala.pasar-leppangang@eskpt.id` |
| 8 | `MKT-008` | Pasar Rakyat Marawi | `kepala.pasar-marawi@eskpt.id` |
| 9 | `MKT-009` | Pasar Rakyat Pekkabata | `kepala.pasar-pekkabata@eskpt.id` |
| 10 | `MKT-010` | Pasar Rakyat Sentral Pinrang | `kepala.pasar-sentral-pinrang@eskpt.id` |
| 11 | `MKT-011` | Pasar Rakyat Teppo | `kepala.pasar-teppo@eskpt.id` |

## Migrasi dari penugasan lama

Profil lama yang masih memakai slug seperti `pasar-sentral-pinrang` atau `pasar-pekkabata` harus diubah menjadi `MKT-010` atau `MKT-009`. Akun untuk pasar yang tidak terdapat pada master resmi tidak boleh diberi akses aktif sampai ada keputusan pemilik untuk menambah pasar tersebut ke master.

Migrasi profil tidak mengubah UID atau password Authentication. Perubahan hanya dilakukan pada nama tampilan, jabatan, status, dan `marketIds` di Firestore.

## Checklist aktivasi

1. Pastikan akun Authentication dan UID benar.
2. Pastikan dokumen `users/{uid}` memakai role `MARKET_HEAD`.
3. Isi `marketIds` dengan ID resmi yang tepat.
4. Uji daftar klaim hanya menampilkan pasar yang ditugaskan.
5. Uji akses silang pasar ditolak Security Rules.
6. Catat perubahan penugasan dalam administrasi internal.

Password awal tidak boleh dicatat di repository atau dokumen ini.
