# WORKFLOW e-SKPT, VERIFIKASI, KOREKSI, DAN PENGESAHAN TAHUNAN

## SKPT lama
Semua SKPT lama = `LEGACY_EXPIRED`.
Tidak ada migrasi otomatis ke `ACTIVE`.

## Workflow utama
```text
PUBLIC SUBMISSION
  ↓
ADMIN_REVIEW
  ↓
MASTER TRADER READY
  ↓
MARKET_VERIFICATION
  ├─ CORRECTION_REQUIRED
  ├─ CONFLICT
  └─ NOT_FOUND
  ↓
MARKET_VERIFIED
  ↓
KADIS_REVIEW
  ├─ RETURNED
  └─ REJECTED
  ↓
APPROVED
  ↓
TTE_PENDING
  ↓
ISSUED
```

## Kepala Pasar
Hanya verifikasi faktual. Dapat mengoreksi:
- nomor los/kios;
- blok;
- lantai;
- luas;
- jenis unit;
- pengguna aktual;
- catatan/foto lokasi.

Koreksi wajib menyimpan:
```json
{
  "field":"claimedUnitNumber",
  "before":"A-18",
  "after":"A-19",
  "reason":"Nomor fisik hasil pemeriksaan lapangan",
  "actorUid":"...",
  "actorRole":"MARKET_HEAD",
  "createdAt":"serverTimestamp"
}
```

Tidak boleh silent overwrite.

## Notifikasi Kadis
Perubahan material membuat notifikasi:
- marketId;
- nomor unit;
- blok;
- lantai;
- luas;
- pemegang;
- jenis usaha jika berdampak ke dokumen;
- konflik.

Kadis melihat submitted vs verified + alasan.

## Koreksi pedagang
Sebelum submit: bebas edit.

Setelah submit:
- tombol `Ajukan Koreksi`;
- menghasilkan `correction_requests`;
- tidak mengubah master.

Routing:
- terkait pasar → Kepala Pasar + Admin;
- data umum → Admin;
- NIK/identitas utama → Admin khusus.

## Masa berlaku
SKPT:
- berlaku 2 tahun;
- annual validation setiap tahun;
- annual validation tidak memperpanjang `validUntil`;
- setelah berakhir → aplikasi periode baru.

## Annual validation
Pemegang mengonfirmasi data eksisting:
- masih menggunakan tempat?;
- usaha sama?;
- unit sama?;
- ada perubahan?;
- setuju ketentuan tahunan?

Status:
`PENDING`
`MARKET_VERIFIED`
`VALIDATED`
`REJECTED`
`OVERDUE`

`OVERDUE` tidak otomatis berarti `REVOKED` kecuali aturan resmi menentukan.

## Renewal dua tahunan
Setelah `validUntil` → `EXPIRED`.
Aplikasi baru boleh prefill data lama, tetapi nomor SKPT baru dan verifikasi ulang unit tetap diperlukan.
