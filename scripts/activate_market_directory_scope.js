'use strict';

// Default: DRY_RUN. Mode apply hanya mengubah marketDirectoryScoped dan
// updatedAt pada profil Kepala Pasar yang lolos pemeriksaan kelengkapan.
const { createReadClient } = require('./lib/firebase_rest_read');

const argv = process.argv.slice(2);
const args = new Set(argv);
const apply = args.has('--apply');
const confirmedComplete = args.has('--confirm-backfill-complete');
const confirmProjectArg = argv.find(value => value.startsWith('--confirm-project='));
const maxAccountsArg = argv.find(value => value.startsWith('--max-accounts='));
const maxAccounts = Number(maxAccountsArg?.split('=')[1] || 10);
if (!Number.isInteger(maxAccounts) || maxAccounts < 1 || maxAccounts > 100) throw new Error('--max-accounts harus bilangan 1 sampai 100.');

const email = process.env.EPASAR_AUDIT_EMAIL || process.env.EPASAR_ADMIN_EMAIL;
const password = process.env.EPASAR_AUDIT_PASSWORD || process.env.EPASAR_ADMIN_PASSWORD;
const client = createReadClient({ email, password });
const canonicalMarkets = new Set(Array.from({ length: 11 }, (_, index) => `MKT-${String(index + 1).padStart(3, '0')}`));
const clean = value => String(value || '').trim();

async function activateOnly(idToken, candidates) {
  const now = new Date().toISOString();
  let activated = 0;
  for (let index = 0; index < candidates.length; index += 20) {
    const batch = candidates.slice(index, index + 20);
    const writes = batch.map(row => ({
      update: {
        name: `${client.root}/users/${row.id}`,
        fields: {
          marketDirectoryScoped: { booleanValue: true },
          updatedAt: { timestampValue: now }
        }
      },
      updateMask: { fieldPaths: ['marketDirectoryScoped', 'updatedAt'] },
      currentDocument: { updateTime: row._updateTime }
    }));
    const response = await fetch(`${client.root}:commit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ writes })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`Aktivasi dihentikan setelah ${activated} akun: ${data.error?.message || response.status}`);
    activated += batch.length;
  }
  return activated;
}

(async () => {
  const idToken = await client.authenticate();
  const names = ['users', 'market_claims', 'market_trader_directory'];
  const values = await Promise.all(names.map(name => client.list(idToken, name)));
  const data = Object.fromEntries(names.map((name, index) => [name, values[index]]));
  const directoryKeys = new Set(data.market_trader_directory.map(row => `${clean(row.marketId)}__${clean(row.traderId)}`));
  const heads = data.users.filter(row => row.role === 'MARKET_HEAD' && row.status === 'ACTIVE' && row.marketDirectoryScoped !== true);
  const candidates = [];
  const blocked = [];

  heads.forEach(head => {
    const marketIds = Array.isArray(head.marketIds) ? [...new Set(head.marketIds.map(clean).filter(Boolean))] : [];
    const invalidMarkets = marketIds.filter(marketId => !canonicalMarkets.has(marketId));
    const claims = data.market_claims.filter(claim => marketIds.includes(clean(claim.marketId)));
    const missingDirectory = claims.filter(claim => !claim.traderId || !directoryKeys.has(`${clean(claim.marketId)}__${clean(claim.traderId)}`));
    const reasons = [];
    if (!head.uid || head.uid !== head.id) reasons.push('UID_PROFILE_INVALID');
    if (!head._updateTime) reasons.push('MISSING_UPDATE_TIME');
    if (!marketIds.length) reasons.push('NO_ASSIGNED_MARKET');
    if (invalidMarkets.length) reasons.push('INVALID_ASSIGNED_MARKET');
    if (missingDirectory.length) reasons.push('MISSING_DIRECTORY_PROJECTION');
    const summary = { id: head.id, marketCount: marketIds.length, claimCount: claims.length, missingDirectoryCount: missingDirectory.length, reasons };
    if (reasons.length) blocked.push(summary);
    else candidates.push({ ...summary, _updateTime: head._updateTime });
  });

  const report = {
    mode: apply ? 'APPLY_REQUESTED' : 'DRY_RUN',
    projectId: client.config.projectId,
    candidateCount: candidates.length,
    blockedCount: blocked.length,
    maxAccounts,
    candidates: candidates.map(({ _updateTime, ...row }) => row),
    blocked
  };
  if (!apply) {
    console.log(JSON.stringify({ ...report, status: 'NO_WRITES_PERFORMED' }, null, 2));
    return;
  }
  const confirmedProject = confirmProjectArg?.split('=')[1] || '';
  if (confirmedProject !== client.config.projectId) throw new Error(`Mode apply memerlukan --confirm-project=${client.config.projectId}.`);
  if (!confirmedComplete) throw new Error('Mode apply memerlukan --confirm-backfill-complete.');
  if (blocked.length) throw new Error(`Dibatalkan: ${blocked.length} akun masih memiliki penghalang aktivasi.`);
  if (candidates.length > maxAccounts) throw new Error(`Dibatalkan: ${candidates.length} kandidat melebihi --max-accounts=${maxAccounts}.`);
  if (!candidates.length) {
    console.log(JSON.stringify({ ...report, status: 'NOTHING_TO_ACTIVATE', activatedCount: 0 }, null, 2));
    return;
  }
  const activatedCount = await activateOnly(idToken, candidates);
  console.log(JSON.stringify({ ...report, mode: 'APPLY', status: 'ACTIVATED', activatedCount }, null, 2));
})().catch(error => {
  console.error(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', status: 'FAILED', message: error.message }));
  process.exitCode = 1;
});
