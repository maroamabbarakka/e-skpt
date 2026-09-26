# TTE, SKPT, WHATSAPP, DAN EMAIL

## TTE pada Spark
Jangan simpan credential TTE di JavaScript.

Jika TTE resmi membutuhkan secret server-side, jangan memaksakan integrasi langsung dari Firebase Hosting.

Phase 1:
1. Kadis approve di e-Pasar;
2. sistem menghasilkan data/draft final;
3. penandatanganan dilakukan melalui sistem TTE/persuratan resmi instansi;
4. admin mencatat:
   - status TTE;
   - signedAt;
   - documentHash;
   - reference/url arsip resmi.

Jika kelak ada integrasi resmi yang aman, buat adapter terpisah. Firebase tetap Spark.

## Metadata SKPT
- skptId;
- number;
- traderId;
- marketUnitId;
- issueDate;
- validUntil;
- validityYears = 2;
- annual validation status;
- signedBy;
- signedAt;
- tteStatus;
- documentHash;
- verificationToken.

## Dua QR
### QR Dokumen
Memeriksa validitas SKPT.

### QR Unit
Identitas permanen kios/los/lapak untuk operasional pasar.

Tidak ada NIK dalam QR.

## WhatsApp assisted share
Admin klik `Kirim via WhatsApp`.

Gunakan `wa.me` dan prefilled message, tanpa backend API pada fase awal.

Isi:
- salam;
- nama;
- ID Pedagang;
- status;
- nomor SKPT bila ada;
- link aman.

Jangan sertakan NIK penuh.

## Email
Fase awal dapat menggunakan `mailto:` atau sistem email resmi instansi.

## Ringkasan pedagang
Dapat memuat:
- ID Pedagang;
- nama;
- usaha;
- lokasi;
- status verifikasi;
- klasifikasi verified;
- SKPT aktif.

NIK hanya masked bila perlu.

## SKPT lama
Simpan nomor/tahun/referensi sebagai arsip dengan status `LEGACY_EXPIRED`.
