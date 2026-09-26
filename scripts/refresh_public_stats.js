'use strict';

// Membaca data privat dengan akun staf, lalu menulis SATU dokumen agregat
// tanpa identitas pribadi. Credential wajib berasal dari environment lokal.
const fs = require('fs');
const path = require('path');
const email = process.env.EPASAR_ADMIN_EMAIL;
const password = process.env.EPASAR_ADMIN_PASSWORD;
if (!email || !password) throw new Error('EPASAR_ADMIN_EMAIL dan EPASAR_ADMIN_PASSWORD wajib tersedia di environment lokal.');

function config() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'epasar', 'firebase-config.local.js'), 'utf8');
  const match = source.match(/EPASAR_FIREBASE_CONFIG\s*=\s*(\{[\s\S]*?\})/);
  if (!match) throw new Error('Konfigurasi Firebase lokal tidak ditemukan.');
  return Function(`return (${match[1]})`)();
}
const cfg = config();
const root = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents`;

async function token() {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cfg.apiKey}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Autentikasi agregasi gagal.');
  return data.idToken;
}
function decode(value) {
  if (!value) return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
  return null;
}
function encode(value) {
  if (typeof value === 'number') return { integerValue: String(Math.max(0, Math.trunc(value))) };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map((item) => ({ mapValue: { fields: Object.fromEntries(Object.entries(item).map(([key, field]) => [key, encode(field)])) } })) } };
  throw new Error(`Tipe agregat tidak didukung: ${typeof value}`);
}
async function list(idToken, collection) {
  const rows = []; let pageToken = '';
  do {
    const url = `${root}/${collection}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(`${collection}: ${data.error?.message || response.status}`);
    (data.documents || []).forEach((document) => rows.push({ id: document.name.split('/').pop(), ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)])) }));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return rows;
}
function valid(row) { return !['REJECTED', 'CANCELLED', 'DELETED', 'INACTIVE', 'INVALID'].includes(String(row.status || '').toUpperCase()); }
function category(row) {
  const value = String(row.category || row.type || row.group || 'OTHER').trim().toUpperCase().replace(/\s+/g, '_');
  if (['MAKANAN_DAN_MINUMAN', 'MAKANAN_&_MINUMAN', 'KULINER', 'FOOD_PROCESSING'].includes(value)) return 'FOOD_PROCESSING';
  if (['PERDAGANGAN', 'DAGANG', 'TRADE'].includes(value)) return 'TRADE';
  if (['KERAJINAN', 'KRIYA', 'CRAFT', 'EKRAF_KRIYA'].includes(value)) return 'CRAFT';
  return value || 'OTHER';
}

async function write(idToken, summary) {
  const name = `projects/${cfg.projectId}/databases/(default)/documents/public_stats/summary`;
  const fields = Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, encode(value)]));
  fields.schemaVersion = { integerValue: '1' };
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents:commit`, {
    method: 'POST', headers: { Authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ writes: [{ update: { name, fields }, updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] }] })
  });
  if (!response.ok) throw new Error(`Penulisan statistik gagal: ${await response.text()}`);
}

(async () => {
  const idToken = await token();
  const [traders, documents, businesses, locations, claims, occupancies] = await Promise.all([
    list(idToken, 'traders'), list(idToken, 'skpt_documents'), list(idToken, 'businesses'),
    list(idToken, 'business_locations'), list(idToken, 'market_claims'), list(idToken, 'market_occupancies')
  ]);
  const activeTraders = traders.filter(valid);
  const traderIds = new Set(activeTraders.map((row) => row.traderId || row.id));
  const now = Date.now();
  const issued = documents.filter((row) => row.status === 'ISSUED' && (!row.validUntil || new Date(row.validUntil).getTime() >= now));
  const activeBusinesses = businesses.filter(valid);
  const activeLocations = locations.filter(valid);
  const marketIds = new Set();
  occupancies.filter((row) => row.status === 'ACTIVE').forEach((row) => row.traderId && marketIds.add(row.traderId));
  claims.filter((row) => row.verificationStatus === 'VERIFIED' || row.status === 'MARKET_VERIFIED').forEach((row) => row.traderId && marketIds.add(row.traderId));
  issued.forEach((row) => row.traderId && marketIds.add(row.traderId));
  const categoryCounts = new Map();
  activeBusinesses.forEach((row) => categoryCounts.set(category(row), (categoryCounts.get(category(row)) || 0) + 1));
  const sorted = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
  let topCategories = sorted.slice(0, 5).map(([label, count]) => ({ label, count }));
  if (sorted.length > 5) topCategories = [...sorted.slice(0, 4).map(([label, count]) => ({ label, count })), { label: 'OTHER', count: sorted.slice(4).reduce((sum, item) => sum + item[1], 0) }];
  const marketTraders = [...traderIds].filter((id) => marketIds.has(id)).length;
  const summary = {
    totalTraders: traderIds.size,
    totalIssuedSkpt: issued.length,
    totalBusinesses: activeBusinesses.length,
    totalLocations: activeLocations.length,
    totalCategories: categoryCounts.size,
    marketTraders,
    nonMarketTraders: Math.max(0, traderIds.size - marketTraders),
    topCategories
  };
  await write(idToken, summary);
  console.log(JSON.stringify({ status: 'PASS', summary }, null, 2));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
