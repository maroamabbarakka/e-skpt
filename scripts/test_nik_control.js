'use strict';

const fs = require('fs');
const vm = require('vm');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');

function assert(value, message) {
  if (!value) throw new Error(message);
}

const source = fs.readFileSync('js/epasar/workflow-service.js', 'utf8');
const reviewSource = fs.readFileSync('js/epasar/admin-intake-review.js', 'utf8');
const rulesSource = fs.readFileSync('firestore.rules', 'utf8');

assert((source.match(/NIK sudah terdaftar\./g) || []).length >= 2, 'Kedua jalur transaksi harus tetap menolak registry yang sudah ada.');
assert(source.includes('transaction.get(nikRef)'), 'Pemeriksaan registry wajib dilakukan di dalam transaksi pembentukan master.');
assert(reviewSource.includes('button.disabled = true;') && reviewSource.includes('nikControlBlocked'), 'UI review harus mengunci pembentukan master saat kontrol NIK gagal.');
assert(rulesSource.includes('match /nik_registry/{id}') && rulesSource.includes('allow update, delete: if false;'), 'Registry NIK tidak boleh dapat ditimpa atau dihapus melalui client.');

let reads = [];
let documents = new Map();
const db = {
  collection(name) {
    return {
      doc(id) {
        return {
          async get() {
            reads.push(`${name}/${id}`);
            const data = documents.get(`${name}/${id}`);
            return { exists: Boolean(data), data: () => data };
          }
        };
      }
    };
  }
};
const window = {
  db,
  firebase: { firestore: { FieldValue: { serverTimestamp() {}, increment() {} } } }
};

vm.runInNewContext(source, {
  window,
  console,
  crypto: webcrypto,
  TextEncoder,
  Date,
  String,
  Number,
  Array,
  Set,
  Map,
  Promise
});

(async () => {
  const service = window.EPASAR_WORKFLOW;
  const nik = '7315010101010001';
  const bytes = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(nik));
  const hash = [...new Uint8Array(bytes)].map(item => item.toString(16).padStart(2, '0')).join('');

  reads = [];
  documents = new Map();
  const available = await service.inspectNikRegistration(nik);
  assert(!available.registered, 'NIK tanpa registry harus dinyatakan belum terdaftar.');
  assert(reads.length === 1 && reads[0] === `nik_registry/${hash}`, 'NIK tersedia harus diperiksa dengan tepat satu document read.');

  reads = [];
  documents = new Map([
    [`nik_registry/${hash}`, { traderId: 'PDG-001', traderDocumentId: 'doc-001' }],
    ['traders/doc-001', { traderId: 'PDG-001', displayName: 'Pedagang Lama', status: 'ACTIVE' }]
  ]);
  const conflict = await service.inspectNikRegistration(nik, { includeReference: true });
  assert(conflict.registered && conflict.integrityStatus === 'LINKED', 'Registry valid harus mengunci sebagai konflik terhubung.');
  assert(conflict.traderId === 'PDG-001' && conflict.displayName === 'Pedagang Lama', 'Kontrol harus mengembalikan referensi master yang aman untuk petugas.');
  assert(reads.length === 2, 'NIK terdaftar hanya boleh memakai satu baca registry dan satu baca master.');

  reads = [];
  const restrictedConflict = await service.inspectNikRegistration(nik);
  assert(restrictedConflict.registered && !restrictedConflict.traderId && !restrictedConflict.displayName, 'Pemeriksaan terbatas tidak boleh membuka referensi pedagang lain.');
  assert(reads.length === 1, 'Pemeriksaan terbatas harus cukup dengan satu document read registry.');

  reads = [];
  documents = new Map([[`nik_registry/${hash}`, { traderId: 'PDG-ORPHAN' }]]);
  const orphan = await service.inspectNikRegistration(nik, { includeReference: true });
  assert(orphan.registered && orphan.integrityStatus === 'REVIEW_REQUIRED', 'Registry tanpa relasi master harus tetap mengunci pemrosesan.');
  assert(reads.length === 1, 'Registry tanpa document ID tidak boleh memicu query koleksi tambahan.');

  let invalidRejected = false;
  try { await service.inspectNikRegistration('123'); } catch (_) { invalidRejected = true; }
  assert(invalidRejected, 'Format NIK tidak valid harus ditolak sebelum akses database.');
  assert(reads.length === 1, 'NIK tidak valid tidak boleh menambah operasi baca.');

  console.log('PASS NIK registry preflight control');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
