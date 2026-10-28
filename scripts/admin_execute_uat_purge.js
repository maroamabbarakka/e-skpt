'use strict';

// Eksekutor administratif untuk plan hasil purge_uat_live.js. Jalur ini memakai
// OAuth Firebase CLI dan melewati Firestore security rules tanpa mengubah rules.
const fs = require('fs');
const path = require('path');

const planArg = process.argv.find(arg => arg.startsWith('--plan='));
if (!planArg || !process.argv.includes('--execute')) {
  throw new Error('Gunakan --execute --plan=artifacts/uat-purge-.../plan.json');
}

const planFile = path.resolve(planArg.slice('--plan='.length));
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
if (plan.total !== 1528 || plan.classification?.intakeIds !== 187 || plan.classification?.traderIds !== 55) {
  throw new Error('Guard gagal: ukuran plan tidak sama dengan hasil audit yang disetujui.');
}
if (!String(plan.backupFile || '').includes('live-inventory-20261028170153')) {
  throw new Error('Guard gagal: plan bukan berasal dari snapshot verifikasi terakhir.');
}

const authFile = path.join(process.env.USERPROFILE || '', '.config', 'configstore', 'firebase-tools.json');
const auth = JSON.parse(fs.readFileSync(authFile, 'utf8'));
if (auth.user?.email !== 'asalada09@gmail.com') throw new Error(`Akun CLI tidak sesuai: ${auth.user?.email || 'tidak diketahui'}`);
if (!auth.tokens?.access_token || Number(auth.tokens.expires_at || 0) <= Date.now()) throw new Error('Token Firebase CLI tidak tersedia atau kedaluwarsa.');

const projectId = 'e-skpt';
const root = `projects/${projectId}/databases/(default)/documents`;
const endpoint = `https://firestore.googleapis.com/v1/${root}:batchWrite`;
const entries = Object.entries(plan.ids).flatMap(([collection, ids]) => ids.map(id => ({ collection, id })));
if (entries.length !== plan.total) throw new Error('Guard gagal: jumlah ID tidak sama dengan total plan.');

const outputFile = path.join(path.dirname(planFile), 'admin-result.json');
const result = { planFile, startedAt: new Date().toISOString(), projectId, requested: entries.length, deleted: 0, batches: [] };

(async () => {
  for (let offset = 0; offset < entries.length; offset += 400) {
    const slice = entries.slice(offset, offset + 400);
    const writes = slice.map(({ collection, id }) => ({ delete: `${root}/${collection}/${id}` }));
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.tokens.access_token}`, 'content-type': 'application/json', 'x-goog-user-project': projectId },
      body: JSON.stringify({ writes })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Batch ${offset / 400 + 1} gagal (${response.status}): ${body.error?.message || 'unknown'}`);
    const statuses = body.status || [];
    const failures = statuses.filter(status => Number(status.code || 0) !== 0);
    if (failures.length) throw new Error(`Batch ${offset / 400 + 1} memiliki ${failures.length} kegagalan.`);
    result.deleted += slice.length;
    result.batches.push({ number: offset / 400 + 1, count: slice.length, completedAt: new Date().toISOString() });
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`Batch ${offset / 400 + 1}: ${slice.length} dokumen dihapus (${result.deleted}/${entries.length}).`);
  }
  result.completedAt = new Date().toISOString();
  result.status = 'COMPLETE';
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ status: result.status, deleted: result.deleted, outputFile }, null, 2));
})().catch(error => {
  result.status = 'FAILED';
  result.error = error.message;
  result.failedAt = new Date().toISOString();
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.error(error.message);
  process.exitCode = 1;
});
