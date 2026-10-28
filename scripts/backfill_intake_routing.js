'use strict';

const { createReadClient } = require('./lib/firebase_rest_read');

const MARKET_IDS = new Set(Array.from({ length: 11 }, (_, index) => `MKT-${String(index + 1).padStart(3, '0')}`));
const APPLY = process.argv.includes('--apply');
const CONFIRMED = process.argv.includes('--confirm-routing-backfill');
const EMAIL = process.env.EPASAR_ADMIN_EMAIL || 'superadmin@eskpt.id';
const PASSWORD = process.env.EPASAR_ADMIN_PASSWORD || process.env.EPASAR_UAT_PASSWORD;

if (!PASSWORD) throw new Error('Set EPASAR_ADMIN_PASSWORD pada environment lokal. Nilai rahasia tidak boleh ditulis ke repository.');
if (APPLY && !CONFIRMED) throw new Error('Mode apply memerlukan --confirm-routing-backfill. Jalankan dry-run lebih dahulu.');

function routingMarketIds(intake) {
  const ids = (intake.businessDrafts || []).flatMap(business => (business.locations || []).flatMap(location =>
    (location.marketPlaces || []).map(place => String(place.marketId || '').trim().toUpperCase())
  ));
  if (!ids.length && intake.marketDraft?.marketId) ids.push(String(intake.marketDraft.marketId).trim().toUpperCase());
  return [...new Set(ids.filter(id => MARKET_IDS.has(id)))].sort();
}

async function patchRouting(client, token, intakeId, marketIds) {
  const response = await fetch(`${client.root}/trader_intake/${encodeURIComponent(intakeId)}?updateMask.fieldPaths=routingMarketIds`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: { routingMarketIds: { arrayValue: { values: marketIds.map(value => ({ stringValue: value })) } } } })
  });
  if (!response.ok) throw new Error(`${intakeId}: ${response.status} ${await response.text()}`);
}

async function main() {
  const client = createReadClient({ email: EMAIL, password: PASSWORD });
  const token = await client.authenticate();
  const rows = await client.list(token, 'trader_intake');
  const changes = rows.map(row => {
    const expected = routingMarketIds(row);
    const actual = Array.isArray(row.routingMarketIds) ? [...new Set(row.routingMarketIds)].sort() : [];
    return { id: row.id, hasMarketUnit: row.hasMarketUnit === true, actual, expected, changed: JSON.stringify(actual) !== JSON.stringify(expected) };
  }).filter(row => row.changed);
  const invalid = changes.filter(row => row.hasMarketUnit && row.expected.length === 0);
  const summary = {
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    total: rows.length,
    changes: changes.length,
    marketIntakesWithoutRoute: invalid.length,
    nonMarketChanges: changes.filter(row => !row.hasMarketUnit).length,
    sample: changes.slice(0, 20)
  };
  console.log(JSON.stringify(summary, null, 2));
  if (invalid.length) throw new Error('Backfill dihentikan: ada pendaftaran pasar tanpa marketId kanonis. Periksa sample sebelum melanjutkan.');
  if (!APPLY) return;
  for (const row of changes) await patchRouting(client, token, row.id, row.expected);
  console.log(`PASS ${changes.length} dokumen trader_intake diperbarui dengan routingMarketIds.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
