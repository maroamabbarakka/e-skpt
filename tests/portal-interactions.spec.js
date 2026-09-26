const { test, expect } = require('@playwright/test');

test.describe('portal and login interactions', () => {
  test('portal data tabs replace the visible rows', async ({ page }) => {
    await page.goto('http://127.0.0.1:8090/index.html');
    await page.getByRole('tab', { name: 'Pasar & Unit' }).click();
    await expect(page.locator('#portalDataRows')).toContainText('Kios, los, lapak, dan pelataran');
    await expect(page.getByRole('tab', { name: 'Pasar & Unit' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'e-SKPT' }).click();
    await expect(page.locator('#portalDataRows')).toContainText('Pengesahan tahunan');
  });

  test('homepage exposes public statistics instead of internal directory', async ({ page }) => {
    await page.goto('http://127.0.0.1:8090/index.html');
    await expect(page.getByRole('heading', { name: 'Statistik e-PASAR' })).toBeVisible();
    await expect(page.getByText('DIREKTORI INTERNAL')).toHaveCount(0);
    await expect(page.getByText('Ruang kerja petugas')).toHaveCount(0);
    await expect(page.locator('[data-stat="totalTraders"]')).not.toHaveText('0');
  });

  test('hero promise rotates and video cards stay lazy', async ({ page }) => {
    const videoRequests = [];
    page.on('request', request => { if (/\.mp4(?:\?|$)/.test(request.url())) videoRequests.push(request.url()); });
    await page.goto('http://127.0.0.1:8090/index.html');
    await expect(page.locator('#heroRotatingText')).toHaveText('e-SKPT');
    await expect(page.locator('#heroRotatingText')).not.toHaveText('e-SKPT', { timeout: 4000 });
    await expect(page.locator('.video-card')).toHaveCount(3);
    const preloadValues = await page.locator('.video-card video').evaluateAll(videos => videos.map(video => video.getAttribute('preload')));
    expect(preloadValues).toEqual(['none', 'none', 'none']);
    expect(videoRequests).toHaveLength(0);
  });

  test('login accepts either a username or an email identifier', async ({ page }) => {
    await page.goto('http://127.0.0.1:8090/login.html');
    const identifier = page.locator('#identifier');
    await expect(identifier).toHaveAttribute('type', 'text');
    await identifier.fill('admin.pasar');
    await expect(identifier).toHaveValue('admin.pasar');
  });

  test('local Parkinsans font is loaded on public and internal pages', async ({ page }) => {
    for (const path of ['index.html', 'login.html', 'admin-epasar.html']) {
      await page.goto(`http://127.0.0.1:8090/${path}`);
      await page.evaluate(() => document.fonts.ready);
      const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
      expect(family).toContain('Parkinsans');
    }
  });
});
