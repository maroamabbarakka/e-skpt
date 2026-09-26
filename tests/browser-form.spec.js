const { test, expect } = require('@playwright/test');

test.describe('e-PASAR public form', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.clear();
      window.localStorage.clear();
    });
  });

  test('validates identity and advances through wizard', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('http://127.0.0.1:8090/epasar.html');
    await page.getByRole('button', { name: 'Lanjut' }).click();
    await expect(page.locator('#formError')).toContainText('Lengkapi seluruh data identitas');
    await page.locator('[name="nik"]').fill('123');
    await page.locator('[name="name"]').fill('Test Pedagang');
    await page.locator('[name="birthPlace"]').fill('Pinrang');
    await page.locator('[name="birthDate"]').fill('1990-01-01');
    await page.locator('[name="phone"]').fill('081234567890');
    await page.locator('[name="district"]').fill('Pinrang');
    await page.locator('[name="village"]').fill('Test');
    await page.locator('[name="address"]').fill('Alamat test');
    await page.getByRole('button', { name: 'Lanjut' }).click();
    await expect(page.locator('#formError')).toContainText('NIK harus terdiri dari 16 digit');
    await page.locator('[name="nik"]').fill('7315010101010001');
    await page.getByRole('button', { name: 'Lanjut' }).click();
    await expect(page.locator('[data-step="2"]')).toHaveClass(/is-active/);
  });

  test('supports multiple businesses, locations, market places, and SKPT per place', async ({ page }) => {
    await page.goto('http://127.0.0.1:8090/epasar.html');
    await page.locator('[name="nik"]').fill('7315010101010001');
    await page.locator('[name="name"]').fill('Test Pedagang');
    await page.locator('[name="birthPlace"]').fill('Pinrang');
    await page.locator('[name="birthDate"]').fill('1990-01-01');
    await page.locator('[name="phone"]').fill('081234567890');
    await page.locator('[name="district"]').fill('Pinrang');
    await page.locator('[name="village"]').fill('Test');
    await page.locator('[name="address"]').fill('Alamat test');
    await page.getByRole('button', { name: 'Lanjut' }).click();
    await page.locator('[data-bind="0|b|||type"]').selectOption({ label: 'Toko' });
    await page.locator('[data-bind="0|b|||group"]').selectOption({ label: 'Bahan pangan kering' });
    await page.locator('[data-bind="0|b|||category"]').fill('Sembako');
    await page.locator('[data-bind="0|b|||monthlyRevenue"]').fill('12500000');
    await expect(page.locator('[data-bind="0|b|||monthlyRevenue"]')).toHaveValue('12.500.000');
    await page.getByRole('button', { name: '+ Tambah Usaha' }).click();
    await expect(page.locator('#businessList .entity-card')).toHaveCount(2);
    await page.getByRole('button', { name: 'Hapus' }).last().click();
    await page.getByRole('button', { name: 'Lanjut' }).click();
    await page.locator('[data-bind="0|l|0||type"]').selectOption('MARKET');
    await page.locator('[data-bind="0|l|0||district"]').fill('Watang Sawitto');
    await page.locator('[data-bind="0|l|0||village"]').fill('Pinrang');
    await page.locator('[data-bind="0|l|0||address"]').fill('Kompleks pasar');
    await page.getByRole('button', { name: '+ Tambah Tempat di Pasar' }).click();
    await expect(page.locator('[data-bind="0|p|0|0|marketId"] option')).toHaveCount(12);
    await page.locator('[data-bind="0|p|0|0|marketId"]').selectOption('MKT-010');
    await page.locator('[data-bind="0|p|0|0|unitType"]').selectOption('PELATARAN');
    await page.locator('[data-bind="0|p|0|0|unitNumber"]').fill('PLT-1');
    await page.getByRole('button', { name: '+ Tambah Tempat di Pasar' }).click();
    await page.locator('[data-bind="0|p|0|1|marketId"]').selectOption('MKT-009');
    await page.locator('[data-bind="0|p|0|1|unitType"]').selectOption('KIOS');
    await page.locator('[data-bind="0|p|0|1|unitNumber"]').fill('K-2');
    await page.getByRole('button', { name: 'Lanjut' }).click();
    await expect(page.locator('#skptPlaceChoices .skpt-place')).toHaveCount(2);
    await page.locator('[data-bind="0|p|0|0|applySkpt"]').check();
    await page.locator('[data-bind="0|p|0|1|applySkpt"]').check();
    await expect(page.locator('#skptOnlyAttachments')).toBeVisible();
    await expect(page.locator('[name="citizenship"]')).toHaveValue('Indonesia');
  });

  test('mobile viewport has no horizontal overflow and draft survives back navigation', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('http://127.0.0.1:8090/epasar.html');
    await page.locator('[name="name"]').fill('Draft Pedagang');
    await page.locator('[name="birthPlace"]').fill('Pinrang');
    await page.locator('[name="birthDate"]').fill('1990-01-01');
    await page.locator('[name="nik"]').fill('7315010101010001');
    await page.locator('[name="phone"]').fill('081234567890');
    await page.locator('[name="district"]').fill('Pinrang');
    await page.locator('[name="village"]').fill('Test');
    await page.locator('[name="address"]').fill('Alamat test');
    await page.getByRole('button', { name: 'Lanjut' }).click();
    await page.getByRole('button', { name: 'Kembali' }).click();
    await expect(page.locator('[name="name"]')).toHaveValue('Draft Pedagang');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
