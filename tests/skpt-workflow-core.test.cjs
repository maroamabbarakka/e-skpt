const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function load(file, seed = {}) {
  const context = { window: {}, crypto: webcrypto, console, TextEncoder, ...seed };
  context.window = context.window || {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  return context.window;
}

const workflow = load('js/epasar/skpt-service.js').EPASAR_SKPT;
assert.equal(workflow.canTransition('MARKET_VERIFIED', 'UPTD_REVIEW'), true);
assert.equal(workflow.canTransition('UPTD_REVIEW', 'KADIS_REVIEW'), true);
assert.equal(workflow.canTransition('KADIS_REVIEW', 'TTE_PENDING'), true);
assert.equal(workflow.canTransition('TTE_PENDING', 'ISSUED'), false);
assert.equal(workflow.canTransition('TTE_UPLOADED', 'ISSUED'), true);
assert.throws(() => workflow.assertTransition('MARKET_VERIFICATION', 'ISSUED'), /tidak diizinkan/);

const storage = load('js/epasar/skpt-storage.js').EPASAR_SKPT_STORAGE;
const verified = storage.descriptor({ provider: 'GOOGLE_DRIVE', objectId: 'drive-file-1', syncStatus: 'VERIFIED', documentHash: 'a'.repeat(64), binaryBytes: 1234 });
assert.equal(verified.provider, 'GOOGLE_DRIVE');
assert.equal(storage.canIssue(verified), true);
assert.equal(storage.canIssue({ provider: 'GOOGLE_DRIVE', syncStatus: 'UPLOADED', documentHash: 'a'.repeat(64), binaryBytes: 1234 }), false);
assert.throws(() => storage.descriptor({ provider: 'UNKNOWN', syncStatus: 'VERIFIED' }), /belum didukung/);

console.log('PASS skpt workflow and storage core');
