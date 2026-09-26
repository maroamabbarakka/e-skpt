# Master Data Pasar e-PASAR

Dokumen ini menetapkan identitas pasar resmi untuk e-PASAR. ID berikut bersifat stabil, digunakan untuk routing Kepala Pasar, klaim unit, pemakaian unit, pengajuan SKPT, pengesahan tahunan, dan riwayat verifikasi. Nama pasar dapat diperbaiki pada master tanpa mengganti ID.

| ID | Nama pasar |
| --- | --- |
| MKT-001 | Pasar Rakyat Bungi |
| MKT-002 | Pasar Rakyat Cempa |
| MKT-003 | Pasar Rakyat Kampung Jaya |
| MKT-004 | Pasar Rakyat Kariango |
| MKT-005 | Pasar Rakyat Langnga |
| MKT-006 | Pasar Rakyat Lanrisang |
| MKT-007 | Pasar Rakyat Leppangang |
| MKT-008 | Pasar Rakyat Marawi |
| MKT-009 | Pasar Rakyat Pekkabata |
| MKT-010 | Pasar Rakyat Sentral Pinrang |
| MKT-011 | Pasar Rakyat Teppo |

## Aturan penggunaan

- Gunakan `marketId` persis seperti tabel ini pada setiap data internal.
- Satu Kepala Pasar dapat ditugaskan ke satu atau lebih `marketIds`.
- Satu pedagang dapat memiliki beberapa tempat pada pasar yang sama atau berbeda; setiap tempat yang mengajukan SKPT menghasilkan satu berkas dan dirutekan berdasarkan `marketId`.
- Nilai lama `pasar-pekkabata` dan `pasar-sentral-pinrang` hanya dinormalisasi oleh aplikasi untuk kompatibilitas data uji lama. Data baru wajib memakai `MKT-009` dan `MKT-010`.
- Master distribusi untuk aplikasi berada pada `assets/data/markets.json`; konstanta browser pada `js/epasar/constants.js` sengaja diuji agar tetap identik.
