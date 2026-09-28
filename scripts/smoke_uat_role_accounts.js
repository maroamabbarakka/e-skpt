'use strict';

const fs = require('fs');
const path = require('path');

const base = process.env.EPASAR_UAT_BASE || 'http://127.0.0.1:8090';
const password = process.env.EPASAR_UAT_PASSWORD;
if (!password) throw new Error('EPASAR_UAT_PASSWORD wajib diisi melalui environment lokal.');

const accounts = [
  'superadmin@eskpt.id',
  'kadis@eskpt.id',
  'kepala.pasar-bungi@eskpt.id',
  'kepala.pasar-cempa@eskpt.id',
  'kepala.pasar-kampung-jaya@eskpt.id',
  'kepala.pasar-kariango@eskpt.id',
  'kepala.pasar-langnga@eskpt.id',
  'kepala.pasar-lanrisang@eskpt.id',
  'kepala.pasar-leppangang@eskpt.id',
  'kepala.pasar-marawi@eskpt.id',
  'kepala.pasar-pekkabata@eskpt.id',
  'kepala.pasar-sentral-pinrang@eskpt.id',
  'kepala.pasar-teppo@eskpt.id'
];

const configSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'epasar', 'firebase-config.local.js'), 'utf8');
const configMatch = configSource.match(/EPASAR_FIREBASE_CONFIG\s*=\s*(\{[\s\S]*?\})/);
if (!configMatch) throw new Error('Konfigurasi Firebase lokal tidak ditemukan.');
const config = Function(`return (${configMatch[1]})`)();

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  return null;
}

async function inspectAccount(email) {
  try {
    const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const auth = await authResponse.json();
    if (!authResponse.ok) throw new Error(auth.error?.message || 'Login gagal');
    const profileResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/users/${auth.localId}`, {
      headers: { Authorization: `Bearer ${auth.idToken}` }
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok) throw new Error(profile.error?.message || 'Profil tidak dapat dibaca');
    const fields = Object.fromEntries(Object.entries(profile.fields || {}).map(([key, value]) => [key, decodeValue(value)]));
    return { email, ok: true, role: fields.role, marketIds: fields.marketIds || [] };
  } catch (error) {
    return { email, ok: false, error: error.message };
  }
}

(async () => {
  const results = await Promise.all(accounts.map(inspectAccount));
  console.log(JSON.stringify(results, null, 2));
  if (results.some(item => !item.ok)) process.exitCode = 2;
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
