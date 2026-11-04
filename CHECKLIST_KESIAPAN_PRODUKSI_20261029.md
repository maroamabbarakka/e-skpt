# Checklist Kesiapan Produksi e-SKPT

## Lulus di kode lokal

- [x] Firebase tetap Spark dan tidak menggunakan Firebase Storage.
- [x] Kadis terpisah dari Super Admin.
- [x] Penolakan Kadis tidak memerlukan nomor/TTE.
- [x] TTE dan penerbitan final hanya melalui backend tepercaya.
- [x] Nomor SKPT memakai counter backend dan waktu WITA.
- [x] Alur wajib melewati Kepala UPTD sesuai wilayah.
- [x] Ledger maksimal dua tempat dilindungi transaksi dan Rules.
- [x] Koreksi foto Kepala Pasar append-only dan tercatat lengkap.
- [x] Kamera dan file/galeri merupakan pilihan terpisah.
- [x] Data contoh luar pasar tidak muncul pada mode produksi.
- [x] Telemetry reads tersedia untuk pengujian Spark.
- [x] Rules emulator, unit test, backend test, dependency audit, dan build lokal lulus.
- [x] Paket `dist` tidak memuat backend, dependency server, skrip/test internal, halaman demo, atau aset UAT.
- [x] Beranda produksi tidak lagi menawarkan tautan simulasi/pelatihan.
- [x] Pemindaian pola private key, API key, dan client secret tidak menemukan kredensial tertanam.

## Keputusan operasional untuk tayang aplikasi utama

- [x] Aplikasi ditayangkan langsung pada Firebase Hosting utama tanpa lingkungan staging terpisah.
- [x] URL utama sementara menggunakan `https://e-skpt.web.app`; domain Pemkab dimigrasikan kemudian.
- [x] Folder Drive sementara `1q0k68owb_9tLiPlUlu6orwvcIaTlkpM7` dapat diakses dan saat audit masih kosong.
- [x] PDF TTE Srikandi boleh menyusul; berkas tetap berstatus menunggu dan tidak dianggap `ISSUED` sebelum PDF diunggah serta hash diverifikasi backend.
- [x] Tautan langsung Drive tidak dipublikasikan ke browser atau QR.

## Wajib sebelum penerbitan SKPT resmi diaktifkan

- [ ] Audit ledger live read-only menunjukkan tidak ada pelanggaran historis.
- [ ] Snapshot dan manifest backup telah diuji restore pada lingkungan pemulihan terpisah.
- [ ] Backfill ledger menghasilkan missing/mismatch/violation = 0 setelah snapshot.
- [ ] Dua transaksi paralel diuji menggunakan backend nyata.
- [ ] Backend HTTPS, Firebase Admin SDK, dan service account organisasi tersedia.
- [ ] Service account backend memperoleh akses minimum ke folder Drive sementara.
- [ ] PDF hasil TTE Srikandi asli berhasil upload, hash, read-back, finalisasi, dan unduh ulang.
- [ ] E2E seluruh role dengan akun aplikasi utama lulus menggunakan data uji berlabel dan kemudian dibersihkan.
- [ ] Reads sebelum/sesudah dicatat dari Firebase Usage dashboard.
- [ ] Uji Android, iOS, Chrome, dan Edge untuk kamera/file selesai.
- [ ] Pemilik proses menyetujui pejabat, format nomor, template komunikasi, dan SOP pembatalan.
- [ ] Rencana rollback dan kontak penanggung jawab ditandatangani.

Status: **SIAP TAYANG UNTUK PENDATAAN DAN VERIFIKASI — PENERBITAN SKPT RESMI TETAP TERKUNCI SAMPAI BACKEND/TTE TERSEDIA**.

Catatan audit terakhir (29 Oktober 2026): 4 tes batas tempat, 5 tes backend, kontrak alur penuh, persyaratan dokumen, preflight statis, dan suite Firestore Rules lulus. Audit dependency root dan backend melaporkan `0 vulnerabilities`. Build bersih berisi 193 file (28.176.818 byte). Firebase Hosting utama dan folder Drive sementara telah teridentifikasi. Service account, URL backend HTTPS, serta akun E2E belum tersedia; aplikasi tetap mempertahankan fail-closed sehingga reservasi nomor, upload TTE, dan finalisasi tidak dapat dilakukan dari browser.

## Bukti deploy aplikasi utama

- Waktu rilis: 29 Oktober 2026, sekitar 13:37 WITA.
- Project/site: `e-skpt` / `https://e-skpt.web.app`.
- Hosting version: `b985e00bae764591`.
- Firestore ruleset: `e3232133-be84-46b3-b511-2e63533f0cb6`.
- Semua 11 composite index berstatus `READY`; `CREATING = 0`, `NEEDS_REPAIR = 0`.
- SHA-256 `index.html` lokal dan live identik: `9FB5385204D58CB4242C7D39414CC821C7ED79436E12E101E393ABB1B2B71D92`.
- Halaman utama, formulir, login, verifikasi pasar, dan persetujuan Kadis merespons HTTP 200.
- Halaman demo serta path backend internal merespons HTTP 404.
- Header `nosniff`, `SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, dan `no-cache` aktif.
