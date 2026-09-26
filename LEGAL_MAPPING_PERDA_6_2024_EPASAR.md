# Pemetaan Perda Kabupaten Pinrang Nomor 6 Tahun 2024 terhadap e-PASAR/e-SKPT

Status: hasil pembacaan menyeluruh naskah pindai lokal 16 halaman, diverifikasi visual pada halaman yang memuat ketentuan SKPT. Dokumen ini adalah pemetaan kebutuhan sistem, bukan pendapat hukum. Penetapan SOP tetap menjadi kewenangan Pemerintah Kabupaten Pinrang.

## 1. Identitas dan keandalan sumber

- Judul: **Peraturan Daerah Kabupaten Pinrang Nomor 6 Tahun 2024 tentang Pengelolaan Pasar Rakyat**.
- Ditetapkan dan diundangkan di Pinrang pada 18 September 2024.
- Lembaran Daerah Kabupaten Pinrang Tahun 2024 Nomor 6.
- Nomor registrasi: B.HK.06.077.24.
- Sumber kerja: `Perda 2024 - Pengelolaan Pasar Rakyat.pdf`, 16 halaman, berupa pindai gambar tanpa lapisan teks.
- Metode pemeriksaan: OCR Bahasa Indonesia per halaman dan verifikasi visual terhadap halaman asli. OCR hanya alat bantu; isi pasal yang dipakai dalam implementasi diperiksa kembali pada citra halaman.

## 2. Pemetaan ketentuan utama

| Pasal | Pokok ketentuan | Dampak terhadap sistem | Status aplikasi / tindakan |
|---|---|---|---|
| 1 angka 9 | Kepala Pasar adalah PNS yang ditunjuk sebagai penanggung jawab pengelolaan pasar pada wilayah kerjanya. | Akun Kepala Pasar harus terikat pasar/wilayah dan tidak boleh memverifikasi pasar lain. | Sudah menjadi model akses; wajib dipertahankan pada rules dan UAT lintas pasar. |
| 1 angka 13 | SKPT dikeluarkan Kepala Dinas kepada perseorangan/badan untuk menempati kios dan los pada lokasi yang dikuasai/dikelola Pemda. | Otoritas penerbit final adalah Kepala Dinas; SKPT bukan produk Kepala Pasar. Cakupan eksplisit definisi adalah kios dan los. | Alur Kadis sesuai. Istilah `LAPAK` perlu kajian karena definisi SKPT menyebut kios/los, sedangkan pasal lain menyebut pelataran. |
| 1 angka 15–16 | Pelataran dan Pedagang didefinisikan sebagai bagian/aktor pasar. | Model unit boleh menyimpan pelataran/lapak, tetapi penerbitan SKPT untuk kategori tersebut memerlukan kepastian SOP. | Tambahkan validasi kebijakan sebelum go-live untuk SKPT jenis `LAPAK`. |
| 13 | Kepala Dinas mengatur penggunaan tempat di pasar dan pelataran menurut jenis dagangan, kebutuhan, dan luas. | Klaim pedagang bukan penetapan unit resmi; verifikasi dan penataan wajib berada pada petugas berwenang. | Sesuai konsep klaim dan verifikasi Kepala Pasar. |
| 15 ayat (1)–(4) | Pedagang yang memakai tempat tetap harus memiliki SKPT; SKPT memberi hak penempatan dan bukan bukti kepemilikan. | Dokumen dan verifikasi publik harus menyatakan sifat administratif dan bukan bukti kepemilikan. | Sudah diterapkan; rumusan diperkuat. |
| 15 ayat (5) | SKPT berlaku dua tahun dan dapat diperpanjang. | `validUntil` dua tahun benar. Perpanjangan harus diproses sebagai periode/permohonan baru atau mekanisme yang ditetapkan SOP. | Masa berlaku sesuai. Kata “dapat diperpanjang” wajib tercermin dan tidak boleh diklaim otomatis. |
| 16 ayat (1) | Permohonan tertulis diajukan kepada Bupati melalui Dinas. | Form elektronik perlu diposisikan sebagai media permohonan kepada Bupati melalui Dinas dan menghasilkan surat permohonan/rekaman yang dapat diaudit. | Alur digital tersedia; kop/tujuan permohonan perlu diverifikasi tata naskah. |
| 16 ayat (2) | Pedagang lama melampirkan surat perjanjian/izin lama dan pernyataan menaati kewajiban. | Sistem perlu cabang pedagang lama, lampiran izin lama, dan pernyataan. | Belum lengkap sebagai cabang khusus. |
| 16 ayat (3) | Pedagang baru: nama, tempat/tanggal lahir, agama, kewarganegaraan, alamat, luas/letak tempat, jenis dagangan. | Agama dan kewarganegaraan diperlukan khusus pengajuan SKPT; luas/letak dan jenis dagangan harus masuk snapshot dokumen. | Nama, lahir, alamat, letak, luas, dagangan ada. Agama dan kewarganegaraan belum tersedia. |
| 16 ayat (4) | Lampiran: materai secukupnya, foto warna 4×6 tiga lembar, fotokopi/pindai KTP, dan surat pernyataan bersedia. | Proses digital perlu kebijakan e-meterai/materai, satu foto digital yang dapat direproduksi, KTP restricted, dan pernyataan elektronik berversi. | Foto dan pindai KTP tersedia tetapi masih opsional; ketentuan materai belum diputuskan. Pernyataan elektronik tersedia. |
| 17 | Dasar pencabutan, peringatan lisan/tertulis, kewenangan Kepala Dinas, dan pengosongan setelah tujuh hari. | Perlu modul peringatan, pencabutan, alasan, bukti, tanggal, dan audit trail; Kepala Pasar tidak boleh mencabut final. | Belum lengkap. Jangan menyamakan `REJECTED` permohonan dengan pencabutan SKPT terbit. |
| 18 | Izin berakhir karena pengunduran diri/meninggal; ahli waris memiliki mekanisme pergantian. | Perlu status berakhir, pengunduran diri, kematian, permohonan ahli waris, dan tenggat 15 hari. | Belum tersedia sebagai workflow operasional. |
| 20 | Bukti retribusi dan SKPT harus dapat ditunjukkan; ketertiban penggunaan api dan batas dagangan. | Verifikasi QR mendukung bukti SKPT. Bukti retribusi dan inspeksi keselamatan berada di luar cakupan versi saat ini. | Verifikasi SKPT ada; modul lain belum ada. |
| 21 | Tiga hak pedagang. | Isi SKPT/pernyataan tidak boleh mengurangi hak ini. | Teks SKPT diselaraskan. |
| 22 | Empat kewajiban pedagang. | Pernyataan dan SKPT harus mengacu pada rumusan ini. | Teks SKPT diselaraskan; pernyataan perlu mencatat persetujuan berversi. |
| 27 ayat (1) | Empat larangan, termasuk maksimal dua SKPT dalam satu lokasi dan larangan pengalihan tanpa izin. | Perlu pemeriksaan jumlah SKPT per pedagang/lokasi dan workflow alih pemegang. | Teks dokumen diselaraskan; enforcement otomatis belum lengkap. |
| 28 huruf d | Pembinaan dapat berupa penggunaan sistem informasi pasar. | Memberi dukungan normatif terhadap e-PASAR. | Sesuai. |
| 29 | Bentuk pengawasan pasar. | Data penggunaan lahan, ketertiban, dan audit perlu dapat ditelusuri. | Audit trail parsial; modul pengawasan komprehensif belum ada. |
| 30 | Pelanggaran Pasal 20, 22, dan 27 dikenai sanksi administratif; pencabutan final oleh Kepala Dinas bila tetap tidak taat. | Status sanksi harus dipisahkan dari koreksi data dan penolakan aplikasi. | Belum lengkap. Rumusan sanksi pada SKPT telah diselaraskan. |
| 31 ayat (1)–(2) | Izin lama tetap berlaku sepanjang tidak bertentangan; SKPT lama tetap berlaku sampai tanggal berakhirnya. | Arahan `LEGACY_EXPIRED` untuk semua SKPT lama bertentangan dengan bunyi Perda. | **Keputusan hukum/pemilik wajib sebelum migrasi data.** Jangan membatalkan massal tanpa dasar lain. |
| 32 | Peraturan pelaksanaan ditetapkan paling lama satu tahun sejak diundangkan. | Perbup/SOP pelaksana harus dicari dan diperiksa karena dapat mengatur detail yang tidak ada dalam Perda. | Belum tersedia dalam paket lokal; wajib diverifikasi ke Bagian Hukum/JDIH. |

## 3. Dua konflik kebijakan yang tidak boleh diputuskan oleh kode

### 3.1 SKPT lama

Arahan teknis awal menyatakan semua SKPT lama `LEGACY_EXPIRED`. Pasal 31 ayat (2) justru menyatakan SKPT yang telah dikeluarkan tetap berlaku sampai tanggal berakhirnya. Implementasi aman:

1. inventarisasi nomor, tanggal terbit, dan tanggal berakhir SKPT lama;
2. status awal `LEGACY_VALID_UNTIL_EXPIRY` bila belum berakhir dan tidak ada dasar pencabutan;
3. `LEGACY_EXPIRED` hanya setelah tanggal berakhir atau keputusan pencabutan yang sah;
4. simpan sumber migrasi dan keputusan pejabat;
5. minta keputusan tertulis Bagian Hukum/pemilik proses sebelum migrasi produksi.

### 3.2 Pengesahan tahunan

Perda 6/2024 tidak memuat kewajiban pengesahan atau registrasi ulang tahunan. Perda hanya menyebut masa berlaku dua tahun dan dapat diperpanjang. Karena format SKPT lama memuat kolom daftar/register tahunan, mekanisme tersebut mungkin berasal dari SOP, keputusan, atau peraturan pelaksana lain. Sampai sumbernya ditemukan:

- fitur pengesahan tahunan boleh dipertahankan sebagai rancangan internal;
- jangan menyatakan kewajiban itu bersumber dari Perda 6/2024;
- jangan menjadikan tidak adanya pengesahan tahunan sebagai alasan otomatis membatalkan SKPT;
- publikasi final menunggu SOP/keputusan tertulis dan pemeriksaan Peraturan Bupati pelaksana Pasal 32.

## 4. Kesenjangan wajib sebelum dinyatakan siap operasional publik

1. Putuskan status SKPT lama berdasarkan Pasal 31.
2. Temukan dan telaah Peraturan Bupati/peraturan pelaksana Pasal 32 serta SOP penerbitan SKPT.
3. Tetapkan dasar dan akibat hukum pengesahan tahunan.
4. Tambahkan cabang pedagang lama dan unggahan izin/perjanjian lama.
5. Tambahkan agama dan kewarganegaraan khusus pemohon SKPT dengan akses privat.
6. Jadikan foto dan pindai KTP persyaratan pengajuan SKPT; tetapkan padanan digital “foto 4×6 tiga lembar”.
7. Keputusan pemilik: aplikasi tidak memakai e-meterai. Persetujuan checkbox tetap dicatat sebagai afirmasi elektronik dan tidak diklaim menggantikan ketentuan meterai; perlakuan administratif meterai fisik perlu ditegaskan dalam SOP.
8. Bangun workflow peringatan, pencabutan, pengunduran diri, kematian, dan ahli waris.
9. Batasi maksimal dua SKPT per pedagang dalam satu lokasi dengan transaksi/validasi yang tidak dapat dilewati dari client.
10. Konfirmasi apakah unit `LAPAK/PELataran` dapat diterbitkan SKPT berdasarkan peraturan pelaksana.

## 5. Kesimpulan audit

Perda 6/2024 merupakan dasar hukum daerah utama dan langsung untuk e-SKPT, terutama Pasal 15–18, 20–22, 27, 30, dan 31. Aplikasi telah memiliki fondasi yang searah untuk permohonan, verifikasi faktual, penerbitan oleh Kepala Dinas, masa berlaku dua tahun, QR, dan penegasan bukan bukti kepemilikan. Namun aplikasi belum boleh dinyatakan selesai secara hukum sebelum konflik SKPT lama, dasar pengesahan tahunan, persyaratan Pasal 16, serta workflow pencabutan/ahli waris dituntaskan melalui keputusan pemilik proses dan aturan pelaksana.
