const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const out = path.join(process.cwd(), 'artifacts', 'uat-final');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pages = [
    ['intake', 'epasar.html'],
    ['status', 'epasar-status.html'],
    ['verification', 'verifikasi-skpt.html'],
    ['statement', 'skpt-statement.html?token=uat-status-token-v2-001'],
    ['application-letter', 'skpt-application-letter.html'],
    ['card', 'trader-card.html?token=uat-status-token-v2-001'],
    ['skpt', 'skpt-pdf.html?token=uat-doc-token-v2-001']
  ];
  for (const [name, url] of pages) {
    try {
      await page.goto(`https://e-skpt.web.app/${url}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1400);
      await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
      if (['statement', 'skpt'].includes(name)) await page.pdf({ path: path.join(out, `${name}-uat.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true });
      console.log(`PASS ${name}`);
    } catch (error) { console.log(`FAIL ${name}: ${error.message}`); }
  }
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
