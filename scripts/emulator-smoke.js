const base = 'http://127.0.0.1:8081/v1/projects/demo-epasar/databases/(default)/documents';

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  return { status: response.status, body: await response.text() };
}

function fields(payload) {
  return {
    fields: Object.fromEntries(Object.entries(payload).map(([key, value]) => {
      if (value && value.timestampValue) return [key, value];
      if (typeof value === 'boolean') return [key, { booleanValue: value }];
      if (typeof value === 'number') return [key, { integerValue: String(value) }];
      if (Array.isArray(value)) return [key, { arrayValue: { values: value.map(item => ({ stringValue: item })) } }];
      if (typeof value === 'object') return [key, { mapValue: { fields: fields(value).fields } }];
      return [key, { stringValue: value }];
    }))
  };
}

async function main() {
  const id = `smoke-${Date.now()}`;
  const payload = {
    registrationCode: 'REG-PIN-2026-SMOKE01', submittedAt: { timestampValue: new Date().toISOString() },
    status: 'SUBMITTED', source: 'PUBLIC_FORM', schemaVersion: 1, publicToken: 'a'.repeat(32),
    identity: { name: 'Smoke Test', phone: '081234567890', district: 'Pinrang', village: 'Test', address: 'Alamat test', nik: '7315010101010001' },
    businessDrafts: ['Toko Test'], hasMarketUnit: false, applySkpt: false, statementAccepted: true,
    statement: { version: 'SKPT-STATEMENT-V2', type: 'PERNYATAAN_ELEKTRONIK_SKPT', text: 'Pernyataan smoke test', accepted: true, acceptanceMethod: 'AFFIRMATIVE_CHECKBOX' }
  };
  const createBody = fields({ ...payload, submittedAt: undefined });
  delete createBody.fields.submittedAt;
  createBody.writes = [{
    update: { name: `projects/demo-epasar/databases/(default)/documents/trader_intake/${id}`, fields: createBody.fields },
    updateTransforms: [{ fieldPath: 'submittedAt', setToServerValue: 'REQUEST_TIME' }, { fieldPath: 'statement.acceptedAt', setToServerValue: 'REQUEST_TIME' }]
  }];
  delete createBody.fields;
  const create = await request(':commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createBody) });
  if (create.status !== 200) throw new Error(`valid anonymous create failed: ${create.status} ${create.body}`);
  const read = await request(`/trader_intake/${id}`);
  if (read.status === 200) throw new Error('anonymous read unexpectedly allowed');
  const list = await request('/trader_intake');
  if (list.status === 200) throw new Error('anonymous list unexpectedly allowed');
  const malformed = await request(`/trader_intake?documentId=malformed-${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields({ status: 'APPROVED', source: 'PUBLIC_FORM' })) });
  if (malformed.status === 200) throw new Error('malformed/approved write unexpectedly allowed');
  console.log('PASS anonymous create-only/read-list/malformed emulator checks');
}

main().catch(error => { console.error(error.message); process.exit(1); });
