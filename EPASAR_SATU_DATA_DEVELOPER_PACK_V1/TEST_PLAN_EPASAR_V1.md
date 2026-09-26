# Test Plan e-Pasar V1

## Phase gates

| Suite | Cases | Status |
|---|---|---|
| Package/architecture audit | ordered Markdown read, manifest, repo identity | PASS |
| Git safety | status inventory, no destructive commands | PASS |
| Mobile UI | 360×640, 390×844, 412×915, tablet, desktop; no overflow | NOT_RUN |
| Form logic | NIK, WhatsApp, branches, review, double-submit, session draft | NOT_RUN |
| Image | JPEG/PNG/portrait/landscape/unsupported; WebP and hard caps | NOT_RUN |
| Firestore emulator | public create-only, schema, role boundaries, issued immutability | NOT_RUN |
| Integrity | duplicate NIK, duplicate unit, claim vs verified, occupancy conflict | NOT_RUN |
| Workflow | correction, factual diff, Kadis notification, approval, annual validation, legacy | NOT_RUN |
| Privacy | no NIK/full address/WA in public verification or QR | NOT_RUN |
| Build | required dist files plus existing build validation | NOT_RUN |
| Regression | LPG, BBM, Pasar, Media Intelligence, berita, PPID, auth | NOT_RUN |

## Synthetic UAT set

Minimum 50 records: non-market, market/no SKPT, SKPT applicant, duplicate NIK, duplicate unit, trader correction, Market Head correction/conflict/not-found, Kadis return/reject/approve, annual validation, and expired two-year record.

## Evidence required before GO

Command output or test report for emulator, mobile viewport checks, image byte measurements, build smoke checks, regression checks, storage baseline/projection, owner approval, and explicit deployment approval. Until all are available, status is not production-ready and no deployment is performed.

## Pembaruan status pengujian — 25 September 2026

Bagian `NOT_RUN` pada baseline di atas tidak lagi seluruhnya mencerminkan kondisi implementasi. Status berbasis bukti terbaru adalah:

| Area | Status aktual |
|---|---|
| Mobile UI dan overflow | PASS_AUTOMATED pada form, 390×844, 412×915, tablet, desktop, dan halaman internal utama. |
| Form logic | PASS_AUTOMATED untuk NIK, WhatsApp, branch pasar/SKPT, review, dan session draft. |
| Image | PASS_AUTOMATED untuk WebP, dimensi, Base64, dan profile hard cap; variasi kamera lapangan masih UAT. |
| Firestore Security Rules | PASS_EMULATOR untuk akses publik, role boundary, media privat, issuance, dan pengesahan tahunan. |
| Integritas NIK | Implementasi diperkuat dengan transaksi atomik; uji konkurensi jaringan riil masih diperlukan. |
| Annual validation | PASS untuk `RETURNED → RESUBMITTED → VALIDATED`, lintas pasar ditolak, perubahan material tidak dapat disahkan. |
| Build | PASS, termasuk pemeriksaan artefak wajib pada `dist`. |
| UAT 50 rekaman | BELUM SELESAI; tetap merupakan gate sebelum operasional publik. |
| Deployment perubahan terakhir | NOT_RUN. |

Perintah terakhir yang lulus:

- `python scripts/check_epasar.py`
- `python scripts/build_production.py`
- `npx playwright test tests/browser-form.spec.js tests/browser-viewports.spec.js --workers=1` — 17/17 PASS
- Firestore Rules emulator pada port terisolasi — PASS

Tambahan pengujian integritas unit pasar:

- pembuatan `market_units` dan `market_occupancies` dalam satu atomic write: PASS;
- occupancy wajib menunjuk unit yang dalam write yang sama menunjuk kembali ke occupancy tersebut: PASS;
- upaya mengganti pemegang aktif melalui update unit: ditolak, PASS;
- upaya Kepala Pasar lain membuat occupancy lintas pasar: ditolak, PASS;
- UI verifikasi pasar dan seluruh halaman utama tanpa horizontal overflow: PASS.
