# UI ADMIN, KEPALA PASAR, DAN NOTIFIKASI KADIS

## Dashboard Admin e-Pasar
KPI:
- total intake;
- belum direview;
- potensi duplicate NIK;
- trader master;
- pedagang pasar;
- pengajuan SKPT;
- menunggu Kepala Pasar;
- konflik unit;
- menunggu Kadis;
- SKPT issued;
- annual validation due.

Gunakan pagination. Jangan load foto pada table.

## Intake queue
Kolom:
- nomor registrasi;
- nama;
- kecamatan;
- tipe usaha;
- punya unit pasar?;
- ajukan SKPT?;
- waktu submit;
- status.

## Deduplikasi
Di detail Admin:
- normalisasi NIK;
- cek `nik_registry`;
- jika cocok, tampilkan trader existing;
- tombol `Hubungkan ke pedagang yang sama`;
- jangan buat master kedua.

## Kepala Pasar
Hanya melihat data pasar sesuai penugasannya.

Tampilkan:
- identitas ringkas;
- pasar;
- claim unit;
- foto lokasi;
- jenis usaha;
- referensi SKPT lama jika ada.

Aksi:
- Sesuai
- Koreksi fakta
- Konflik
- Tidak ditemukan
- Perlu pemeriksaan ulang

Koreksi wajib alasan.

## Diff viewer
Contoh:
```text
Dikirim pedagang    Hasil verifikasi
A-18                 A-19
```

## Notifikasi Kadis
Trigger material:
- nomor unit berubah;
- pasar berubah;
- blok/lantai/luas berubah;
- konflik pemegang;
- identitas utama berubah;
- rekomendasi penolakan;
- siap approve;
- annual validation bermasalah.

State:
`UNREAD | READ | ACTIONED`.

## Kadis review
Tampilan satu layar:
- identitas;
- usaha;
- unit;
- hasil verifikasi;
- correction diff;
- flags;
- pernyataan;
- timeline.

Aksi:
- Setujui
- Kembalikan
- Tolak

Setelah setuju:
`APPROVED -> TTE_PENDING`.

## Audit
Setiap perubahan status:
- actorUid;
- actorRole;
- action;
- previousStatus;
- newStatus;
- timestamp;
- note.

Audit trail read-only.
