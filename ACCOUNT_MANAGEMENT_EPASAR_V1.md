# Manajemen Akun e-PASAR

## Keputusan arsitektur

Firebase Authentication tetap menjadi sumber identitas login. Dokumen `users/{uid}` hanya menyimpan profil jabatan, status, role, dan penugasan pasar.

Super Admin dapat membuat atau mengubah profil `users`, mengaktifkan/menonaktifkan akun, dan memperbarui penugasan. Penghapusan dokumen profil dilarang agar audit tidak putus. Penghapusan atau pembuatan user Firebase Authentication tidak dilakukan dari browser.

## Login

Login email/password dapat dilakukan langsung melalui Firebase Authentication. Login username/password belum diaktifkan secara publik karena pemetaan username ke email membutuhkan resolver tepercaya. Membuka `login_aliases` untuk anonymous read akan memungkinkan enumerasi akun dan membocorkan email.

Implementasi aman untuk login username membutuhkan salah satu dari:

1. endpoint administratif tepercaya; atau
2. proses provisioning lokal yang mengubah username menjadi email sebelum login.

Cloud Functions tidak digunakan sesuai batasan Spark. Karena itu, sampai resolver tersedia, UI harus meminta email/password dan tidak mengklaim username/password sudah aktif.

## Akun jabatan uji

Profil dapat menggunakan nama jabatan tanpa nama personal. Kadis dapat menggunakan identitas resmi yang disetujui pemilik proyek. Password dan credential tidak pernah disimpan di repository.

## Batasan saat ini

- `users` hanya dapat dibuat/diubah oleh `SUPER_ADMIN`.
- `SUPER_ADMIN` tidak dapat menghapus akun melalui Firestore.
- Akun Authentication dibuat melalui Firebase Console atau proses administratif lokal.
- `marketIds` wajib ditetapkan untuk `MARKET_HEAD` sebelum akses produksi.
