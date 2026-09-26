# Data Model e-Pasar V1

## Source of truth

`trader_intake` is untrusted public submission. `traders` is the reviewed master. `trader_private` and `nik_registry` are restricted. NIK is never a public document ID, URL, QR value, or card value.

## Collections

`trader_intake`, `traders`, `trader_private`, `nik_registry`, `businesses`, `business_locations`, `business_classifications`, `market_claims`, `market_units`, `market_occupancies`, `skpt_applications`, `skpt_documents`, `skpt_annual_validations`, `correction_requests`, `verification_records`, `notifications`, and `trader_media`.

## Relationships

`trader` 1—N `businesses`; `business` 1—N `business_locations`; `trader` N—N classifications through `business_classifications`; `trader` 1—N claims/occupancies; claims become verified units only through factual verification. Occupancy history is append-only and conflicts are represented, not silently overwritten.

## Identity and lifecycle

- Public registration code: opaque, non-sensitive.
- Master ID: `TRD-PIN-YY-XXXXXX`.
- NIK hash is used only in restricted dedupe registry; full NIK only in `trader_private`.
- SKPT lifecycle: `SUBMITTED → ADMIN_REVIEW → MARKET_VERIFICATION → MARKET_VERIFIED → KADIS_REVIEW → APPROVED → TTE_PENDING → ISSUED` plus correction/conflict/not-found/returned/rejected/cancelled states.
- Legacy SKPT menggunakan `LEGACY_VALID_UNTIL_EXPIRY`, `LEGACY_EXPIRED`, atau `LEGACY_REVIEW_REQUIRED` sesuai tanggal berakhir dan hasil telaah. Ketentuan ini mengikuti Pasal 31 Perda Kabupaten Pinrang Nomor 6 Tahun 2024 dan masih memerlukan keputusan migrasi tertulis.
- Issued SKPT validity is two years; annual validation never changes `validUntil`.

## Media and documents

One compressed WebP photo per `trader_media` document. `dataBase64` is excluded from indexes and never loaded in list queries. Profile hard cap is approximately 55 KB; location hard cap approximately 85 KB. SKPT PDFs are represented by metadata, hash, TTE status, and official reference—not Base64.

## Query/index policy

Use pagination for queues and dashboard lists. Candidate composite indexes are status/time or scoped market queries only. No broad realtime listener over media or private data.

## Identitas unit dan okupansi

- `market_claims` adalah klaim pemohon dan tidak menjadi identitas unit resmi.
- `market_units/{unitId}` adalah identitas permanen unit fisik. `unitId` diturunkan secara deterministik dari pasar, jenis unit, dan nomor unit yang telah dinormalisasi.
- `qrUnitToken` melekat pada `market_units`, bukan pedagang atau SKPT, sehingga tetap sama ketika pemegang berubah.
- `market_occupancies` menyimpan hubungan pemegang dengan unit dan bersifat append-only.
- Unit menyimpan pointer `currentTraderId` dan `currentOccupancyId` untuk penguncian okupansi aktif.
- Verifikasi klaim, pembuatan unit, pembuatan okupansi, audit, pembaruan aplikasi, dan notifikasi dilakukan dalam satu transaksi.
- Jika unit sudah mempunyai `currentTraderId` berbeda, sistem mencatat `CONFLICT`, tidak menimpa pemegang, dan tidak meneruskan berkas ke review Kadis.
- `skpt_documents.marketUnitId` wajib merujuk identitas unit resmi, bukan ID klaim.
