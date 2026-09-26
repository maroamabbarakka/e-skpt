# PAKET ARAHAN TEKNIS DEVELOPER — e-PASAR / SATU DATA PEDAGANG PINRANG

**Versi:** 1.0  
**Target:** VS Code / coding agent / developer manusia  
**Repositori:** `fajarbakri9/disperindagesdm`  
**Baseline Firebase:** `disperindagesdm-pinrang` — **Spark**.

## Prinsip mutlak
- Tetap Firebase **Spark**. Jangan meminta upgrade Blaze.
- Jangan gunakan Cloud Functions.
- Jangan gunakan Firebase Storage untuk modul ini.
- Gunakan Firestore + Hosting + Auth internal yang sudah ada.
- Foto kecil: WebP terkompresi → Base64 → collection media terpisah.
- Jangan simpan foto pada dokumen utama `traders`.
- NIK adalah kunci unik bisnis/deduplikasi internal, **bukan** ID publik/QR/path utama.
- Semua SKPT lama diperlakukan `LEGACY_EXPIRED`.
- SKPT baru berlaku 2 tahun dan memiliki pengesahan tahunan.
- Kepala Pasar hanya verifikasi faktual/koreksi dengan alasan.
- Semua koreksi material Kepala Pasar menghasilkan notifikasi kepada Kadis.
- Kadis melakukan persetujuan final dan proses TTE melalui kanal resmi.
- Implementasi harus additive-only agar LPG, BBM, Pasar, Media Intelligence, berita, dan PPID tidak terganggu.

## Kondisi repositori yang sudah diperiksa
Repositori sudah memiliki:
- `firebase.json` dengan Hosting dari `dist`;
- `.firebaserc` menuju `disperindagesdm-pinrang`;
- `js/firebase-config.js` untuk Firestore/Auth;
- `js/auth.js` untuk role internal;
- `js/market-engine.js` + `js/admin-markets.js`;
- `firestore.rules` + `firestore.indexes.json`;
- build produksi via `scripts/build_production.py`.

`js/market-engine.js` saat ini menolak `data:image` pada foto pasar. Jangan ubah perilaku itu. Base64 foto pedagang memakai modul/collection baru.

## Urutan baca
1. `01_MASTER_DIRECTIVE_VSCODE.md`
2. `02_FORM_PEDAGANG_MOBILE_FIRST.md`
3. `03_MODEL_DATA_FIRESTORE.md`
4. `04_WORKFLOW_ESKPT_DAN_KOREKSI.md`
5. `05_FOTO_BASE64_DAN_BUDGET_SPARK.md`
6. `06_SECURITY_RULES_DAN_PRIVASI.md`
7. `07_UI_ADMIN_DAN_NOTIFIKASI.md`
8. `08_TTE_WA_EMAIL_DAN_DOKUMEN.md`
9. `09_IMPLEMENTATION_PLAN.md`
10. `10_TESTING_UAT_GO_LIVE.md`
11. `11_NOTE_FIREBASE_TEMPLATE.md`
12. `12_DEFINITION_OF_DONE.md`

## Exit gate
Testing tidak boleh menjadi alasan modul tidak pernah aktif. Jika security test, mobile UAT, regression test, build, dan approval owner sudah PASS, status berubah menjadi **GO-LIVE**.
