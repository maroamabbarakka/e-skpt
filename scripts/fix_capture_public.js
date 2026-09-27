'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8090';
const BASE_OUT = path.join(process.cwd(), 'artifacts', 'role-screenshots', '01-publik-pedagang');

async function capture(page, fileName) {
  // Desktop 1440x950
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.waitForTimeout(700);
  const deskPath = path.join(BASE_OUT, 'desktop', `${fileName}.png`);
  await page.screenshot({ path: deskPath, fullPage: true });

  // Mobile 390x844
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  const mobPath = path.join(BASE_OUT, 'mobile', `${fileName}.png`);
  await page.screenshot({ path: mobPath, fullPage: true });

  // Reset back to desktop
  await page.setViewportSize({ width: 1440, height: 950 });
  console.log(`  ✓ Tersimpan Publik: ${fileName}`);
}

(async () => {
  console.log('=== MEMPERBAIKI TANGKAPAN LAYAR PUBLIK / PEDAGANG ===');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const page = await browser.newPage();

  // 1. Beranda Portal
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await capture(page, '01-beranda-portal-publik');

  // 2. Layanan & Regulasi
  await page.goto(`${BASE}/layanan.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await capture(page, '02-informasi-layanan-regulasi');

  // 3. Pendaftaran Pedagang Terpadu (e-PASAR)
  await page.goto(`${BASE}/epasar.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await capture(page, '03-formulir-pendaftaran-terpadu');

  // 4. Cek Status Pendaftaran & Perbaikan Berkas
  await page.goto(`${BASE}/epasar-status.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await capture(page, '04-cek-status-pendaftaran-publik');

  // 5. Verifikasi Keabsahan QR SKPT
  await page.goto(`${BASE}/verifikasi-skpt.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await capture(page, '05-verifikasi-keabsahan-skpt');

  // 6. Panduan Pelayanan & Persyaratan
  await page.goto(`${BASE}/panduan.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await capture(page, '06-panduan-pelayanan-pedagang');

  // 7. Berita & Informasi Pasar
  await page.goto(`${BASE}/informasi.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await capture(page, '07-informasi-dan-pengumuman');

  // 8. Portal Login Petugas
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await capture(page, '08-portal-login-petugas');

  await browser.close();
  console.log('=== SEMUA HALAMAN PUBLIK BERHASIL DISIMPAN 100%! ===');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
