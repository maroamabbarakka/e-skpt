import test from 'node:test';
import assert from 'node:assert/strict';
import { requirePdf, requireActor, safeFileName, storageDescriptor, addYearsIso, administrativeDate, formatSkptNumber } from '../src/core.js';

const validPdf = Buffer.from('%PDF-' + 'x'.repeat(200));

test('PDF validation and SHA-256', () => {
  const result = requirePdf(validPdf, 'application/pdf');
  assert.equal(result.binaryBytes, validPdf.length);
  assert.match(result.documentHash, /^[a-f0-9]{64}$/);
  assert.throws(() => requirePdf(Buffer.from('not pdf'.repeat(30)), 'application/pdf'), /Header/);
  assert.throws(() => requirePdf(validPdf, 'text/plain'), /MIME/);
});

test('only active Kadis may operate', () => {
  assert.deepEqual(requireActor({ uid: 'k1' }, { role: 'KADIS', status: 'ACTIVE', displayName: 'Kadis' }), { uid: 'k1', role: 'KADIS', displayName: 'Kadis' });
  assert.throws(() => requireActor({ uid: 'a1' }, { role: 'SUPER_ADMIN', status: 'ACTIVE' }), /Kepala Dinas/);
  assert.throws(() => requireActor({ uid: 'k2' }, { role: 'KADIS', status: 'INACTIVE' }), /Kepala Dinas/);
});

test('storage descriptor and deterministic naming', () => {
  assert.equal(safeFileName('SKPT/01 X', 'app', 2), 'SKPT-01-X-R2.pdf');
  const value = storageDescriptor({ fileId: 'file1', folderId: 'folder1', documentHash: 'a'.repeat(64), binaryBytes: 205, verifiedAt: '2026-10-29T00:00:00.000Z' });
  assert.equal(value.syncStatus, 'VERIFIED');
  assert.equal(value.provider, 'GOOGLE_DRIVE');
  assert.throws(() => storageDescriptor({ fileId: '', folderId: 'folder1', documentHash: 'x' }), /tidak lengkap/);
});

test('validity uses calendar years', () => {
  assert.equal(addYearsIso('2026-10-29T00:00:00.000Z', 2), '2028-10-29T00:00:00.000Z');
});

test('official number uses backend market master and WITA administrative date', () => {
  assert.equal(formatSkptNumber(1, 'MKT-001', 10, 2026), '0001/SKPT/BNG/X/2026');
  assert.equal(formatSkptNumber(9999, 'MKT-010', 12, 2026), '9999/SKPT/SPG/XII/2026');
  assert.throws(() => formatSkptNumber(1, 'MKT-999', 1, 2026), /Kode pasar/);
  assert.deepEqual(administrativeDate(new Date('2026-10-28T16:30:00.000Z')), { year: 2026, month: 10, day: 29, timeZone: 'Asia/Makassar' });
});
