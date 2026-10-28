'use strict';

// Purge terarah berdasarkan snapshot hasil inventory_live_uat.js.
// Default adalah dry-run. Penghapusan hanya berjalan dengan --execute.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.EPASAR_BASE_URL || 'https://e-skpt.web.app';
const EMAIL = process.env.EPASAR_ADMIN_EMAIL || 'superadmin@eskpt.id';
const execute = process.argv.includes('--execute');
const backupArg = process.argv.find(arg => arg.startsWith('--backup='));

function localUatPassword() {
  if (process.env.EPASAR_UAT_PASSWORD) return process.env.EPASAR_UAT_PASSWORD;
  const helper = path.resolve(process.cwd(), 'scripts', 'capture_role_uat.js');
  if (!fs.existsSync(helper)) return '';
  const source = fs.readFileSync(helper, 'utf8');
  const match = source.match(/locator\((['"])#password\1\)\.fill\((['"])(.*?)\2\)/);
  return match ? match[3] : '';
}

function newestBackup() {
  if (backupArg) return path.resolve(backupArg.slice('--backup='.length));
  const root = path.resolve(process.cwd(), 'artifacts');
  const candidates = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('live-inventory-'))
    .map(entry => path.join(root, entry.name, 'backup.json'))
    .filter(file => fs.existsSync(file))
    .sort();
  if (!candidates.length) throw new Error('Snapshot live-inventory tidak ditemukan.');
  return candidates[candidates.length - 1];
}

const password = localUatPassword();
if (!password) throw new Error('EPASAR_UAT_PASSWORD wajib tersedia di environment lokal.');

const backupFile = newestBackup();
const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
if (backup.source !== BASE_URL) throw new Error(`Sumber snapshot berbeda: ${backup.source}`);
const ageHours = (Date.now() - Date.parse(backup.capturedAt)) / 3600000;
if (!Number.isFinite(ageHours) || ageHours > 24) throw new Error(`Snapshot terlalu lama (${ageHours.toFixed(1)} jam). Ambil inventory baru.`);

const collections = Object.fromEntries(Object.entries(backup.collections).map(([name, value]) => [name, value.documents || []]));
const testName = value => /(?:\buji\s*coba\b|\btest\s+imo\b)/i.test(String(value || ''));
const taggedDocument = row => row.data?.isDemo === true && /uat|internal/i.test(String(row.data?.environment || ''));
const values = key => new Set(key.filter(Boolean));

const intakeRows = collections.trader_intake.filter(row => testName(row.data?.identity?.name));
const intakeIds = values(intakeRows.map(row => row.id));
const publicTokens = values(intakeRows.map(row => row.data?.publicToken));

const taggedSkptRows = collections.skpt_documents.filter(taggedDocument);
const traderIds = values([
  ...intakeRows.map(row => row.data?.traderId),
  ...collections.traders.filter(row => testName(row.data?.displayName) || intakeIds.has(row.data?.intakeId)).map(row => row.data?.traderId),
  ...taggedSkptRows.map(row => row.data?.traderId)
]);

const traderRows = collections.traders.filter(row => traderIds.has(row.data?.traderId));
traderRows.forEach(row => intakeIds.add(row.data?.intakeId));
collections.trader_intake.filter(row => intakeIds.has(row.id)).forEach(row => publicTokens.add(row.data?.publicToken));

const claimRows = collections.market_claims.filter(row => traderIds.has(row.data?.traderId));
const claimIds = values(claimRows.map(row => row.id));
const applicationRows = collections.skpt_applications.filter(row => traderIds.has(row.data?.traderId) || claimIds.has(row.data?.claimId) || intakeIds.has(row.data?.sourceIntakeId));
const applicationIds = values(applicationRows.map(row => row.id));
const unitIds = values([
  ...claimRows.map(row => row.data?.marketUnitId),
  ...applicationRows.map(row => row.data?.marketUnitId),
  ...taggedSkptRows.map(row => row.data?.marketUnitId)
]);
const verificationRows = collections.verification_records.filter(row => claimIds.has(row.data?.claimId) || unitIds.has(row.data?.marketUnitId));
const verificationIds = values(verificationRows.map(row => row.id));
const unitRows = collections.market_units.filter(row => unitIds.has(row.id) || traderIds.has(row.data?.currentTraderId));
unitRows.forEach(row => unitIds.add(row.id));

const plan = {
  correction_requests: collections.correction_requests.filter(row => publicTokens.has(row.data?.publicToken) || claimIds.has(row.data?.claimId)),
  notifications: collections.notifications.filter(row => intakeIds.has(row.data?.sourceIntakeId) || traderIds.has(row.data?.traderId) || claimIds.has(row.data?.claimId) || applicationIds.has(row.data?.applicationId) || verificationIds.has(row.data?.verificationRecordId) || testName(row.data?.traderName)),
  skpt_documents: collections.skpt_documents.filter(row => taggedDocument(row) || traderIds.has(row.data?.traderId) || applicationIds.has(row.data?.applicationId)),
  market_occupancies: collections.market_occupancies.filter(row => traderIds.has(row.data?.traderId) || claimIds.has(row.data?.claimId) || unitIds.has(row.data?.marketUnitId)),
  verification_records: verificationRows,
  market_units: unitRows,
  skpt_applications: applicationRows,
  market_claims: claimRows,
  business_locations: collections.business_locations.filter(row => traderIds.has(row.data?.traderId)),
  business_classifications: collections.business_classifications.filter(row => traderIds.has(row.data?.traderId)),
  businesses: collections.businesses.filter(row => traderIds.has(row.data?.traderId)),
  market_trader_directory: collections.market_trader_directory.filter(row => traderIds.has(row.data?.traderId)),
  nik_registry: collections.nik_registry.filter(row => traderIds.has(row.data?.traderId)),
  trader_private: collections.trader_private.filter(row => traderIds.has(row.data?.traderId)),
  trader_media: collections.trader_media.filter(row => intakeIds.has(row.data?.ownerId) || traderIds.has(row.data?.ownerId) || publicTokens.has(row.data?.publicToken)),
  traders: traderRows,
  trader_intake: collections.trader_intake.filter(row => intakeIds.has(row.id))
};

// Proyeksi publik tidak dapat di-list oleh Super Admin, tetapi ID-nya berasal dari
// token dokumen sumber yang sudah masuk snapshot.
plan.public_status = [...publicTokens].filter(Boolean).map(id => ({ id, data: {} }));
plan.public_skpt_verification = plan.skpt_documents.map(row => row.data?.verificationToken).filter(Boolean).map(id => ({ id, data: {} }));
plan.public_market_units = unitRows.map(row => row.data?.qrUnitToken).filter(Boolean).map(id => ({ id, data: {} }));

const uniquePlan = Object.fromEntries(Object.entries(plan).map(([name, rows]) => [name, [...new Map(rows.map(row => [row.id, row])).values()]]));
const summary = Object.fromEntries(Object.entries(uniquePlan).map(([name, rows]) => [name, rows.length]));
const total = Object.values(summary).reduce((sum, count) => sum + count, 0);
const audit = {
  mode: execute ? 'EXECUTE' : 'DRY_RUN',
  backupFile,
  capturedAt: backup.capturedAt,
  generatedAt: new Date().toISOString(),
  classification: { intakeIds: intakeIds.size, traderIds: traderIds.size, publicTokens: publicTokens.size, claimIds: claimIds.size, applicationIds: applicationIds.size, unitIds: unitIds.size },
  summary,
  total,
  ids: Object.fromEntries(Object.entries(uniquePlan).map(([name, rows]) => [name, rows.map(row => row.id)]))
};

const outputDir = path.resolve(process.cwd(), 'artifacts', `uat-purge-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`);
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'plan.json'), JSON.stringify(audit, null, 2));
console.log(JSON.stringify({ outputDir, ...audit, ids: undefined }, null, 2));

if (!execute) process.exit(0);
if (intakeIds.size < 1 || traderIds.size < 1) throw new Error('Guard gagal: kandidat UAT kosong.');
if (traderIds.size > 100 || intakeIds.size > 300) throw new Error('Guard gagal: jumlah kandidat melampaui batas aman.');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('#identifier').fill(EMAIL);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/admin-epasar/, { timeout: 30000 });
    await page.waitForFunction(() => typeof db !== 'undefined', null, { timeout: 20000 });
    const ids = audit.ids;
    const result = await page.evaluate(async deletionPlan => {
      const deleted = {};
      for (const [collection, documentIds] of Object.entries(deletionPlan)) {
        deleted[collection] = 0;
        for (let offset = 0; offset < documentIds.length; offset += 400) {
          const batch = db.batch();
          documentIds.slice(offset, offset + 400).forEach(id => batch.delete(db.collection(collection).doc(id)));
          await batch.commit();
          deleted[collection] += Math.min(400, documentIds.length - offset);
        }
      }
      return deleted;
    }, ids);
    const completed = { ...audit, completedAt: new Date().toISOString(), deleted: result };
    fs.writeFileSync(path.join(outputDir, 'result.json'), JSON.stringify(completed, null, 2));
    console.log(JSON.stringify({ status: 'PURGE_COMPLETE', outputDir, deleted: result }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
