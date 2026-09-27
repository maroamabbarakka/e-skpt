'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8090';
const OUT_DIR = path.join(process.cwd(), 'artifacts', 'database-pedagang');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function loginUser(page, email, target = 'database-pedagang.html') {
  await page.goto(`${BASE}/login.html?t=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#identifier').fill(email);
  await page.locator('#password').fill('Pasar202#');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/admin-epasar/, { timeout: 25000 });
  if (target) {
    await page.goto(`${BASE}/${target}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }
}

async function logoutUser(page) {
  try {
    await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      if (window.EPASAR_AUTH && window.EPASAR_AUTH.signOut) {
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
  console.log('=== MEMULAI PENGUJIAN MODUL DATABASE MASTER PEDAGANG ===');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true
  });
  const page = await context.newPage();

  // 1. Pengujian Role: SUPER ADMIN / ADMIN DISPERINDAG
  console.log('\n--- 1. Uji Coba Role Admin Disperindag ---');
  await loginUser(page, 'superadmin@eskpt.id');
  await page.waitForSelector('#dbRows tr', { timeout: 25000 });
  await page.waitForTimeout(2000);

  // Screenshot Desktop Admin
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(OUT_DIR, '01-admin-database-desktop.png'), fullPage: true });

  // Screenshot Mobile Admin
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(OUT_DIR, '01-admin-database-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Uji Unduh CSV
  const [downloadCsv] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#btnExportCsv').click()
  ]);
  const csvPath = path.join(OUT_DIR, 'DATABASE_PEDAGANG_PINRANG_EXPORT.csv');
  await downloadCsv.saveAs(csvPath);
  console.log('✓ Ekspor CSV Excel berhasil disimpan di:', csvPath);

  // Uji Unduh JSON
  const [downloadJson] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#btnExportJson').click()
  ]);
  const jsonPath = path.join(OUT_DIR, 'SPASIAL_RETRIBUSI_PEDAGANG_EXPORT.json');
  await downloadJson.saveAs(jsonPath);
  console.log('✓ Ekspor JSON Spasial & Retribusi berhasil disimpan di:', jsonPath);

  // 2. Pengujian Modal Detail
  const detailButtons = page.locator('button:has-text("Rincian")');
  if (await detailButtons.count() > 0) {
    await detailButtons.first().click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, '02-modal-rincian-pedagang.png') });
    await page.locator('#closeModalBtn').click();
    await page.waitForTimeout(500);
  }

  // 3. Pengujian Role: KEPALA PASAR (Pasar Sentral Pinrang)
  console.log('\n--- 2. Uji Coba Role Kepala Pasar Sentral ---');
  await logoutUser(page);
  await loginUser(page, 'kepala.pasar-sentral-pinrang@eskpt.id');
  await page.waitForSelector('#dbRows tr', { timeout: 25000 });
  await page.waitForTimeout(2000);

  // Verifikasi filter pasar terkunci (disabled)
  const isMarketDisabled = await page.locator('#filterMarket').isDisabled();
  const selectedMarketText = await page.locator('#filterMarket option:checked').innerText();
  console.log(`✓ Verifikasi Scoped Market Kepala Pasar: Terkunci = ${isMarketDisabled}, Pilihan = "${selectedMarketText}"`);

  // Screenshot Desktop Kepala Pasar
  await page.screenshot({ path: path.join(OUT_DIR, '03-kepala-pasar-database-desktop.png'), fullPage: true });
  // Screenshot Mobile Kepala Pasar
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(OUT_DIR, '03-kepala-pasar-database-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });

  // 4. Pengujian Role: KEPALA DINAS (KADIS)
  console.log('\n--- 3. Uji Coba Role Kepala Dinas (Kadis) ---');
  await logoutUser(page);
  await loginUser(page, 'kadis@eskpt.id');
  await page.waitForSelector('#dbRows tr', { timeout: 25000 });
  await page.waitForTimeout(2000);

  // Screenshot Desktop Kadis
  await page.screenshot({ path: path.join(OUT_DIR, '04-kadis-database-desktop.png'), fullPage: true });
  // Screenshot Mobile Kadis
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(OUT_DIR, '04-kadis-database-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Uji Mode Cetak Siap Pakai (Print Simulation via emulate media print)
  console.log('\n--- 4. Pengujian Format Cetak Resmi (Print-Ready Layout) ---');
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(1000);
  const pdfPrintPath = path.join(OUT_DIR, 'BUKU_INDUK_PEDAGANG_PINRANG_PRINT_READY.pdf');
  await page.pdf({
    path: pdfPrintPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: '10mm', bottom: '12mm', left: '12mm', right: '12mm' }
  });
  console.log('✓ Dokumen Cetak Resmi (A4 Landscape) berhasil dibuat di:', pdfPrintPath);
  await page.screenshot({ path: path.join(OUT_DIR, '05-layout-cetak-resmi-preview.png'), fullPage: true });

  console.log('\n=== PENGUJIAN MODUL DATABASE SELESAI DENGAN SUKSES! ===');
  await browser.close();
})().catch(err => {
  console.error('ERROR PENGUJIAN:', err);
  process.exit(1);
});
