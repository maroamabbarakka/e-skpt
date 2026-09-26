# IMPLEMENTATION PLAN VS CODE

## FASE 0 — PRECHECK
- [ ] `git status` dicatat.
- [ ] branch feature dibuat.
- [ ] project Firebase diverifikasi.
- [ ] current Firestore storage usage dicatat.
- [ ] backup `firestore.rules`.
- [ ] backup `firestore.indexes.json`.
- [ ] `NOTE_FIREBASE_LOCAL.md` ditambahkan `.gitignore`.
- [ ] tidak ada secret baru di repo.

## FASE 1 — UI PUBLIC
Deliverables:
- `epasar.html`;
- `css/epasar.css`;
- wizard 5 langkah;
- review screen;
- session draft;
- responsive tests.

Test viewport:
- 360×640;
- 390×844;
- 412×915;
- tablet;
- desktop.

## FASE 2 — IMAGE PIPELINE
- `image-compress.js`;
- WebP conversion;
- size cap;
- preview/re-take;
- Base64;
- metadata bytes.

Test dengan portrait, landscape, PNG, JPEG besar, unsupported file.

## FASE 3 — PUBLIC INTAKE
- registration code;
- create-only Firestore;
- correction request;
- no public read;
- emulator tests.

## FASE 4 — MASTER TRADER
- admin intake queue;
- NIK dedupe;
- nik_registry;
- master trader;
- businesses;
- locations;
- classification.

## FASE 5 — MARKET + SKPT
- claim pasar;
- Kepala Pasar queue;
- factual verification;
- diff;
- unit creation/link;
- Kadis notification;
- approval;
- SKPT metadata.

## FASE 6 — ANNUAL VALIDATION
- due calculation;
- confirm data;
- market recheck bila perlu;
- validated record;
- jangan ubah `validUntil`.

## FASE 7 — SHARE
- WhatsApp deep link;
- email;
- printable summary;
- public verification.

## FASE 8 — BUILD
Update `scripts/build_production.py`.
Tambahkan smoke checks.
Jangan auto-deploy.

## FASE 9 — UAT
Gunakan minimal 50 synthetic records:
- non-market trader;
- market trader no SKPT;
- applicant SKPT;
- duplicate NIK;
- duplicate claim unit;
- koreksi pedagang;
- koreksi Kepala Pasar;
- Kadis reject;
- Kadis approve;
- annual validation;
- expired dua tahun.

## FASE 10 — GO LIVE
Setelah owner approve:
1. deploy rules/indexes;
2. deploy Hosting;
3. buat role internal;
4. smoke production;
5. buka form publik;
6. monitor 24–48 jam.

Jika critical issue:
- tutup entry point form;
- jangan hapus data;
- rollback Hosting;
- rollback rules targeted dari snapshot.
