# Register Data UAT Live e-PASAR

Data UAT live wajib memakai `isDemo: true` dan `environment: INTERNAL_UAT`.

Seed admin mencakup empat master pedagang:

- `REG-UAT-0001` — SKPT issued; klaim A-18 diverifikasi menjadi A-19.
- `REG-UAT-0002` — SKPT issued; unit B-07 terkonfirmasi.
- `REG-UAT-0003` — pedagang non-pasar, tanpa SKPT.
- `REG-UAT-0004` — konflik unit, belum boleh dianggap issued.

Seed admin tidak menulis `trader_intake`, karena collection tersebut hanya menerima create anonim dengan schema publik dan timestamp server. Untuk menguji intake riil, submission harus dikirim melalui `epasar.html`, kemudian diproses admin melalui workflow.

Script seed membaca credential hanya dari environment lokal:

```text
EPASAR_ADMIN_EMAIL
EPASAR_ADMIN_PASSWORD
```

Sebelum eksekusi live:

1. Pastikan akun admin yang dipakai berstatus `ACTIVE`.
2. Pastikan seluruh data seed memiliki `isDemo: true`.
3. Verifikasi dashboard dapat membedakan data UAT dan operasional.
4. Uji dokumen issued dan konflik secara terpisah.
5. Hapus data berdasarkan daftar ID UAT setelah uji selesai, sebelum publikasi.

Seed admin dan seed Kepala Pasar dijalankan terpisah. Jangan mengganti credential Kepala Pasar dengan Super Admin pada script verifikasi, karena tujuan UAT adalah membuktikan pembatasan akses berdasarkan `marketIds`.
