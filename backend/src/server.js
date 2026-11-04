import http from 'node:http';
import Busboy from 'busboy';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { randomBytes } from 'node:crypto';
import { MAX_PDF_BYTES, requireActor, requirePdf, safeFileName, addYearsIso, administrativeDate, formatSkptNumber } from './core.js';
import { uploadAndVerifyPdf } from './drive-storage.js';

if (!getApps().length) initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const folderId = process.env.GOOGLE_DRIVE_SKPT_FOLDER_ID;
const port = Number(process.env.PORT || 8080);
const allowedOrigins = new Set(String(process.env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean));

function json(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function cors(request, response) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

async function actorFromRequest(request) {
  const header = String(request.headers.authorization || '');
  if (!header.startsWith('Bearer ')) throw new Error('Firebase ID token tidak tersedia.');
  const decoded = await getAuth().verifyIdToken(header.slice(7), true);
  const profileSnap = await db.collection('users').doc(decoded.uid).get();
  if (!profileSnap.exists) throw new Error('Profil petugas tidak ditemukan.');
  return requireActor(decoded, profileSnap.data());
}

function parseMultipart(request) {
  return new Promise((resolve, reject) => {
    const parser = Busboy({ headers: request.headers, limits: { files: 1, fileSize: Number(process.env.SKPT_PDF_MAX_BYTES || 10 * 1024 * 1024), fields: 5 } });
    const chunks = []; let mimeType = ''; let fileName = ''; const fields = {}; let truncated = false;
    parser.on('file', (_name, stream, info) => {
      mimeType = info.mimeType; fileName = info.filename;
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('limit', () => { truncated = true; });
    });
    parser.on('field', (name, value) => { fields[name] = String(value).slice(0, 500); });
    parser.on('error', reject);
    parser.on('finish', () => {
      if (truncated) return reject(new Error('PDF melebihi batas ukuran.'));
      resolve({ buffer: Buffer.concat(chunks), mimeType, fileName, fields });
    });
    request.pipe(parser);
  });
}

function parseJson(request, maxBytes = 16 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let bytes = 0;
    request.on('data', chunk => { bytes += chunk.length; if (bytes > maxBytes) { reject(new Error('Payload keputusan terlalu besar.')); request.destroy(); return; } chunks.push(chunk); });
    request.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('Payload JSON tidak valid.')); } });
    request.on('error', reject);
  });
}

async function approveForTte(applicationId, actor, note) {
  const decisionNote = String(note || '').trim().slice(0, 500);
  if (!decisionNote) throw new Error('Catatan keputusan Kadis wajib diisi.');
  const appRef = db.collection('skpt_applications').doc(applicationId);
  return db.runTransaction(async transaction => {
    const appSnap = await transaction.get(appRef);
    if (!appSnap.exists) throw new Error('Permohonan SKPT tidak ditemukan.');
    const app = appSnap.data();
    if (app.status === 'TTE_PENDING' && app.draftNumber && app.numberReservationId) {
      return { status: app.status, number: app.draftNumber, reservationId: app.numberReservationId, alreadyReserved: true };
    }
    if (app.status !== 'KADIS_REVIEW') throw new Error(`Status ${app.status} tidak dapat disetujui Kadis.`);
    if (app.uptdApproval?.decision !== 'APPROVED' || app.uptdApproval?.marketId !== app.marketId) throw new Error('Persetujuan Kepala UPTD belum lengkap atau tidak sesuai pasar.');
    const date = administrativeDate();
    const counterRef = db.collection('skpt_number_counters').doc(String(date.year));
    const counterSnap = await transaction.get(counterRef);
    const serial = Number(counterSnap.exists ? counterSnap.data().nextSerial : 0) + 1;
    if (serial > 9999) throw new Error(`Nomor urut SKPT tahun ${date.year} telah mencapai batas.`);
    const number = formatSkptNumber(serial, app.marketId, date.month, date.year);
    const reservationId = `${date.year}-${String(serial).padStart(4, '0')}`;
    const reservationRef = db.collection('skpt_number_reservations').doc(reservationId);
    const verificationToken = randomBytes(16).toString('hex');
    transaction.set(counterRef, { year: date.year, nextSerial: serial, administrativeTimeZone: date.timeZone, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.create(reservationRef, {
      reservationId, applicationId, marketId: app.marketId, number, year: date.year, month: date.month,
      serial, status: 'RESERVED', reservedBy: actor.uid, administrativeTimeZone: date.timeZone,
      createdAt: FieldValue.serverTimestamp()
    });
    const history = Array.isArray(app.statusHistory) ? app.statusHistory : [];
    transaction.update(appRef, {
      status: 'TTE_PENDING', draftNumber: number, numberReservationId: reservationId, verificationToken,
      storageStatus: 'NOT_CONFIGURED', approval: { decision: 'APPROVED', note: decisionNote, actorUid: actor.uid, actorRole: 'KADIS', approvedAt: FieldValue.serverTimestamp() },
      statusHistory: [...history, { from: 'KADIS_REVIEW', to: 'TTE_PENDING', actorUid: actor.uid, actorRole: 'KADIS', note: decisionNote, at: new Date().toISOString() }].slice(-50),
      updatedAt: FieldValue.serverTimestamp()
    });
    return { status: 'TTE_PENDING', number, reservationId, alreadyReserved: false };
  });
}

async function markUploading(applicationId, actor) {
  const ref = db.collection('skpt_applications').doc(applicationId);
  return db.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error('Permohonan SKPT tidak ditemukan.');
    const app = snap.data();
    if (!['TTE_PENDING', 'TTE_REJECTED'].includes(app.status)) throw new Error(`Status ${app.status} tidak dapat menerima PDF TTE.`);
    if (app.approval?.decision !== 'APPROVED') throw new Error('Persetujuan Kadis belum lengkap.');
    const revision = Math.max(1, Number(app.activeStorage?.revision || 0) + 1);
    transaction.update(ref, { status: 'TTE_UPLOADING', storageStatus: 'UPLOADING', updatedAt: FieldValue.serverTimestamp() });
    return { ...app, id: snap.id, revision };
  });
}

async function recordUploaded(applicationId, storage, actor) {
  const ref = db.collection('skpt_applications').doc(applicationId);
  await db.runTransaction(async transaction => {
    const snap = await transaction.get(ref); const app = snap.data();
    if (!snap.exists || app.status !== 'TTE_UPLOADING') throw new Error('Status aplikasi berubah selama unggah PDF.');
    const history = Array.isArray(app.statusHistory) ? app.statusHistory : [];
    transaction.update(ref, {
      status: 'TTE_UPLOADED', storageStatus: 'VERIFIED', activeStorage: storage,
      statusHistory: [...history, { from: 'TTE_UPLOADING', to: 'TTE_UPLOADED', actorUid: actor.uid, actorRole: actor.role, note: 'PDF TTE terverifikasi di Google Drive.', at: new Date().toISOString() }].slice(-50),
      updatedAt: FieldValue.serverTimestamp()
    });
  });
}

async function finalize(applicationId, actor, officialReference = '') {
  const appRef = db.collection('skpt_applications').doc(applicationId);
  return db.runTransaction(async transaction => {
    const appSnap = await transaction.get(appRef);
    if (!appSnap.exists) throw new Error('Permohonan SKPT tidak ditemukan.');
    const app = appSnap.data();
    if (app.status === 'ISSUED' && app.skptDocumentId) return { documentId: app.skptDocumentId, verificationToken: app.verificationToken, alreadyIssued: true };
    if (app.status !== 'TTE_UPLOADED' || app.activeStorage?.syncStatus !== 'VERIFIED') throw new Error('PDF TTE belum berstatus terverifikasi.');
    const storedBytes = Number(app.activeStorage.binaryBytes || 0);
    if (storedBytes <= 100 || storedBytes > MAX_PDF_BYTES) throw new Error('Ukuran arsip PDF terverifikasi tidak valid.');
    if (!/^[a-f0-9]{64}$/.test(String(app.activeStorage.documentHash || ''))) throw new Error('Hash arsip PDF tidak valid.');
    if (!app.draftNumber || !app.numberReservationId || !/^[a-f0-9]{32}$/.test(String(app.verificationToken || ''))) throw new Error('Nomor reservasi atau token verifikasi tidak lengkap.');

    const [traderSnap, claimSnap, unitSnap, reservationSnap, settingsSnap] = await Promise.all([
      transaction.get(db.collection('traders').doc(app.traderId)),
      transaction.get(db.collection('market_claims').doc(app.claimId)),
      transaction.get(db.collection('market_units').doc(app.marketUnitId)),
      transaction.get(db.collection('skpt_number_reservations').doc(app.numberReservationId)),
      transaction.get(db.collection('app_settings').doc('general'))
    ]);
    if (!traderSnap.exists || !claimSnap.exists || !unitSnap.exists || !reservationSnap.exists) throw new Error('Relasi pedagang, klaim, unit, atau reservasi belum lengkap.');
    const trader = traderSnap.data(), claim = claimSnap.data(), unit = unitSnap.data(), reservation = reservationSnap.data();
    if (reservation.status !== 'RESERVED' || reservation.applicationId !== applicationId || reservation.number !== app.draftNumber) throw new Error('Reservasi nomor tidak konsisten.');
    const now = new Date(); const issueDate = now.toISOString();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const documentId = `SKPT-${applicationId}`;
    const signatory = settings.signatory || {};
    const documentSnapshot = {
      displayName: trader.displayName || app.applicantSnapshot?.displayName || '',
      address: trader.address || app.applicantSnapshot?.address || '',
      businessType: trader.businessType || app.applicantSnapshot?.businessType || '',
      marketId: app.marketId, marketName: claim.marketName || app.marketName || app.marketId,
      unitType: unit.unitType || '', unitNumber: unit.unitNumber || '', block: unit.block || '', floor: unit.floor || '', areaM2: unit.areaM2 ?? null
    };
    const document = {
      skptId: documentId, applicationId, number: app.draftNumber, traderId: app.traderId,
      marketUnitId: app.marketUnitId, issueDate, validUntil: addYearsIso(now, settings.legalBasis?.validityYears || 2),
      status: 'ISSUED', tteStatus: 'VERIFIED', documentHash: app.activeStorage.documentHash,
      hashAlgorithm: 'SHA-256', hashScope: 'PDF_BINARY', activeStorage: app.activeStorage,
      documentSnapshot, signatory, annualValidations: [], officialReference: String(officialReference || '').slice(0, 160),
      verificationToken: app.verificationToken, legalBasisVersion: 'PINRANG-SKPT-PERDA6-2024-V1',
      environment: 'PROD', isDemo: false, schemaVersion: 3, issuedBy: actor.uid,
      issuedAt: FieldValue.serverTimestamp()
    };
    transaction.create(db.collection('skpt_documents').doc(documentId), document);
    transaction.create(db.collection('public_skpt_verification').doc(app.verificationToken), {
      verificationToken: app.verificationToken, documentId, applicationId, number: document.number,
      displayName: documentSnapshot.displayName, status: 'ISSUED', traderId: app.traderId,
      marketUnitId: app.marketUnitId, issueDate: document.issueDate, validUntil: document.validUntil,
      documentHash: document.documentHash, hashAlgorithm: document.hashAlgorithm, hashScope: document.hashScope,
      tteStatus: 'VERIFIED', documentSnapshot, signatory, annualValidations: [],
      officialReference: document.officialReference, environment: 'PROD', isDemo: false, schemaVersion: 3
    });
    const history = Array.isArray(app.statusHistory) ? app.statusHistory : [];
    transaction.update(appRef, { status: 'ISSUED', skptDocumentId: documentId, statusHistory: [...history, { from: 'TTE_UPLOADED', to: 'ISSUED', actorUid: actor.uid, actorRole: actor.role, note: 'Penerbitan final oleh backend.', at: issueDate }].slice(-50), updatedAt: FieldValue.serverTimestamp() });
    transaction.update(db.collection('skpt_number_reservations').doc(app.numberReservationId), { status: 'ISSUED', issuedAt: FieldValue.serverTimestamp() });
    if (app.publicToken) transaction.update(db.collection('public_status').doc(app.publicToken), { status: 'ISSUED' });
    transaction.set(db.collection('public_stats').doc('summary'), { issuedSkpt: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { documentId, verificationToken: app.verificationToken, alreadyIssued: false };
  });
}

const server = http.createServer(async (request, response) => {
  cors(request, response);
  if (request.method === 'OPTIONS') return response.end();
  if (request.method === 'GET' && request.url === '/healthz') return json(response, 200, { ok: true, storage: folderId ? 'configured' : 'missing' });
  const uploadMatch = request.url?.match(/^\/v1\/skpt\/([^/?]+)\/upload-tte$/);
  const finalizeMatch = request.url?.match(/^\/v1\/skpt\/([^/?]+)\/finalize$/);
  const approveMatch = request.url?.match(/^\/v1\/skpt\/([^/?]+)\/approve-tte$/);
  try {
    if (request.method !== 'POST' || (!uploadMatch && !finalizeMatch && !approveMatch)) return json(response, 404, { error: 'Endpoint tidak ditemukan.' });
    const actor = await actorFromRequest(request);
    const applicationId = decodeURIComponent((uploadMatch || finalizeMatch || approveMatch)[1]);
    if (approveMatch) {
      const payload = await parseJson(request);
      const result = await approveForTte(applicationId, actor, payload.note);
      return json(response, 200, { ok: true, ...result });
    }
    if (uploadMatch) {
      if (!folderId) throw new Error('GOOGLE_DRIVE_SKPT_FOLDER_ID belum dikonfigurasi.');
      const payload = await parseMultipart(request); requirePdf(payload.buffer, payload.mimeType);
      const app = await markUploading(applicationId, actor);
      let storage;
      try {
        storage = await uploadAndVerifyPdf({ buffer: payload.buffer, mimeType: payload.mimeType, fileName: safeFileName(app.draftNumber, applicationId, app.revision), folderId, revision: app.revision });
        await recordUploaded(applicationId, storage, actor);
      } catch (uploadError) {
        await db.collection('skpt_applications').doc(applicationId).update({
          status: 'TTE_PENDING', storageStatus: 'FAILED',
          lastStorageError: String(uploadError.message || 'Unggah gagal').slice(0, 300),
          updatedAt: FieldValue.serverTimestamp()
        }).catch(() => {});
        throw uploadError;
      }
      return json(response, 200, { ok: true, applicationId, status: 'TTE_UPLOADED', storage: { ...storage, location: undefined } });
    }
    const result = await finalize(applicationId, actor, request.headers['x-official-reference'] || '');
    return json(response, 200, { ok: true, status: 'ISSUED', ...result });
  } catch (error) {
    console.error(error);
    return json(response, /token|akses|Kepala Dinas/i.test(error.message) ? 403 : 400, { error: error.message });
  }
});

server.listen(port, () => console.log(`e-PASAR SKPT backend listening on ${port}`));
