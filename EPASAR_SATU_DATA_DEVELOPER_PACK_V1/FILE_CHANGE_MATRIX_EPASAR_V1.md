# File Change Matrix e-Pasar V1

| Area | Existing file | Planned action | Phase | Risk/control |
|---|---|---|---|---|
| Public UI | new `epasar.html` | create isolated wizard | 1 | no shared page mutation |
| Styling | new `css/epasar.css` | create scoped styles | 1 | no global CSS dependency |
| Form | new `js/epasar/trader-form.js` | create state/validation/review | 1 | sessionStorage only for draft |
| Validation | new `js/epasar/validators.js` | create pure validators | 1 | unit tests |
| Image | new `js/epasar/image-compress.js` | create WebP/size pipeline | 2 | hard caps, no Storage |
| Firestore | new `js/epasar/*-service.js` | create modular adapters | 3–12 | no changes to `DBService` contract |
| Rules | missing | create isolated e-Pasar rules | 3+ | emulator tests; no inherited public writes |
| Indexes | missing | create only query-backed indexes | 3+ | no Base64 index |
| Admin | missing | create e-Pasar admin surface | 4+ | no dependency on parent repo |
| Market master | missing | define/import approved market seed | 5–7 | owner-approved source required |
| Build | missing | create production build/check flow | 13 | no auto-deploy |
| Config | missing | create only after owner note | 0 | no guessed Firebase project |
| Privacy | `.gitignore` | add `NOTE_FIREBASE_LOCAL.md` when owner file is introduced | 0/next | never commit local note |

## Protected existing changes

The repository is intentionally near-empty: only the developer pack and three image assets are present and untracked. There is no inherited production baseline in this repository. The separate parent repository is out of scope and must not be copied or modified implicitly.

## Explicitly out of scope

No Firebase Storage, Cloud Functions, Blaze upgrade, deployment, destructive Git command, or dependency on the separate `fajarbakri9/disperindagesdm` repository.

## Realisasi dan perubahan integritas terbaru

| File | Perubahan | Risiko yang dikendalikan |
|---|---|---|
| `js/epasar/workflow-service.js` | Pembentukan master dan reservasi NIK dijalankan dalam satu transaksi Firestore; klasifikasi awal memakai kode `TRADE`. | Race condition duplicate NIK, intake diproses ganda, dan kode klasifikasi bebas. |
| `epasar.html` | Label foto profil dan KTP diselaraskan dengan persyaratan cabang SKPT. | Pemohon mengira lampiran SKPT bersifat opsional. |
| `js/epasar/annual-validation-service.js` | Pengajuan ulang setelah `RETURNED`, jadwal tahunan, audit history, dan material-change gate. | Dead-end workflow dan pengesahan data yang belum sesuai. |
| `firestore.rules` | Transition gate dan validasi UID/role pada riwayat tahunan. | Pemalsuan keputusan dan riwayat dari client. |
| `tests/rules/role-boundaries.test.js` | Return/resubmit, lintas pasar, dan penolakan validasi perubahan material. | Regresi otorisasi. |
| `js/epasar/workflow-service.js` | Identitas unit deterministik, occupancy atomik, deteksi pemegang aktif, dan penggunaan `marketUnitId` resmi pada SKPT. | Duplikasi unit, penimpaan pemegang, dan QR unit berubah bersama klaim. |
| `js/epasar/market-verification.js` | Form jenis unit eksplisit, pesan konflik otomatis, dan hasil verifikasi yang mudah dipahami. | Petugas mengira berkas konflik tetap diteruskan ke Kadis. |
