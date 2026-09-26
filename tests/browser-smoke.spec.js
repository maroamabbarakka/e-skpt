const { test, expect } = require('playwright/test');

test('username jabatan dipetakan ke domain login internal', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/index.html');
  await page.addScriptTag({ url: 'http://127.0.0.1:8090/js/epasar/auth-service.js' });
  expect(await page.evaluate(() => window.EPASAR_AUTH.loginEmail('superadmin'))).toBe('superadmin@eskpt.id');
  expect(await page.evaluate(() => window.EPASAR_AUTH.loginEmail('Kepala.Sentral'))).toBe('kepala.sentral@eskpt.id');
});

test('e-PASAR form and browser image pipeline', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/tests/browser-smoke.html');
  await page.waitForFunction(() => document.querySelector('#result')?.textContent !== 'RUNNING');
  const output = await page.locator('#result').textContent();
  expect(output).toContain('PASS NIK valid');
  expect(output).toContain('PASS NIK invalid rejected');
  expect(output).toContain('PASS WebP output');
  expect(output).toContain('PASS profile hard cap');
  expect(output).toContain('PASS dimensions capped');
  expect(output).toContain('PASS Base64 present');
  expect(output).toContain('PASS metadata bytes');
  expect(output).not.toContain('FAIL');
});

test('image pipeline menyediakan konfigurasi untuk seluruh tipe unggahan form', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/epasar.html');
  const limits = await page.evaluate(() => window.EPASAR_IMAGE.limits);
  for (const type of ['profile', 'identity', 'business', 'location', 'thumbnail']) {
    expect(limits[type]?.maxSide).toBeGreaterThan(0);
    expect(limits[type]?.maxBytes).toBeGreaterThan(0);
  }
});
