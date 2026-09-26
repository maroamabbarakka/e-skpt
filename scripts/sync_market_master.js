/* Sync the official market master to Firestore without storing credentials.
   Uses an active Firebase CLI session, or optional EPASAR_ADMIN_EMAIL and
   EPASAR_ADMIN_PASSWORD environment variables. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const markets = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'data', 'markets.json'), 'utf8'));
const configText = fs.readFileSync(path.join(root, 'js', 'epasar', 'firebase-config.local.js'), 'utf8');
const configMatch = configText.match(/EPASAR_FIREBASE_CONFIG\s*=\s*(\{.*\})\s*;/s);
if (!configMatch) throw new Error('Konfigurasi Firebase lokal tidak ditemukan.');
const config = Function(`"use strict";return (${configMatch[1]})`)();
const email = process.env.EPASAR_ADMIN_EMAIL;
const password = process.env.EPASAR_ADMIN_PASSWORD;

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `${response.status} ${response.statusText}`);
  return body;
}
function fields(market) {
  return { fields: {
    marketId: { stringValue: market.id }, name: { stringValue: market.name },
    status: { stringValue: market.status || 'ACTIVE' }, schemaVersion: { integerValue: '1' },
    updatedAt: { timestampValue: new Date().toISOString() }
  } };
}
(async () => {
  if (!Array.isArray(markets) || markets.length !== 11) throw new Error('Master lokal harus tepat berisi 11 pasar.');
  const ids = new Set(markets.map(market => market.id));
  for (let number = 1; number <= 11; number += 1) if (!ids.has(`MKT-${String(number).padStart(3, '0')}`)) throw new Error(`Master kehilangan MKT-${String(number).padStart(3, '0')}.`);
  let bearer;
  if (email && password) {
    const login = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
    bearer = login.idToken;
  } else {
    const firebaseToolsLib = path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools', 'lib');
    const { configstore } = require(path.join(firebaseToolsLib, 'configstore.js'));
    const firebaseAuth = require(path.join(firebaseToolsLib, 'auth.js'));
    const refreshToken = configstore.get('tokens')?.refresh_token;
    if (!refreshToken) throw new Error('Login Firebase CLI tidak ditemukan. Jalankan firebase login atau isi environment akun admin.');
    const cliToken = await firebaseAuth.getAccessToken(refreshToken, ['https://www.googleapis.com/auth/cloud-platform']);
    bearer = cliToken.access_token;
  }
  for (const market of markets) {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/markets/${market.id}?updateMask.fieldPaths=marketId&updateMask.fieldPaths=name&updateMask.fieldPaths=status&updateMask.fieldPaths=schemaVersion&updateMask.fieldPaths=updatedAt`;
    await request(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` }, body: JSON.stringify(fields(market)) });
  }
  console.log(`PASS: ${markets.length} master pasar tersinkron ke project ${config.projectId}.`);
})().catch(error => { console.error(`FAIL: ${error.message}`); process.exitCode = 1; });
