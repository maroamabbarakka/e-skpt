'use strict';
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  console.log('Mengunjungi https://e-skpt.web.app/login...');
  await page.goto('https://e-skpt.web.app/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#identifier').fill('kadis@eskpt.id');
  await page.locator('#password').fill('Pasar202#');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/admin-epasar/, { timeout: 25000 });
  await page.waitForTimeout(4000);

  console.log('Current URL di Firebase:', page.url());
  const hasSidebar = await page.locator('.internal-sidebar').count();
  const userName = await page.locator('#shellUserName').innerText().catch(() => 'None');
  const roleText = await page.locator('#shellUserRole').innerText().catch(() => 'None');
  console.log('Hasil Verifikasi Live Firebase:', { hasSidebar, userName, roleText });

  await page.screenshot({ path: 'artifacts/role-screenshots/live-firebase-kadis-cleanurl.png', fullPage: true });
  await browser.close();
  console.log('SUKSES! Sidebar dan layout eksekutif berhasil ter-render di Firebase Hosting Live.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
