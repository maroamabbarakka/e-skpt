'use strict';

const fs = require('fs');
const configSource = fs.readFileSync('js/epasar/firebase-config.local.js', 'utf8');
const config = Function(`return (${configSource.match(/EPASAR_FIREBASE_CONFIG\s*=\s*(\{[\s\S]*?\})/)[1]})`)();
const password = process.env.EPASAR_SMOKE_PASSWORD;
if (!password) throw new Error('EPASAR_SMOKE_PASSWORD wajib tersedia.');
const root = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;

async function login(email) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const data = await response.json();
  if (!response.ok) throw new Error(`${email}: ${data.error?.message || response.status}`);
  return data.idToken;
}
function decode(value) {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  return null;
}
async function query(token, markets) {
  const body = { structuredQuery: { from: [{ collectionId: 'trader_intake' }], where: { compositeFilter: { op: 'AND', filters: [
    { fieldFilter: { field: { fieldPath: 'status' }, op: 'IN', value: { arrayValue: { values: [{ stringValue: 'SUBMITTED' }, { stringValue: 'CORRECTION_REQUIRED' }] } } } },
    { fieldFilter: { field: { fieldPath: 'routingMarketIds' }, op: 'ARRAY_CONTAINS_ANY', value: { arrayValue: { values: markets.map(value => ({ stringValue: value })) } } } }
  ] } }, orderBy: [{ field: { fieldPath: 'submittedAt' }, direction: 'DESCENDING' }], limit: 20 } };
  const response = await fetch(`${root}:runQuery`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Query gagal ${response.status}: ${text}`);
  return JSON.parse(text).filter(row => row.document).map(row => ({ id: row.document.name.split('/').pop(), routingMarketIds: decode(row.document.fields.routingMarketIds) || [] }));
}
async function get(token, id) { return fetch(`${root}/trader_intake/${id}`, { headers: { Authorization: `Bearer ${token}` } }); }

(async () => {
  const cases = [
    { email: 'admin.wilayah.1@eskpt.id', markets: ['MKT-001','MKT-002','MKT-005','MKT-007','MKT-009','MKT-011'] },
    { email: 'admin.wilayah.2@eskpt.id', markets: ['MKT-003','MKT-004','MKT-006','MKT-008','MKT-010'] }
  ];
  const sessions = [];
  for (const item of cases) {
    const token = await login(item.email);
    const rows = await query(token, item.markets);
    if (!rows.length || rows.some(row => !row.routingMarketIds.some(marketId => item.markets.includes(marketId)))) throw new Error(`${item.email}: hasil antrean kosong atau keluar scope.`);
    sessions.push({ ...item, token, rows });
  }
  const foreignOne = sessions[1].rows.find(row => !row.routingMarketIds.some(id => sessions[0].markets.includes(id)));
  const foreignTwo = sessions[0].rows.find(row => !row.routingMarketIds.some(id => sessions[1].markets.includes(id)));
  if (!foreignOne || !foreignTwo) throw new Error('Sampel lintas wilayah tidak tersedia.');
  const denyOne = await get(sessions[0].token, foreignOne.id);
  const denyTwo = await get(sessions[1].token, foreignTwo.id);
  const inactiveToken = await login('admin.pasar@eskpt.id');
  const inactive = await get(inactiveToken, foreignOne.id);
  if (denyOne.status !== 403 || denyTwo.status !== 403 || inactive.status !== 403) throw new Error(`Boundary gagal: ${denyOne.status}/${denyTwo.status}/${inactive.status}`);
  console.log(JSON.stringify({ status: 'PASS', areaOneRows: sessions[0].rows.length, areaTwoRows: sessions[1].rows.length, crossScopeGet: [denyOne.status, denyTwo.status], inactiveGet: inactive.status }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
