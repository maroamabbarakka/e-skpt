# Landasan Hukum e-PASAR dan e-SKPT Pinrang

Status dokumen: hasil riset awal berbasis sumber resmi, untuk telaah Bagian Hukum/JDIH dan pemilik proses Pemerintah Kabupaten Pinrang sebelum penerbitan publik.

Dokumen ini membatasi klaim sistem. Ia bukan pendapat hukum dan tidak menggantikan penetapan kewenangan, SOP, atau keputusan pejabat yang berwenang.

## 1. Dasar hukum yang terverifikasi

### 1.0 Dasar khusus Pengelolaan Pasar Rakyat dan SKPT

**Peraturan Daerah Kabupaten Pinrang Nomor 6 Tahun 2024 tentang Pengelolaan Pasar Rakyat** adalah dasar daerah yang secara langsung mendefinisikan dan mengatur SKPT. Naskah lokal 16 halaman telah dibaca dengan OCR per halaman dan pemeriksaan visual terhadap halaman pasal terkait. Perda ini ditetapkan dan diundangkan pada 18 September 2024, tercatat dalam Lembaran Daerah Kabupaten Pinrang Tahun 2024 Nomor 6, dengan nomor registrasi B.HK.06.077.24.

Ketentuan yang langsung mengikat desain e-SKPT:

- Pasal 1 angka 13: SKPT dikeluarkan Kepala Dinas kepada perseorangan/badan untuk menempati kios dan los pada lokasi yang dikuasai atau dikelola Pemerintah Daerah;
- Pasal 15 ayat (1)–(4): SKPT memberi hak penempatan dan bukan bukti kepemilikan;
- Pasal 15 ayat (5): masa berlaku dua tahun dan dapat diperpanjang;
- Pasal 16: permohonan, data pemohon, dan lampiran SKPT;
- Pasal 17–18: pencabutan, berakhirnya izin, dan pergantian oleh ahli waris;
- Pasal 20–22: tata tertib, hak, dan kewajiban;
- Pasal 27 dan Pasal 30: larangan dan sanksi administratif;
- Pasal 31: izin/SKPT yang telah diterbitkan tetap berlaku menurut ketentuan peralihan;
- Pasal 32: peraturan pelaksanaan harus ditetapkan paling lama satu tahun sejak Perda diundangkan.

Pemetaan terperinci tersedia pada `LEGAL_MAPPING_PERDA_6_2024_EPASAR.md`.

### 1.1 Kerangka retribusi daerah

1. **Undang-Undang Nomor 1 Tahun 2022 tentang Hubungan Keuangan antara Pemerintah Pusat dan Pemerintahan Daerah** menjadi kerangka nasional pajak dan retribusi daerah. Pasal 94 mengharuskan seluruh jenis pajak dan retribusi daerah ditetapkan dalam satu Perda sebagai dasar pemungutan.
2. **Peraturan Pemerintah Nomor 35 Tahun 2023 tentang Ketentuan Umum Pajak Daerah dan Retribusi Daerah** berstatus berlaku dan menjadi aturan pelaksana nasional.
3. **Peraturan Daerah Kabupaten Pinrang Nomor 1 Tahun 2024 tentang Pajak Daerah dan Retribusi Daerah** adalah rujukan daerah utama yang saat ini tercatat berstatus berlaku, ditetapkan dan diundangkan 5 Januari 2024 sebagai Lembaran Daerah Kabupaten Pinrang Tahun 2024 Nomor 1.

Konsekuensi implementasi: template SKPT tidak boleh menjadikan Perda 16/2011 atau Perda 2/2017 sebagai satu-satunya dasar hukum retribusi tanpa konfirmasi hubungan dan ketentuan peralihan Perda 1/2024.

### 1.2 Rujukan khusus pelayanan pasar

1. **Perda Kabupaten Pinrang Nomor 16 Tahun 2011 tentang Retribusi Pelayanan Pasar** merupakan aturan historis pelayanan pasar.
2. **Perda Kabupaten Pinrang Nomor 2 Tahun 2017** tercatat berstatus berlaku di basis data BPK dan mengubah Perda 16/2011, antara lain klasifikasi pasar serta struktur/tarif retribusi.
3. **Peraturan Bupati Pinrang Nomor 44 Tahun 2017** tercatat sebagai perubahan ketiga atas Perbup Pinrang Nomor 4 Tahun 2012 tentang pelaksanaan Perda 16/2011, diterbitkan untuk menindaklanjuti Perda 2/2017.

Ketiganya harus diperlakukan sebagai rujukan historis/teknis sampai JDIH Pinrang atau Bagian Hukum mengonfirmasi apakah seluruh norma yang relevan masih berlaku, telah diserap, atau telah digantikan oleh Perda 1/2024 dan peraturan pelaksananya. Sistem tidak menetapkan tarif dan tidak menyimpulkan keberlakuan norma hanya dari keberadaan halaman indeks.

### 1.3 Dokumen elektronik dan persetujuan paperless

1. **Undang-Undang Nomor 1 Tahun 2024** adalah perubahan kedua atas UU ITE dan berstatus berlaku.
2. **Peraturan Pemerintah Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik** berstatus berlaku. Mekanisme afirmasi/persetujuan dapat digunakan untuk menunjukkan maksud pihak yang terikat dalam transaksi elektronik.

Implementasi saat ini menggunakan checkbox persetujuan elektronik, waktu server, versi teks, identitas registrasi, dan jejak audit. Sistem **tidak menyebut checkbox sebagai Tanda Tangan Elektronik tersertifikasi** dan tidak mencetak “ditandatangani secara elektronik” sebelum integrasi dengan PSrE/penyelenggara sertifikasi elektronik resmi dan persetujuan tata naskah dinas.

### 1.4 Pelindungan data pribadi

**Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi** mengatur data pribadi, hak subjek data, pemrosesan, kewajiban pengendali/prosesor, dan keamanan pemrosesan. NIK diperlakukan sebagai data terbatas:

- disimpan pada area privat/restricted;
- tidak digunakan sebagai document ID, URL, QR, atau tampilan publik;
- ditampilkan secara tersamar pada status/verifikasi publik;
- diproses sesuai tujuan pendataan, verifikasi, layanan SKPT, audit, dan kewajiban hukum;
- akses internal berbasis peran dan dicatat dalam audit log.

## 2. Batas hukum dokumen SKPT

SKPT dalam sistem ini adalah **surat keterangan administratif mengenai pemakaian/penggunaan unit tempat usaha pasar berdasarkan data yang diajukan dan diverifikasi**. SKPT:

- bukan sertifikat hak atas tanah;
- bukan bukti kepemilikan tanah atau bangunan;
- tidak mengalihkan hak, sewa, atau hubungan keperdataan di luar kewenangan pemerintah daerah;
- tidak menghapus hak pemerintah daerah untuk melakukan penataan, penertiban, perubahan, atau pencabutan sesuai peraturan;
- hanya sah setelah status aplikasi `ISSUED` dan pejabat penerbit menyelesaikan prosedur pengesahan yang ditetapkan.

## 3. Frasa yang wajib ada pada dokumen

Dokumen final harus mencantumkan:

> SKPT ini merupakan dokumen keterangan administratif pemakaian/penggunaan tempat usaha pada pasar yang dikelola Pemerintah Kabupaten Pinrang. Dokumen ini bukan bukti kepemilikan hak atas tanah atau bangunan dan tunduk pada peraturan perundang-undangan serta ketentuan pengelolaan pasar yang berlaku.

Dasar hukum pada PDF menggunakan rujukan yang telah diverifikasi dari naskah Perda lokal:

> Dasar hukum: Peraturan Daerah Kabupaten Pinrang Nomor 6 Tahun 2024 tentang Pengelolaan Pasar Rakyat dan Peraturan Daerah Kabupaten Pinrang Nomor 1 Tahun 2024 tentang Pajak Daerah dan Retribusi Daerah.

Jangan mencantumkan nomor tarif, pasal, atau Perbup teknis tertentu sebagai dasar final sebelum diverifikasi terhadap naskah resmi dan SOP daerah terbaru.

## 4. Verifikasi wajib sebelum go-live

### Keputusan operasional pemilik — 25 September 2026

- e-PASAR tidak menggunakan e-meterai pada formulir atau surat pernyataan elektronik.
- Sistem tidak membeli, menempelkan, menerbitkan, atau memvalidasi token e-meterai.
- Persetujuan pemohon dicatat sebagai afirmasi elektronik berversi, bukan TTE tersertifikasi dan bukan pernyataan bahwa meterai telah dipenuhi.
- Integrasi TTE Kadis ditunda. Sampai tersedia kanal resmi, sistem hanya mencatat persetujuan Kadis, hash dokumen, nomor/referensi registrasi, dan status `NOT_INTEGRATED`.
- Ketentuan administratif mengenai meterai fisik berdasarkan Pasal 16 ayat (4) Perda 6/2024 tetap perlu dituangkan dalam SOP/keputusan pejabat berwenang.

- Bagian Hukum/JDIH mengonfirmasi status dan hubungan Perda 1/2024 dengan Perda 16/2011, Perda 2/2017, dan Perbup 44/2017.
- Bagian Hukum/JDIH menyediakan dan mengesahkan penggunaan peraturan pelaksanaan Perda 6/2024 sebagaimana diperintahkan Pasal 32.
- Disperindag ESDM menetapkan nomenklatur resmi SKPT, pejabat penandatangan, kewenangan Kepala Pasar, registrasi ulang tahunan, pencabutan, dan mekanisme konflik. Masa berlaku dua tahun sudah ditentukan Pasal 15 ayat (5).
- Pemilik proses memutuskan penanganan SKPT lama sesuai Pasal 31. Penandaan seluruh SKPT lama sebagai `LEGACY_EXPIRED` tidak boleh dijalankan tanpa dasar hukum tambahan karena Pasal 31 ayat (2) menyatakan SKPT lama tetap berlaku sampai tanggal berakhirnya.
- Pemilik proses menunjukkan dasar SOP/peraturan untuk pengesahan tahunan. Kewajiban tersebut tidak disebut dalam Perda 6/2024 dan tidak boleh diklaim bersumber dari Perda ini.
- Pemilik proses menyetujui teks pernyataan paperless dan klausul pelindungan data.
- Jika PDF akan diposisikan sebagai dokumen bertanda tangan elektronik, integrasikan PSrE resmi; jika belum, gunakan label `persetujuan elektronik tercatat` dan status TTE `PENDING/REGISTERED_MANUAL` sesuai SOP.
- Setiap perubahan dasar hukum harus memperbarui versi template, hash dokumen, dan catatan audit.

## 5. Sumber resmi

- Naskah lokal: `Perda 2024 - Pengelolaan Pasar Rakyat.pdf` (16 halaman, diperiksa 25 September 2026).
- JDIH BPK, Perda Pinrang No. 1 Tahun 2024: https://peraturan.bpk.go.id/Details/309627/perda-kab-pinrang-no-1-tahun-2024
- JDIH BPK, Perda Pinrang No. 2 Tahun 2017: https://peraturan.bpk.go.id/Details/76235/perda-kab-pinrang-no-2-tahun-2017
- JDIH BPK, PP No. 71 Tahun 2019: https://peraturan.bpk.go.id/Details/122030/pp-no-71-tahun-2019
- JDIH BPK, UU No. 1 Tahun 2024: https://peraturan.bpk.go.id/Details/274494/uu-no-1-tahun-2024
- JDIH BPK, UU No. 27 Tahun 2022: https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022%20
- JDIH Kabupaten Pinrang: https://jdih.pinrangkab.go.id/

## Kesimpulan

Landasan utama dan langsung untuk e-SKPT adalah Perda Pinrang No. 6 Tahun 2024. Perda Pinrang No. 1 Tahun 2024, PP 35/2023, dan UU 1/2022 menjadi kerangka pajak/retribusi; PP 71/2019 dan UU 1/2024 menjadi kerangka transaksi elektronik; serta UU 27/2022 menjadi kerangka pelindungan data pribadi. Perda 16/2011, Perda 2/2017, dan Perbup 44/2017 tetap menjadi bahan kajian historis/teknis, tetapi hubungan keberlakuannya harus dikonfirmasi. Peraturan pelaksanaan Perda 6/2024 dan SOP resmi merupakan dokumen berikutnya yang wajib diperoleh sebelum status siap operasional publik.
