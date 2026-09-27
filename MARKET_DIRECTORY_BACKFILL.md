# Backfill Direktori Pedagang Pasar

Prosedur ini mengisi `market_trader_directory` dari relasi yang sudah ada pada
`market_claims`. Skrip tidak mengubah klaim, master pedagang, aplikasi SKPT,
unit, okupansi, atau hasil verifikasi.

## Pengaman

- Mode default adalah `DRY_RUN`.
- Hanya pasar kanonik `MKT-001` sampai `MKT-011` yang diproses.
- Klaim tanpa master pedagang dilewati dan dilaporkan.
- Dokumen memakai ID deterministik `<marketId>__<traderId>`.
- Mode apply hanya menggunakan create dengan precondition `exists=false`.
- Tidak ada update, merge, atau delete.
- Apply wajib menyertakan project ID dan batas jumlah write.

## 1. Audit read-only

Jalankan pada terminal PowerShell sementara:

```powershell
$env:EPASAR_AUDIT_EMAIL='akun-admin-resmi@example.go.id'
$env:EPASAR_AUDIT_PASSWORD='password-sementara'
node scripts/audit_market_integrity.js > audit-market-integrity.json
```

Periksa khusus `CLAIM_MISSING_MARKET_DIRECTORY`, `CLAIM_MISSING_TRADER`, dan
`CLAIM_MARKET_UNKNOWN`. Jangan lanjut apply sebelum anomali relasi dipahami.

## 2. Preview backfill

```powershell
node scripts/backfill_market_directory.js > backfill-market-preview.json
```

Pastikan output memiliki `mode: DRY_RUN`, `status: NO_WRITES_PERFORMED`, project
yang benar, dan jumlah kandidat yang masuk akal.

## 3. Apply terkontrol

Contoh di bawah sengaja memakai batas kecil. Ganti project dan batas hanya
setelah preview ditinjau:

```powershell
node scripts/backfill_market_directory.js --apply --confirm-project=e-skpt --max-writes=50
```

Jika kandidat melebihi `--max-writes`, skrip berhenti sebelum commit. Jika satu
dokumen dalam batch sudah ada, precondition menggagalkan batch tersebut tanpa
menimpa data yang sudah ada. Jalankan preview kembali sebelum mengulang apply.

## 4. Verifikasi setelah apply

Jalankan kembali audit dan preview. Targetnya:

- `CLAIM_MISSING_MARKET_DIRECTORY` menjadi nol untuk klaim valid;
- preview menghasilkan `candidateCount: 0`;
- akses Kepala Pasar lintas wilayah tetap ditolak oleh pengujian Rules.

Setelah seluruh klaim valid memiliki proyeksi, ubah `marketDirectoryScoped` pada
profil `users` setiap Kepala Pasar menjadi `true`. Flag ini sengaja tidak
diaktifkan otomatis oleh backfill agar pencabutan akses master dilakukan setelah
hasil audit diperiksa. Jangan aktifkan flag jika kandidat atau anomali relasi
masih tersisa.

Preview aktivasi seluruh akun aktif:

```powershell
node scripts/activate_market_directory_scope.js > market-scope-preview.json
```

Apply hanya setelah preview tidak memiliki akun `blocked`:

```powershell
node scripts/activate_market_directory_scope.js --apply --confirm-backfill-complete --confirm-project=e-skpt --max-accounts=10
```

Aktivasi menggunakan versi terakhir setiap dokumen akun. Jika profil berubah
setelah preview/read, batch terkait ditolak sehingga perubahan admin lain tidak
tertimpa. Skrip hanya mengubah `marketDirectoryScoped` dan `updatedAt`.

Hapus credential dari proses setelah selesai:

```powershell
Remove-Item Env:EPASAR_AUDIT_EMAIL
Remove-Item Env:EPASAR_AUDIT_PASSWORD
```
