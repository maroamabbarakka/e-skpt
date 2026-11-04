'use strict';

const { createReadClient } = require('./lib/firebase_rest_read');

const APPLY = process.argv.includes('--apply');
const CONFIRMED = process.argv.includes('--confirm-market-intake-queue');
const EMAIL = process.env.EPASAR_ADMIN_EMAIL || 'superadmin@eskpt.id';
const PASSWORD = process.env.EPASAR_ADMIN_PASSWORD;
const ACTIVE = new Set(['SUBMITTED', 'CORRECTION_REQUIRED']);
const MARKET_ID = /^MKT-0(?:0[1-9]|1[01])$/;

if (!PASSWORD) throw new Error('Set EPASAR_ADMIN_PASSWORD pada environment lokal.');
if (APPLY && !CONFIRMED) throw new Error('Mode apply memerlukan --confirm-market-intake-queue.');

function fields(row, marketId) {
  return {
    intakeId: { stringValue: row.id },
    marketId: { stringValue: marketId },
    registrationCode: { stringValue: String(row.registrationCode || '') },
    status: { stringValue: row.status },
    submittedAt: { timestampValue: row.submittedAt },
    updatedAt: { timestampValue: new Date().toISOString() },
    schemaVersion: { integerValue: '1' }
  };
}

async function create(client, token, row, marketId) {
  const documentId = `${marketId}__${row.id}`;
  const response = await fetch(`${client.root}/market_intake_queue?documentId=${encodeURIComponent(documentId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: fields(row, marketId) })
  });
  if (response.status === 409) return 'EXISTS';
  if (!response.ok) throw new Error(`${documentId}: ${response.status} ${await response.text()}`);
  return 'CREATED';
}

async function main() {
  const client = createReadClient({ email: EMAIL, password: PASSWORD });
  const token = await client.authenticate();
  const [intakes, existing] = await Promise.all([client.list(token, 'trader_intake'), client.list(token, 'market_intake_queue')]);
  const existingIds = new Set(existing.map(row => row.id));
  const expected = intakes.filter(row => ACTIVE.has(row.status)).flatMap(row =>
    [...new Set(row.routingMarketIds || [])].filter(id => MARKET_ID.test(id)).map(marketId => ({ row, marketId, id: `${marketId}__${row.id}` }))
  );
  const missing = expected.filter(item => !existingIds.has(item.id));
  console.log(JSON.stringify({ mode: APPLY ? 'APPLY' : 'DRY_RUN', activeIntakes: intakes.filter(row => ACTIVE.has(row.status)).length, expected: expected.length, existing: existing.length, missing: missing.length, sample: missing.slice(0, 20).map(item => item.id) }, null, 2));
  if (!APPLY) return;
  for (const item of missing) await create(client, token, item.row, item.marketId);
  console.log(`PASS ${missing.length} proyeksi antrean dibuat.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
