const { test, expect } = require('@playwright/test');

for (const viewport of [
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 }
]) {
  test(`epasar no overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('http://127.0.0.1:8090/epasar.html');
    await expect(page.getByRole('heading', { name: 'Pendataan Pedagang' })).toBeVisible();
    await expect(page.locator('.form-shell')).toHaveCSS('background-image', /logo_pinrang_opt/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
}

for (const path of ['index.html', 'layanan.html', 'data-informasi.html', 'galeri-video.html', 'informasi.html', 'panduan.html', 'epasar-status.html', 'verifikasi-skpt.html', 'verifikasi-unit.html', 'admin-epasar.html', 'admin-intake-review.html', 'photo-editor.html', 'market-verification.html', 'annual-validation.html', 'occupancy-change.html', 'kadis-approval.html', 'profil.html', 'login.html']) {
  test(`${path} loads without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`http://127.0.0.1:8090/${path}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
}
