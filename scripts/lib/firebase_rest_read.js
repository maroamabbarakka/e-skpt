'use strict';

const fs = require('fs');
const path = require('path');

function firebaseConfig() {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'epasar', 'firebase-config.local.js'), 'utf8');
  const match = source.match(/EPASAR_FIREBASE_CONFIG\s*=\s*(\{[\s\S]*?\})/);
  if (!match) throw new Error('Konfigurasi Firebase lokal tidak ditemukan.');
  return Function(`return (${match[1]})`)();
}

function createReadClient({ email, password }) {
  if (!email || !password) throw new Error('Email dan password audit wajib tersedia di environment lokal.');
  const config = firebaseConfig();
  const root = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;

  async function authenticate() {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Autentikasi gagal.');
    return data.idToken;
  }

  function decode(value) {
    if (!value || 'nullValue' in value) return null;
    if ('stringValue' in value) return value.stringValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return Number(value.doubleValue);
    if ('booleanValue' in value) return value.booleanValue;
    if ('timestampValue' in value) return value.timestampValue;
    if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
    if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
    return null;
  }

  async function list(idToken, collectionName) {
    const rows = [];
    let pageToken = '';
    do {
      const url = `${root}/${collectionName}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const response = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(`${collectionName}: ${data.error?.message || response.status}`);
      (data.documents || []).forEach(document => rows.push({
        id: document.name.split('/').pop(),
        _updateTime: document.updateTime || '',
        ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)]))
      }));
      pageToken = data.nextPageToken || '';
    } while (pageToken);
    return rows;
  }

  return { config, root, authenticate, list };
}

module.exports = { createReadClient };
