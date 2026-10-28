'use strict';

const fs = require('fs');
const path = require('path');
const { createReadClient } = require('./lib/firebase_rest_read');

const password = process.env.EPASAR_ADMIN_PASSWORD || process.env.EPASAR_UAT_PASSWORD;
if (!password) throw new Error('EPASAR_ADMIN_PASSWORD wajib tersedia.');

function stamp() { return new Date().toISOString().replace(/\D/g, '').slice(0, 14); }

(async () => {
  const client = createReadClient({ email: process.env.EPASAR_ADMIN_EMAIL || 'superadmin@eskpt.id', password });
  const token = await client.authenticate();
  const collections = ['users', 'trader_intake'];
  const data = {};
  for (const collection of collections) data[collection] = await client.list(token, collection);
  const outputDir = path.resolve('artifacts', `scope-migration-backup-${stamp()}`);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'backup.json'), JSON.stringify({ capturedAt: new Date().toISOString(), projectId: client.config.projectId, collections: data }, null, 2));
  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify({ users: data.users.length, trader_intake: data.trader_intake.length }, null, 2));
  console.log(JSON.stringify({ outputDir, users: data.users.length, trader_intake: data.trader_intake.length }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
