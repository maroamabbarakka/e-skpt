'use strict';

// Audit read-only. Skrip ini tidak memiliki operasi tulis dan tidak boleh
// mengubah data produksi. Credential hanya dibaca dari environment lokal.
const fs = require('fs');
const path = require('path');
const { createReadClient } = require('./lib/firebase_rest_read');

const email = process.env.EPASAR_AUDIT_EMAIL || process.env.EPASAR_ADMIN_EMAIL;
const password = process.env.EPASAR_AUDIT_PASSWORD || process.env.EPASAR_ADMIN_PASSWORD;
if (!email || !password) throw new Error('EPASAR_AUDIT_EMAIL dan EPASAR_AUDIT_PASSWORD wajib tersedia untuk audit read-only.');

const client = createReadClient({ email, password });
const activeClaim = row => !['REJECTED','CANCELLED','CLOSED','SUPERSEDED'].includes(String(row.status || row.verificationStatus || '').toUpperCase());

(async () => {
  const token = await client.authenticate();
  const [claims, ledgers] = await Promise.all([client.list(token, 'market_claims'), client.list(token, 'trader_market_place_ledgers').catch(() => [])]);
  const groups = new Map();
  claims.filter(activeClaim).forEach(row => {
    if (!row.traderId || !row.marketId) return;
    const id = `${row.traderId}__${row.marketId}`;
    if (!groups.has(id)) groups.set(id, { ledgerId: id, traderId: row.traderId, marketId: row.marketId, claimIds: [] });
    groups.get(id).claimIds.push(row.id);
  });
  const existing = new Map(ledgers.map(row => [row.id, row]));
  const proposed = [...groups.values()].map(row => ({ ...row, claimIds: [...new Set(row.claimIds)].sort(), activePlaceCount: new Set(row.claimIds).size, maximumPlaces: 2 }));
  const violations = proposed.filter(row => row.activePlaceCount > 2);
  const missing = proposed.filter(row => !existing.has(row.ledgerId));
  const mismatched = proposed.filter(row => existing.has(row.ledgerId) && JSON.stringify([...(existing.get(row.ledgerId).claimIds || [])].sort()) !== JSON.stringify(row.claimIds));
  const report = { mode: 'DRY_RUN_READ_ONLY', generatedAt: new Date().toISOString(), counts: { claims: claims.length, currentLedgers: ledgers.length, proposedLedgers: proposed.length, missing: missing.length, mismatched: mismatched.length, violations: violations.length }, violations, missing, mismatched };
  const output = path.join(process.cwd(), 'scratch', `place-limit-ledger-audit-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report.counts, output, safeToBackfill: violations.length === 0 }, null, 2));
  if (violations.length) process.exitCode = 2;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
