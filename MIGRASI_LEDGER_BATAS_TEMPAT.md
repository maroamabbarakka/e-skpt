# Migrasi Ledger Batas Dua Tempat per Pedagang per Pasar

## Tujuan

Koleksi `trader_market_place_ledgers` menjadi pengunci transaksi untuk aturan maksimal dua tempat per `traderId + marketId`. Dokumen tidak menggantikan klaim, okupansi, atau SKPT; ledger hanya menyimpan ID klaim yang masih diperhitungkan.

ID dokumen: `{traderId}__{marketId}`.

## Urutan produksi wajib

1. Jalankan `npm run audit:place-limit` menggunakan akun audit pusat read-only melalui environment lokal.
2. Simpan JSON hasil audit sebagai artefak rilis di luar repository.
3. Jika `violations > 0`, hentikan migrasi. Petugas berwenang harus menentukan klaim historis yang sah; skrip tidak boleh menutup atau menghapus klaim otomatis.
4. Ambil snapshot koleksi `market_claims`, `market_occupancies`, `skpt_applications`, `skpt_documents`, dan ledger bila sudah ada.
5. Catat jumlah dokumen dan hash manifest snapshot.
6. Jalankan backfill pada staging dengan service account terbatas. Backfill harus `create/merge` idempoten dan tidak mengubah klaim.
7. Jalankan kembali audit; target `missing = 0`, `mismatched = 0`, `violations = 0`.
8. Uji dua request paralel pada pedagang/pasar sama: hanya satu request yang boleh mengambil slot terakhir.
9. Deploy Security Rules sebelum mengaktifkan frontend schema 2 yang menulis klaim baru.
10. Pantau kegagalan transaksi dan jumlah ledger selama masa observasi.

## Rollback

- Nonaktifkan pembentukan klaim schema 2 dari UI.
- Kembalikan Rules versi sebelumnya hanya setelah frontend dinonaktifkan.
- Ledger bersifat additive sehingga tidak perlu dihapus untuk rollback.
- Jangan menghapus ledger atau klaim secara massal.
- Pulihkan dokumen hanya dari manifest snapshot yang terverifikasi jika terdapat korupsi.

## Kriteria lulus

- Setiap klaim schema 2 memiliki ledger yang sesuai.
- Setiap ledger berisi maksimal dua ID klaim unik.
- Klaim ketiga ditolak oleh Rules, termasuk melalui SDK langsung.
- Pasar berbeda memiliki ledger berbeda.
- Pembaruan/perpanjangan tempat memakai claim/place identity lama dan tidak mengambil slot baru.
- Tidak ada klaim historis, okupansi, nomor SKPT, atau dokumen terbit yang dihapus.
