'use strict';

// Audit read-only. Script ini hanya melakukan login dan HTTP GET; tidak ada write,
// migrasi, perbaikan otomatis, atau pencetakan data pribadi seperti NIK/telepon.
const { createReadClient } = require('./lib/firebase_rest_read');

const email = process.env.EPASAR_AUDIT_EMAIL || process.env.EPASAR_ADMIN_EMAIL;
const password = process.env.EPASAR_AUDIT_PASSWORD || process.env.EPASAR_ADMIN_PASSWORD;
if (!email || !password) throw new Error('EPASAR_AUDIT_EMAIL dan EPASAR_AUDIT_PASSWORD wajib tersedia di environment lokal. Gunakan akun Super Admin read-only untuk audit lengkap.');

const client = createReadClient({ email, password });
const config = client.config;
const canonicalMarkets = new Set(Array.from({ length: 11 }, (_, index) => `MKT-${String(index + 1).padStart(3, '0')}`));
const legacyMarkets = new Set(['pasar-pekkabata', 'pasar-sentral-pinrang']);

function marketClass(value) {
  const marketId = String(value || '').trim();
  if (!marketId) return 'EMPTY';
  if (canonicalMarkets.has(marketId)) return 'CANONICAL';
  if (legacyMarkets.has(marketId.toLowerCase())) return 'LEGACY';
  return 'UNKNOWN';
}

function issue(listTarget, code, collection, row, detail) {
  listTarget.push({ code, collection, documentId: row.id, traderId: row.traderId || '', marketId: row.marketId || '', detail });
}

(async () => {
  const idToken = await client.authenticate();
  const names = ['users', 'traders', 'market_trader_directory', 'market_claims', 'skpt_applications', 'market_units', 'market_occupancies', 'verification_records', 'business_locations'];
  const values = await Promise.all(names.map(name => client.list(idToken, name)));
  const data = Object.fromEntries(names.map((name, index) => [name, values[index]]));
  const issues = [];
  const traders = new Set(data.traders.map(row => row.traderId).filter(Boolean));
  const claims = new Map(data.market_claims.map(row => [row.id, row]));
  const applications = new Map(data.skpt_applications.map(row => [row.id, row]));
  const units = new Map(data.market_units.map(row => [row.id, row]));
  const directoryKeys = new Set(data.market_trader_directory.map(row => `${row.marketId}__${row.traderId}`));
  const verificationsByClaim = new Map();
  data.verification_records.forEach(row => {
    if (!verificationsByClaim.has(row.claimId)) verificationsByClaim.set(row.claimId, []);
    verificationsByClaim.get(row.claimId).push(row);
  });

  data.users.filter(row => row.role === 'MARKET_HEAD').forEach(row => {
    if (row.status !== 'ACTIVE') return;
    if (row.marketDirectoryScoped !== true) issue(issues, 'HEAD_DIRECTORY_SCOPE_NOT_ENFORCED', 'users', row, 'Akses kompatibilitas master pedagang masih aktif sampai backfill diverifikasi.');
    if (!Array.isArray(row.marketIds) || !row.marketIds.length) issue(issues, 'HEAD_WITHOUT_MARKET', 'users', row, 'Akun aktif tidak memiliki marketIds.');
    (Array.isArray(row.marketIds) ? row.marketIds : []).forEach(marketId => {
      if (marketClass(marketId) !== 'CANONICAL') issue(issues, 'HEAD_INVALID_MARKET', 'users', { ...row, marketId }, `Penugasan pasar ${marketClass(marketId).toLowerCase()}.`);
    });
  });

  data.market_claims.forEach(row => {
    const classification = marketClass(row.marketId);
    if (classification !== 'CANONICAL') issue(issues, `CLAIM_MARKET_${classification}`, 'market_claims', row, 'marketId klaim tidak kanonik.');
    if (!traders.has(row.traderId)) issue(issues, 'CLAIM_MISSING_TRADER', 'market_claims', row, 'Master pedagang tidak ditemukan.');
    if (!directoryKeys.has(`${row.marketId}__${row.traderId}`)) issue(issues, 'CLAIM_MISSING_MARKET_DIRECTORY', 'market_claims', row, 'Proyeksi pedagang untuk pasar ini belum tersedia.');
    if (!row.verificationStatus) issue(issues, 'CLAIM_LEGACY_STATUS', 'market_claims', row, `verificationStatus kosong; status legacy=${row.status || 'kosong'}.`);
    if (row.applicationId) {
      const application = applications.get(row.applicationId);
      if (!application) issue(issues, 'CLAIM_MISSING_APPLICATION', 'market_claims', row, `Aplikasi ${row.applicationId} tidak ditemukan.`);
      else if (application.claimId !== row.id || application.traderId !== row.traderId || application.marketId !== row.marketId) issue(issues, 'CLAIM_APPLICATION_MISMATCH', 'market_claims', row, `Relasi aplikasi ${row.applicationId} tidak konsisten.`);
    }
    if (row.verificationStatus === 'VERIFIED') {
      if (!row.marketUnitId || !units.has(row.marketUnitId)) issue(issues, 'VERIFIED_CLAIM_MISSING_UNIT', 'market_claims', row, 'Klaim VERIFIED tidak memiliki unit valid.');
      if (!(verificationsByClaim.get(row.id) || []).length) issue(issues, 'VERIFIED_CLAIM_MISSING_RECORD', 'market_claims', row, 'Klaim VERIFIED tidak memiliki verification record.');
    }
  });

  data.skpt_applications.forEach(row => {
    const claim = claims.get(row.claimId);
    if (!claim) issue(issues, 'APPLICATION_MISSING_CLAIM', 'skpt_applications', row, `Klaim ${row.claimId || 'kosong'} tidak ditemukan.`);
    else if (claim.traderId !== row.traderId || claim.marketId !== row.marketId) issue(issues, 'APPLICATION_CLAIM_MISMATCH', 'skpt_applications', row, 'Relasi aplikasi dan klaim tidak konsisten.');
  });

  data.market_occupancies.forEach(row => {
    const unit = units.get(row.marketUnitId || row.unitId);
    if (!unit) issue(issues, 'OCCUPANCY_MISSING_UNIT', 'market_occupancies', row, 'Unit okupansi tidak ditemukan.');
    if (!traders.has(row.traderId)) issue(issues, 'OCCUPANCY_MISSING_TRADER', 'market_occupancies', row, 'Pedagang okupansi tidak ditemukan.');
  });

  const issueCounts = Object.fromEntries([...new Set(issues.map(row => row.code))].sort().map(code => [code, issues.filter(row => row.code === code).length]));
  console.log(JSON.stringify({
    auditMode: 'READ_ONLY',
    projectId: config.projectId,
    auditedAt: new Date().toISOString(),
    collectionCounts: Object.fromEntries(names.map(name => [name, data[name].length])),
    issueCounts,
    issues
  }, null, 2));
})().catch(error => {
  console.error(JSON.stringify({ auditMode: 'READ_ONLY', status: 'FAILED', message: error.message }));
  process.exitCode = 1;
});
