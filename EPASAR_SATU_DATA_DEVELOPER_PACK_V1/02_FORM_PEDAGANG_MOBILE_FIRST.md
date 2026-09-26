# FORM PEDAGANG — MOBILE FIRST / SUPER RESPONSIF

## Prinsip UX
Form harus terasa singkat, bukan formulir birokrasi panjang.

- mobile 320–480px = target utama;
- tanpa horizontal scroll;
- input/tombol minimal 48px;
- font input minimal 16px;
- 3–6 input per layar;
- progress jelas;
- tombol `Lanjut` sticky di bawah;
- validasi inline;
- radio/card untuk pilihan utama;
- keyboard `numeric/tel/email` sesuai input;
- foto dikompres sebelum upload;
- tidak mengulang data identitas;
- jangan minta data yang belum dibutuhkan.

## Maksimal 5 langkah

### 1. Identitas
Wajib:
- NIK 16 digit;
- nama sesuai KTP;
- nomor WhatsApp/HP;
- kecamatan;
- desa/kelurahan;
- alamat singkat.

Opsional bila dibutuhkan:
- tempat/tanggal lahir;
- email.

Agama/kewarganegaraan tidak wajib kecuali dinas menetapkan dasar kebutuhannya.

### 2. Usaha
- nama usaha (opsional);
- bentuk kegiatan: Toko / Kaki Lima / Pasar / Warung-Kuliner / Rumahan / Keliling / Online / Lainnya;
- jenis dagangan/usaha;
- kecamatan lokasi usaha;
- desa/kelurahan;
- alamat/petunjuk lokasi.

Sediakan `+ Tambah usaha/lokasi lain`.

### 3. Hubungan dengan pasar
Pertanyaan:
**Apakah Anda memiliki/menggunakan kios, los, atau lapak pada pasar yang dikelola Disperindag ESDM Pinrang?**

Jika Tidak → lanjut.

Jika Ya:
- pilih pasar dari master;
- jenis tempat;
- nomor/label manual;
- blok opsional;
- lantai opsional;
- luas opsional bila belum diketahui;
- petunjuk lokasi;
- foto lokasi bila diperlukan.

Teks wajib:
> Nomor tempat yang Anda isi akan diverifikasi Kepala Pasar dan belum menjadi identitas unit resmi sebelum verifikasi.

### 4. Foto & pilihan SKPT
Foto profil:
- kamera atau pilih file;
- kompres otomatis;
- preview;
- ambil ulang.

Jika punya unit pasar:
**Apakah ingin mengajukan SKPT?**
- Ya, sekarang
- Tidak sekarang

Jika Ya, tampilkan syarat ringkas dan link ketentuan lengkap.

Checkbox wajib (tidak pre-checked):
- data yang saya kirim benar;
- lokasi akan diverifikasi;
- SKPT bukan bukti kepemilikan aset;
- SKPT berlaku 2 tahun dan wajib pengesahan tahunan.

### 5. Periksa & Kirim
Ringkasan card:
- Identitas
- Usaha
- Lokasi
- Pasar/kios
- Foto
- Pilihan SKPT

Setiap card punya tombol `Ubah`.

CTA:
**KIRIM DATA**

Setelah submit, tampilkan nomor registrasi dan tombol **Ajukan Koreksi Data**.

## Koreksi
Sebelum submit: edit bebas.

Setelah submit: jangan direct edit. Buat `correction_requests`.

Form koreksi:
- nomor registrasi;
- NIK;
- WhatsApp;
- bagian yang dikoreksi;
- nilai benar;
- alasan;
- foto baru jika relevan.

## Draft
Untuk field sensitif gunakan `sessionStorage`, bukan localStorage permanen di perangkat bersama.

## CSS
```css
.form-shell{width:100%;padding:16px}
input,select,button,textarea{font-size:16px;min-height:48px}
@media(min-width:768px){
  .form-shell{max-width:720px;margin:auto;padding:24px}
}
```

Gunakan `safe-area-inset-bottom`, `prefers-reduced-motion`, fokus keyboard yang jelas, dan `minmax(0,1fr)` untuk grid.
