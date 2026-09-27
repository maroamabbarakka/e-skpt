'use strict';

// Default: DRY_RUN. Mode tulis hanya membuat dokumen yang belum ada dengan
// precondition exists=false; tidak memperbarui atau menghapus data apa pun.
const { createReadClient } = require('./lib/firebase_rest_read');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const confirmProjectArg = [...args].find(value => value.startsWith('--confirm-project='));
const maxWritesArg = [...args].find(value => value.startsWith('--max-writes='));
const maxWrites = Number(maxWritesArg?.split('=')[1] || 200);
if (!Number.isInteger(maxWrites) || maxWrites < 1 || maxWrites > 5000) throw new Error('--max-writes harus bilangan 1 sampai 5000.');

const email = process.env.EPASAR_AUDIT_EMAIL || process.env.EPASAR_ADMIN_EMAIL;
const password = process.env.EPASAR_AUDIT_PASSWORD || process.env.EPASAR_ADMIN_PASSWORD;
const client = createReadClient({ email, password });
const canonicalMarkets = new Set(Array.from({ length: 11 }, (_, index) => `MKT-${String(index + 1).padStart(3, '0')}`));
const clean = (value, max = 120) => String(value || '').trim().slice(0, max);
const directoryId = (marketId, traderId) => `${clean(marketId,100)}__${clean(traderId,100)}`.replaceAll('/', '_');

function fields(row) {
  return {
    marketId: { stringValue: row.marketId },
    traderId: { stringValue: row.traderId },
    displayName: { stringValue: row.displayName },
    status: { stringValue: row.status },
    source: { stringValue: 'LEGACY_BACKFILL' },
    schemaVersion: { integerValue: '1' },
    createdAt: { timestampValue: row.createdAt },
    updatedAt: { timestampValue: row.createdAt }
  };
}

async function createOnly(idToken, candidates) {
  const batches = [];
  for (let index = 0; index < candidates.length; index += 50) batches.push(candidates.slice(index, index + 50));
  let created = 0;
  for (const batch of batches) {
    const writes = batch.map(row => ({
      update: { name: `${client.root}/market_trader_directory/${row.id}`, fields: fields(row) },
      currentDocument: { exists: false }
    }));
    const response = await fetch(`${client.root}:commit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ writes })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`Commit dihentikan setelah ${created} dokumen: ${data.error?.message || response.status}`);
    created += batch.length;
  }
  return created;
}

(async () => {
  const idToken = await client.authenticate();
  const names = ['market_claims', 'traders', 'skpt_applications', 'market_trader_directory'];
  const values = await Promise.all(names.map(name => client.list(idToken, name)));
  const data = Object.fromEntries(names.map((name, index) => [name, values[index]]));
  const traders = new Map(data.traders.map(row => [row.traderId, row]));
  const applications = new Map(data.skpt_applications.map(row => [row.id, row]));
  const existing = new Set(data.market_trader_directory.map(row => `${row.marketId}__${row.traderId}`));
  const candidates = new Map();
  const skipped = { invalidMarket: 0, missingTraderId: 0, missingTraderMaster: 0, alreadyExists: 0 };
  const now = new Date().toISOString();

  data.market_claims.forEach(claim => {
    const marketId = clean(claim.marketId, 100);
    const traderId = clean(claim.traderId, 100);
    if (!canonicalMarkets.has(marketId)) { skipped.invalidMarket += 1; return; }
    if (!traderId) { skipped.missingTraderId += 1; return; }
    const logicalKey = `${marketId}__${traderId}`;
    if (existing.has(logicalKey)) { skipped.alreadyExists += 1; return; }
    const trader = traders.get(traderId);
    if (!trader) { skipped.missingTraderMaster += 1; return; }
    const application = claim.applicationId ? applications.get(claim.applicationId) : null;
    const displayName = clean(claim.traderDisplayName || trader.displayName || application?.applicantSnapshot?.displayName || traderId, 120);
    candidates.set(logicalKey, { id: directoryId(marketId, traderId), marketId, traderId, displayName, status: clean(trader.status || 'ACTIVE', 30), createdAt: now });
  });

  const rows = [...candidates.values()].sort((left, right) => left.id.localeCompare(right.id));
  const report = {
    mode: apply ? 'APPLY_REQUESTED' : 'DRY_RUN',
    projectId: client.config.projectId,
    candidateCount: rows.length,
    maxWrites,
    skipped,
    sampleDocumentIds: rows.slice(0, 20).map(row => row.id)
  };

  if (!apply) {
    console.log(JSON.stringify({ ...report, status: 'NO_WRITES_PERFORMED' }, null, 2));
    return;
  }
  const confirmedProject = confirmProjectArg?.split('=')[1] || '';
  if (confirmedProject !== client.config.projectId) throw new Error(`Mode apply memerlukan --confirm-project=${client.config.projectId}.`);
  if (rows.length > maxWrites) throw new Error(`Dibatalkan: ${rows.length} kandidat melebihi batas --max-writes=${maxWrites}.`);
  if (!rows.length) {
    console.log(JSON.stringify({ ...report, status: 'NOTHING_TO_CREATE', createdCount: 0 }, null, 2));
    return;
  }
  const createdCount = await createOnly(idToken, rows);
  console.log(JSON.stringify({ ...report, mode: 'APPLY', status: 'CREATED', createdCount }, null, 2));
})().catch(error => {
  console.error(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', status: 'FAILED', message: error.message }));
  process.exitCode = 1;
});
