# DEFINITION OF DONE — e-PASAR V1

## Public
- [ ] Form mobile 5 langkah.
- [ ] Pedagang non-pasar dapat terdaftar.
- [ ] Pedagang pasar dapat membuat claim unit.
- [ ] Opsi ajukan SKPT bekerja.
- [ ] Foto otomatis terkompres.
- [ ] Review sebelum submit.
- [ ] Registration code.
- [ ] Koreksi pasca-submit = request, bukan direct edit.

## Master
- [ ] NIK untuk dedupe internal.
- [ ] traderId opaque lintas sistem.
- [ ] usaha & lokasi terpisah.
- [ ] klasifikasi multi-label.
- [ ] filter perdagangan/industri/kerajinan/Dekranasda dari satu data.

## Pasar
- [ ] claim terpisah dari verified unit.
- [ ] Kepala Pasar factual verify.
- [ ] koreksi menyimpan before/after/reason.
- [ ] konflik tanpa menghapus data.

## Kadis
- [ ] perubahan material → notification.
- [ ] review ringkas.
- [ ] approve/return/reject.
- [ ] role lain tidak dapat approve final.

## SKPT
- [ ] legacy tidak aktif.
- [ ] SKPT baru 2 tahun.
- [ ] annual validation tersedia.
- [ ] annual validation tidak memperpanjang masa berlaku.
- [ ] QR dokumen != QR unit.
- [ ] public verification tidak expose data sensitif.
- [ ] TTE melalui mekanisme resmi.

## Spark
- [ ] tanpa Cloud Functions.
- [ ] tanpa Firebase Storage.
- [ ] tanpa upgrade Blaze.
- [ ] budget storage dihitung.
- [ ] media lazy-loaded.
- [ ] Base64 tidak diindeks.

## Security
- [ ] emulator PASS.
- [ ] public cannot read/list private data.
- [ ] issued record tidak diubah diam-diam.
- [ ] audit trail.
- [ ] no secrets committed.

## Regression
- [ ] build produksi PASS.
- [ ] LPG/BBM/Pasar/News tetap jalan.
- [ ] rollback tersedia.

Jika seluruh checklist PASS dan owner menyetujui, V1 siap go-live.
