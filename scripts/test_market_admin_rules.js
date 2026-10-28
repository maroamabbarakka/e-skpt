'use strict';

const project = 'demo-epasar';
const firestorePort = process.env.FIRESTORE_EMULATOR_PORT || '8091';
const authPort = process.env.FIREBASE_AUTH_EMULATOR_PORT || '9099';
const firestore = `http://127.0.0.1:${firestorePort}/v1/projects/${project}/databases/(default)/documents`;
const auth = `http://127.0.0.1:${authPort}/identitytoolkit.googleapis.com/v1/accounts`;

function value(input) {
  if (Array.isArray(input)) return { arrayValue: { values: input.map(value) } };
  if (typeof input === 'boolean') return { booleanValue: input };
  if (typeof input === 'number') return { integerValue: String(input) };
  return { stringValue: String(input) };
}
function fields(input) { return { fields: Object.fromEntries(Object.entries(input).map(([key, item]) => [key, value(item)])) }; }
async function request(url, options = {}) {
  const response = await fetch(url, options);
  return { status: response.status, body: await response.text() };
}
async function createUser(email) {
  const result = await request(`${auth}:signUp?key=fake-api-key`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'ScopeTest2026!', returnSecureToken: true }) });
  if (result.status !== 200) throw new Error(`Auth seed gagal: ${result.status} ${result.body}`);
  return JSON.parse(result.body);
}
async function seed(path, data) {
  const result = await request(`${firestore}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' }, body: JSON.stringify(fields(data)) });
  if (result.status !== 200) throw new Error(`Seed ${path} gagal: ${result.status} ${result.body}`);
}
async function get(path, token) { return request(`${firestore}/${path}`, { headers: { Authorization: `Bearer ${token}` } }); }
async function updateDelivery(path, token) {
  const mask = ['deliveryStatus','status','dispatchedBy','dispatchedRole','dispatchedPhone','dispatchedAt'].map(field => `updateMask.fieldPaths=${field}`).join('&');
  return request(`${firestore}/${path}?${mask}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(fields({ deliveryStatus: 'WHATSAPP_OPENED', status: 'READ', dispatchedBy: 'test', dispatchedRole: 'MARKET_ADMIN', dispatchedPhone: '628123456789', dispatchedAt: 'test' })) });
}
async function scopedQuery(token, marketId) {
  return request(`${firestore}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'trader_intake' }],
      where: { fieldFilter: { field: { fieldPath: 'routingMarketIds' }, op: 'ARRAY_CONTAINS', value: { stringValue: marketId } } }
    } })
  });
}

async function main() {
  const first = await createUser('wilayah1@example.test');
  const second = await createUser('wilayah2@example.test');
  const inactive = await createUser('inactive@example.test');
  await seed(`users/${first.localId}`, { uid: first.localId, role: 'MARKET_ADMIN', status: 'ACTIVE', marketIds: ['MKT-001'], schemaVersion: 1 });
  await seed(`users/${second.localId}`, { uid: second.localId, role: 'MARKET_ADMIN', status: 'ACTIVE', marketIds: ['MKT-010'], schemaVersion: 1 });
  await seed(`users/${inactive.localId}`, { uid: inactive.localId, role: 'MARKET_ADMIN', status: 'INACTIVE', marketIds: ['MKT-001'], schemaVersion: 1 });
  await seed('trader_intake/intake-bungi', { status: 'SUBMITTED', routingMarketIds: ['MKT-001'] });
  await seed('trader_intake/intake-sentral', { status: 'SUBMITTED', routingMarketIds: ['MKT-010'] });
  await seed('notifications/notification-bungi', { type: 'TRADER_DECISION', deliveryStatus: 'PENDING_ADMIN', status: 'UNREAD', marketId: 'MKT-001', routingMarketIds: ['MKT-001'] });
  await seed('notifications/notification-sentral', { type: 'TRADER_DECISION', deliveryStatus: 'PENDING_ADMIN', status: 'UNREAD', marketId: 'MKT-010', routingMarketIds: ['MKT-010'] });
  const own = await get('trader_intake/intake-bungi', first.idToken);
  const foreign = await get('trader_intake/intake-sentral', first.idToken);
  const secondOwn = await get('trader_intake/intake-sentral', second.idToken);
  const disabled = await get('trader_intake/intake-bungi', inactive.idToken);
  const ownQuery = await scopedQuery(first.idToken, 'MKT-001');
  const foreignQuery = await scopedQuery(first.idToken, 'MKT-010');
  const ownNotification = await get('notifications/notification-bungi', first.idToken);
  const foreignNotification = await get('notifications/notification-sentral', first.idToken);
  const disabledNotification = await get('notifications/notification-bungi', inactive.idToken);
  const updateOwnNotification = await updateDelivery('notifications/notification-bungi', first.idToken);
  const updateForeignNotification = await updateDelivery('notifications/notification-sentral', first.idToken);
  if (own.status !== 200) throw new Error(`Scope sendiri ditolak: ${own.status} ${own.body}`);
  if (foreign.status !== 403) throw new Error(`Scope wilayah lain tidak ditolak: ${foreign.status}`);
  if (secondOwn.status !== 200) throw new Error(`Scope Wilayah II ditolak: ${secondOwn.status}`);
  if (disabled.status !== 403) throw new Error(`Profil INACTIVE masih dapat membaca intake: ${disabled.status}`);
  if (ownQuery.status !== 200) throw new Error(`Query scope sendiri ditolak: ${ownQuery.status} ${ownQuery.body}`);
  if (foreignQuery.status !== 200) throw new Error(`Query list aktif gagal: ${foreignQuery.status}`);
  if (ownNotification.status !== 200 || updateOwnNotification.status !== 200) throw new Error(`Notifikasi scope sendiri gagal: ${ownNotification.status}/${updateOwnNotification.status}`);
  if (foreignNotification.status !== 403 || updateForeignNotification.status !== 403) throw new Error(`Notifikasi lintas wilayah tidak ditolak: ${foreignNotification.status}/${updateForeignNotification.status}`);
  if (disabledNotification.status !== 403) throw new Error(`Profil INACTIVE masih dapat membaca notifikasi: ${disabledNotification.status}`);
  console.log('PASS Firestore MARKET_ADMIN intake/notification boundaries and INACTIVE profile rules');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
