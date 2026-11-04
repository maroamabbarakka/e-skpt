import { createHash } from 'node:crypto';

export const MAX_PDF_BYTES = Number(process.env.SKPT_PDF_MAX_BYTES || 10 * 1024 * 1024);
export const ALLOWED_ROLES = Object.freeze(['KADIS']);
export const MARKET_CODES = Object.freeze({
  'MKT-001':'BNG','MKT-002':'CMP','MKT-003':'KJY','MKT-004':'KRG','MKT-005':'LNG','MKT-006':'LRS',
  'MKT-007':'LPG','MKT-008':'MRW','MKT-009':'PKB','MKT-010':'SPG','MKT-011':'TPP'
});
const ROMAN_MONTHS = Object.freeze(['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']);

export function requirePdf(buffer, mimeType = '') {
  if (!Buffer.isBuffer(buffer)) throw new Error('Payload PDF tidak tersedia.');
  if (buffer.length <= 100) throw new Error('PDF terlalu kecil atau kosong.');
  if (buffer.length > MAX_PDF_BYTES) throw new Error(`PDF melebihi batas ${MAX_PDF_BYTES} byte.`);
  if (mimeType !== 'application/pdf') throw new Error('MIME berkas wajib application/pdf.');
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Header berkas bukan PDF yang valid.');
  return {
    binaryBytes: buffer.length,
    documentHash: createHash('sha256').update(buffer).digest('hex')
  };
}

export function requireActor(decodedToken, profile) {
  const role = String(profile?.role || decodedToken?.role || '').toUpperCase();
  if (!decodedToken?.uid || profile?.status !== 'ACTIVE' || !ALLOWED_ROLES.includes(role)) {
    throw new Error('Hanya Kepala Dinas aktif yang dapat memproses PDF TTE.');
  }
  return { uid: decodedToken.uid, role, displayName: profile.displayName || decodedToken.name || '' };
}

export function safeFileName(number, applicationId, revision = 1) {
  const base = String(number || applicationId || 'SKPT').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  return `${base || 'SKPT'}-R${Math.max(1, Number(revision || 1))}.pdf`;
}

export function storageDescriptor({ fileId, folderId, documentHash, binaryBytes, revision = 1, verifiedAt }) {
  if (!fileId || !folderId || !/^[a-f0-9]{64}$/.test(String(documentHash || ''))) throw new Error('Metadata penyimpanan Drive tidak lengkap.');
  return {
    provider: 'GOOGLE_DRIVE', objectId: fileId, location: folderId,
    syncStatus: 'VERIFIED', documentHash, binaryBytes: Number(binaryBytes),
    mimeType: 'application/pdf', revision: Math.max(1, Number(revision || 1)),
    verifiedAt
  };
}

export function addYearsIso(date, years) {
  const value = new Date(date);
  value.setUTCFullYear(value.getUTCFullYear() + Number(years || 2));
  return value.toISOString();
}

export function administrativeDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Makassar', year: 'numeric', month: 'numeric', day: 'numeric'
  }).formatToParts(date);
  const part = type => Number(parts.find(item => item.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day'), timeZone: 'Asia/Makassar' };
}

export function formatSkptNumber(sequence, marketId, month, year) {
  const serial = Number(sequence), monthNumber = Number(month), yearNumber = Number(year), marketCode = MARKET_CODES[marketId];
  if (!marketCode) throw new Error('Kode pasar tidak terdaftar pada master backend.');
  if (!Number.isInteger(serial) || serial < 1 || serial > 9999) throw new Error('Nomor urut SKPT tidak valid.');
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) throw new Error('Bulan administratif tidak valid.');
  if (!Number.isInteger(yearNumber) || yearNumber < 2024 || yearNumber > 2200) throw new Error('Tahun administratif tidak valid.');
  return `${String(serial).padStart(4, '0')}/SKPT/${marketCode}/${ROMAN_MONTHS[monthNumber - 1]}/${yearNumber}`;
}
