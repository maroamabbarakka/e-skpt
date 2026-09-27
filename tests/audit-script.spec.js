const { test, expect } = require('playwright/test');
const fs = require('fs');
const path = require('path');

test('audit integritas pasar bersifat read-only', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'audit_market_integrity.js'), 'utf8');
  const client = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'lib', 'firebase_rest_read.js'), 'utf8');
  expect(source).toContain("auditMode: 'READ_ONLY'");
  expect(client).toContain("method: 'GET'");
  expect(source + client).not.toMatch(/method:\s*['"](?:PATCH|PUT|DELETE)['"]/);
  expect(source + client).not.toContain('documents:commit');
  expect(client).not.toContain(':commit');
  expect(source).not.toContain('.collection(');
});

test('backfill direktori aman, dry-run default, dan create-only', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'backfill_market_directory.js'), 'utf8');
  expect(source).toContain("const apply = args.has('--apply')");
  expect(source).toContain("startsWith('--confirm-project=')");
  expect(source).toContain("startsWith('--max-writes=')");
  expect(source).toContain('currentDocument: { exists: false }');
  expect(source).toContain("status: 'NO_WRITES_PERFORMED'");
  expect(source).not.toMatch(/method:\s*['"](?:PATCH|PUT|DELETE)['"]/);
  expect(source).not.toContain('transaction.update');
  expect(source).not.toContain('transaction.delete');
});

test('aktivasi scope akun default dry-run dan memakai optimistic concurrency', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'activate_market_directory_scope.js'), 'utf8');
  expect(source).toContain("const apply = args.has('--apply')");
  expect(source).toContain("args.has('--confirm-backfill-complete')");
  expect(source).toContain("startsWith('--confirm-project=')");
  expect(source).toContain("startsWith('--max-accounts=')");
  expect(source).toContain("fieldPaths: ['marketDirectoryScoped', 'updatedAt']");
  expect(source).toContain('currentDocument: { updateTime: row._updateTime }');
  expect(source).toContain("status: 'NO_WRITES_PERFORMED'");
  expect(source).toContain("if (blocked.length) throw new Error");
  expect(source).not.toMatch(/method:\s*['"](?:PATCH|PUT|DELETE)['"]/);
});

test('jejak sebelum verifikasi berasal dari snapshot transaksi', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'epasar', 'workflow-service.js'), 'utf8');
  expect(source).toContain('unitNumber: currentClaim.claimedUnitNumber');
  expect(source).toContain('areaM2: currentClaim.claimedAreaM2');
  expect(source).not.toContain('unitNumber: claim.claimedUnitNumber, block: claim.claimedBlock');
});

test('pendaftaran pasar membentuk read-model pedagang per pasar', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'epasar', 'workflow-service.js'), 'utf8');
  expect(source).toContain("collection('market_trader_directory')");
  expect(source).toContain('traderDisplayName:clean(intake.identity.name,120)');
  expect(source).toContain('traderDisplayName:clean(intake.identity?.name,120)');
});

test('pengalihan pemegang memvalidasi penerima melalui direktori pasar', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'epasar', 'occupancy-change-service.js'), 'utf8');
  expect(source).toContain("collection('market_trader_directory')");
  expect(source).not.toContain("collection('traders')");
  expect(source).toContain("targetTraderSnapshot.data().marketId !== current.marketId");
  expect(source).toContain("target.docs[0].data().status !== 'ACTIVE'");
});

test('ruang kerja Kepala Pasar mengutamakan data scoped dan membatasi fallback legacy', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'epasar', 'market-workspace-service.js'), 'utf8');
  expect(source).toContain("collection('market_trader_directory')");
  expect(source).toContain("collection('skpt_applications')");
  expect(source).toContain('profile?.marketDirectoryScoped === true');
  expect(source).toContain("collection('traders')");
  expect(source).toContain("console.warn('Fallback identitas pedagang lama tidak tersedia.'");
  expect(source).toContain("const allowedTypes = ['PROFILE', 'EVIDENCE', 'LOCATION']");
  expect(source).toContain("where('marketId', '==', marketId)");
});

test('editor akun mempertahankan flag scope yang sudah aktif', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'epasar', 'account-service.js'), 'utf8');
  expect(source).toContain("marketDirectoryScoped: role === 'MARKET_HEAD' && existing?.marketDirectoryScoped === true");
});

test('perubahan pemegang memakai nama dan pilihan direktori pasar, bukan input ID bebas', () => {
  const ui = fs.readFileSync(path.join(__dirname, '..', 'js', 'epasar', 'occupancy-change.js'), 'utf8');
  const service = fs.readFileSync(path.join(__dirname, '..', 'js', 'epasar', 'occupancy-change-service.js'), 'utf8');
  expect(ui).toContain('unit.currentTraderName');
  expect(ui).toContain('Pedagang penerima<select name="newTraderId"');
  expect(ui).not.toContain('ID pedagang penerima<input');
  expect(service).toContain('directoryByMarket');
  expect(service).toContain("collection('market_trader_directory')");
});

test('dashboard Kepala Pasar menjelaskan identitas dan tujuan setiap alur', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'epasar', 'admin-epasar.js'), 'utf8');
  expect(source).toContain('ALUR KERJA');
  expect(source).toContain('Semua data pasar:</strong> hanya daftar referensi');
  expect(source).toContain("document.getElementById('adminUser').textContent");
});

test('form memakai master pasar dan master wilayah, bukan teks bebas', () => {
  const constants = fs.readFileSync(path.join(__dirname, '..', 'js', 'epasar', 'constants.js'), 'utf8');
  const form = fs.readFileSync(path.join(__dirname, '..', 'epasar.html'), 'utf8');
  const entities = fs.readFileSync(path.join(__dirname, '..', 'js', 'epasar', 'multi-entity-form.js'), 'utf8');
  const review = fs.readFileSync(path.join(__dirname, '..', 'admin-intake-review.html'), 'utf8');
  expect(constants).toContain('ADMIN_AREAS');
  expect(constants).toContain('villagesByDistrict');
  expect(form).toContain('id="identityDistrict"');
  expect(form).toContain('id="identityVillage"');
  expect(entities).toContain('districtOptions');
  expect(entities).toContain('villageOptions');
  expect(review).toContain('id="officialMarket"');
  expect(review).not.toContain('ID pasar resmi<input');
});

test('review administrasi merinci setiap usaha, lokasi, klaim pasar, dan media', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'epasar', 'admin-intake-review.js'), 'utf8');
  expect(source).toContain('renderBusinessDetails');
  expect(source).toContain('place.marketId');
  expect(source).toContain('place.unitNumber');
  expect(source).toContain('place.locationHint');
  expect(source).toContain('renderMedia');
  expect(source).toContain('IDENTITY_KTP');
});

test('keputusan admin dipublikasikan tanpa menimpa pendaftaran asli', () => {
  const service = fs.readFileSync(path.join(__dirname, '..', 'js', 'epasar', 'intake-review-service.js'), 'utf8');
  const intake = fs.readFileSync(path.join(__dirname, '..', 'js', 'epasar', 'intake-service.js'), 'utf8');
  expect(service).toContain('CORRECTION_REQUIRED');
  expect(service).toContain('REJECTED');
  expect(service).toContain('reviewHistory');
  expect(service).toContain("collection('public_status')");
  expect(intake).toContain('batch.commit()');
  expect(intake).toContain("status: 'SUBMITTED'");
});
