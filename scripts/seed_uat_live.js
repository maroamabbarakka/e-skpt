'use strict';

const fs = require('fs');
const path = require('path');
const { UAT_TAG, traders, documents, related } = require('./uat-data');

const email = process.env.EPASAR_ADMIN_EMAIL;
const password = process.env.EPASAR_ADMIN_PASSWORD;
if (!email || !password) throw new Error('Set EPASAR_ADMIN_EMAIL dan EPASAR_ADMIN_PASSWORD hanya pada environment lokal.');

function config() {
  const file = path.join(__dirname, '..', 'js', 'epasar', 'firebase-config.local.js');
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/EPASAR_FIREBASE_CONFIG\s*=\s*(\{[\s\S]*?\})/);
  if (!m) throw new Error('Konfigurasi Firebase lokal tidak ditemukan.');
  return Function(`return (${m[1]})`)();
}
const cfg = config();
const base = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents`;
async function authToken() { const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cfg.apiKey}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || 'Login seed gagal.'); return j.idToken; }
function value(v) { if (v === null) return { nullValue: null }; if (typeof v === 'boolean') return { booleanValue: v }; if (typeof v === 'number') return { integerValue: String(v) }; return { stringValue: String(v) }; }
function fields(obj) { return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, value(v)])); }
async function put(token, collection, id, data) { const { id: _documentId, ...documentData } = data; const r = await fetch(`${base}/${collection}/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ fields: fields(documentData) }) }); if (!r.ok) throw new Error(`${collection}/${id}: ${await r.text()}`); }

(async () => { const token = await authToken(); const failures = []; for (const t of traders) { await put(token, 'traders', t.id, { ...UAT_TAG, traderId: t.id, registrationCode: t.code, displayName: t.name, status: t.status, primaryMarketId: t.marketId || '' }); if (t.skpt) await put(token, 'skpt_applications', `uat-skpt-${t.id.slice(-3)}`, { ...UAT_TAG, applicationId: `uat-skpt-${t.id.slice(-3)}`, traderId: t.id, status: t.status, documentNumber: t.skpt, marketId: t.marketId || '' }); } const data = related(); for (const collection of ['businesses','business_locations','business_classifications','market_claims','market_units','market_occupancies','skpt_annual_validations','notifications','public_status','public_skpt_verification']) for (const row of data[collection]) { try { await put(token, collection, row.id, { ...UAT_TAG, ...row }); } catch (e) { failures.push(`${collection}/${row.id}: ${e.message}`); } } for (const d of documents()) await put(token, 'skpt_documents', d.id, d); console.log(`PASS seeded ${traders.length} UAT master traders, ${documents().length} UAT issued documents, public mirrors, and admin workflow records`); if (failures.length) { console.error(`WARN ${failures.length} records rejected:\n${failures.join('\n')}`); process.exitCode = 2; } })().catch((e) => { console.error(e.message); process.exitCode = 1; });
