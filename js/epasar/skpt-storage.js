(function () {
  'use strict';

  const PROVIDERS = Object.freeze(['GOOGLE_DRIVE', 'PEMKAB_SERVER', 'FIREBASE_STORAGE']);
  const SYNC_STATUSES = Object.freeze(['PENDING_UPLOAD', 'UPLOADING', 'UPLOADED', 'VERIFIED', 'FAILED', 'SUPERSEDED', 'REVOKED']);

  function clean(value, max = 300) { return String(value || '').trim().slice(0, max); }
  function bytesToHex(buffer) { return [...new Uint8Array(buffer)].map(value => value.toString(16).padStart(2, '0')).join(''); }
  async function sha256(bytes) { return bytesToHex(await crypto.subtle.digest('SHA-256', bytes)); }

  async function inspectPdf(file) {
    if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Pilih file PDF hasil TTE.');
    if (file.size < 100) throw new Error('PDF terlalu kecil atau tidak berisi dokumen yang valid.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') throw new Error('File tidak memiliki struktur awal PDF yang valid.');
    return { bytes, binaryBytes: bytes.byteLength, documentHash: await sha256(bytes), mimeType: 'application/pdf', fileName: clean(file.name, 160) };
  }

  function descriptor(input) {
    const provider = clean(input.provider, 40).toUpperCase();
    const syncStatus = clean(input.syncStatus || 'PENDING_UPLOAD', 40).toUpperCase();
    if (!PROVIDERS.includes(provider)) throw new Error('Penyedia penyimpanan PDF belum didukung.');
    if (!SYNC_STATUSES.includes(syncStatus)) throw new Error('Status sinkronisasi PDF tidak valid.');
    if (syncStatus === 'VERIFIED' && (!input.objectId || !/^[a-f0-9]{64}$/.test(String(input.documentHash || '')))) {
      throw new Error('Arsip terverifikasi wajib memiliki objectId dan hash SHA-256.');
    }
    return {
      provider,
      objectId: clean(input.objectId, 500),
      location: clean(input.location, 500),
      syncStatus,
      documentHash: clean(input.documentHash, 64).toLowerCase(),
      binaryBytes: Number(input.binaryBytes || 0),
      mimeType: 'application/pdf',
      revision: Math.max(1, Number(input.revision || 1)),
      verifiedAt: input.verifiedAt || null
    };
  }

  function canIssue(storage) {
    try { const value = descriptor(storage); return value.syncStatus === 'VERIFIED' && value.binaryBytes > 100; }
    catch (_) { return false; }
  }

  window.EPASAR_SKPT_STORAGE = { PROVIDERS, SYNC_STATUSES, inspectPdf, descriptor, canIssue, sha256 };
}());
