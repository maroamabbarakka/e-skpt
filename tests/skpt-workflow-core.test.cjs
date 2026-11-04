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

const intakeSource = fs.readFileSync('js/epasar/intake-service.js', 'utf8');
const reviewSource = fs.readFileSync('js/epasar/intake-review-service.js', 'utf8');
const rulesSource = fs.readFileSync('firestore.rules', 'utf8');
const customizationHtml = fs.readFileSync('admin-kustomisasi.html', 'utf8');
const traderDatabaseHtml = fs.readFileSync('database-pedagang.html', 'utf8');
const traderDatabaseSource = fs.readFileSync('js/epasar/database-pedagang.js', 'utf8');
assert.match(intakeSource, /environment:\s*'PROD'[\s\S]*?isDemo:\s*false/);
assert.doesNotMatch(intakeSource, /environment:\s*'UAT'[\s\S]*?isDemo:\s*true/);
assert.match(reviewSource, /environment:\s*'PROD',\s*isDemo:\s*false/);
assert.match(rulesSource, /request\.resource\.data\.environment == 'PROD' && request\.resource\.data\.isDemo == false/);
assert.doesNotMatch(customizationHtml, /value="UAT_SIMULATED"/);
assert.match(traderDatabaseHtml, /js\/vendor\/exceljs\.min\.js/);
assert.doesNotMatch(traderDatabaseHtml, /xlsx\.full\.min\.js/);
assert.match(traderDatabaseSource, /new ExcelJS\.Workbook\(\)/);
assert.doesNotMatch(traderDatabaseSource, /XLSX\./);
assert.match(rulesSource, /match \/skpt_documents\/\{id\}[\s\S]*?allow create: if false;/);
assert.match(rulesSource, /match \/public_skpt_verification\/\{token\}[\s\S]*?allow create: if false;/);

console.log('PASS skpt workflow, storage, and production-mode guards');
