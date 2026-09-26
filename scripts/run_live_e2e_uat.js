const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = 'https://e-skpt.web.app';
const password = process.env.EPASAR_UAT_PASSWORD;
if (!password) throw new Error('EPASAR_UAT_PASSWORD wajib diisi melalui environment lokal.');
const run = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const name = `Pedagang Uji Alur ${run.slice(-6)}`;
const nik = `731599${run.slice(-10)}`.slice(0, 16);
const unit = `UAT-${run.slice(-8)}`;
const skptNumber = `SKPT-UAT-${run}`;
const out = path.join(process.cwd(), 'artifacts', `live-e2e-${run}`);
fs.mkdirSync(out, { recursive: true });
const photo = path.join(process.cwd(), 'assets', 'uat', 'pedagang-contoh-3x4.jpg');

async function shot(page, order, label) {
  await page.screenshot({ path: path.join(out, `${String(order).padStart(2, '0')}-${label}.png`), fullPage: true });
  console.log(`PASS ${String(order).padStart(2, '0')} ${label}`);
}
async function login(page, email) {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#identifier').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/admin-epasar/, { timeout: 20000 });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

  await page.goto(`${base}/epasar`, { waitUntil: 'domcontentloaded' });
  await page.locator('[name="nik"]').fill(nik);
  await page.locator('[name="name"]').fill(name);
  await page.locator('[name="birthPlace"]').fill('Pinrang');
  await page.locator('[name="birthDate"]').fill('1990-01-01');
  await page.locator('[name="phone"]').fill('081299990001');
  await page.locator('[name="district"]').fill('Watang Sawitto');
  await page.locator('[name="village"]').fill('Macorawalie');
  await page.locator('[name="address"]').fill('Alamat khusus pengujian internal e-PASAR');
  await shot(page, 1, 'pedagang-identitas');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[name="businessName"]').fill('Warung Uji Internal');
  await page.locator('[name="businessType"]').selectOption({ label: 'Warung/Kuliner' });
  await page.locator('[name="businessGroup"]').selectOption({ label: 'Kuliner dan makanan siap saji' });
  await page.locator('[name="businessCategory"]').fill('Makanan dan minuman');
  await page.locator('[name="monthlyRevenue"]').fill('5000000');
  await page.locator('[name="workerCount"]').fill('2');
  await page.locator('[name="businessDistrict"]').fill('Watang Sawitto');
  await page.locator('[name="businessVillage"]').fill('Macorawalie');
  await page.locator('[name="businessAddress"]').fill('Area pengujian Pasar Sentral Pinrang');
  await shot(page, 2, 'pedagang-usaha');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[name="hasMarketUnit"][value="yes"]').check();
  await page.locator('[name="marketName"]').fill('Pasar Sentral Pinrang');
  await page.locator('[name="unitType"]').selectOption('KIOS');
  await page.locator('[name="unitNumber"]').fill(unit);
  await page.locator('[name="block"]').fill('UAT');
  await page.locator('[name="floor"]').fill('1');
  await page.locator('[name="areaM2"]').fill('6');
  await page.locator('[name="locationHint"]').fill('Unit khusus pengujian internal');
  await shot(page, 3, 'pedagang-klaim-pasar');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[name="applySkpt"][value="yes"]').check();
  await page.locator('[name="religion"]').selectOption({ label: 'Islam' });
  await page.locator('[name="citizenship"]').fill('Indonesia');
  console.log('INFO memproses foto profil');
  await page.locator('#profilePhoto').setInputFiles(photo, { timeout: 30000 });
  console.log('INFO memproses foto KTP');
  await page.locator('#identityKtpPhoto').setInputFiles(photo, { timeout: 30000 });
  console.log('INFO menunggu buffer media');
  await page.waitForFunction(() => window.EPASAR_MEDIA_BUFFER?.PROFILE && window.EPASAR_MEDIA_BUFFER?.IDENTITY_KTP, null, { timeout: 45000 });
  await page.locator('[name="truthAck"]').check();
  await page.locator('[name="verificationAck"]').check();
  await page.locator('[name="skptAck"]').check();
  await shot(page, 4, 'pedagang-foto-pernyataan');
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await shot(page, 5, 'pedagang-review');
  await page.getByRole('button', { name: 'KIRIM DATA' }).click();
  await page.locator('#successPanel').waitFor({ state: 'visible', timeout: 30000 });
  const registrationCode = (await page.locator('#registrationCode').innerText()).trim();
  await shot(page, 6, 'pedagang-berhasil');

  await context.clearCookies();
  await login(page, 'superadmin@eskpt.id');
  await page.waitForTimeout(1800);
  await shot(page, 7, 'admin-dashboard');
  const row = page.locator('#intakeRows tr').filter({ hasText: registrationCode });
  await row.waitFor({ state: 'visible', timeout: 20000 });
  const reviewHref = await row.getByRole('link', { name: 'Review' }).getAttribute('href');
  const intakeId = new URL(reviewHref, base).searchParams.get('id');
  await page.goto(new URL(reviewHref, base).href, { waitUntil: 'domcontentloaded' });
  await page.locator('#reviewForm').waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('[name="marketId"]').fill('pasar-sentral-pinrang');
  await page.locator('#confirmReview').check();
  await shot(page, 8, 'admin-review-intake');
  await page.getByRole('button', { name: 'Bentuk data pedagang' }).click();
  await page.locator('#reviewMessage').filter({ hasText: 'berhasil dibentuk' }).waitFor({ timeout: 30000 });
  const intakeState = await page.evaluate(async id => { const d = await db.collection('trader_intake').doc(id).get(); return d.data(); }, intakeId);
  await shot(page, 9, 'admin-data-terbentuk');

  await context.clearCookies();
  await page.evaluate(() => firebase.auth().signOut()).catch(() => {});
  await login(page, 'kepala.pasar-sentral-pinrang@eskpt.id');
  await page.goto(`${base}/market-verification`, { waitUntil: 'domcontentloaded' });
  const marketForm = page.locator('form[data-id]').filter({ has: page.locator(`[name="unitNumber"][value="${unit}"]`) });
  await marketForm.waitFor({ state: 'visible', timeout: 20000 });
  await marketForm.locator('[name="actualUser"]').fill(name);
  await marketForm.locator('[name="reason"]').fill('Nomor, lokasi, dan pengguna aktual telah diperiksa dalam simulasi UAT internal.');
  await shot(page, 10, 'kepala-pasar-verifikasi');
  await marketForm.getByRole('button', { name: 'Simpan verifikasi' }).click();
  await page.locator('#message').filter({ hasText: 'terverifikasi' }).waitFor({ timeout: 30000 });
  await shot(page, 11, 'kepala-pasar-berhasil');

  await context.clearCookies();
  await page.evaluate(() => firebase.auth().signOut()).catch(() => {});
  await login(page, 'kadis@eskpt.id');
  await page.goto(`${base}/kadis-approval`, { waitUntil: 'domcontentloaded' });
  const approval = page.locator(`form[data-action="approve"][data-id="${intakeState.workflow.applicationId}"]`);
  await approval.waitFor({ state: 'visible', timeout: 20000 });
  await approval.locator('[name="note"]').fill('Data pemohon dan hasil verifikasi telah dibandingkan untuk UAT internal.');
  await shot(page, 12, 'kadis-review');
  await approval.getByRole('button').click();
  await page.locator('#message').filter({ hasText: 'disetujui' }).waitFor({ timeout: 30000 });
  await shot(page, 13, 'kadis-persetujuan-tercatat');

  await page.reload({ waitUntil: 'domcontentloaded' });
  const issue = page.locator(`form[data-action="issue"][data-id="${intakeState.workflow.applicationId}"]`);
  await issue.waitFor({ state: 'visible', timeout: 20000 });
  await issue.locator('[name="displayName"]').fill(name);
  await issue.locator('[name="number"]').fill(skptNumber);
  await issue.locator('[name="reference"]').fill(`UAT-INTERNAL-${run}`);
  await shot(page, 14, 'kadis-registrasi-penerbitan');
  await issue.getByRole('button').click();
  await page.waitForURL(/skpt-pdf.*token=/, { timeout: 30000 });
  const verificationToken = new URL(page.url()).searchParams.get('token');
  await page.waitForTimeout(2500);
  await shot(page, 15, 'dokumen-skpt');
  await page.pdf({ path: path.join(out, 'SKPT-UAT.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });

  const publicToken = await page.evaluate(async id => { const d = await db.collection('trader_intake').doc(id).get(); return d.data().publicToken; }, intakeId);
  await page.goto(`${base}/skpt-statement?token=${encodeURIComponent(publicToken)}`, { waitUntil: 'networkidle' });
  await shot(page, 16, 'surat-pernyataan');
  await page.pdf({ path: path.join(out, 'SURAT-PERNYATAAN-UAT.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.goto(`${base}/trader-card?token=${encodeURIComponent(publicToken)}`, { waitUntil: 'networkidle' });
  await shot(page, 17, 'kartu-pedagang');
  await page.pdf({ path: path.join(out, 'KARTU-PEDAGANG-UAT.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.goto(`${base}/verifikasi-skpt?token=${encodeURIComponent(verificationToken)}`, { waitUntil: 'networkidle' });
  await shot(page, 18, 'verifikasi-publik-skpt');
  await page.goto(`${base}/epasar-status?token=${encodeURIComponent(publicToken)}&code=${encodeURIComponent(registrationCode)}`, { waitUntil: 'networkidle' });
  await shot(page, 19, 'status-pedagang');

  const report = { run, out, name, nikMasked: `${nik.slice(0, 6)}******${nik.slice(-4)}`, unit, registrationCode, intakeId, traderId: intakeState.traderId, applicationId: intakeState.workflow.applicationId, skptNumber, verificationToken, publicToken, errors };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
