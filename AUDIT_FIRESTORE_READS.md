# Audit Pembacaan Firestore — Firebase Spark

## Kesimpulan akar masalah (29 Oktober 2026)

Kuota bukan habis karena jumlah akun atau jumlah baris yang terlihat di tabel. Cloud Monitoring menunjukkan hampir seluruh konsumsi berasal dari `QUERY`; `LOOKUP` dan `NOT_FOUND` sangat kecil. Lonjakan berulang mendekati batas gratis 50.000 document reads per hari.

Snapshot inventory live 28 Oktober membuktikan data tidak lagi sangat minim: ada 7.852 dokumen yang dapat dibaca pada 18 koleksi. Koleksi terbesar ialah `trader_media` (2.781), `trader_intake` (817), `market_claims` (482), `skpt_applications` (482), serta beberapa master dengan sekitar 435 dokumen.

`inventory_live_uat.js` membaca semua dokumen tersebut. Satu eksekusi menghabiskan sedikitnya 7.852 reads. Dua inventory pada 29 Oktober pukul 00.57 dan 01.04 WITA berarti sedikitnya 15.704 reads dalam sekitar tujuh menit. Waktunya berimpit dengan lonjakan Cloud Monitoring. Ini sumber konsumsi besar yang terverifikasi.

Halaman `database-pedagang` juga memindai penuh tujuh kelompok data ketika dibuka role pusat: `market_claims`, `traders`, `businesses`, `skpt_applications`, `skpt_documents`, `market_units`, dan `market_occupancies`. Berdasarkan snapshot yang sama, satu pembukaan membaca sekitar 1.898 dokumen walaupun tabel hanya menampilkan 15 baris. Tombol Muat Ulang mengulang scan.

Contoh metrik `QUERY`: 50.044 pada 24 Oktober 01.15 UTC; 51.235 pada 22 Oktober 08.15 UTC; dan total 49.232 pada tiga bucket 28 Oktober 16.15–18.15 UTC. Angka ini adalah dokumen yang dibaca melalui query, bukan jumlah request HTTP.

## Pengamanan

- Helper audit full-scan dan inventory live sekarang gagal tertutup kecuali operator menetapkan `EPASAR_ALLOW_FULL_SCAN=YES`.
- Inventory, backup penuh, simulasi semua role, dan capture semua halaman dilarang dijalankan berulang pada produksi.
- Audit rutin harus memakai agregasi `count()`, query terbatas, atau emulator.
- Database master harus dimigrasikan ke pagination server/projection sebelum volume produksi bertambah.

## Perbaikan operasional 29 Oktober 2026

- Halaman Database Master tidak lagi menjalankan full scan. Query utama dibatasi server ke 30 klaim.
- Relasi aplikasi, usaha, dan dokumen SKPT dibaca berdasarkan ID untuk klaim yang sedang tampil saja.
- Batas teoritis satu pemuatan adalah 120 dokumen, dibanding sekitar 1.898 dokumen sebelumnya.
- Permintaan pemuatan yang berlangsung bersamaan digabungkan dan tombol refresh memiliki cooldown 30 detik.
- Fungsi full scan lama dibuat gagal tertutup.
- `refresh_public_stats.js` kini juga memerlukan interlock `EPASAR_ALLOW_FULL_SCAN=YES`.

Kebijakan proyek adalah tetap menggunakan paket Spark. Karena trafik publik dan operasi admin berbagi batas harian, pengendalian dilakukan melalui query terbatas, cooldown, cache, agregasi, interlock full scan, telemetry, dan penghentian audit massal pada project produksi. Aplikasi tidak boleh menampilkan atau meminta upgrade paket kepada pengguna.

## Instrumentasi

Halaman database pedagang mencatat telemetry per pemuatan pada `window.EPASAR_READ_TELEMETRY` dan console browser:

- jumlah query pagination;
- jumlah dokumen yang diterima oleh jalur `readAll`;
- durasi pemuatan;
- scope kabupaten/wilayah.

Nilai ini tidak dikirim ke layanan eksternal dan tidak memuat data pribadi.

## Gerbang staging

1. Kosongkan cache browser dan buka halaman satu kali untuk setiap role.
2. Catat telemetry Super Admin, Admin pusat, Admin Wilayah I, dan Admin Wilayah II.
3. Ulangi dengan cache hangat.
4. Pastikan akun wilayah hanya membaca pasar yang ditugaskan.
5. Pisahkan pengujian tampilan harian dari ekspor lengkap.
6. Gagal rilis bila halaman melakukan retry otomatis setelah `resource-exhausted` atau jumlah reads meningkat tanpa penjelasan.

## Catatan

Telemetry sisi klien merupakan estimasi dokumen yang diterima, bukan pengganti metrik billing Firebase. Perbandingan final wajib menggunakan Firebase Usage dashboard pada project staging selama skenario UAT yang sama.
