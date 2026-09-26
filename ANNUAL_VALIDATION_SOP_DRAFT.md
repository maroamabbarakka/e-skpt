# Rancangan SOP Pengesahan Tahunan SKPT

Status: **rancangan administrasi internal untuk UAT**. Dokumen ini belum menjadi peraturan dan tidak boleh disebut sebagai kewajiban yang bersumber dari Perda Kabupaten Pinrang Nomor 6 Tahun 2024 sampai ditetapkan oleh pejabat berwenang.

## 1. Tujuan

Pengesahan tahunan digunakan untuk mencatat bahwa selama masa berlaku dua tahun:

- pedagang masih menggunakan tempat;
- jenis usaha masih sama atau perubahannya telah dilaporkan;
- unit yang digunakan masih sama atau perubahannya telah dilaporkan;
- pemeriksaan dilakukan oleh Kepala Pasar yang ditugaskan;
- hasil pemeriksaan telah ditinjau petugas administrasi/Kepala Dinas.

Pengesahan tahunan **tidak**:

- memperpanjang `validUntil`;
- mengubah pemegang, unit, pasar, atau jenis usaha secara langsung;
- menggantikan workflow koreksi/perubahan;
- menghapus dasar pencabutan dalam Pasal 17;
- membatalkan SKPT secara otomatis jika pemeriksaan belum dilakukan;
- menggantikan permohonan periode baru setelah masa berlaku berakhir.

## 2. Aktor dan kewenangan

### Kepala Pasar

- hanya melihat SKPT pada pasar dalam `marketIds` akun;
- melakukan pemeriksaan faktual;
- menjawab kondisi penggunaan tempat, usaha, dan unit;
- menulis catatan pemeriksaan;
- mengirim status `PENDING_REVIEW`;
- tidak dapat mengesahkan final;
- tidak dapat mengubah `validUntil` atau mirror verifikasi publik.

### Admin Disperindag/Kadis

- membaca hasil pemeriksaan;
- membandingkan dengan dokumen SKPT induk;
- menetapkan `VALIDATED` atau `RETURNED`;
- tidak dapat menetapkan `VALIDATED` jika pemeriksaan masih menunjukkan perubahan material;
- memperbarui catatan tahunan pada dokumen internal dan mirror publik dalam satu transaksi;
- tidak mengubah data master melalui proses pengesahan tahunan.

### Publik

- hanya melihat status tahunan melalui token QR dokumen;
- tidak dapat membuat, mengubah, atau mendaftar catatan tahunan;
- tidak memperoleh data pemeriksaan internal atau catatan petugas.

## 3. Status

| Status | Makna |
|---|---|
| `INITIAL_ISSUE` | Tahun penerbitan awal SKPT. |
| `DUE` | Periode berikutnya menunggu pemeriksaan. |
| `PENDING_REVIEW` | Kepala Pasar telah mengirim pemeriksaan dan menunggu keputusan. |
| `VALIDATED` | Catatan tahunan telah disahkan secara administratif. |
| `RETURNED` | Pemeriksaan dikembalikan untuk diperbaiki/ditindaklanjuti. |

`RETURNED` bukan pencabutan dan bukan penolakan SKPT.

Setelah `RETURNED`, Kepala Pasar dapat memperbaiki hasil pemeriksaan dan mengajukan ulang rekaman yang sama. Status kembali menjadi `PENDING_REVIEW`; identitas SKPT dan tahun pengesahan tidak berubah.

## 4. Identitas rekaman dan anti-duplikasi

- Collection: `skpt_annual_validations`.
- Document ID: `{skptId}_{validationYear}` setelah karakter tidak aman dinormalisasi.
- Satu SKPT hanya memiliki satu rekaman untuk satu tahun validasi.
- Pembuatan menggunakan operasi create/set setelah pemeriksaan keberadaan dokumen.
- Security Rules memverifikasi SKPT induk ada, berstatus `ISSUED`, pasar sesuai penugasan, dan `traderId` sama.

## 5. Struktur data versi 2

Field identitas yang tidak dapat diubah setelah submit:

- `skptId`
- `validationKey` (harus sama dengan document ID)
- `verificationToken`
- `number`
- `traderId`
- `marketId`
- `validationYear`
- `stillUsesPlace`
- `sameBusiness`
- `sameUnit`
- `hasChanges`
- `note`
- `submittedBy`
- `submittedRole`
- `submittedAt`
- `doesNotExtendValidity: true`
- `policyBasis: INTERNAL_ANNUAL_REGISTRATION_DRAFT_V1`
- `reviewHistory` (maksimal 10 peristiwa terbaru)
- `schemaVersion: 3`

Field keputusan:

- `status`
- `validatedBy`
- `validatorRole`
- `validatedAt`
- `decisionNote`

## 6. Aturan perubahan material

Jika `sameBusiness == false`, `sameUnit == false`, atau petugas menandai perubahan:

1. catatan tahunan tetap dikirim untuk review;
2. admin tidak mengubah master dari halaman pengesahan;
3. buat/lanjutkan workflow koreksi atau `CHANGE_REQUEST`;
4. sistem menolak `VALIDATED` selama hasil pemeriksaan masih menandai perubahan;
5. setelah workflow koreksi/perubahan selesai, Kepala Pasar memeriksa ulang dan mengajukan kembali data faktual yang telah sesuai;
6. jejak sebelum/sesudah/alasan/aktor/waktu harus disimpan pada workflow perubahan.

Jika `stillUsesPlace == false`, admin wajib menilai apakah kondisi termasuk pengunduran diri, tidak menggunakan tempat, atau dasar pencabutan menurut Pasal 17–18. Sistem tidak mencabut otomatis.

## 7. Batas masa berlaku

- Tahun target dihitung sebagai tahun terbit + 1.
- Tanggal jadwal dihitung dari tanggal terbit + 1 tahun dan ditampilkan kepada petugas. Sebelum SOP final ditetapkan, tanggal ini bersifat informasi dan tidak membatalkan SKPT secara otomatis.
- Proses ditolak oleh layanan jika tanggal saat ini telah melewati `validUntil`.
- Keputusan tidak mengubah `validUntil`.
- Setelah `validUntil`, pengguna diarahkan ke permohonan periode baru.
- Validasi tanggal di client merupakan perlindungan UX; keputusan final tetap harus diperiksa petugas karena Spark tidak menyediakan backend tepercaya untuk scheduler/otomasi.

## 8. Keamanan

- Kepala Pasar tidak dapat menulis langsung `annualValidations` pada dokumen publik.
- Hanya admin/Kadis yang dapat memutakhirkan mirror publik setelah keputusan.
- Kepala Pasar lintas pasar ditolak Security Rules.
- Field keputusan hanya dapat diubah dari `PENDING_REVIEW` ke `VALIDATED` atau `RETURNED`.
- Kepala Pasar hanya dapat mengubah rekaman berstatus `RETURNED` kembali ke `PENDING_REVIEW`; identitas SKPT, pasar, pedagang, tahun, dan dasar kebijakan tidak dapat diganti.
- Security Rules menolak `VALIDATED` jika `hasChanges == true` atau salah satu hasil pemeriksaan faktual bernilai tidak sesuai.
- Identitas rekaman pemeriksaan tidak dapat diganti saat keputusan.
- Publik hanya memiliki akses `get` dengan token acak; operasi list ditolak.

## 9. Keputusan pemilik yang masih diperlukan

1. Dasar keputusan/SOP formal pengesahan tahunan.
2. Jendela waktu pemeriksaan, misalnya 30 hari sebelum tanggal ulang tahun penerbitan.
3. Apakah keputusan final cukup oleh Admin atau wajib Kepala Dinas.
4. Akibat administratif jika pemeriksaan tidak dilakukan tepat waktu.
5. Tata cara ketika ditemukan perubahan unit, jenis usaha, pemegang, atau penggunaan berhenti.
6. Format nomor/referensi pengesahan tahunan.

Sebelum keputusan tersebut tersedia, modul diperlakukan sebagai fitur UAT internal dan tidak digunakan untuk membatalkan hak pedagang.
