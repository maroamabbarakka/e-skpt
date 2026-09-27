'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8090';
const PASSWORD = 'Pasar202#';
const OUT_DIR = path.resolve(process.cwd(), 'artifacts', 'simulasi-lengkap');
const PHOTO_SAMPLE = path.resolve(process.cwd(), 'assets', 'uat', 'pedagang-contoh-3x4.jpg');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function shot(page, stepNumber, label) {
  const prefix = String(stepNumber).padStart(2, '0');
  // Desktop
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, `${prefix}-${label}-desktop.png`), fullPage: true });

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, `${prefix}-${label}-mobile.png`), fullPage: true });

  // Kembali ke desktop
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(300);
  console.log(`[TANGKAPAN LAYAR] ${prefix}-${label} (Desktop & Mobile) tersimpan.`);
}

async function loginUser(page, email, targetUrl = null) {
  await page.goto(`${BASE}/login.html?t=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#identifier').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/admin-epasar/, { timeout: 25000 });
  if (targetUrl) {
    await page.goto(`${BASE}/${targetUrl}`, { waitUntil: 'domcontentloaded' });
  }
}

async function logoutUser(page) {
  try {
    await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      if (window.EPASAR_AUTH && typeof window.EPASAR_AUTH.signOut === 'function') {
        await window.EPASAR_AUTH.signOut();
      } else if (typeof firebase !== 'undefined' && firebase.auth) {
        await firebase.auth().signOut();
      }
      sessionStorage.clear();
      localStorage.clear();
    });
  } catch (e) {}
  await page.context().clearCookies();
  await page.waitForTimeout(600);
}

(async () => {
  console.log('=== MEMULAI SIMULASI MANDIRI ALUR E-PASAR ===');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true
  });
  const page = await context.newPage();

  const timeStamp = Date.now().toString().slice(-6);
  const nikBase = `731501${Date.now().toString().slice(-10)}`;

  const scenario1 = {
    name: `Haji Baharuddin ${timeStamp}`,
    nik: nikBase,
    unit: `A-${timeStamp.slice(-3)}`,
    skptNumber: `SKPT-SIM-2026-${timeStamp}`,
    regCode: '',
    publicToken: '',
    intakeId: '',
    applicationId: '',
    verificationToken: ''
  };

  const scenario2 = {
    name: `Ibu Fatimah Revisi ${timeStamp}`,
    nik: `731502${Date.now().toString().slice(-10)}`,
    unit: `B-${timeStamp.slice(-3)}`,
    regCode: '',
    publicToken: '',
    intakeId: ''
  };

  const scenario3 = {
    name: `Pemohon Ditolak ${timeStamp}`,
    nik: `731503${Date.now().toString().slice(-10)}`,
    unit: `C-${timeStamp.slice(-3)}`,
    regCode: '',
    publicToken: '',
    intakeId: ''
  };

  const scenario4 = {
    name: `Pedagang Konflik Lapangan ${timeStamp}`,
    nik: `731504${Date.now().toString().slice(-10)}`,
    unit: `D-${timeStamp.slice(-3)}`,
    regCode: '',
    publicToken: '',
    intakeId: ''
  };

  const scenario5 = {
    name: `Pemohon Ditolak Kadis ${timeStamp}`,
    nik: `731505${Date.now().toString().slice(-10)}`,
    unit: `E-${timeStamp.slice(-3)}`,
    regCode: '',
    publicToken: '',
    intakeId: '',
    applicationId: ''
  };

  // ========================================================
  // SKENARIO 1: ALUR UTAMA (HAPPY PATH LENGKAP SAMPAI TERBIT)
  // ========================================================
  console.log('\n--- SKENARIO 1: Alur Utama Pendaftaran s/d Penerbitan SKPT ---');

  // Step 1.1: Pedagang mengisi formulir pendaftaran
  await page.goto(`${BASE}/epasar.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('[name="nik"]').fill(scenario1.nik);
  await page.locator('[name="name"]').fill(scenario1.name);
  await page.locator('[name="birthPlace"]').fill('Pinrang');
  await page.locator('[name="birthDate"]').fill('1982-05-14');
  await page.locator('[name="phone"]').fill('081234567890');
  await page.locator('[name="district"]').selectOption('Watang Sawitto');
  await page.locator('[name="village"]').selectOption('Macorawalie');
  await page.locator('[name="address"]').fill('Jl. Kemakmuran No. 45, Watang Sawitto');
  await shot(page, 1, 'pedagang-identitas');

  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.locator('[data-bind="0|b|||name"]').fill('Toko Sembako Berkah');
  await page.locator('[data-bind="0|b|||type"]').selectOption({ label: 'Toko' });
  await page.locator('[data-bind="0|b|||group"]').selectOption({ label: 'Bahan pangan kering' });
  await page.locator('[data-bind="0|b|||category"]').fill('Bahan Pokok dan Sembako');
  await page.locator('[data-bind="0|b|||monthlyRevenue"]').fill('12000000');
  await page.locator('[data-bind="0|b|||workerCount"]').fill('2');
  await shot(page, 2, 'pedagang-usaha');

  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.locator('[data-bind="0|l|0||type"]').selectOption('MARKET');
  await page.locator('[data-bind="0|l|0||district"]').selectOption('Watang Sawitto');
  await page.locator('[data-bind="0|l|0||village"]').selectOption('Macorawalie');
  await page.locator('[data-bind="0|l|0||address"]').fill('Kawasan Pasar Rakyat Sentral Pinrang');
  await page.getByRole('button', { name: '+ Tambah Tempat di Pasar' }).click();
  await page.locator('[data-bind="0|p|0|0|marketId"]').selectOption('MKT-010');
  await page.locator('[data-bind="0|p|0|0|unitType"]').selectOption('KIOS');
  await page.locator('[data-bind="0|p|0|0|unitNumber"]').fill(scenario1.unit);
  await page.locator('[data-bind="0|p|0|0|block"]').fill('A');
  await page.locator('[data-bind="0|p|0|0|floor"]').fill('1');
  await page.locator('[data-bind="0|p|0|0|areaM2"]').fill('9');
  await page.locator('[data-bind="0|p|0|0|locationHint"]').fill('Dekat pintu barat blok sembako');
  await shot(page, 3, 'pedagang-klaim-pasar');

  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.locator('[data-bind="0|p|0|0|applySkpt"]').check();
  await page.locator('[name="religion"]').selectOption({ label: 'Islam' });
  await page.locator('[name="citizenship"]').fill('Indonesia');
  await page.locator('#profilePhoto').setInputFiles(PHOTO_SAMPLE);
  await page.locator('#identityKtpPhoto').setInputFiles(PHOTO_SAMPLE);
  await page.waitForFunction(() => window.EPASAR_MEDIA_BUFFER?.PROFILE && window.EPASAR_MEDIA_BUFFER?.IDENTITY_KTP, null, { timeout: 45000 });
  await page.locator('[name="truthAck"]').check();
  await page.locator('[name="verificationAck"]').check();
  await page.locator('[name="skptAck"]').check();
  await shot(page, 4, 'pedagang-foto-pernyataan');

  await page.getByRole('button', { name: 'Lanjut' }).click();
  await shot(page, 5, 'pedagang-review');

  await page.locator('#nextButton').click();
  await page.locator('#successPanel').waitFor({ state: 'visible', timeout: 35000 });
  scenario1.regCode = (await page.locator('#registrationCode').innerText()).trim();
  scenario1.publicToken = (await page.locator('#privateToken').innerText()).trim();
  await shot(page, 6, 'pedagang-sukses-pendaftaran');
  console.log(`Pendaftaran Berhasil: Kode = ${scenario1.regCode}, Token = ${scenario1.publicToken}`);

  // Step 1.2: Pedagang mengecek status awal di epasar-status.html
  await page.goto(`${BASE}/epasar-status.html?code=${encodeURIComponent(scenario1.regCode)}&token=${encodeURIComponent(scenario1.publicToken)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#statusResult:not([hidden])', { timeout: 15000 });
  await shot(page, 7, 'pedagang-status-submitted');

  // Step 1.3: Admin Login & Dashboard
  await logoutUser(page);
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
  await shot(page, 8, 'halaman-login-petugas');

  await page.locator('#identifier').fill('superadmin@eskpt.id');
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/admin-epasar/, { timeout: 25000 });
  await page.waitForTimeout(2000);
  await shot(page, 9, 'admin-dashboard-antrean');

  // Step 1.4: Admin Memeriksa Intake
  const intakeRow = page.locator('#intakeRows tr').filter({ hasText: scenario1.regCode });
  await intakeRow.waitFor({ state: 'visible', timeout: 20000 });
  const reviewHref = await intakeRow.getByRole('link', { name: 'Review' }).getAttribute('href');
  scenario1.intakeId = new URL(reviewHref, BASE).searchParams.get('id');
  await page.goto(new URL(reviewHref, BASE).href, { waitUntil: 'domcontentloaded' });
  await page.locator('#reviewForm').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot(page, 10, 'admin-review-intake');

  // Step 1.5: Admin Menerima dan Membentuk Data Pedagang
  await page.locator('#confirmReview').check();
  await page.getByRole('button', { name: 'Bentuk data pedagang' }).click();
  await page.waitForTimeout(600);
  try {
    await page.locator('#reviewMessage').filter({ hasText: /berhasil dibentuk|Membentuk data induk/i }).waitFor({ state: 'visible', timeout: 10000 });
    await shot(page, 11, 'admin-data-terbentuk');
  } catch (e) {
    console.log('Catatan screenshot step 11:', e.message);
  }
  if (!page.url().includes('admin-epasar')) {
    await page.waitForURL(/admin-epasar/, { timeout: 30000 });
  }
  await page.waitForTimeout(2000);

  // Dapatkan applicationId dari Firestore
  const intakeState = await page.evaluate(async id => {
    const doc = await db.collection('trader_intake').doc(id).get();
    return doc.data();
  }, scenario1.intakeId);
  scenario1.applicationId = (intakeState.workflow?.applicationIds && intakeState.workflow.applicationIds[0]) || intakeState.workflow?.applicationId;
  console.log(`Data terbentuk: traderId = ${intakeState.traderId}, applicationId = ${scenario1.applicationId}`);

  // Step 1.6: Pedagang cek status: kini beralih ke MARKET_VERIFICATION
  await page.goto(`${BASE}/epasar-status.html?code=${encodeURIComponent(scenario1.regCode)}&token=${encodeURIComponent(scenario1.publicToken)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#statusResult:not([hidden])', { timeout: 15000 });
  await shot(page, 12, 'pedagang-status-market-verification');

  // Step 1.7: Kepala Pasar login & verifikasi faktual lapangan
  await logoutUser(page);
  await loginUser(page, 'kepala.pasar-sentral-pinrang@eskpt.id', 'market-verification.html');
  await page.waitForTimeout(2000);
  await shot(page, 13, 'kepala-pasar-antrean');

  // Pilih item antrean yang sesuai nama pemohon atau nomor unit
  await page.locator('#pendingSearch').fill(scenario1.name);
  await page.waitForTimeout(600);
  let queueItem = page.locator('#pendingList button').filter({ hasText: scenario1.name });
  if (await queueItem.count() === 0) {
    await page.locator('#pendingSearch').fill(scenario1.unit);
    await page.waitForTimeout(600);
    queueItem = page.locator('#pendingList button').filter({ hasText: scenario1.unit });
  }
  await queueItem.first().waitFor({ state: 'visible', timeout: 25000 });
  await queueItem.first().click();
  await page.waitForTimeout(1000);
  const marketForm = page.locator('form[data-id]');
  await marketForm.waitFor({ state: 'visible', timeout: 25000 });
  await marketForm.locator('[name="actualUser"]').fill(scenario1.name);
  await marketForm.locator('[name="reason"]').fill('Hasil pemeriksaan faktual lapangan: nomor fisik unit, blok, dan pengguna aktual sesuai dengan data pemohon.');
  await shot(page, 14, 'kepala-pasar-verifikasi-faktual');

  await marketForm.getByRole('button', { name: 'Simpan verifikasi' }).click();
  await page.locator('#message').filter({ hasText: 'terverifikasi' }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);
  await shot(page, 15, 'kepala-pasar-verifikasi-berhasil');

  // Step 1.8: Pedagang cek status: kini beralih ke KADIS_REVIEW
  await page.goto(`${BASE}/epasar-status.html?code=${encodeURIComponent(scenario1.regCode)}&token=${encodeURIComponent(scenario1.publicToken)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#statusResult:not([hidden])', { timeout: 15000 });
  await shot(page, 16, 'pedagang-status-kadis-review');

  // Step 1.9: Kepala Dinas (Kadis) login & memberikan keputusan
  await logoutUser(page);
  await loginUser(page, 'kadis@eskpt.id', 'kadis-approval.html');
  await page.waitForTimeout(2500);

  const kadisApprovalForm = page.locator(`form[data-action="approve"][data-id="${scenario1.applicationId}"]`);
  await kadisApprovalForm.waitFor({ state: 'visible', timeout: 25000 });
  await shot(page, 17, 'kadis-review-komparasi');

  await kadisApprovalForm.locator('[name="note"]').fill('Data pemohon dan hasil verifikasi faktual lapangan telah dibandingkan dan memenuhi seluruh ketentuan Perda No. 6 Tahun 2024.');
  await kadisApprovalForm.getByRole('button', { name: 'Setujui Permohonan' }).click();
  // Tangani modal konfirmasi internal
  await page.waitForTimeout(600);
  const confirmBtn = page.locator('button[data-modal="confirm"]');
  if (await confirmBtn.isVisible()) {
    await confirmBtn.click();
  }
  await page.locator('#message').filter({ hasText: 'disetujui' }).waitFor({ timeout: 25000 });
  await page.waitForTimeout(1500);
  await shot(page, 18, 'kadis-persetujuan-tercatat');

  // Step 1.10: Kadis / Admin menerbitkan SKPT
  await page.reload({ waitUntil: 'domcontentloaded' });
  const issueForm = page.locator(`form[data-action="issue"][data-id="${scenario1.applicationId}"]`);
  await issueForm.waitFor({ state: 'visible', timeout: 25000 });
  await issueForm.locator('[name="displayName"]').fill(scenario1.name);
  await issueForm.locator('[name="number"]').fill(scenario1.skptNumber);
  await issueForm.locator('[name="reference"]').fill(`REG-KADIS-${timeStamp}`);
  await shot(page, 19, 'kadis-registrasi-skpt');

  await issueForm.getByRole('button', { name: 'Terbitkan Dokumen Uji Coba' }).click();
  await page.waitForTimeout(600);
  const issueConfirmBtn = page.locator('button[data-modal="confirm"]');
  if (await issueConfirmBtn.isVisible()) {
    await issueConfirmBtn.click();
  }
  if (!page.url().includes('skpt-pdf')) {
    await page.waitForURL(/skpt-pdf.*token=/, { timeout: 35000 }).catch(() => {});
  }
  scenario1.verificationToken = new URL(page.url()).searchParams.get('token');
  console.log(`SKPT Terbit! Nomor = ${scenario1.skptNumber}, Token Verifikasi = ${scenario1.verificationToken}`);
  await page.waitForTimeout(3000);
  await shot(page, 20, 'dokumen-skpt-elektronik');
  await page.pdf({ path: path.join(OUT_DIR, 'SKPT-RESMI-BAHARUDDIN.pdf'), format: 'A4', printBackground: true });

  // Step 1.11: Dokumen Pernyataan, Kartu Pedagang, dan Verifikasi Publik
  await page.goto(`${BASE}/skpt-statement.html?token=${encodeURIComponent(scenario1.publicToken)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot(page, 21, 'surat-pernyataan-pedagang');
  await page.pdf({ path: path.join(OUT_DIR, 'SURAT-PERNYATAAN-PEDAGANG.pdf'), format: 'A4', printBackground: true });

  await page.goto(`${BASE}/trader-card.html?token=${encodeURIComponent(scenario1.publicToken)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot(page, 22, 'kartu-tanda-pedagang');
  await page.pdf({ path: path.join(OUT_DIR, 'KARTU-TANDA-PEDAGANG.pdf'), format: 'A4', printBackground: true });

  await page.goto(`${BASE}/verifikasi-skpt.html?token=${encodeURIComponent(scenario1.verificationToken)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot(page, 23, 'verifikasi-publik-skpt-qr');

  await page.goto(`${BASE}/epasar-status.html?code=${encodeURIComponent(scenario1.regCode)}&token=${encodeURIComponent(scenario1.publicToken)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#statusResult:not([hidden])', { timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, 24, 'pedagang-status-final-issued');

  // Step 1.12: Pengesahan Tahunan
  await page.goto(`${BASE}/annual-validation.html?token=${encodeURIComponent(scenario1.verificationToken)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot(page, 25, 'pengesahan-tahunan-skpt');

  // ========================================================
  // SKENARIO 2: ALUR PERLU PERBAIKAN (CORRECTION FLOW)
  // ========================================================
  console.log('\n--- SKENARIO 2: Alur Perlu Perbaikan (Correction Flow) ---');

  // Step 2.1: Pedagang 2 mendaftar
  await logoutUser(page);
  await page.goto(`${BASE}/epasar.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('[name="nik"]').fill(scenario2.nik);
  await page.locator('[name="name"]').fill(scenario2.name);
  await page.locator('[name="birthPlace"]').fill('Pinrang');
  await page.locator('[name="birthDate"]').fill('1988-11-20');
  await page.locator('[name="phone"]').fill('085211223344');
  await page.locator('[name="district"]').selectOption('Watang Sawitto');
  await page.locator('[name="village"]').selectOption('Macorawalie');
  await page.locator('[name="address"]').fill('Jl. Ahmad Yani No. 12');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[data-bind="0|b|||name"]').fill('Kios Busana Muslim');
  await page.locator('[data-bind="0|b|||type"]').selectOption({ label: 'Toko' });
  await page.locator('[data-bind="0|b|||group"]').selectOption({ label: 'Konveksi dan sandang' });
  await page.locator('[data-bind="0|b|||category"]').fill('Pakaian Jadi');
  await page.locator('[data-bind="0|b|||monthlyRevenue"]').fill('8000000');
  await page.locator('[data-bind="0|b|||workerCount"]').fill('1');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[data-bind="0|l|0||type"]').selectOption('MARKET');
  await page.locator('[data-bind="0|l|0||district"]').selectOption('Watang Sawitto');
  await page.locator('[data-bind="0|l|0||village"]').selectOption('Macorawalie');
  await page.locator('[data-bind="0|l|0||address"]').fill('Pasar Sentral Pinrang');
  await page.getByRole('button', { name: '+ Tambah Tempat di Pasar' }).click();
  await page.locator('[data-bind="0|p|0|0|marketId"]').selectOption('MKT-010');
  await page.locator('[data-bind="0|p|0|0|unitType"]').selectOption('KIOS');
  await page.locator('[data-bind="0|p|0|0|unitNumber"]').fill(scenario2.unit);
  await page.locator('[data-bind="0|p|0|0|block"]').fill('B');
  await page.locator('[data-bind="0|p|0|0|floor"]').fill('1');
  await page.locator('[data-bind="0|p|0|0|areaM2"]').fill('6');
  await page.locator('[data-bind="0|p|0|0|locationHint"]').fill('Lorong pakaian');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[data-bind="0|p|0|0|applySkpt"]').check();
  await page.locator('[name="religion"]').selectOption({ label: 'Islam' });
  await page.locator('[name="citizenship"]').fill('Indonesia');
  await page.locator('#profilePhoto').setInputFiles(PHOTO_SAMPLE);
  await page.locator('#identityKtpPhoto').setInputFiles(PHOTO_SAMPLE);
  await page.waitForFunction(() => window.EPASAR_MEDIA_BUFFER?.PROFILE && window.EPASAR_MEDIA_BUFFER?.IDENTITY_KTP, null, { timeout: 45000 });
  await page.locator('[name="truthAck"]').check();
  await page.locator('[name="verificationAck"]').check();
  await page.locator('[name="skptAck"]').check();
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('#nextButton').click();
  await page.locator('#successPanel').waitFor({ state: 'visible', timeout: 35000 });
  scenario2.regCode = (await page.locator('#registrationCode').innerText()).trim();
  scenario2.publicToken = (await page.locator('#privateToken').innerText()).trim();
  await shot(page, 26, 'pedagang-2-pendaftaran-berhasil');

  // Step 2.2: Admin membuka intake pedagang 2 & meminta perbaikan
  await loginUser(page, 'superadmin@eskpt.id');
  const row2 = page.locator('#intakeRows tr').filter({ hasText: scenario2.regCode });
  await row2.waitFor({ state: 'visible', timeout: 20000 });
  const reviewHref2 = await row2.getByRole('link', { name: 'Review' }).getAttribute('href');
  scenario2.intakeId = new URL(reviewHref2, BASE).searchParams.get('id');
  await page.goto(new URL(reviewHref2, BASE).href, { waitUntil: 'domcontentloaded' });
  await page.locator('#reviewForm').waitFor({ state: 'visible', timeout: 20000 });

  await page.locator('#decisionSections').selectOption(['BUSINESS']);
  await page.locator('#decisionReason').fill('Rincian jenis komoditas pakaian dan omzet bulanan perlu diperjelas sesuai pembukuan.');
  await shot(page, 27, 'admin-keputusan-perlu-perbaikan');

  await page.locator('#returnIntake').click();
  await page.waitForTimeout(600);
  const confirmReturn = page.locator('button[data-modal="confirm"]');
  if (await confirmReturn.isVisible()) {
    await confirmReturn.click();
  }
  try {
    await page.locator('#reviewMessage').filter({ hasText: /dikembalikan/i }).waitFor({ state: 'visible', timeout: 5000 });
  } catch (e) {}
  if (!page.url().includes('admin-epasar')) {
    await page.waitForURL(/admin-epasar/, { timeout: 25000 }).catch(() => {});
  }
  await page.waitForTimeout(1200);

  // Step 2.3: Pedagang 2 cek status, melihat catatan perbaikan, dan mengirimkan revisi
  await page.goto(`${BASE}/epasar-status.html?code=${encodeURIComponent(scenario2.regCode)}&token=${encodeURIComponent(scenario2.publicToken)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#statusResult:not([hidden])', { timeout: 15000 });
  await page.waitForSelector('#correctionPanel:not([hidden])', { timeout: 15000 });

  await page.locator('#correctionSection').selectOption('business');
  await page.locator('#correctionValue').fill('Komoditas: Busana muslim wanita dan perlengkapan ibadah, Omzet aktual: Rp 10.500.000/bln.');
  await page.locator('#correctionReason').fill('Sudah disesuaikan dengan rincian pembukuan dan catatan stok toko.');
  await shot(page, 28, 'pedagang-2-kirim-perbaikan');

  await page.locator('#correctionForm button[type="submit"]').click();
  await page.locator('#correctionMessage').filter({ hasText: /berhasil dikirim/i }).waitFor({ timeout: 25000 });
  await page.waitForTimeout(1000);
  await shot(page, 29, 'pedagang-2-perbaikan-terkirim');

  // Step 2.4: Admin membuka kembali intake pedagang 2 & melihat jawaban koreksi
  await page.goto(new URL(reviewHref2, BASE).href, { waitUntil: 'domcontentloaded' });
  await page.locator('#correctionHistory').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1000);
  await shot(page, 30, 'admin-tinjau-jawaban-perbaikan');

  // ========================================================
  // SKENARIO 3: ALUR PENOLAKAN ADMIN (REJECTION FLOW)
  // ========================================================
  console.log('\n--- SKENARIO 3: Alur Penolakan Admin (Rejection Flow) ---');

  // Step 3.1: Pedagang 3 mendaftar
  await logoutUser(page);
  await page.goto(`${BASE}/epasar.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('[name="nik"]').fill(scenario3.nik);
  await page.locator('[name="name"]').fill(scenario3.name);
  await page.locator('[name="birthPlace"]').fill('Luar Daerah');
  await page.locator('[name="birthDate"]').fill('1995-03-10');
  await page.locator('[name="phone"]').fill('081399887766');
  await page.locator('[name="district"]').selectOption('Watang Sawitto');
  await page.locator('[name="village"]').selectOption('Macorawalie');
  await page.locator('[name="address"]').fill('Alamat Sementara Tidak Lengkap');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[data-bind="0|b|||name"]').fill('Usaha Belum Terdaftar');
  await page.locator('[data-bind="0|b|||type"]').selectOption({ label: 'Lainnya' });
  await page.locator('[data-bind="0|b|||group"]').selectOption({ label: 'Lainnya' });
  await page.locator('[data-bind="0|b|||category"]').fill('Barang Campuran');
  await page.locator('[data-bind="0|b|||monthlyRevenue"]').fill('1000000');
  await page.locator('[data-bind="0|b|||workerCount"]').fill('0');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[data-bind="0|l|0||type"]').selectOption('MARKET');
  await page.locator('[data-bind="0|l|0||district"]').selectOption('Watang Sawitto');
  await page.locator('[data-bind="0|l|0||village"]').selectOption('Macorawalie');
  await page.locator('[data-bind="0|l|0||address"]').fill('Pasar Sentral');
  await page.getByRole('button', { name: '+ Tambah Tempat di Pasar' }).click();
  await page.locator('[data-bind="0|p|0|0|marketId"]').selectOption('MKT-010');
  await page.locator('[data-bind="0|p|0|0|unitType"]').selectOption('LAPAK');
  await page.locator('[data-bind="0|p|0|0|unitNumber"]').fill(scenario3.unit);
  await page.locator('[data-bind="0|p|0|0|block"]').fill('C');
  await page.locator('[data-bind="0|p|0|0|floor"]').fill('1');
  await page.locator('[data-bind="0|p|0|0|areaM2"]').fill('4');
  await page.locator('[data-bind="0|p|0|0|locationHint"]').fill('Pelataran umum');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[data-bind="0|p|0|0|applySkpt"]').check();
  await page.locator('[name="religion"]').selectOption({ label: 'Islam' });
  await page.locator('[name="citizenship"]').fill('Indonesia');
  await page.locator('#profilePhoto').setInputFiles(PHOTO_SAMPLE);
  await page.locator('#identityKtpPhoto').setInputFiles(PHOTO_SAMPLE);
  await page.waitForFunction(() => window.EPASAR_MEDIA_BUFFER?.PROFILE && window.EPASAR_MEDIA_BUFFER?.IDENTITY_KTP, null, { timeout: 45000 });
  await page.locator('[name="truthAck"]').check();
  await page.locator('[name="verificationAck"]').check();
  await page.locator('[name="skptAck"]').check();
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('#nextButton').click();
  await page.locator('#successPanel').waitFor({ state: 'visible', timeout: 35000 });
  scenario3.regCode = (await page.locator('#registrationCode').innerText()).trim();
  scenario3.publicToken = (await page.locator('#privateToken').innerText()).trim();

  // Step 3.2: Admin menolak pendaftaran
  await loginUser(page, 'superadmin@eskpt.id');
  const row3 = page.locator('#intakeRows tr').filter({ hasText: scenario3.regCode });
  await row3.waitFor({ state: 'visible', timeout: 20000 });
  const reviewHref3 = await row3.getByRole('link', { name: 'Review' }).getAttribute('href');
  scenario3.intakeId = new URL(reviewHref3, BASE).searchParams.get('id');
  await page.goto(new URL(reviewHref3, BASE).href, { waitUntil: 'domcontentloaded' });
  await page.locator('#reviewForm').waitFor({ state: 'visible', timeout: 20000 });

  await page.locator('#decisionSections').selectOption(['DOCUMENT', 'IDENTITY']);
  await page.locator('#decisionReason').fill('Dokumen identitas tidak valid dan pemohon tidak memenuhi persyaratan pedagang pasar rakyat.');
  await shot(page, 31, 'admin-keputusan-penolakan');

  await page.locator('#rejectIntake').click();
  await page.waitForTimeout(600);
  const confirmReject = page.locator('button[data-modal="confirm"]');
  if (await confirmReject.isVisible()) {
    await confirmReject.click();
  }
  try {
    await page.locator('#reviewMessage').filter({ hasText: /ditolak/i }).waitFor({ state: 'visible', timeout: 5000 });
  } catch (e) {}
  if (!page.url().includes('admin-epasar')) {
    await page.waitForURL(/admin-epasar/, { timeout: 25000 }).catch(() => {});
  }
  await page.waitForTimeout(1000);

  // Step 3.3: Pedagang 3 cek status ditolak
  await page.goto(`${BASE}/epasar-status.html?code=${encodeURIComponent(scenario3.regCode)}&token=${encodeURIComponent(scenario3.publicToken)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#statusResult:not([hidden])', { timeout: 15000 });
  await shot(page, 32, 'pedagang-3-status-ditolak');

  // ========================================================
  // SKENARIO 4: ALUR KONFLIK / KOREKSI KEPALA PASAR
  // ========================================================
  console.log('\n--- SKENARIO 4: Alur Konflik / Koreksi Faktual Kepala Pasar ---');

  // Step 4.1: Pedagang 4 mendaftar
  await logoutUser(page);
  await page.goto(`${BASE}/epasar.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('[name="nik"]').fill(scenario4.nik);
  await page.locator('[name="name"]').fill(scenario4.name);
  await page.locator('[name="birthPlace"]').fill('Pinrang');
  await page.locator('[name="birthDate"]').fill('1991-07-07');
  await page.locator('[name="phone"]').fill('082155667788');
  await page.locator('[name="district"]').selectOption('Watang Sawitto');
  await page.locator('[name="village"]').selectOption('Macorawalie');
  await page.locator('[name="address"]').fill('Jl. Sukawati No. 8');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[data-bind="0|b|||name"]').fill('Kios Elektronik Sentral');
  await page.locator('[data-bind="0|b|||type"]').selectOption({ label: 'Toko' });
  await page.locator('[data-bind="0|b|||group"]').selectOption({ label: 'Perlengkapan rumah tangga' });
  await page.locator('[data-bind="0|b|||category"]').fill('Alat Listrik');
  await page.locator('[data-bind="0|b|||monthlyRevenue"]').fill('15000000');
  await page.locator('[data-bind="0|b|||workerCount"]').fill('1');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[data-bind="0|l|0||type"]').selectOption('MARKET');
  await page.locator('[data-bind="0|l|0||district"]').selectOption('Watang Sawitto');
  await page.locator('[data-bind="0|l|0||village"]').selectOption('Macorawalie');
  await page.locator('[data-bind="0|l|0||address"]').fill('Pasar Sentral');
  await page.getByRole('button', { name: '+ Tambah Tempat di Pasar' }).click();
  await page.locator('[data-bind="0|p|0|0|marketId"]').selectOption('MKT-010');
  await page.locator('[data-bind="0|p|0|0|unitType"]').selectOption('KIOS');
  await page.locator('[data-bind="0|p|0|0|unitNumber"]').fill(scenario4.unit);
  await page.locator('[data-bind="0|p|0|0|block"]').fill('D');
  await page.locator('[data-bind="0|p|0|0|floor"]').fill('1');
  await page.locator('[data-bind="0|p|0|0|areaM2"]').fill('8');
  await page.locator('[data-bind="0|p|0|0|locationHint"]').fill('Samping pos jaga');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[data-bind="0|p|0|0|applySkpt"]').check();
  await page.locator('[name="religion"]').selectOption({ label: 'Islam' });
  await page.locator('[name="citizenship"]').fill('Indonesia');
  await page.locator('#profilePhoto').setInputFiles(PHOTO_SAMPLE);
  await page.locator('#identityKtpPhoto').setInputFiles(PHOTO_SAMPLE);
  await page.waitForFunction(() => window.EPASAR_MEDIA_BUFFER?.PROFILE && window.EPASAR_MEDIA_BUFFER?.IDENTITY_KTP, null, { timeout: 45000 });
  await page.locator('[name="truthAck"]').check();
  await page.locator('[name="verificationAck"]').check();
  await page.locator('[name="skptAck"]').check();
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.waitForTimeout(1200);

  await page.locator('#nextButton').click();
  await page.locator('#successPanel').waitFor({ state: 'visible', timeout: 35000 });
  scenario4.regCode = (await page.locator('#registrationCode').innerText()).trim();

  // Admin membentuk data pedagang 4
  await loginUser(page, 'superadmin@eskpt.id');
  const row4 = page.locator('#intakeRows tr').filter({ hasText: scenario4.regCode });
  await row4.waitFor({ state: 'visible', timeout: 20000 });
  const reviewHref4 = await row4.getByRole('link', { name: 'Review' }).getAttribute('href');
  await page.goto(new URL(reviewHref4, BASE).href, { waitUntil: 'domcontentloaded' });
  await page.locator('#reviewForm').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.locator('#confirmReview').check();
  await page.getByRole('button', { name: 'Bentuk data pedagang' }).click();
  await page.waitForTimeout(1000);
  if (!page.url().includes('admin-epasar')) {
    await page.waitForURL(/admin-epasar/, { timeout: 30000 });
  }
  await page.waitForTimeout(2000);

  // Kepala Pasar mencatat konflik lapangan
  await logoutUser(page);
  await loginUser(page, 'kepala.pasar-sentral-pinrang@eskpt.id', 'market-verification.html');
  await page.waitForTimeout(2500);

  await page.locator('#pendingSearch').fill(scenario4.name);
  await page.waitForTimeout(600);
  let queueItem4 = page.locator('#pendingList button').filter({ hasText: scenario4.name });
  if (await queueItem4.count() === 0) {
    await page.locator('#pendingSearch').fill(scenario4.unit);
    await page.waitForTimeout(600);
    queueItem4 = page.locator('#pendingList button').filter({ hasText: scenario4.unit });
  }
  await queueItem4.first().waitFor({ state: 'visible', timeout: 25000 });
  await queueItem4.first().click();
  await page.waitForTimeout(1000);

  const marketForm4 = page.locator('form[data-id]');
  await marketForm4.waitFor({ state: 'visible', timeout: 25000 });
  await marketForm4.locator('[name="actualUser"]').fill('Pihak Lain Yang Menempati');
  await marketForm4.locator('[name="conflict"]').check();
  await marketForm4.locator('[name="reason"]').fill('Terdapat ketidaksesuaian fisik dan sengketa penguasaan unit di lapangan dengan pedagang lain.');
  await shot(page, 33, 'kepala-pasar-formulir-konflik');

  await marketForm4.getByRole('button', { name: 'Simpan verifikasi' }).click();
  await page.locator('#message').filter({ hasText: /konflik unit tercatat/i }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);
  await shot(page, 34, 'kepala-pasar-konflik-tercatat');

  // ========================================================
  // SKENARIO 5: ALUR PENOLAKAN KEPALA DINAS (KADIS REJECTION FLOW)
  // ========================================================
  console.log('\n--- SKENARIO 5: Alur Penolakan Keputusan Kepala Dinas (Kadis Rejection Flow) ---');

  // Step 5.1: Pedagang 5 mendaftar
  await logoutUser(page);
  await page.goto(`${BASE}/epasar.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('[name="nik"]').fill(scenario5.nik);
  await page.locator('[name="name"]').fill(scenario5.name);
  await page.locator('[name="birthPlace"]').fill('Pinrang');
  await page.locator('[name="birthDate"]').fill('1987-04-12');
  await page.locator('[name="phone"]').fill('081298765432');
  await page.locator('[name="district"]').selectOption('Watang Sawitto');
  await page.locator('[name="village"]').selectOption('Macorawalie');
  await page.locator('[name="address"]').fill('Jl. Tirto Utomo No. 19');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[data-bind="0|b|||name"]').fill('Kios Kelontong Sentral');
  await page.locator('[data-bind="0|b|||type"]').selectOption({ label: 'Toko' });
  await page.locator('[data-bind="0|b|||group"]').selectOption({ label: 'Lainnya' });
  await page.locator('[data-bind="0|b|||category"]').fill('Barang Campuran');
  await page.locator('[data-bind="0|b|||monthlyRevenue"]').fill('9000000');
  await page.locator('[data-bind="0|b|||workerCount"]').fill('1');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[data-bind="0|l|0||type"]').selectOption('MARKET');
  await page.locator('[data-bind="0|l|0||district"]').selectOption('Watang Sawitto');
  await page.locator('[data-bind="0|l|0||village"]').selectOption('Macorawalie');
  await page.locator('[data-bind="0|l|0||address"]').fill('Pasar Sentral');
  await page.getByRole('button', { name: '+ Tambah Tempat di Pasar' }).click();
  await page.locator('[data-bind="0|p|0|0|marketId"]').selectOption('MKT-010');
  await page.locator('[data-bind="0|p|0|0|unitType"]').selectOption('KIOS');
  await page.locator('[data-bind="0|p|0|0|unitNumber"]').fill(scenario5.unit);
  await page.locator('[data-bind="0|p|0|0|block"]').fill('E');
  await page.locator('[data-bind="0|p|0|0|floor"]').fill('1');
  await page.locator('[data-bind="0|p|0|0|areaM2"]').fill('7');
  await page.locator('[data-bind="0|p|0|0|locationHint"]').fill('Dekat gerbang timur');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.locator('[data-bind="0|p|0|0|applySkpt"]').check();
  await page.locator('[name="religion"]').selectOption({ label: 'Islam' });
  await page.locator('[name="citizenship"]').fill('Indonesia');
  await page.locator('#profilePhoto').setInputFiles(PHOTO_SAMPLE);
  await page.locator('#identityKtpPhoto').setInputFiles(PHOTO_SAMPLE);
  await page.waitForFunction(() => window.EPASAR_MEDIA_BUFFER?.PROFILE && window.EPASAR_MEDIA_BUFFER?.IDENTITY_KTP, null, { timeout: 45000 });
  await page.locator('[name="truthAck"]').check();
  await page.locator('[name="verificationAck"]').check();
  await page.locator('[name="skptAck"]').check();
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.waitForTimeout(1200);

  await page.locator('#nextButton').click();
  await page.locator('#successPanel').waitFor({ state: 'visible', timeout: 35000 });
  scenario5.regCode = (await page.locator('#registrationCode').innerText()).trim();
  scenario5.publicToken = (await page.locator('#privateToken').innerText()).trim();

  // Admin membentuk data pedagang 5
  await loginUser(page, 'superadmin@eskpt.id');
  const row5 = page.locator('#intakeRows tr').filter({ hasText: scenario5.regCode });
  await row5.waitFor({ state: 'visible', timeout: 20000 });
  const reviewHref5 = await row5.getByRole('link', { name: 'Review' }).getAttribute('href');
  scenario5.intakeId = new URL(reviewHref5, BASE).searchParams.get('id');
  await page.goto(new URL(reviewHref5, BASE).href, { waitUntil: 'domcontentloaded' });
  await page.locator('#reviewForm').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.locator('#confirmReview').check();
  await page.getByRole('button', { name: 'Bentuk data pedagang' }).click();
  await page.waitForTimeout(1000);
  if (!page.url().includes('admin-epasar')) {
    await page.waitForURL(/admin-epasar/, { timeout: 30000 });
  }
  await page.waitForTimeout(2000);

  // Ambil applicationId dari Firestore
  const intakeState5 = await page.evaluate(async id => {
    const doc = await db.collection('trader_intake').doc(id).get();
    return doc.data();
  }, scenario5.intakeId);
  scenario5.applicationId = (intakeState5.workflow?.applicationIds && intakeState5.workflow.applicationIds[0]) || intakeState5.workflow?.applicationId;

  // Kepala Pasar melakukan verifikasi faktual lapangan
  await logoutUser(page);
  await loginUser(page, 'kepala.pasar-sentral-pinrang@eskpt.id', 'market-verification.html');
  await page.waitForTimeout(2500);

  await page.locator('#pendingSearch').fill(scenario5.name);
  await page.waitForTimeout(600);
  let queueItem5 = page.locator('#pendingList button').filter({ hasText: scenario5.name });
  if (await queueItem5.count() === 0) {
    await page.locator('#pendingSearch').fill(scenario5.unit);
    await page.waitForTimeout(600);
    queueItem5 = page.locator('#pendingList button').filter({ hasText: scenario5.unit });
  }
  await queueItem5.first().waitFor({ state: 'visible', timeout: 25000 });
  await queueItem5.first().click();
  await page.waitForTimeout(1000);

  const marketForm5 = page.locator('form[data-id]');
  await marketForm5.waitFor({ state: 'visible', timeout: 25000 });
  await marketForm5.locator('[name="actualUser"]').fill(scenario5.name);
  await marketForm5.locator('[name="reason"]').fill('Pemeriksaan fisik sesuai tetapi zonasi blok masuk dalam rencana penataan ulang dinas.');
  await marketForm5.getByRole('button', { name: 'Simpan verifikasi' }).click();
  await page.locator('#message').filter({ hasText: 'terverifikasi' }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);

  // Kepala Dinas memeriksa dan mengambil keputusan PENOLAKAN
  await logoutUser(page);
  await loginUser(page, 'kadis@eskpt.id', 'kadis-approval.html');
  await page.waitForTimeout(3000);

  let kadisApprovalForm5 = page.locator(`form[data-action="approve"][data-id="${scenario5.applicationId}"]`);
  if (await kadisApprovalForm5.count() === 0) {
    const kadisItem5 = page.locator('article.workflow-item').filter({ hasText: scenario5.name });
    await kadisItem5.waitFor({ state: 'visible', timeout: 30000 });
    kadisApprovalForm5 = kadisItem5.locator('form[data-action="approve"]');
  }
  await kadisApprovalForm5.waitFor({ state: 'visible', timeout: 25000 });
  await kadisApprovalForm5.locator('[name="note"]').fill('Berdasarkan evaluasi tata ruang dan rencana relokasi zonasi pasar, permohonan SKPT pada blok ini tidak dapat disetujui. Berkas resmi ditolak dan tidak diterbitkan.');
  await shot(page, 35, 'kadis-keputusan-penolakan');

  // Klik tombol Tolak Permohonan
  await kadisApprovalForm5.locator('button[data-action="reject"]').click();
  await page.waitForTimeout(800);
  const rejectConfirmBtn = page.locator('button[data-modal="confirm"]');
  await rejectConfirmBtn.waitFor({ state: 'visible', timeout: 10000 });
  await rejectConfirmBtn.click();
  await page.locator('#message').filter({ hasText: /resmi ditolak/i }).waitFor({ timeout: 25000 });
  await page.waitForTimeout(2000);
  await shot(page, 36, 'kadis-penolakan-tercatat');

  // Pedagang 5 mengecek status di portal publik: berstatus DITOLAK dengan catatan dari Kadis
  await page.goto(`${BASE}/epasar-status.html?code=${encodeURIComponent(scenario5.regCode)}&token=${encodeURIComponent(scenario5.publicToken)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#statusResult:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await shot(page, 37, 'pedagang-5-status-ditolak-kadis');

  console.log('\n=== SELURUH SKENARIO SIMULASI SELESAI DENGAN SUKSES! ===');
  const reportSummary = {
    waktuSimulasi: new Date().toISOString(),
    skenario1_AlurUtama: scenario1,
    skenario2_PerluPerbaikan: scenario2,
    skenario3_PenolakanAdmin: scenario3,
    skenario4_KonflikLapanganKepalaPasar: scenario4,
    skenario5_PenolakanKepalaDinas: scenario5,
    totalTangkapanLayar: 37 * 2
  };
  fs.writeFileSync(path.join(OUT_DIR, 'simulasi_report.json'), JSON.stringify(reportSummary, null, 2));
  console.log(JSON.stringify(reportSummary, null, 2));

  await browser.close();
})().catch(err => {
  console.error('ERROR SIMULASI:', err);
  process.exit(1);
});
