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

test('super admin account editor supports Auth provisioning and safe deactivation', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/admin-akun.html');
  await expect(page.locator('#email')).toHaveAttribute('type', 'email');
  await expect(page.locator('#initialPassword')).toHaveAttribute('minlength', '8');
  await expect(page.locator('#status')).toContainText('INACTIVE');
  await expect(page.locator('#marketIdOptions option')).toHaveCount(11);
});

test('review admin menampilkan rincian routing pasar dan bukti lampiran', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/admin-intake-review.html');
  await expect(page.locator('#businessDetails')).toBeAttached();
  await expect(page.locator('#mediaGallery')).toBeAttached();
  await expect(page.locator('#officialMarket')).toBeAttached();
  const source = await page.evaluate(async () => (await fetch('/js/epasar/admin-intake-review.js')).text());
  expect(source).toContain('Pasar tujuan');
  expect(source).toContain('Tempat diklaim');
  expect(source).toContain('AJUKAN SKPT');
  expect(source).toContain("collection('trader_media')");
  expect(source).toContain('invalidMarketCount');
});

test('review admin menyediakan pengembalian, penolakan, alasan, dan riwayat koreksi', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/admin-intake-review.html');
  await expect(page.locator('#decisionSections')).toHaveCount(1);
  await expect(page.locator('#decisionReason')).toHaveAttribute('maxlength', '500');
  await expect(page.locator('#returnIntake')).toContainText('Kembalikan');
  await expect(page.locator('#rejectIntake')).toContainText('Tolak');
  await expect(page.locator('#correctionHistory')).toHaveCount(1);
  const source = await page.evaluate(async () => (await fetch('/js/epasar/intake-review-service.js')).text());
  expect(source).toContain("['CORRECTION_REQUIRED', 'REJECTED']");
  expect(source).toContain('reviewHistory');
});

test('halaman status hanya membuka koreksi ketika diminta admin', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/epasar-status.html');
  await expect(page.locator('#correctionPanel')).toBeHidden();
  await expect(page.locator('#correctionSection option[data-admin-section="DOCUMENT"]')).toHaveCount(1);
  const source = await page.evaluate(async () => (await fetch('/js/epasar/status-ui.js')).text());
  expect(source).toContain("current.status!=='CORRECTION_REQUIRED'");
  expect(source).toContain('current.canResubmit!==true');
});

test('ruang kerja Kepala Pasar memisahkan klaim baru dari data legacy secara aman', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/market-verification.html');
  await page.addScriptTag({ url: 'http://127.0.0.1:8090/js/epasar/market-workspace-service.js' });
  await page.addScriptTag({ url: 'http://127.0.0.1:8090/js/epasar/workflow-service.js' });
  const states = await page.evaluate(() => ({
    fresh: window.EPASAR_MARKET_WORKSPACE.claimState({ verificationStatus: 'UNVERIFIED' }),
    verified: window.EPASAR_MARKET_WORKSPACE.claimState({ verificationStatus: 'VERIFIED' }),
    legacyVerified: window.EPASAR_MARKET_WORKSPACE.claimState({ status: 'MARKET_VERIFIED' }),
    missing: window.EPASAR_MARKET_WORKSPACE.claimState({})
  }));
  expect(states).toEqual({ fresh: 'UNVERIFIED', verified: 'VERIFIED', legacyVerified: 'LEGACY_REVIEW', missing: 'LEGACY_REVIEW' });
  const legacyGuard = await page.evaluate(async () => {
    try {
      await window.EPASAR_WORKFLOW.verifyClaim({ id: 'legacy', traderId: 'PDG-1', marketId: 'MKT-010', status: 'MARKET_VERIFIED' }, {}, { role: 'MARKET_HEAD', marketIds: ['MKT-010'] });
      return '';
    } catch (error) {
      return error.message;
    }
  });
  expect(legacyGuard).toContain('UNVERIFIED');
  await expect(page.locator('#pendingTab')).toBeAttached();
  await expect(page.locator('#directoryTab')).toBeAttached();
  await expect(page.locator('#pendingMore')).toBeAttached();
  await expect(page.locator('#directoryMore')).toBeAttached();
  await expect(page.locator('#pendingSearch')).toHaveAttribute('type', 'search');
  await expect(page.locator('#pendingList')).toBeAttached();
  await expect(page.locator('#items')).toBeAttached();
  const verificationSource = await page.evaluate(async () => (await fetch('/js/epasar/market-verification.js')).text());
  expect(verificationSource).toContain('BUKTI VISUAL PENDAFTARAN');
  expect(verificationSource).toContain('Foto KTP/KK tidak ditampilkan');
});

test('image pipeline menyediakan konfigurasi untuk seluruh tipe unggahan form', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/epasar.html');
  const limits = await page.evaluate(() => window.EPASAR_IMAGE.limits);
  for (const type of ['profile', 'identity', 'business', 'location', 'thumbnail']) {
    expect(limits[type]?.maxSide).toBeGreaterThan(0);
    expect(limits[type]?.maxBytes).toBeGreaterThan(0);
  }
});

test('intake membatasi jumlah tempat pasar sesuai kontrak public status', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/epasar.html');
  const result = await page.evaluate(() => {
    const place = index => ({ id: `PLC-${index}`, marketId: 'MKT-010', unitType: 'KIOS', unitNumber: String(index), applySkpt: false });
    const location = (prefix, count) => ({ id: `LOC-${prefix}`, type: 'MARKET', district: 'Watang Sawitto', village: 'Sawitto', address: 'Pinrang', marketPlaces: Array.from({ length: count }, (_, index) => place(`${prefix}-${index}`)) });
    const business = (prefix, locationCounts) => ({ id: `BUS-${prefix}`, name: `Usaha ${prefix}`, type: 'Toko', group: 'Perdagangan', category: 'Perdagangan', locations: locationCounts.map((count, index) => location(`${prefix}-${index}`, count)) });
    const base = { district: 'Watang Sawitto', village: 'Sawitto', truthAck: true, verificationAck: true, businessDrafts: [business('A', [5, 5, 5, 5, 5])] };
    const accepted = window.EPASAR_INTAKE.payload(base).businessDrafts.flatMap(row => row.locations.flatMap(item => item.marketPlaces)).length;
    let rejected = '';
    try {
      window.EPASAR_INTAKE.payload({ ...base, businessDrafts: [...base.businessDrafts, business('B', [1])] });
    } catch (error) {
      rejected = error.message;
    }
    return { accepted, rejected, configuredLimit: window.EPASAR.MAX_MARKET_PLACES };
  });
  expect(result.configuredLimit).toBe(25);
  expect(result.accepted).toBe(25);
  expect(result.rejected).toContain('Maksimal 25');
});
