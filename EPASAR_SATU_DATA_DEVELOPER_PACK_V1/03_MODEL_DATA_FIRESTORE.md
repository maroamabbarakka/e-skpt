# MODEL DATA FIRESTORE

## Collection inti

### `trader_intake`
Submit mentah publik. Tidak boleh dibaca publik.

Field utama:
```json
{
  "registrationCode": "REG-2026-XXXXXX",
  "submittedAt": "serverTimestamp",
  "status": "SUBMITTED",
  "identity": {
    "name": "...",
    "phone": "...",
    "district": "...",
    "village": "...",
    "address": "..."
  },
  "businessDrafts": [],
  "hasMarketUnit": true,
  "applySkpt": true,
  "source": "PUBLIC_FORM",
  "schemaVersion": 1
}
```

### `traders`
Master resmi setelah review/deduplikasi.
```json
{
  "traderId": "TRD-PIN-26-A8F72K",
  "displayName": "...",
  "maskedNik": "7315••••••••1234",
  "primaryPhone": "...",
  "district": "...",
  "village": "...",
  "status": "ACTIVE",
  "createdAt": "...",
  "updatedAt": "...",
  "schemaVersion": 1
}
```

### `trader_private`
Doc ID = `traderId`. Akses terbatas.
```json
{
  "nik": "16-digit",
  "nikKey": "sha256(normalizedNik)",
  "dateOfBirth": "...",
  "fullAddress": "...",
  "accessClass": "RESTRICTED"
}
```

### `nik_registry`
Doc ID = SHA-256 NIK normal. Admin-only.
```json
{"traderId":"...","createdAt":"..."}
```

Saat membentuk master gunakan transaksi:
1. baca `nik_registry/{nikKey}`;
2. bila ada, hubungkan ke trader existing;
3. bila tidak, create registry + trader.

Public form tidak menulis collection ini.

### `businesses`
Satu orang dapat memiliki beberapa usaha.

### `business_locations`
Satu usaha dapat memiliki beberapa lokasi.
Enum lokasi:
`STORE | STREET_VENDOR | MARKET | HOME | MOBILE | ONLINE | OTHER`.

### `business_classifications`
Multi-label:
`TRADE`, `INDUSTRY`, `CRAFT`, `DEKRANASDA_CANDIDATE`, `UMKM`, `EKRAF_KRIYA`, dll.

Setiap label punya:
- source;
- status `CLAIMED|VERIFIED|REJECTED`;
- verifiedBy;
- verifiedAt.

### `market_claims`
Data awal dari pedagang:
```json
{
  "traderId":"...",
  "marketId":"...",
  "claimedUnitType":"LOS",
  "claimedUnitNumber":"A-18",
  "claimedBlock":"A",
  "claimedFloor":"1",
  "claimedAreaM2":9,
  "locationHint":"...",
  "verificationStatus":"UNVERIFIED"
}
```

### `market_units`
Dibentuk/di-link setelah Kepala Pasar verifikasi.
```json
{
  "unitId":"UNIT-PSP-A-L1-0018",
  "marketId":"...",
  "unitType":"LOS",
  "officialNumber":"A-18",
  "block":"A",
  "floor":"1",
  "areaM2":9,
  "status":"ACTIVE",
  "verificationStatus":"VERIFIED"
}
```

### `market_occupancies`
Riwayat relasi pedagang ↔ unit. Jangan overwrite histori.

### `skpt_applications`
Status:
`SUBMITTED`
`ADMIN_REVIEW`
`MARKET_VERIFICATION`
`CORRECTION_REQUIRED`
`MARKET_VERIFIED`
`KADIS_REVIEW`
`APPROVED`
`TTE_PENDING`
`ISSUED`
`REJECTED`
`CANCELLED`

### `skpt_documents`
```json
{
  "skptId":"...",
  "traderId":"...",
  "marketUnitId":"...",
  "issueDate":"...",
  "validUntil":"...",
  "validityYears":2,
  "status":"ACTIVE",
  "tteStatus":"SIGNED",
  "documentHash":"...",
  "verificationToken":"...",
  "legacy":false
}
```

### `skpt_annual_validations`
Pengesahan tahunan; tidak mengubah `validUntil`.

### `correction_requests`
Permohonan koreksi publik/staf.

### `verification_records`
Before/after/reason hasil Kepala Pasar.

### `notifications`
Notifikasi internal, terutama perubahan material ke Kadis.

### `trader_media`
Satu dokumen per foto kecil.
```json
{
  "mediaId":"...",
  "ownerType":"TRADER|MARKET_CLAIM|CORRECTION",
  "ownerId":"...",
  "mediaType":"PROFILE|LOCATION|EVIDENCE",
  "mime":"image/webp",
  "width":640,
  "height":800,
  "binaryBytes":38000,
  "base64Bytes":50668,
  "dataBase64":"...",
  "status":"ACTIVE",
  "createdAt":"..."
}
```

## Index
`dataBase64` jangan diindeks.

Tambahkan field override:
```json
{
  "collectionGroup":"trader_media",
  "fieldPath":"dataBase64",
  "indexes":[]
}
```

Composite index hanya sesuai query nyata. Kandidat:
- `trader_intake.status + submittedAt`
- `skpt_applications.status + updatedAt`
- `market_claims.marketId + verificationStatus`
- `correction_requests.status + createdAt`
- `notifications.recipientUid + status + createdAt`

## Public verification
Jika diperlukan buat `public_skpt_verification`, hanya data aman:
- nomor;
- nama;
- pasar;
- unit;
- jenis usaha;
- tanggal;
- masa berlaku;
- status.

Jangan tampilkan NIK, alamat lengkap, WA, KTP.
