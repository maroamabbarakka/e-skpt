const fs = require('fs');
const crypto = require('crypto');

throw new Error(
  'Skrip REST lama ini dinonaktifkan. Penerbitan dokumen UAT wajib dilakukan melalui dashboard Kadis agar perubahan status, dokumen privat, dan data verifikasi publik ditulis dalam satu batch atomik.'
);

const password = process.env.EPASAR_UAT_PASSWORD;
if (!password) throw new Error('EPASAR_UAT_PASSWORD wajib tersedia di environment lokal.');
const configText = fs.readFileSync('js/epasar/firebase-config.local.js', 'utf8');
const config = Function(`return (${configText.match(/EPASAR_FIREBASE_CONFIG\s*=\s*(\{[\s\S]*?\})/)[1]})`)();
const root = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;
const run = '20260925064124';
const claimId = 'RnkLoT3NqbpEYc0DBLNQ';
const applicationId = 'w2Ph7rXYx9wvCgcP4aRr';
const intakeId = 'JHQCyYDYSvZTf1OYkoxS';
const traderId = 'PDG-PIN-26-JWG7Q5';
const publicToken = '6f81f6e33bc6e5b2ab60655da623c0b6b1f85a2a6a4267fee75c2a276229d634';
const photoMediaToken = '3e6e71e28fff4a0092c2b4f2113b19b1';
const unitId = 'UNT-DEC82D6C265F2D56AA6C082E';
const number = `SKPT-UAT-${run}`;
const marketId = 'pasar-sentral-pinrang';
const now = () => new Date().toISOString();
const field = value => {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(field) } };
  if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, field(item)])) } };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  return { stringValue: String(value) };
};
const fields = row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, field(value)]));
async function signIn(email) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const data = await response.json();
  if (!response.ok) throw new Error(`Login ${email}: ${data.error?.message || JSON.stringify(data)}`);
  return data;
}
async function request(token, method, path, body) {
  const response = await fetch(`${root}/${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
async function patch(token, path, data, mask) {
  const query = mask.map(key => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join('&');
  return request(token, 'PATCH', `${path}?${query}`, { fields: fields(data) });
}

(async () => {
  const market = await signIn('kepala.pasar-sentral-pinrang@eskpt.id');
  const occupancyId = `OCC-UAT-${run}`;
  const recordId = `VER-UAT-${run}`;
  const verified = { marketId, unitId, unitNumber: 'UAT-25064124', block: 'UAT', floor: '1', areaM2: 6, unitType: 'KIOS', actualUser: 'Pedagang Uji Alur 064124', conflict: false };
  const verificationReason = 'Nomor unit, blok, lantai, luas, dan pengguna aktual telah diperiksa untuk UAT internal.';
  await patch(market.idToken, `market_units/${unitId}`, { status: 'OCCUPIED', currentTraderId: traderId, currentOccupancyId: occupancyId, updatedAt: now() }, ['status', 'currentTraderId', 'currentOccupancyId', 'updatedAt']);
  await request(market.idToken, 'PATCH', `market_occupancies/${occupancyId}`, { fields: fields({ occupancyId, marketUnitId: unitId, marketId, traderId, claimId, status: 'ACTIVE', startedAt: now(), endedAt: null, createdBy: market.localId, schemaVersion: 1 }) });
  await patch(market.idToken, `market_claims/${claimId}`, { verified, verificationStatus: 'VERIFIED', marketUnitId: unitId, updatedAt: now() }, ['verified', 'verificationStatus', 'marketUnitId', 'updatedAt']);
  await request(market.idToken, 'PATCH', `verification_records/${recordId}`, { fields: fields({ claimId, marketId, marketUnitId: unitId, before: { marketId, unitNumber: 'UAT-25064124', block: 'UAT', floor: '1', areaM2: 6, unitType: 'KIOS' }, after: verified, reason: verificationReason, actorUid: market.localId, actorRole: 'MARKET_HEAD', status: 'MARKET_VERIFIED', createdAt: now() }) });
  await patch(market.idToken, `skpt_applications/${applicationId}`, { status: 'KADIS_REVIEW', marketUnitId: unitId, verificationRecordId: recordId, updatedAt: now() }, ['status', 'marketUnitId', 'verificationRecordId', 'updatedAt']);
  await request(market.idToken, 'PATCH', `notifications/NOT-UAT-${run}`, { fields: fields({ type: 'MATERIAL_MARKET_CHANGE', recipientRole: 'KADIS', marketId, claimId, applicationId, verificationRecordId: recordId, summary: 'Data unit UAT telah diverifikasi', reason: verificationReason, actorUid: market.localId, actorRole: 'MARKET_HEAD', status: 'UNREAD', createdAt: now() }) });

  const kadis = await signIn('kadis@eskpt.id');
  const approvedAt = now();
  await patch(kadis.idToken, `skpt_applications/${applicationId}`, { status: 'TTE_PENDING', approval: { decision: 'APPROVED', note: 'Data pemohon dan hasil verifikasi telah dibandingkan untuk UAT internal.', actorUid: kadis.localId, actorRole: 'KADIS', approvedAt }, updatedAt: now() }, ['status', 'approval', 'updatedAt']);
  const issueDate = now();
  const validUntil = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString();
  const verificationToken = crypto.randomUUID().replaceAll('-', '');
  const documentId = `DOC-UAT-${run}`;
  const documentSnapshot = { displayName: 'Pedagang Uji Alur 064124', address: 'Alamat khusus pengujian internal e-PASAR', businessType: 'Warung/Kuliner', marketName: 'Pasar Sentral Pinrang', marketId, unitType: 'KIOS', unitNumber: 'UAT-25064124', block: 'UAT', floor: '1', areaM2: 6 };
  const signatory = { name: 'MUHAMMAD YUSUF NUR, S.STP', nip: '19800326 200003 1 001', rank: 'Pembina Tk. I', position: 'Kepala Dinas Perindustrian, Perdagangan, Energi dan Sumber Daya Mineral Kabupaten Pinrang', authority: 'a.n. BUPATI PINRANG' };
  const canonical = JSON.stringify({ number, traderId, claimId, issueDate, validUntil, documentSnapshot, signatory, photoMediaToken, statementVersion: 'SKPT-STATEMENT-V3-PERDA6-2024' });
  const documentHash = crypto.createHash('sha256').update(canonical).digest('hex');
  const annualValidations = [{ year: 2026, status: 'INITIAL_ISSUE', validatedAt: issueDate, reference: `UAT-INTERNAL-${run}` }, { year: 2027, status: 'DUE', validatedAt: null, reference: '' }];
  const document = { skptId: documentId, number, traderId, marketUnitId: unitId, issueDate, validUntil, status: 'ISSUED', tteStatus: 'NOT_INTEGRATED', documentHash, hashAlgorithm: 'SHA-256', hashScope: 'CANONICAL_DOCUMENT_SNAPSHOT', documentSnapshot, signatory, annualValidations, photoMediaToken, legalBasisVersion: 'PINRANG-SKPT-PERDA6-2024-V1', statementVersion: 'SKPT-STATEMENT-V3-PERDA6-2024', officialReference: `UAT-INTERNAL-${run}`, verificationToken, schemaVersion: 2, issuedBy: kadis.localId, issuedAt: now() };
  await request(kadis.idToken, 'PATCH', `skpt_documents/${documentId}`, { fields: fields(document) });
  await patch(kadis.idToken, `skpt_applications/${applicationId}`, { status: 'ISSUED', skptDocumentId: documentId, updatedAt: now() }, ['status', 'skptDocumentId', 'updatedAt']);
  await patch(kadis.idToken, `public_status/${publicToken}`, { status: 'ISSUED' }, ['status']);
  await request(kadis.idToken, 'PATCH', `public_skpt_verification/${verificationToken}`, { fields: fields({ verificationToken, number, displayName: documentSnapshot.displayName, status: 'ISSUED', traderId, marketUnitId: unitId, issueDate, validUntil, documentHash, hashAlgorithm: 'SHA-256', hashScope: 'CANONICAL_DOCUMENT_SNAPSHOT', tteStatus: 'NOT_INTEGRATED', officialReference: `UAT-INTERNAL-${run}`, documentSnapshot, signatory, annualValidations, photoMediaToken, legalBasisVersion: 'PINRANG-SKPT-PERDA6-2024-V1', environment: 'internal-uat', isDemo: false, schemaVersion: 2 }) });
  const report = { status: 'PASS', run, intakeId, traderId, claimId, applicationId, unitId, occupancyId, verificationRecordId: recordId, documentId, number, publicToken, verificationToken, statementUrl: `https://e-skpt.web.app/skpt-statement?token=${publicToken}`, cardUrl: `https://e-skpt.web.app/trader-card?token=${publicToken}`, skptUrl: `https://e-skpt.web.app/skpt-pdf?token=${verificationToken}`, verificationUrl: `https://e-skpt.web.app/verifikasi-skpt?token=${verificationToken}` };
  fs.writeFileSync(`artifacts/live-e2e-${run}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
