const fs = require('node:fs');
const path = require('node:path');

const PROJECT = 'e-skpt';
const PASSWORD = process.env.EPASAR_UPTD_INITIAL_PASSWORD || '';
const ACCOUNTS = [
  {
    username: 'kepala.uptd.wilayah.1',
    email: 'kepala.uptd.wilayah.1@eskpt.id',
    displayName: 'Kepala UPTD Wilayah I',
    position: 'Kepala UPTD Pengelolaan Pasar Wilayah I',
    marketIds: ['MKT-001', 'MKT-002', 'MKT-005', 'MKT-007', 'MKT-009', 'MKT-011']
  },
  {
    username: 'kepala.uptd.wilayah.2',
    email: 'kepala.uptd.wilayah.2@eskpt.id',
    displayName: 'Kepala UPTD Wilayah II',
    position: 'Kepala UPTD Pengelolaan Pasar Wilayah II',
    marketIds: ['MKT-003', 'MKT-004', 'MKT-006', 'MKT-008', 'MKT-010']
  }
];

if (PASSWORD.length < 8) throw new Error('EPASAR_UPTD_INITIAL_PASSWORD minimal 8 karakter wajib tersedia.');

const cliConfig = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
const accessToken = cliConfig.tokens?.access_token;
if (!accessToken || Number(cliConfig.tokens?.expires_at || 0) < Date.now() + 60_000) throw new Error('Sesi Firebase CLI perlu diperbarui.');

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${data.error?.message || response.statusText}`);
  return data;
}

const authUrl = action => `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:${action}`;
const firestoreRoot = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)`;
const str = value => ({ stringValue: String(value) });
const timestamp = value => ({ timestampValue: value });
const array = values => ({ arrayValue: { values: values.map(str) } });

function profileFields(account, uid, now) {
  return {
    uid: str(uid), username: str(account.username), displayName: str(account.displayName), position: str(account.position),
    role: str('UPTD_HEAD'), marketIds: array(account.marketIds), marketDirectoryScoped: { booleanValue: true },
    status: str('ACTIVE'), phone: str(''), photoMediaId: { nullValue: null }, schemaVersion: { integerValue: '1' },
    createdAt: timestamp(now), updatedAt: timestamp(now)
  };
}

async function allAuthUsers() {
  const users = [];
  let nextPageToken = '';
  do {
    const url = new URL(authUrl('batchGet'));
    url.searchParams.set('maxResults', '1000');
    if (nextPageToken) url.searchParams.set('nextPageToken', nextPageToken);
    const data = await request(url);
    users.push(...(data.users || []));
    nextPageToken = data.nextPageToken || '';
  } while (nextPageToken);
  return users;
}

async function deleteCreated(created) {
  for (const row of created) {
    try { await request(authUrl('delete'), { method: 'POST', body: JSON.stringify({ localId: row.uid }) }); }
    catch (error) { console.error(`ROLLBACK GAGAL ${row.email}: ${error.message}`); }
  }
}

(async () => {
  const existing = await allAuthUsers();
  const byEmail = new Map(existing.map(user => [String(user.email || '').toLowerCase(), user]));
  const created = [];
  const resolved = [];
  try {
    for (const account of ACCOUNTS) {
      let user = byEmail.get(account.email);
      if (!user) {
        user = await request(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts`, {
          method: 'POST', body: JSON.stringify({ email: account.email, password: PASSWORD, displayName: account.displayName, returnSecureToken: false })
        });
        if (!user.localId) throw new Error(`Firebase tidak mengembalikan UID untuk ${account.email}.`);
        created.push({ email: account.email, uid: user.localId });
      }
      resolved.push({ ...account, uid: user.localId, authCreated: !byEmail.has(account.email) });
    }

    const now = new Date().toISOString();
    const writes = resolved.flatMap(account => [
      {
        update: {
          name: `projects/${PROJECT}/databases/(default)/documents/users/${account.uid}`,
          fields: profileFields(account, account.uid, now)
        },
        updateMask: { fieldPaths: Object.keys(profileFields(account, account.uid, now)) }
      },
      {
        update: {
          name: `projects/${PROJECT}/databases/(default)/documents/login_aliases/${account.username}`,
          fields: { uid: str(account.uid), status: str('ACTIVE'), updatedAt: timestamp(now) }
        },
        updateMask: { fieldPaths: ['uid', 'status', 'updatedAt'] }
      }
    ]);
    await request(`${firestoreRoot}/documents:commit`, { method: 'POST', body: JSON.stringify({ writes }) });

    for (const account of resolved) {
      const document = await request(`${firestoreRoot}/documents/users/${account.uid}`);
      const fields = document.fields || {};
      const actualMarkets = (fields.marketIds?.arrayValue?.values || []).map(value => value.stringValue);
      if (fields.role?.stringValue !== 'UPTD_HEAD' || fields.status?.stringValue !== 'ACTIVE'
        || JSON.stringify(actualMarkets) !== JSON.stringify(account.marketIds)) throw new Error(`Verifikasi profil gagal untuk ${account.email}.`);
    }
    console.log(JSON.stringify(resolved.map(account => ({ email: account.email, uid: account.uid, role: 'UPTD_HEAD', marketIds: account.marketIds, authCreated: account.authCreated })), null, 2));
  } catch (error) {
    if (created.length) await deleteCreated(created);
    throw error;
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
