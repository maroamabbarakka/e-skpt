const { chromium } = require('playwright');
const base = 'https://e-skpt.web.app';
const password = process.env.EPASAR_UAT_PASSWORD;
if (!password) throw new Error('EPASAR_UAT_PASSWORD wajib tersedia di environment lokal.');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${base}/login?market-uat=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#identifier').fill('kepala.pasar-sentral-pinrang@eskpt.id');
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/admin-epasar/, { timeout: 20000 });
  await page.goto(`${base}/market-verification?market-uat=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const result = await page.evaluate(async () => {
    const snapshot = await db.collection('market_claims').where('claimedUnitNumber', '==', 'UAT-25064124').limit(1).get();
    if (snapshot.empty) throw new Error('Klaim UAT tidak ditemukan.');
    const claim = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    const profile = await window.EPASAR_AUTH.requireStaff(['MARKET_HEAD']);
    return window.EPASAR_WORKFLOW.verifyClaim(claim, {
      unitType: 'KIOS', unitNumber: 'UAT-25064124', block: 'UAT', floor: '1', areaM2: '6',
      actualUser: 'Pedagang Uji Alur 064124', conflict: false,
      reason: 'Nomor unit, blok, lantai, luas, dan pengguna aktual telah diperiksa untuk UAT internal.'
    }, profile);
  });
  console.log(JSON.stringify(result, null, 2));
  await page.screenshot({ path: 'artifacts/live-e2e-20260925064124/11-kepala-pasar-berhasil.png', fullPage: true });
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
