# Implementation Plan e-Pasar V1 — Phase 0 Architecture Gate

## Scope and repository identity

Audit final ini dilakukan pada workspace repository `maroamabbarakka/e-skpt` dengan remote yang terverifikasi:

`https://github.com/maroamabbarakka/e-skpt.git`

Repo `https://github.com/fajarbakri9/disperindagesdm` adalah repository berbeda dan tidak dijadikan target perubahan. `disperindagesdm-pinrang` bukan asumsi binding untuk repository ini; project Firebase harus dikonfirmasi pemilik melalui `NOTE_FIREBASE_LOCAL.md`.

## Guardrails

- Additive-only; tidak mengubah kontrak modul LPG, BBM, Pasar, Media Intelligence, berita, PPID, atau auth lama tanpa kebutuhan eksplisit.
- Firebase tetap Spark; tidak memakai Functions, Storage, atau credential rahasia.
- Binding Firebase tidak diubah sebelum `NOTE_FIREBASE_LOCAL.md` milik pemilik diperiksa.
- NIK restricted untuk deduplikasi; `traderId` opaque untuk publik.
- Foto hanya melalui browser compression dan collection `trader_media`.
- Tidak deploy otomatis/produksi.

## Fase implementasi

| Fase | Deliverable | Gate |
|---|---|---|
| 0 | audit, model, security/test plan | owner review arsitektur |
| 1 | `epasar.html`, CSS, wizard mobile | viewport/no overflow |
| 2 | WebP compressor + media adapter | byte-cap tests |
| 3 | intake service + rules | emulator security PASS |
| 4 | admin queue + NIK dedupe | synthetic duplicate tests |
| 5 | businesses, locations, classifications | data integrity PASS |
| 6–7 | claims + Kepala Pasar verification | before/after audit |
| 8–9 | correction + Kadis notifications/approval | role boundary tests |
| 10 | SKPT metadata + annual validation | legacy/expiry tests |
| 11–12 | public verification + QR + assisted share | privacy checks |
| 13 | production build checks/regression | build PASS |
| 14 | staging UAT | owner sign-off |
| 15 | go-live only after explicit approval | deployment approval |

## Phase 0 status

- Audit package Markdown: PASS.
- `git status` and dirty workspace inventory: PASS; existing changes protected.
- Firebase files and integration points: NOT_AVAILABLE; tidak ada baseline Firebase di repo ini.
- Five architecture documents: IN PROGRESS/REVIEW GATE.
- Coding, deployment, and production activation: NOT_STARTED.

## Open decisions before Phase 1

1. Owner supplies/reviews `NOTE_FIREBASE_LOCAL.md` before any Firebase binding decision.
2. Owner confirms whether Firebase project `disperindagesdm-pinrang` may be reused or a separate project is required.
3. Owner confirms authentication provider, staff accounts, and role/profile source.
4. Owner confirms master Pasar seed/source and initial market assignment/scope data.
5. Owner confirms whether the three root image assets are intended for the new application.

## Status implementasi aktual — 25 September 2026

Baseline Phase 0 di atas dipertahankan untuk histori. Status implementasi sekarang:

| Fase | Status aktual | Catatan |
|---|---|---|
| 0 | PASS | Audit, Firebase note, model, security, dan test plan tersedia. |
| 1–3 | PASS_LOCAL | Wizard, WebP/Base64, intake create-only, rules, dan emulator tersedia. |
| 4 | PASS_WITH_UAT_PENDING | Antrean admin dan deduplikasi NIK tersedia; pembentukan master memakai transaksi atomik. |
| 5–7 | PARTIAL_PASS | Business/location/classification dan verifikasi faktual tersedia; duplicate unit/occupancy belum lengkap. |
| 8–9 | PARTIAL_PASS | Notifikasi perubahan material dan approval tersedia; koreksi end-to-end masih perlu UAT. |
| 10 | PASS_WITH_POLICY_GATE | SKPT dua tahun, legacy-by-expiry, dan pengesahan tahunan tersedia; keputusan hukum/SOP belum final. |
| 11–13 | PASS_LOCAL | QR, verifikasi publik, share, dokumen, kartu, preflight dan build tersedia. |
| 14 | IN_PROGRESS | Rekap UAT minimum 50 rekaman dan sign-off belum selesai. |
| 15 | BLOCKED_BY_APPROVAL | Go-live publik menunggu gate hukum, UAT, storage baseline, dan izin eksplisit. |

Penguatan terbaru memastikan reservasi NIK, pembuatan master, data privat, usaha, lokasi, klasifikasi, klaim, aplikasi, status publik, dan perubahan status intake berada dalam satu transaksi Firestore. Seluruh transaksi dibatalkan jika NIK telah terdaftar atau intake telah diproses petugas lain.
