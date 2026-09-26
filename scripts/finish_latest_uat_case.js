const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = 'https://e-skpt.web.app';
const password = process.env.EPASAR_UAT_PASSWORD;
if (!password) throw new Error('EPASAR_UAT_PASSWORD wajib tersedia di environment lokal.');
const run = '20260925064124';
const unit = 'UAT-25064124';
const name = 'Pedagang Uji Alur 064124';
const number = 'SKPT-UAT-20260925064124';
const out = path.join(process.cwd(), 'artifacts', `live-e2e-${run}`);

async function login(page, email) {
  await page.goto(`${base}/login?uat=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#identifier').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/admin-epasar/, { timeout: 20000 });
}
async function shot(page, numberPart, label) {
  await page.screenshot({ path: path.join(out, `${numberPart}-${label}.png`), fullPage: true });
  console.log(`PASS ${numberPart} ${label}`);
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

  await login(page, 'superadmin@eskpt.id');
  const state = await page.evaluate(async (claimedUnitNumber) => {
    const snapshot = await db.collection('market_claims').where('claimedUnitNumber', '==', claimedUnitNumber).limit(1).get();
    if (snapshot.empty) throw new Error('Klaim UAT tidak ditemukan.');
    const claim = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    const appSnapshot = await db.collection('skpt_applications').doc(claim.applicationId).get();
    const app = { id: appSnapshot.id, ...appSnapshot.data() };
    const intakeSnapshot = await db.collection('trader_intake').doc(app.sourceIntakeId).get();
    return { claim, app, intake: { id: intakeSnapshot.id, ...intakeSnapshot.data() } };
  }, unit);

  await page.evaluate(() => firebase.auth().signOut()).catch(() => {});
  await login(page, 'kepala.pasar-sentral-pinrang@eskpt.id');
  await page.goto(`${base}/market-verification?uat=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  const marketForm = page.locator(`form[data-id="${state.claim.id}"]`);
  await marketForm.waitFor({ state: 'visible', timeout: 30000 });
  await marketForm.locator('[name="actualUser"]').fill(name);
  await marketForm.locator('[name="reason"]').fill('Nomor unit, blok, lantai, luas, dan pengguna aktual telah diperiksa untuk UAT internal.');
  await shot(page, '10', 'kepala-pasar-verifikasi');
  await marketForm.getByRole('button', { name: 'Simpan verifikasi' }).click();
  await page.locator('#message').filter({ hasText: 'terverifikasi' }).waitFor({ timeout: 30000 });
  await shot(page, '11', 'kepala-pasar-berhasil');

  await page.evaluate(() => firebase.auth().signOut()).catch(() => {});
  await login(page, 'kadis@eskpt.id');
  await page.goto(`${base}/kadis-approval?uat=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  const approval = page.locator(`form[data-action="approve"][data-id="${state.app.id}"]`);
  await approval.waitFor({ state: 'visible', timeout: 30000 });
  await approval.locator('[name="note"]').fill('Data pemohon dan hasil verifikasi telah dibandingkan untuk UAT internal.');
  await shot(page, '12', 'kadis-review');
  await approval.getByRole('button').click();
  await page.locator('#message').filter({ hasText: 'disetujui' }).waitFor({ timeout: 30000 });
  await shot(page, '13', 'kadis-persetujuan-tercatat');

  await page.reload({ waitUntil: 'domcontentloaded' });
  const issue = page.locator(`form[data-action="issue"][data-id="${state.app.id}"]`);
  await issue.waitFor({ state: 'visible', timeout: 30000 });
  await issue.locator('[name="displayName"]').fill(name);
  await issue.locator('[name="number"]').fill(number);
  await issue.locator('[name="reference"]').fill(`UAT-INTERNAL-${run}`);
  await shot(page, '14', 'kadis-registrasi-penerbitan');
  await issue.getByRole('button').click();
  await page.waitForURL(/skpt-pdf.*token=/, { timeout: 30000 });
  const verificationToken = new URL(page.url()).searchParams.get('token');
  await page.waitForTimeout(1500);
  await shot(page, '15', 'dokumen-skpt');
  await page.pdf({ path: path.join(out, 'SKPT-UAT.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });

  const publicToken = state.intake.publicToken;
  await page.goto(`${base}/skpt-statement?token=${encodeURIComponent(publicToken)}`, { waitUntil: 'networkidle' });
  await shot(page, '16', 'surat-pernyataan');
  await page.pdf({ path: path.join(out, 'SURAT-PERNYATAAN-UAT.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.goto(`${base}/trader-card?token=${encodeURIComponent(publicToken)}`, { waitUntil: 'networkidle' });
  await shot(page, '17', 'kartu-pedagang');
  await page.pdf({ path: path.join(out, 'KARTU-PEDAGANG-UAT.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.goto(`${base}/verifikasi-skpt?token=${encodeURIComponent(verificationToken)}`, { waitUntil: 'networkidle' });
  await shot(page, '18', 'verifikasi-publik-skpt');
  await page.goto(`${base}/epasar-status?token=${encodeURIComponent(publicToken)}&code=${encodeURIComponent(state.intake.registrationCode)}`, { waitUntil: 'networkidle' });
  await shot(page, '19', 'status-pedagang');

  const report = { status: 'PASS', run, name, unit, registrationCode: state.intake.registrationCode, intakeId: state.intake.id, traderId: state.claim.traderId, claimId: state.claim.id, applicationId: state.app.id, number, verificationToken, publicToken, errors };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
