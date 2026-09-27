'use strict';
const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://127.0.0.1:8090';
const BASE_OUT = path.join(process.cwd(), 'artifacts', 'role-screenshots');

async function capture(page, subDir, fileName) {
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.waitForTimeout(1000);
  const deskPath = path.join(BASE_OUT, subDir, 'desktop', `${fileName}.png`);
  await page.screenshot({ path: deskPath, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  const mobPath = path.join(BASE_OUT, subDir, 'mobile', `${fileName}.png`);
  await page.screenshot({ path: mobPath, fullPage: true });

  await page.setViewportSize({ width: 1440, height: 950 });
  console.log(`✓ Tersimpan diperbarui: [${subDir}] ${fileName}`);
}

async function login(page, email) {
  await page.goto(`${BASE}/login.html?t=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#identifier').fill(email);
  await page.locator('#password').fill('Pasar202#');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/admin-epasar/, { timeout: 25000 });
  await page.waitForTimeout(2500);
}

async function logout(page) {
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
  console.log('=== MEMPERBARUI TANGKAPAN LAYAR HASIL REFINEMENT ===');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const page = await browser.newPage();

  // 1. Publik: Cek Status
  await page.goto(`${BASE}/epasar-status.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await capture(page, '01-publik-pedagang', '04-cek-status-pendaftaran-publik');

  // 2. Publik: Verifikasi SKPT
  await page.goto(`${BASE}/verifikasi-skpt.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await capture(page, '01-publik-pedagang', '05-verifikasi-keabsahan-skpt');

  // 3. Kepala Pasar: Dashboard Baru
  await login(page, 'kepala.pasar-sentral-pinrang@eskpt.id');
  await page.goto(`${BASE}/admin-epasar.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await capture(page, '03-kepala-pasar', '01-dashboard-kepala-pasar');

  // 4. Kadis: Dashboard Eksekutif Baru
  await logout(page);
  await login(page, 'kadis@eskpt.id');
  await page.goto(`${BASE}/admin-epasar.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await capture(page, '04-kepala-dinas', '01-dashboard-eksekutif-kadis');

  await browser.close();
  console.log('=== PEMBARUAN TANGKAPAN LAYAR SELESAI 100%! ===');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
