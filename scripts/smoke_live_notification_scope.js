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
async function notifications(token) {
  const body = { structuredQuery: { from: [{ collectionId: 'notifications' }], where: { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'TRADER_DECISION' } } }, limit: 100 } };
  const response = await fetch(`${root}:runQuery`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Query notifikasi gagal ${response.status}: ${text}`);
  return JSON.parse(text).filter(row => row.document).map(row => ({ id: row.document.name.split('/').pop(), marketId: decode(row.document.fields.marketId), routingMarketIds: decode(row.document.fields.routingMarketIds) || [] }));
}
async function get(token, id) { return fetch(`${root}/notifications/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } }); }

(async () => {
  const cases = [
    { email: 'admin.wilayah.1@eskpt.id', markets: ['MKT-001','MKT-002','MKT-005','MKT-007','MKT-009','MKT-011'] },
    { email: 'admin.wilayah.2@eskpt.id', markets: ['MKT-003','MKT-004','MKT-006','MKT-008','MKT-010'] }
  ];
  const results = [];
  for (const item of cases) {
    const token = await login(item.email);
    const rows = await notifications(token);
    const routed = rows.filter(row => row.routingMarketIds.length || row.marketId);
    let own = 0, denied = 0;
    for (const row of routed) {
      const route = row.routingMarketIds.length ? row.routingMarketIds : [row.marketId];
      const expectedOwn = route.some(id => item.markets.includes(id));
      const response = await get(token, row.id);
      if (expectedOwn && response.status === 200) own += 1;
      else if (!expectedOwn && response.status === 403) denied += 1;
      else throw new Error(`${item.email}: batas notifikasi ${row.id} tidak sesuai (${response.status}, expectedOwn=${expectedOwn}).`);
    }
    results.push({ email: item.email, routedNotifications: routed.length, ownReadable: own, foreignDenied: denied });
  }
  console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
