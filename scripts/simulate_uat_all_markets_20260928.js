'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.EPASAR_UAT_BASE || 'http://127.0.0.1:8090';
const PASSWORD = process.env.EPASAR_UAT_PASSWORD;
if (!PASSWORD) throw new Error('EPASAR_UAT_PASSWORD wajib diisi melalui environment lokal.');

const run = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const out = path.resolve(process.cwd(), 'artifacts', `simulasi-semua-pasar-${run}`);
const imageDir = path.resolve(process.cwd(), 'assets', 'uat', 'generated-20260928');
fs.mkdirSync(out, { recursive: true });

const markets = [
  ['MKT-001', 'Pasar Rakyat Bungi', 'Duampanua', 'Bungi', 'kepala.pasar-bungi@eskpt.id'],
  ['MKT-002', 'Pasar Rakyat Cempa', 'Cempa', 'Cempa', 'kepala.pasar-cempa@eskpt.id'],
  ['MKT-003', 'Pasar Rakyat Kampung Jaya', 'Watang Sawitto', 'Jaya', 'kepala.pasar-kampung-jaya@eskpt.id'],
  ['MKT-004', 'Pasar Rakyat Kariango', 'Lembang', 'Kariango', 'kepala.pasar-kariango@eskpt.id'],
  ['MKT-005', 'Pasar Rakyat Langnga', 'Mattiro Sompe', 'Langnga', 'kepala.pasar-langnga@eskpt.id'],
  ['MKT-006', 'Pasar Rakyat Lanrisang', 'Lanrisang', 'Lanrisang', 'kepala.pasar-lanrisang@eskpt.id'],
  ['MKT-007', 'Pasar Rakyat Leppangang', 'Patampanua', 'Leppangang', 'kepala.pasar-leppangang@eskpt.id'],
  ['MKT-008', 'Pasar Rakyat Marawi', 'Tiroang', 'Marawi', 'kepala.pasar-marawi@eskpt.id'],
  ['MKT-009', 'Pasar Rakyat Pekkabata', 'Duampanua', 'Pekkabata', 'kepala.pasar-pekkabata@eskpt.id'],
  ['MKT-010', 'Pasar Rakyat Sentral Pinrang', 'Paleteang', 'Benteng Sawitto', 'kepala.pasar-sentral-pinrang@eskpt.id'],
  ['MKT-011', 'Pasar Rakyat Teppo', 'Patampanua', 'Teppo', 'kepala.pasar-teppo@eskpt.id']
];

const cases = markets.map((market, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    number,
    name: `Nama ujicoba ${number}`,
    nik: `7315${number}${run.slice(-10)}`,
    phone: `0812${run.slice(-6)}${number}`,
    unit: `UJI-${run.slice(-4)}-${number}`,
    marketId: market[0], marketName: market[1], district: market[2], village: market[3], headEmail: market[4],
    profile: path.join(imageDir, `profil-ujicoba-${number}.jpg`),
    ktp: path.join(imageDir, `ktp-dummy-ujicoba-${number}.jpg`),
    scenario: ({ '01': 'TERBIT', '02': 'PERBAIKAN_ADMIN', '03': 'DITOLAK_ADMIN', '04': 'KONFLIK_PASAR', '05': 'DITOLAK_KADIS', '07': 'MENUNGGU_KADIS' })[number] || 'SUBMITTED',
    viewport: index % 2 === 0 ? 'desktop' : 'mobile',
    status: 'NOT_RUN', errors: []
  };
});

const browserErrors = [];
let shotNo = 0;
function clean(value) { return String(value || '').replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase(); }

async function shot(page, label, both = false) {
  shotNo += 1;
  const prefix = String(shotNo).padStart(3, '0');
  const original = page.viewportSize();
  const views = both ? [{ width: 1440, height: 1000, suffix: 'desktop' }, { width: 390, height: 844, suffix: 'mobile' }] : [{ ...original, suffix: original.width <= 500 ? 'mobile' : 'desktop' }];
  for (const view of views) {
    await page.setViewportSize({ width: view.width, height: view.height });
    await page.screenshot({ path: path.join(out, `${prefix}-${clean(label)}-${view.suffix}.png`), fullPage: true });
  }
  await page.setViewportSize(original);
}

async function logout(page) {
  await page.evaluate(() => firebase?.auth?.().signOut()).catch(() => {});
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => {});
}

async function login(page, email, target) {
  await logout(page);
  await page.goto(`${BASE}/login.html?t=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#identifier').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/admin-epasar/, { timeout: 20000 });
  if (target) await page.goto(`${BASE}/${target}`, { waitUntil: 'domcontentloaded' });
}

async function register(page, item) {
  await logout(page);
  await page.setViewportSize(item.viewport === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await page.goto(`${BASE}/epasar.html?t=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.locator('[name="nik"]').fill(item.nik);
  await page.locator('[name="name"]').fill(item.name);
  await page.locator('[name="birthPlace"]').fill('Pinrang');
  await page.locator('[name="birthDate"]').fill(`19${70 + Number(item.number)}-01-15`);
  await page.locator('[name="phone"]').fill(item.phone);
  await page.locator('[name="district"]').selectOption(item.district);
  await page.locator('[name="village"]').selectOption(item.village);
  await page.locator('[name="address"]').fill(`Alamat ujicoba ${item.number}, ${item.village}, ${item.district}`);
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[data-bind="0|b|||name"]').fill(`Usaha ujicoba ${item.number}`);
  await page.locator('[data-bind="0|b|||type"]').selectOption({ label: Number(item.number) % 2 ? 'Toko' : 'Warung/Kuliner' });
  await page.locator('[data-bind="0|b|||group"]').selectOption({ label: Number(item.number) % 2 ? 'Bahan pangan kering' : 'Kuliner dan makanan siap saji' });
  await page.locator('[data-bind="0|b|||category"]').fill(`Komoditas ujicoba ${item.number}`);
  await page.locator('[data-bind="0|b|||monthlyRevenue"]').fill(String(2000000 + Number(item.number) * 500000));
  await page.locator('[data-bind="0|b|||workerCount"]').fill(String(Number(item.number) % 4));
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[data-bind="0|l|0||type"]').selectOption('MARKET');
  await page.locator('[data-bind="0|l|0||district"]').selectOption(item.district);
  await page.locator('[data-bind="0|l|0||village"]').selectOption(item.village);
  await page.locator('[data-bind="0|l|0||address"]').fill(`${item.marketName}, data ujicoba ${item.number}`);
  await page.getByRole('button', { name: '+ Tambah Tempat di Pasar' }).click();
  await page.locator('[data-bind="0|p|0|0|marketId"]').selectOption(item.marketId);
  await page.locator('[data-bind="0|p|0|0|unitType"]').selectOption(Number(item.number) % 3 === 0 ? 'LOS' : 'KIOS');
  await page.locator('[data-bind="0|p|0|0|unitNumber"]').fill(item.unit);
  await page.locator('[data-bind="0|p|0|0|block"]').fill(`U${item.number}`);
  await page.locator('[data-bind="0|p|0|0|floor"]').fill('1');
  await page.locator('[data-bind="0|p|0|0|areaM2"]').fill(String(4 + Number(item.number)));
  await page.locator('[data-bind="0|p|0|0|locationHint"]').fill(`Lokasi sintetis ujicoba ${item.number}`);
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[data-bind="0|p|0|0|applySkpt"]').check();
  await page.locator('[name="religion"]').selectOption({ label: 'Islam' });
  await page.locator('[name="citizenship"]').fill('Indonesia');
  await page.locator('#profilePhoto').setInputFiles(item.profile);
  await page.locator('#identityKtpPhoto').setInputFiles(item.ktp);
  await page.waitForFunction(() => window.EPASAR_MEDIA_BUFFER?.PROFILE && window.EPASAR_MEDIA_BUFFER?.IDENTITY_KTP, null, { timeout: 45000 });
  await page.locator('[name="truthAck"]').check();
  await page.locator('[name="verificationAck"]').check();
  await page.locator('[name="skptAck"]').check();
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await shot(page, `${item.number}-review-${item.marketId}`);
  await page.getByRole('button', { name: 'KIRIM DATA' }).click();
  await page.locator('#successPanel').waitFor({ state: 'visible', timeout: 35000 });
  item.regCode = (await page.locator('#registrationCode').innerText()).trim();
  item.publicToken = (await page.locator('#privateToken').innerText()).trim();
  item.status = 'SUBMITTED';
  await shot(page, `${item.number}-submitted-${item.marketId}`);
}

async function openAdminReview(page, item) {
  await login(page, 'superadmin@eskpt.id', 'admin-epasar.html');
  const row = page.locator('#intakeRows tr').filter({ hasText: item.regCode });
  await row.waitFor({ state: 'visible', timeout: 25000 });
  const href = await row.getByRole('link', { name: 'Review' }).getAttribute('href');
  item.intakeId = new URL(href, BASE).searchParams.get('id');
  item.reviewUrl = new URL(href, BASE).href;
  await page.goto(item.reviewUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#reviewForm').waitFor({ state: 'visible', timeout: 25000 });
}

async function adminAccept(page, item) {
  await openAdminReview(page, item);
  await page.locator('#confirmReview').check();
  await page.getByRole('button', { name: 'Bentuk data pedagang' }).click();
  await page.locator('#reviewMessage').filter({ hasText: /berhasil dibentuk/i }).waitFor({ timeout: 30000 });
  const intake = await page.evaluate(async id => ({ id, ...(await db.collection('trader_intake').doc(id).get()).data() }), item.intakeId);
  item.traderId = intake.traderId;
  item.applicationId = intake.workflow?.applicationIds?.[0] || intake.workflow?.applicationId;
  item.status = 'MARKET_VERIFICATION';
}

async function adminDecide(page, item, decision) {
  await openAdminReview(page, item);
  await page.locator('#decisionSections').selectOption(decision === 'REJECTED' ? ['IDENTITY', 'DOCUMENT'] : ['BUSINESS']);
  await page.locator('#decisionReason').fill(decision === 'REJECTED' ? 'KTP dummy tidak dapat dipakai sebagai identitas produksi; penolakan ini bagian simulasi ujicoba.' : 'Rincian komoditas dan omzet perlu diperbaiki pada simulasi ujicoba ini.');
  await shot(page, `${item.number}-admin-${decision}`, true);
  await page.locator(decision === 'REJECTED' ? '#rejectIntake' : '#returnIntake').click();
  const confirm = page.locator('button[data-modal="confirm"]');
  if (await confirm.isVisible()) await confirm.click();
  await page.waitForTimeout(1800);
  item.status = decision;
}

async function submitCorrection(page, item) {
  await logout(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/epasar-status.html?code=${encodeURIComponent(item.regCode)}&token=${encodeURIComponent(item.publicToken)}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#correctionPanel:not([hidden])').waitFor({ timeout: 20000 });
  await page.locator('#correctionSection').selectOption('business');
  await page.locator('#correctionValue').fill('Komoditas ujicoba sudah dirinci; omzet sintetis Rp 3.000.000 per bulan.');
  await page.locator('#correctionReason').fill('Perbaikan data simulasi sesuai catatan administrator.');
  await page.locator('#correctionForm button[type="submit"]').click();
  await page.locator('#correctionMessage').filter({ hasText: /berhasil dikirim/i }).waitFor({ timeout: 25000 });
  item.status = 'CORRECTION_SUBMITTED';
  await shot(page, `${item.number}-correction-submitted`, true);
}

async function marketVerify(page, item, conflict = false) {
  await login(page, item.headEmail, 'market-verification.html');
  await page.locator('#pendingSearch').fill(item.name);
  const queue = page.locator('#pendingList button').filter({ hasText: item.name }).first();
  await queue.waitFor({ state: 'visible', timeout: 30000 });
  await queue.click();
  const form = page.locator('form[data-id]').first();
  await form.waitFor({ state: 'visible', timeout: 20000 });
  await form.locator('[name="actualUser"]').fill(conflict ? 'Pengguna lain ujicoba' : item.name);
  if (conflict) await form.locator('[name="conflict"]').check();
  await form.locator('[name="reason"]').fill(conflict ? 'Simulasi konflik: pengguna aktual berbeda dan unit perlu mediasi.' : 'Nomor unit, lokasi, dan pengguna sesuai pemeriksaan simulasi lapangan.');
  await shot(page, `${item.number}-market-${conflict ? 'conflict' : 'verified'}`, true);
  await form.getByRole('button', { name: 'Simpan Verifikasi' }).click();
  await page.locator('#message').filter({ hasText: conflict ? /konflik/i : /terverifikasi/i }).waitFor({ timeout: 30000 });
  item.status = conflict ? 'CONFLICT' : 'KADIS_REVIEW';
}

async function kadisDecision(page, item, reject = false) {
  await login(page, 'kadis@eskpt.id', 'kadis-approval.html');
  const form = page.locator(`form[data-action="approve"][data-id="${item.applicationId}"]`);
  await form.waitFor({ state: 'visible', timeout: 30000 });
  await form.locator('[name="note"]').fill(reject ? 'Ditolak dalam simulasi karena hasil evaluasi zonasi dan kelengkapan belum memenuhi syarat.' : 'Disetujui dalam simulasi setelah administrasi dan verifikasi pasar dinyatakan sesuai.');
  await shot(page, `${item.number}-kadis-${reject ? 'reject' : 'approve'}`, true);
  if (reject) {
    await form.locator('button[data-action="reject"]').click();
    const confirm = page.locator('button[data-modal="confirm"]');
    await confirm.waitFor({ state: 'visible', timeout: 10000 });
    await confirm.click();
    await page.locator('#message').filter({ hasText: /ditolak/i }).waitFor({ timeout: 30000 });
    item.status = 'REJECTED_BY_KADIS';
  } else {
    await form.getByRole('button', { name: 'Setujui Permohonan' }).click();
    const confirm = page.locator('button[data-modal="confirm"]');
    if (await confirm.isVisible()) await confirm.click();
    await page.locator('#message').filter({ hasText: /disetujui/i }).waitFor({ timeout: 30000 });
    item.status = 'TTE_PENDING';
  }
}

async function issue(page, item) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  const form = page.locator(`form[data-action="issue"][data-id="${item.applicationId}"]`);
  await form.waitFor({ state: 'visible', timeout: 30000 });
  item.skptNumber = `SKPT-UJICOBA-${run}-${item.number}`;
  await form.locator('[name="displayName"]').fill(item.name);
  await form.locator('[name="number"]').fill(item.skptNumber);
  await form.locator('[name="reference"]').fill(`UAT-MANDIRI-${run}-${item.number}`);
  await form.getByRole('button', { name: 'Terbitkan Dokumen Uji Coba' }).click();
  await page.waitForURL(/skpt-pdf.*token=/, { timeout: 35000 });
  item.verificationToken = new URL(page.url()).searchParams.get('token');
  item.status = 'ISSUED';
  await shot(page, `${item.number}-skpt-issued`, true);
  await page.pdf({ path: path.join(out, `${item.number}-SKPT.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.goto(`${BASE}/skpt-statement.html?token=${encodeURIComponent(item.publicToken)}`, { waitUntil: 'networkidle' });
  await shot(page, `${item.number}-statement`, true);
  await page.pdf({ path: path.join(out, `${item.number}-SURAT-PERNYATAAN.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.goto(`${BASE}/trader-card.html?token=${encodeURIComponent(item.publicToken)}`, { waitUntil: 'networkidle' });
  await shot(page, `${item.number}-trader-card`, true);
  await page.pdf({ path: path.join(out, `${item.number}-KARTU-PEDAGANG.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.goto(`${BASE}/verifikasi-skpt.html?token=${encodeURIComponent(item.verificationToken)}`, { waitUntil: 'networkidle' });
  await shot(page, `${item.number}-public-verification`, true);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => browserErrors.push({ url: page.url(), type: 'pageerror', message: error.message }));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push({ url: page.url(), type: 'console', message: message.text() }); });

  for (const item of cases) {
    try { await register(page, item); console.log(`PASS daftar ${item.name} ${item.marketId} ${item.viewport}`); }
    catch (error) { item.status = 'REGISTER_FAILED'; item.errors.push(error.message); console.error(`FAIL daftar ${item.name}: ${error.message}`); }
  }

  for (const item of cases.filter(value => ['TERBIT', 'KONFLIK_PASAR', 'DITOLAK_KADIS', 'MENUNGGU_KADIS'].includes(value.scenario) && value.status === 'SUBMITTED')) {
    try { await adminAccept(page, item); console.log(`PASS admin bentuk ${item.name}`); }
    catch (error) { item.errors.push(error.message); console.error(`FAIL admin ${item.name}: ${error.message}`); }
  }
  const correction = cases[1], adminRejected = cases[2];
  try { await adminDecide(page, correction, 'CORRECTION_REQUIRED'); await submitCorrection(page, correction); }
  catch (error) { correction.errors.push(error.message); }
  try { await adminDecide(page, adminRejected, 'REJECTED'); }
  catch (error) { adminRejected.errors.push(error.message); }

  for (const item of [cases[0], cases[3], cases[4], cases[6]]) {
    if (item.status !== 'MARKET_VERIFICATION') continue;
    try { await marketVerify(page, item, item.number === '04'); console.log(`PASS kepala pasar ${item.name}: ${item.status}`); }
    catch (error) { item.errors.push(error.message); console.error(`FAIL kepala pasar ${item.name}: ${error.message}`); }
  }
  if (cases[0].status === 'KADIS_REVIEW') {
    try { await kadisDecision(page, cases[0], false); await issue(page, cases[0]); }
    catch (error) { cases[0].errors.push(error.message); }
  }
  if (cases[4].status === 'KADIS_REVIEW') {
    try { await kadisDecision(page, cases[4], true); }
    catch (error) { cases[4].errors.push(error.message); }
  }

  const report = { run, base: BASE, outputDirectory: out, cases, browserErrors, screenshotCount: shotNo, finishedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
