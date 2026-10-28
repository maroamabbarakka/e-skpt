# Migrasi Scope Admin Wilayah

Status produksi: selesai diterapkan 12 Oktober 2026. Backup pra-migrasi berada di `artifacts/scope-migration-backup-20261012133140`.

Perubahan ini membatasi role `MARKET_ADMIN` berdasarkan `users/{uid}.marketIds`. Pendaftaran pasar menggunakan field denormalisasi `trader_intake.routingMarketIds` agar query, pagination, dan Firestore Rules memakai sumber routing yang sama.

## Kondisi dry-run 12 Oktober 2026

- Total dokumen `trader_intake`: 221.
- Dokumen yang perlu di-backfill: 189.
- Pendaftaran pasar tanpa market ID kanonis: 0.
- Pendaftaran non-pasar yang perlu diubah: 0.

## Urutan rilis wajib

1. Simpan backup/inventaris produksi.
2. Jalankan dry-run:

   ```powershell
   $env:EPASAR_ADMIN_PASSWORD='...'
   node scripts/backfill_intake_routing.js
   ```

3. Tinjau bahwa `marketIntakesWithoutRoute` bernilai `0`.
4. Jalankan backfill dengan konfirmasi eksplisit:

   ```powershell
   node scripts/backfill_intake_routing.js --apply --confirm-routing-backfill
   ```

5. Verifikasi ulang dry-run sampai `changes` bernilai `0`.
6. Deploy indeks Firestore dan tunggu status indeks siap.
7. Deploy Firestore Rules.
8. Build dan deploy Hosting.
9. Uji silang Admin Wilayah I dan II, termasuk direct URL review dan olah foto.

Jangan men-deploy Rules lebih dahulu. Dokumen lama tanpa `routingMarketIds` akan ditolak untuk role `MARKET_ADMIN`.

Pendaftaran non-pasar tidak diberikan kepada Admin Wilayah karena tidak mempunyai `marketId`. Role administrasi pusat tetap menanganinya sampai kebijakan routing kecamatan ditetapkan.

## Catatan batasan Firestore

Firestore Rules tidak dapat membuktikan irisan dua array dinamis untuk operasi list/query. Karena itu query aplikasi dibatasi server-side menggunakan `routingMarketIds array-contains-any marketIds`, sedangkan Rules menerapkan scope ketat pada direct `get` dan `update`. Operasi list tetap mensyaratkan staf aktif. Hardening list sepenuhnya membutuhkan koleksi proyeksi per pasar dengan field `marketId` skalar.
