# Petunjuk Teknis e-PASAR Kabupaten Pinrang

## 1. Tujuan

e-PASAR adalah satu tempat untuk mencatat pedagang, usaha, lokasi usaha, unit pasar, proses e-SKPT, koreksi data, serta pengesahan tahunan. Satu pedagang dapat memiliki lebih dari satu usaha dan lokasi tanpa membuat identitas baru.

## 2. Prinsip layanan

- NIK dipakai untuk mencegah data ganda, tetapi tidak menjadi alamat halaman, isi QR, atau nomor kartu.
- Form masyarakat dibuat ringkas dalam lima langkah dan dapat digunakan pada telepon genggam.
- Data yang diketik pedagang tentang kios, los, atau lapak adalah klaim awal. Data itu baru menjadi data resmi setelah diperiksa Kepala Pasar.
- Setelah dikirim, data induk tidak boleh diubah diam-diam. Perubahan harus melalui permohonan koreksi atau perubahan pemegang unit.
- Foto diperkecil di perangkat, diubah ke WebP, lalu disimpan terpisah dari data utama.
- PDF berukuran besar tidak disimpan di Firestore. Sistem menyimpan isi terstruktur, hash, status, dan referensi dokumen.
- Aplikasi tidak menggunakan e-meterai.
- TTE Kadis belum terintegrasi. Sistem hanya mencatat keputusan Kadis dan status bahwa TTE belum terintegrasi; sistem tidak boleh menyatakan tanda tangan elektronik tersertifikasi.

## 3. Peta halaman

### Halaman masyarakat

- `index.html`: portal utama dan pintu masuk seluruh layanan.
- `epasar.html`: pendataan pedagang.
- `epasar-status.html`: pemeriksaan perkembangan menggunakan nomor registrasi.
- `verifikasi-skpt.html`: pemeriksaan SKPT melalui token atau QR.
- `panduan.html`: petunjuk sederhana menurut peran.

### Halaman petugas

- `login.html`: masuk dengan email atau nama pengguna yang dipetakan ke email.
- `admin-epasar.html`: ringkasan antrean kerja.
- `admin-intake-review.html`: pemeriksaan pendaftaran dan pembentukan data induk.
- `market-verification.html`: pemeriksaan klaim kios, los, atau lapak.
- `kadis-approval.html`: keputusan akhir dan pencatatan penerbitan.
- `annual-validation.html`: pengesahan tahunan selama masa berlaku SKPT.
- `occupancy-change.html`: pelepasan atau pengalihan pemegang unit.
- `admin-akun.html`: pengelolaan akun oleh Super Admin.
- `profil.html`: profil jabatan dan penggantian password.
- `photo-editor.html`: pemeriksaan dan penyiapan foto dokumen.

### Halaman dokumen

Halaman surat pernyataan, surat permohonan, kartu pedagang, dan SKPT dibuka dari rekam data yang sesuai. Halaman tersebut membutuhkan identitas dokumen atau token, sehingga tidak dipakai sebagai menu bebas tanpa data.

## 4. Alur pedagang

1. Pedagang mengisi identitas, usaha, hubungan dengan pasar, foto, dan pilihan SKPT.
2. Jika tidak menggunakan unit pasar, pendataan tetap dapat selesai.
3. Jika menggunakan unit pasar, nomor yang ditulis tetap berstatus klaim sampai diverifikasi.
4. Pedagang membaca pernyataan elektronik dan memberi semua persetujuan wajib.
5. Sistem membuat nomor registrasi. Nomor ini harus disimpan oleh pedagang.
6. Kesalahan setelah pengiriman diperbaiki melalui permohonan koreksi, bukan langsung mengubah data induk.

## 5. Alur petugas

### Admin

Admin memeriksa kelengkapan, kesamaan NIK, isi usaha, dan lampiran. Setelah lolos, Admin membentuk data induk. Hak akses privat hanya diberikan kepada petugas yang memang memerlukan.

### Kepala Pasar

Kepala Pasar hanya memeriksa fakta lapangan. Jika nomor unit berubah, sistem menyimpan data sebelum, data sesudah, alasan, pelaku, peran, dan waktu. Konflik pemegang tidak boleh diselesaikan dengan menimpa catatan lama.

### Kadis

Kadis membandingkan data pemohon dengan hasil verifikasi, lalu menyetujui, mengembalikan, atau menolak. Penerbitan mencatat nomor SKPT, masa berlaku dua tahun, hash, QR verifikasi, dan status TTE yang sebenarnya.

## 6. Perubahan pemegang unit

1. Kepala Pasar memilih pelepasan atau pengalihan.
2. Untuk pengalihan, penerima harus sudah memiliki data pedagang yang sah.
3. Permohonan masuk sebagai perubahan hunian berstatus menunggu keputusan.
4. Kadis atau Super Admin memeriksa alasan dan penerima.
5. Persetujuan menutup hunian lama dan, jika pengalihan, membuat hunian baru dalam satu transaksi.
6. Identitas QR unit tidak berubah walaupun pemegang berubah.

## 7. Pengesahan tahunan

- Pengesahan dilakukan secara digital melalui aplikasi.
- Pengesahan hanya berlaku untuk SKPT yang masih berada dalam masa berlaku.
- Pemeriksaan tahunan mencatat kondisi unit, pemegang aktual, catatan, petugas, dan waktu.
- Pengesahan tahunan tidak mengubah atau memperpanjang tanggal berakhir SKPT.
- Setelah dua tahun, pedagang harus mengajukan periode baru.

## 8. Surat pernyataan dan dokumen

Pernyataan elektronik memuat versi naskah, persetujuan wajib, waktu, dan identitas rekam permohonan. Pernyataan ini bukan TTE tersertifikasi dan bukan pengganti kewajiban meterai yang mungkin ditentukan melalui keputusan hukum atau SOP di luar aplikasi. Sesuai keputusan pemilik, aplikasi tidak menyediakan e-meterai.

SKPT dicetak pada A4, menggunakan identitas Pemerintah Kabupaten Pinrang, bingkai pengaman, foto rasio 3:4, data unit, hak dan kewajiban, QR, masa berlaku, serta ruang pengesahan yang relevan. Tautan QR dibentuk dari alamat situs saat aplikasi berjalan, sehingga pada situs daring tidak menggunakan alamat `127.0.0.1`.

## 9. Keamanan dan privasi

- Masyarakat hanya boleh membuat pendaftaran atau koreksi yang bentuknya telah dibatasi.
- Masyarakat tidak boleh membaca daftar pendaftaran, data pedagang, peran, notifikasi internal, atau keputusan SKPT.
- Peran berasal dari data akun tepercaya, bukan pilihan di browser.
- NIK lengkap disimpan di area privat dan tidak dikirim melalui WhatsApp atau email.
- Daftar tidak memuat Base64 foto. Foto dimuat hanya ketika detail dibuka.
- Semua perubahan penting harus meninggalkan riwayat.

## 10. Persiapan dan pemeriksaan lokal

1. Pastikan `NOTE_FIREBASE_LOCAL.md` tersedia secara lokal dan tidak masuk Git.
2. Jalankan pemeriksaan aplikasi: `python scripts/check_epasar.py`.
3. Jalankan pengujian Security Rules melalui Firebase Emulator.
4. Jalankan pengujian browser pada 360×640, 390×844, 412×915, tablet, dan desktop.
5. Buat paket: `python scripts/build_production.py`.
6. Pastikan halaman, JavaScript, CSS, model foto, dan tiga video panduan ada di `dist`.
7. Jangan melakukan deployment otomatis. Deployment hanya dilakukan setelah izin pemilik.

## 11. Pemeriksaan sebelum layanan publik

- Seluruh skenario UAT berstatus lulus dan ditandatangani penanggung jawab.
- Security Rules telah lulus emulator, bukan hanya dibaca manual.
- Akun jabatan, penugasan pasar, dan penggantian password telah diuji.
- Indeks Firestore selesai dibangun.
- Kapasitas Firestore awal dicatat.
- Data latihan diberi tanda dan tersedia prosedur penghapusan.
- Dasar hukum dan naskah dokumen mendapat pengesahan pejabat berwenang.
- Integrasi TTE, bila kelak ditambahkan, dilakukan melalui sistem resmi tanpa menyimpan PIN, private key, atau kredensial di browser maupun repositori.

## 12. Penanganan masalah singkat

- **Tidak bisa masuk:** periksa email/nama pengguna, password, status akun, dan koneksi.
- **Data tidak muncul:** muat ulang, periksa peran dan penugasan pasar; jangan membuka akses aturan secara umum.
- **Permintaan indeks:** tambahkan indeks yang tepat ke `firestore.indexes.json`, lalu tunggu sampai status indeks siap.
- **Foto gagal:** gunakan JPEG/PNG yang jelas dan ulangi setelah kompresi; jangan menaikkan batas ukuran tanpa mengukur kuota.
- **Konflik unit:** hentikan penerbitan dan selesaikan melalui verifikasi serta perubahan pemegang.
- **QR membuka alamat lokal:** dokumen dibuat saat aplikasi berjalan dari alamat lokal; buat ulang dokumen pada domain resmi setelah tersedia.
