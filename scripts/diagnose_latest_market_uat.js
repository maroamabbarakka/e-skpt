const { chromium } = require('playwright');

const base = 'https://e-skpt.web.app';
const password = process.env.EPASAR_UAT_PASSWORD;
const unit = 'UAT-25064124';

if (!password) throw new Error('EPASAR_UAT_PASSWORD wajib tersedia di environment lokal.');

async function login(page, email) {
  await page.goto(`${base}/login?uat=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#identifier').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/admin-epasar/, { timeout: 20000 });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const logs = [];
  page.on('console', message => logs.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', error => logs.push(`pageerror: ${error.message}`));
  await login(page, 'kepala.pasar-sentral-pinrang@eskpt.id');
  await page.goto(`${base}/market-verification?uat=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  const form = page.locator(`form`).filter({ has: page.locator(`[name="unitNumber"]`) }).filter({ hasText: unit });
  await form.waitFor({ state: 'visible', timeout: 30000 });
  await form.locator('[name="actualUser"]').fill('Pedagang Uji Alur 064124');
  await form.locator('[name="reason"]').fill('Verifikasi unit untuk UAT internal.');
  await form.getByRole('button', { name: 'Simpan verifikasi' }).click();
  await page.waitForTimeout(12000);
  const result = await page.evaluate(async (claimedUnitNumber) => {
    const row = await db.collection('market_claims').where('claimedUnitNumber', '==', claimedUnitNumber).limit(1).get();
    const claim = row.empty ? null : { id: row.docs[0].id, ...row.docs[0].data() };
    const app = claim ? await db.collection('skpt_applications').doc(claim.applicationId).get() : null;
    return { message: document.querySelector('#message')?.textContent, claim, app: app?.exists ? { id: app.id, ...app.data() } : null };
  }, unit);
  console.log(JSON.stringify({ result, logs }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
