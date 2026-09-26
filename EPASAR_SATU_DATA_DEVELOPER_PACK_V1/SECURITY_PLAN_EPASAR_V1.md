# Security Plan e-Pasar V1

## Trust boundary

Browser public submissions are untrusted. They may create only schema-constrained intake/correction records. No client-controlled field may grant a role, verification, approval, or issued status. Existing legacy rules are not copied into e-Pasar.

## Roles

Target roles: `SUPER_ADMIN`, `DISPERINDAG_ADMIN`, `TRADE_ADMIN`, `MARKET_ADMIN`, `MARKET_HEAD`, `KADIS`, `TECH_ADMIN`. Effective role must come from protected Firebase Auth/profile data, never localStorage alone. Existing repository auth role names differ and require an explicit mapping before implementation.

## Access matrix

| Collection | Anonymous | Staff |
|---|---|---|
| `trader_intake` | create valid only; no read/list/update/delete | authorized review |
| `traders` | no access | scoped read/write |
| `trader_private`, `nik_registry` | none | restricted admin only |
| `trader_media` | constrained create only if linked to valid intake; no read/list | scoped read |
| `market_claims` | no read | admin/Market Head scope |
| `market_units` | no raw access | market/admin workflow |
| `correction_requests` | create valid only | routed processing |
| `verification_records` | none | append/read-only audit policy |
| `notifications` | none | recipient/workflow only |
| `skpt_applications/documents` | no raw access | controlled workflow |

## Rule invariants

Known keys only; bounded strings/lists; NIK exactly 16 digits at intake; status defaults to `SUBMITTED`; no public `approvedBy`, role, verified status, or notification mutation. Issued records cannot be silently edited. Market Head cannot perform Kadis approval and is limited to assigned markets.

## Required emulator tests

Anonymous valid create PASS; anonymous reads/lists private data FAIL; malformed/oversized writes FAIL; role injection FAIL; Market Head cross-market and final approval FAIL; correction cannot mutate master; material verification creates Kadis notification; issued SKPT direct edit FAIL.

## Current baseline warning

This repository currently has no `firestore.rules`, auth implementation, or inherited collection rules. The first security implementation must therefore define the complete e-Pasar baseline, with emulator tests before any deployment. No rules deployment is authorized in this phase.
