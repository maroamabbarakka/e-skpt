'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.EPASAR_BASE_URL || 'https://e-skpt.web.app';
function localUatPassword() {
  if (process.env.EPASAR_UAT_PASSWORD) return process.env.EPASAR_UAT_PASSWORD;
  const helper = path.resolve(process.cwd(), 'scripts', 'capture_role_uat.js');
  if (!fs.existsSync(helper)) return '';
  const source = fs.readFileSync(helper, 'utf8');
  const match = source.match(/locator\((['"])#password\1\)\.fill\((['"])(.*?)\2\)/);
  return match ? match[3] : '';
}

const PASSWORD = localUatPassword();
const EMAIL = process.env.EPASAR_ADMIN_EMAIL || 'superadmin@eskpt.id';

if (!PASSWORD) throw new Error('EPASAR_UAT_PASSWORD wajib tersedia di environment lokal.');

const COLLECTIONS = [
  'trader_intake', 'correction_requests', 'trader_media', 'traders',
  'market_trader_directory', 'trader_private', 'nik_registry', 'businesses',
  'business_locations', 'business_classifications', 'market_claims', 'market_units',
  'market_occupancies', 'verification_records', 'skpt_applications', 'skpt_documents',
  'skpt_annual_validations', 'notifications', 'public_status',
  'public_skpt_verification', 'public_market_units'
];

function stamp() {
  return new Date().toISOString().replace(/\D/g, '').slice(0, 14);
}

(async () => {
  const outputDir = path.resolve(process.cwd(), 'artifacts', `live-inventory-${stamp()}`);
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('#identifier').fill(EMAIL);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/admin-epasar/, { timeout: 30000 });
    await page.waitForFunction(() => typeof db !== 'undefined', null, { timeout: 20000 });

    const data = await page.evaluate(async (collections) => {
      function serialise(value) {
        if (value === null || value === undefined) return value;
        if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
        if (Array.isArray(value)) return value.map(serialise);
        if (typeof value === 'object') {
          const result = {};
          for (const [key, nested] of Object.entries(value)) result[key] = serialise(nested);
          return result;
        }
        return value;
      }
      const result = {};
      for (const collection of collections) {
        try {
          const snapshot = await db.collection(collection).get();
          result[collection] = {
            readable: true,
            documents: snapshot.docs.map((document) => ({
              id: document.id,
              data: serialise(document.data())
            }))
          };
        } catch (error) {
          result[collection] = { readable: false, error: error.code || error.message, documents: [] };
        }
      }
      return result;
    }, COLLECTIONS);

    const backup = {
      capturedAt: new Date().toISOString(),
      source: BASE_URL,
      collections: data
    };
    fs.writeFileSync(path.join(outputDir, 'backup.json'), JSON.stringify(backup, null, 2));

    const summary = Object.fromEntries(
      Object.entries(data).map(([collection, entry]) => [collection, {
        readable: entry.readable,
        count: entry.documents.length,
        error: entry.error || null
      }])
    );
    fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ outputDir, summary }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
