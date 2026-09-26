const { chromium } = require('playwright');
const base = 'https://e-skpt.web.app';
const password = process.env.EPASAR_UAT_PASSWORD;
if (!password) throw new Error('EPASAR_UAT_PASSWORD wajib tersedia di environment lokal.');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage();
  await page.goto(`${base}/login?inspect=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#identifier').fill('superadmin@eskpt.id');
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/admin-epasar/, { timeout: 20000 });
  const result = await page.evaluate(async () => {
    const snap = await db.collection('market_claims').where('claimedUnitNumber', '==', 'UAT-25064124').limit(1).get();
    if (snap.empty) return { missing: true };
    const claim = { id: snap.docs[0].id, ...snap.docs[0].data() };
    const app = await db.collection('skpt_applications').doc(claim.applicationId).get();
    const unit = claim.marketUnitId ? await db.collection('market_units').doc(claim.marketUnitId).get() : null;
    const occupancy = unit?.exists && unit.data().currentOccupancyId ? await db.collection('market_occupancies').doc(unit.data().currentOccupancyId).get() : null;
    const intake = app?.exists ? await db.collection('trader_intake').doc(app.data().sourceIntakeId).get() : null;
    return { claim, app: app.exists ? { id: app.id, ...app.data() } : null, intake: intake?.exists ? { id: intake.id, ...intake.data() } : null, unit: unit?.exists ? { id: unit.id, ...unit.data() } : null, occupancy: occupancy?.exists ? { id: occupancy.id, ...occupancy.data() } : null };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
