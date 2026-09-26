const fs = require('fs');
const crypto = require('crypto');

const password = process.env.EPASAR_UAT_PASSWORD;
if (!password) throw new Error('EPASAR_UAT_PASSWORD wajib tersedia di environment lokal.');
const text = fs.readFileSync('js/epasar/firebase-config.local.js', 'utf8');
const cfg = Function(`return (${text.match(/EPASAR_FIREBASE_CONFIG\s*=\s*(\{[\s\S]*?\})/)[1]})`)();
const root = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents`;
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

(async () => {
  const login = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cfg.apiKey}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'kepala.pasar-sentral-pinrang@eskpt.id', password, returnSecureToken: true }) });
  const loginData = await login.json();
  if (!login.ok) throw new Error(JSON.stringify(loginData));
  const token = loginData.idToken;
  const unitNumber = 'UAT-25064124';
  const unitId = `UNT-${crypto.createHash('sha256').update(`PASAR-SENTRAL-PINRANG|KIOS|${unitNumber}`).digest('hex').slice(0, 24).toUpperCase()}`;
  const data = { unitId, marketId: 'pasar-sentral-pinrang', unitType: 'KIOS', unitNumber, block: 'UAT', floor: '1', areaM2: 6, qrUnitToken: crypto.randomUUID().replaceAll('-', ''), status: 'AVAILABLE', currentTraderId: '', currentOccupancyId: '', schemaVersion: 1, createdAt: now(), updatedAt: now() };
  const response = await fetch(`${root}/market_units/${unitId}`, { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ fields: fields(data) }) });
  console.log(JSON.stringify({ status: response.status, body: await response.text(), unitId }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
