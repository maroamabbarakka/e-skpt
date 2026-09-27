'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8090';
const BASE_OUT = path.join(process.cwd(), 'artifacts', 'role-screenshots');

const SUBDIRS = [
  '01-publik-pedagang/desktop',
  '01-publik-pedagang/mobile',
  '02-super-admin/desktop',
  '02-super-admin/mobile',
  '03-kepala-pasar/desktop',
  '03-kepala-pasar/mobile',
  '04-kepala-dinas/desktop',
  '04-kepala-dinas/mobile'
];

SUBDIRS.forEach(d => {
  const p = path.join(BASE_OUT, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

async function capture(page, subDir, fileName) {
  // Desktop 1440x950
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.waitForTimeout(600);
  const deskPath = path.join(BASE_OUT, subDir, 'desktop', `${fileName}.png`);
  await page.screenshot({ path: deskPath, fullPage: true });

  // Mobile 390x844
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const mobPath = path.join(BASE_OUT, subDir, 'mobile', `${fileName}.png`);
  await page.screenshot({ path: mobPath, fullPage: true });

  // Reset back to desktop
  await page.setViewportSize({ width: 1440, height: 950 });
  console.log(`  ✓ Tersimpan: [${subDir}] ${fileName}`);
}

async function login(page, email) {
  await page.goto(`${BASE}/login.html?t=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#identifier').fill(email);
  await page.locator('#password').fill('Pasar202#');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/admin-epasar/, { timeout: 25000 });
  await page.waitForTimeout(2000);
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
  console.log('=== MEMULAI PENGAMBILAN TANGKAPAN LAYAR LENGKAP SEMUA ROLE (DESKTOP & MOBILE) ===');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 }
  });
  const page = await context.newPage();

  // ==========================================
  // BAGIAN 1: PUBLIK / PEDAGANG (GUEST)
  // ==========================================
  console.log('\n--- 1. MENANGKAP HALAMAN PUBLIK / PEDAGANG ---');
  
  // 1.1 Beranda Publik
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await capture(page, '01-publik-pedagang', '01-beranda-publik');

  // 1.2 Informasi Layanan
  await page.goto(`${BASE}/layanan.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await capture(page, '01-publik-pedagang', '02-informasi-layanan');

  // 1.3 Cek Status Pendaftaran
  await page.goto(`${BASE}/cek-status.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await capture(page, '01-publik-pedagang', '03-cek-status-pendaftaran');

  // 1.4 Verifikasi QR SKPT
  await page.goto(`${BASE}/verifikasi.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await capture(page, '01-publik-pedagang', '04-verifikasi-keabsahan-skpt');

  // 1.5 Formulir Pendaftaran Pedagang
  await page.goto(`${BASE}/pendaftaran-pedagang.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await capture(page, '01-publik-pedagang', '05-formulir-pendaftaran-langkah1');

  // 1.6 Halaman Login Petugas
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await capture(page, '01-publik-pedagang', '06-portal-login-petugas');

  // ==========================================
  // BAGIAN 2: ROLE SUPER ADMIN / DISPERINDAG
  // ==========================================
  console.log('\n--- 2. MENANGKAP FITUR ROLE SUPER ADMIN / ADMIN DISPERINDAG ---');
  await login(page, 'superadmin@eskpt.id');

  // 2.1 Dashboard Utama Super Admin
  await page.goto(`${BASE}/admin-epasar.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await capture(page, '02-super-admin', '01-dashboard-utama-admin');

  // 2.2 Tab Pendaftaran Masuk di Dashboard
  try {
    const tabIntake = page.locator('#tabIntake, a[href="#pendaftaran"], button:has-text("Pendaftaran Masuk")');
    if (await tabIntake.count() > 0) {
      await tabIntake.first().click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {}
  await capture(page, '02-super-admin', '02-tab-pendaftaran-masuk');

  // 2.3 Modul Database Master Pedagang
  await page.goto(`${BASE}/database-pedagang.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#dbRows tr', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await capture(page, '02-super-admin', '03-database-master-pedagang');

  // Modal Rincian Pedagang di Database
  const detailBtns = page.locator('button:has-text("Rincian")');
  if (await detailBtns.count() > 0) {
    await detailBtns.first().click();
    await page.waitForTimeout(700);
    await capture(page, '02-super-admin', '04-modal-detail-pedagang');
    await page.locator('#closeModalBtn').click();
    await page.waitForTimeout(400);
  }

  // 2.4 Review Pendaftaran (Admin Intake Review)
  await page.goto(`${BASE}/admin-intake-review.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await capture(page, '02-super-admin', '05-review-pendaftaran-intake');

  // 2.5 Pengolah Foto & Dokumen Pendataan
  await page.goto(`${BASE}/photo-editor.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await capture(page, '02-super-admin', '06-pengolah-foto-dokumen');

  // 2.6 Verifikasi Unit Pasar
  await page.goto(`${BASE}/market-verification.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await capture(page, '02-super-admin', '07-verifikasi-unit-pasar');

  // 2.7 Perubahan Pemegang Hak
  await page.goto(`${BASE}/occupancy-change.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await capture(page, '02-super-admin', '08-perubahan-pemegang-hak');

  // 2.8 Persetujuan SKPT
  await page.goto(`${BASE}/kadis-approval.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await capture(page, '02-super-admin', '09-persetujuan-skpt');

  // 2.9 Pengesahan Tahunan SKPT
  await page.goto(`${BASE}/annual-validation.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await capture(page, '02-super-admin', '10-pengesahan-tahunan-skpt');

  // 2.10 Manajemen Akun & Pengguna
  await page.goto(`${BASE}/admin-akun.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await capture(page, '02-super-admin', '11-manajemen-akun-pengguna');

  // 2.11 Profil & Keamanan
  await page.goto(`${BASE}/profil.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await capture(page, '02-super-admin', '12-profil-dan-keamanan');

  // ==========================================
  // BAGIAN 3: ROLE KEPALA PASAR
  // ==========================================
  console.log('\n--- 3. MENANGKAP FITUR ROLE KEPALA PASAR ---');
  await logout(page);
  await login(page, 'kepala.pasar-sentral-pinrang@eskpt.id');

  // 3.1 Dashboard Kepala Pasar
  await page.goto(`${BASE}/admin-epasar.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await capture(page, '03-kepala-pasar', '01-dashboard-kepala-pasar');

  // 3.2 Database Master Terkunci ke Pasar Sentral
  await page.goto(`${BASE}/database-pedagang.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#dbRows tr', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await capture(page, '03-kepala-pasar', '02-database-pedagang-pasar-sentral');

  // 3.3 Verifikasi Unit Fisik Lapangan
  await page.goto(`${BASE}/market-verification.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await capture(page, '03-kepala-pasar', '03-verifikasi-fisik-unit-lapangan');

  // 3.4 Perubahan Pemegang Hak (Verifikasi Kepala Pasar)
  await page.goto(`${BASE}/occupancy-change.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await capture(page, '03-kepala-pasar', '04-perubahan-pemegang-hak-pasar');

  // 3.5 Pengesahan Tahunan SKPT Pasar
  await page.goto(`${BASE}/annual-validation.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await capture(page, '03-kepala-pasar', '05-pengesahan-tahunan-pasar');

  // 3.6 Profil Kepala Pasar
  await page.goto(`${BASE}/profil.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await capture(page, '03-kepala-pasar', '06-profil-kepala-pasar');

  // ==========================================
  // BAGIAN 4: ROLE KEPALA DINAS (KADIS)
  // ==========================================
  console.log('\n--- 4. MENANGKAP FITUR ROLE KEPALA DINAS (KADIS) ---');
  await logout(page);
  await login(page, 'kadis@eskpt.id');

  // 4.1 Dashboard Eksekutif Kadis
  await page.goto(`${BASE}/admin-epasar.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await capture(page, '04-kepala-dinas', '01-dashboard-eksekutif-kadis');

  // 4.2 Database Master Kabupaten Kadis
  await page.goto(`${BASE}/database-pedagang.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#dbRows tr', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await capture(page, '04-kepala-dinas', '02-database-master-kadis');

  // 4.3 Persetujuan SKPT & TTE Digital
  await page.goto(`${BASE}/kadis-approval.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await capture(page, '04-kepala-dinas', '03-persetujuan-skpt-kadis');

  // 4.4 Perubahan Pemegang Hak (Persetujuan Final Kadis)
  await page.goto(`${BASE}/occupancy-change.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await capture(page, '04-kepala-dinas', '04-persetujuan-perubahan-pemegang');

  // 4.5 Pengesahan Tahunan SKPT
  await page.goto(`${BASE}/annual-validation.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await capture(page, '04-kepala-dinas', '05-pengesahan-tahunan-skpt');

  // 4.6 Profil & TTE Kadis
  await page.goto(`${BASE}/profil.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await capture(page, '04-kepala-dinas', '06-profil-dan-tte-kadis');

  console.log('\n=== SEMUA TANGKAPAN LAYAR ROLE BERHASIL DIAMBIL 100%! ===');
  await browser.close();
})().catch(err => {
  console.error('ERROR CAPTURE ALL ROLES:', err);
  process.exit(1);
});
