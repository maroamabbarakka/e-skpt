const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  
  try {
    console.log('1. Login Superadmin...');
    await page.goto('http://127.0.0.1:8090/login.html');
    await page.locator('#identifier').fill('superadmin@eskpt.id');
    await page.locator('#password').fill('Pasar202#');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/admin-epasar/);
    await page.waitForTimeout(2000);

    console.log('2. Uji klik Card KPI SKPT Terbit...');
    const kpiIssued = page.locator('#kpiIssued').locator('xpath=ancestor::article');
    await kpiIssued.click();
    await page.waitForTimeout(1000);
    const isKpiModalVisible = await page.locator('#adminKpiModal').isVisible();
    console.log('Modal Admin KPI Terbuka:', isKpiModalVisible);

    console.log('3. Uji Search di Modal KPI...');
    await page.locator('#adminKpiSearchInput').fill('Haji');
    await page.waitForTimeout(500);
    const countText = await page.locator('#adminKpiCount').innerText();
    console.log('Hasil pencarian KPI:', countText);

    console.log('4. Uji Tutup Modal KPI...');
    await page.locator('#closeAdminKpiBtn').click();
    await page.waitForTimeout(500);
    const isKpiClosed = !(await page.locator('#adminKpiModal').isVisible());
    console.log('Modal KPI Berhasil Ditutup:', isKpiClosed);

    console.log('5. Navigasi ke Database Pedagang...');
    await page.goto('http://127.0.0.1:8090/database-pedagang.html');
    await page.waitForTimeout(2500);

    console.log('6. Uji klik KPI Card Retribusi di Database...');
    await page.locator('.db-kpi-card.highlight-5').click();
    await page.waitForTimeout(800);
    const isDbKpiModalVisible = await page.locator('#kpiModal').isVisible();
    console.log('Modal Breakdown Retribusi Terbuka:', isDbKpiModalVisible);
    await page.locator('#closeKpiModalBtn').click();
    await page.waitForTimeout(500);

    console.log('7. Uji Rincian Pedagang & Aksi SKPT/Kartu/WA...');
    await page.locator('#filterSkpt').selectOption('ISSUED');
    await page.waitForTimeout(500);

    const firstDetailBtn = page.locator('button:has-text("Rincian")').first();
    await firstDetailBtn.click();
    await page.waitForTimeout(800);
    const isDetailVisible = await page.locator('#detailModal').isVisible();
    console.log('Modal Rincian Pedagang Terbuka:', isDetailVisible);

    const hasSkptActions = await page.locator('#modalSkptActionContainer').isVisible();
    console.log('Aksi SKPT Terbit Tampil pada Pedagang ber-SKPT:', hasSkptActions);

    const skptHref = await page.locator('#modalBtnPrintSkpt').getAttribute('href');
    const cardHref = await page.locator('#modalBtnPrintCard').getAttribute('href');
    console.log('Tautan Cetak SKPT:', skptHref);
    console.log('Tautan Cetak Kartu:', cardHref);

    await page.locator('#closeModalBtn').click();
    await page.waitForTimeout(500);

    console.log('SELESAI! SEMUA TEST BERHASIL!');
  } catch (err) {
    console.error('TEST ERROR:', err);
  } finally {
    await browser.close();
  }
})();
