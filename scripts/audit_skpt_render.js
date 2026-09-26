const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { related } = require('./uat-data');

(async () => {
  const output = path.join(process.cwd(), 'artifacts', 'document-audit');
  fs.mkdirSync(output, { recursive: true });
  const fixtures = related();
  const records = {};
  for (const row of fixtures.public_status) records[`public_status/${row.id}`] = row;
  for (const row of fixtures.public_skpt_verification) records[`public_skpt_verification/${row.id}`] = row;
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript((data) => {
    const mock = { collection: (collection) => ({ doc: (id) => ({ get: async () => ({ exists: Boolean(data[`${collection}/${id}`]), data: () => data[`${collection}/${id}`] }) }) }) };
    Object.defineProperty(window, 'db', { configurable: false, get: () => mock, set: () => {} });
  }, records);
  const pages = [
    ['skpt', 'skpt-pdf.html?token=uat-doc-token-v2-001'],
    ['statement', 'skpt-statement.html?token=uat-status-token-v2-001'],
    ['card', 'trader-card.html?token=uat-status-token-v2-001']
  ];
  for (const [name, url] of pages) {
    await page.goto(`http://127.0.0.1:8765/${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);
    if (name === 'skpt') {
      if (await page.locator('.uat-document-banner').count() !== 1) throw new Error('Watermark UAT SKPT tidak tampil.');
      if (await page.locator('.dummy-tte-qr').count() !== 1 || await page.locator('.dummy-tte-qr > *').count() < 1) throw new Error('QR TTE simulasi tidak tampil.');
    }
    if (name === 'card' && await page.locator('.card-uat-mark').count() !== 1) throw new Error('Penanda UAT kartu tidak tampil.');
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    if (name !== 'card') await page.pdf({ path: path.join(output, `${name}.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true });
    console.log(`PASS ${name}: ${JSON.stringify(await page.locator(name === 'card' ? '#card' : name === 'statement' ? '#statement' : '#document').boundingBox())}`);
  }
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
