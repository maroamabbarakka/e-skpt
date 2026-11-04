'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function loadBrowserModule(file, seed = {}) {
  const context = {
    window: {}, crypto: webcrypto, console, TextEncoder, ...seed
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  return context.window;
}

const skpt = loadBrowserModule('js/epasar/skpt-service.js').EPASAR_SKPT;
const storage = loadBrowserModule('js/epasar/skpt-storage.js').EPASAR_SKPT_STORAGE;
const workflowSource = fs.readFileSync('js/epasar/workflow-service.js', 'utf8');
const rulesSource = fs.readFileSync('firestore.rules', 'utf8');
const kadisUiSource = fs.readFileSync('js/epasar/kadis-approval.js', 'utf8');
const uptdUiSource = fs.readFileSync('js/epasar/uptd-approval.js', 'utf8');
const environmentTemplate = fs.readFileSync('.env.example', 'utf8');
const kadisHtml = fs.readFileSync('kadis-approval.html', 'utf8');
const accountHtml = fs.readFileSync('admin-akun.html', 'utf8');
const accountSource = fs.readFileSync('js/epasar/admin-accounts.js', 'utf8');

function assertPath(path, label) {
  for (let index = 1; index < path.length; index += 1) {
    assert.equal(
      skpt.canTransition(path[index - 1], path[index]),
      true,
      `${label}: transisi ${path[index - 1]} -> ${path[index]} harus tersedia`
    );
  }
}

assertPath([
  'SUBMITTED', 'ADMIN_REVIEW', 'MARKET_VERIFICATION', 'MARKET_VERIFIED',
  'UPTD_REVIEW', 'KADIS_REVIEW', 'TTE_PENDING', 'TTE_UPLOADING',
  'TTE_UPLOADED', 'ISSUED'
], 'alur utama');

assertPath(['ADMIN_REVIEW', 'CORRECTION_REQUIRED', 'ADMIN_REVIEW'], 'perbaikan administrasi');
assertPath(['MARKET_VERIFICATION', 'CONFLICT', 'CORRECTION_REQUIRED', 'MARKET_VERIFICATION'], 'konflik unit');
assertPath(['MARKET_VERIFICATION', 'NOT_FOUND', 'MARKET_VERIFICATION'], 'unit tidak ditemukan');
assertPath(['UPTD_REVIEW', 'MARKET_VERIFICATION'], 'pengembalian UPTD');
assertPath(['KADIS_REVIEW', 'REJECTED'], 'penolakan Kadis');
assertPath(['TTE_UPLOADED', 'TTE_REJECTED', 'TTE_PENDING'], 'penolakan hasil TTE');
assertPath(['TTE_PENDING', 'CANCELLED'], 'pembatalan sebelum TTE');

assert.equal(skpt.canTransition('TTE_PENDING', 'ISSUED'), false, 'TTE tidak boleh dilewati');
assert.equal(skpt.canTransition('KADIS_REVIEW', 'ISSUED'), false, 'persetujuan Kadis bukan penerbitan final');
assert.equal(skpt.canTransition('REJECTED', 'ISSUED'), false, 'berkas ditolak tidak boleh diterbitkan');
assert.equal(skpt.canTransition('CONFLICT', 'KADIS_REVIEW'), false, 'konflik tidak boleh melewati pemeriksaan ulang');

const verifiedStorage = storage.descriptor({
  provider: 'GOOGLE_DRIVE', objectId: 'drive-file-production', syncStatus: 'VERIFIED',
  documentHash: 'a'.repeat(64), binaryBytes: 2048
});
assert.equal(storage.canIssue(verifiedStorage), true, 'arsip terverifikasi dan memiliki hash harus layak diproses backend');
assert.equal(storage.canIssue({ ...verifiedStorage, syncStatus: 'UPLOADED' }), false, 'arsip belum diverifikasi tidak boleh diterbitkan');
assert.equal(storage.canIssue({ ...verifiedStorage, documentHash: '' }), false, 'arsip tanpa hash tidak boleh diterbitkan');

assert.match(workflowSource, /actor\?\.role !== 'KADIS'/, 'penolakan final harus eksklusif untuk Kadis');
assert.doesNotMatch(rulesSource, /function kadis\(\)[^\n]*SUPER_ADMIN/, 'helper Kadis tidak boleh mencakup Super Admin');
assert.match(workflowSource, /application\?\.status !== 'TTE_UPLOADED'/, 'client harus memeriksa status TTE_UPLOADED');
assert.match(workflowSource, /backend tepercaya[\s\S]*Admin SDK/, 'client harus menyerahkan penerbitan final ke backend');
assert.match(kadisUiSource, /approve-tte/, 'UI Kadis harus menyerahkan persetujuan dan reservasi nomor ke backend');
assert.doesNotMatch(kadisUiSource, /EPASAR_WORKFLOW\.approveForTte/, 'browser tidak boleh lagi mereservasi nomor SKPT');
assert.doesNotMatch(workflowSource, /function approveForTte/, 'implementasi reservasi nomor legacy harus dihapus dari bundle browser');
assert.match(kadisUiSource, /rejectByKadis/, 'UI Kadis harus menyediakan keputusan penolakan');
assert.match(uptdUiSource, /decideUptd/, 'UI UPTD harus menyediakan telaah sebelum Kadis');

assert.match(rulesSource, /match \/skpt_documents\/\{id\}[\s\S]*?allow create: if false;/, 'client tidak boleh membuat dokumen final');
assert.match(rulesSource, /match \/public_skpt_verification\/\{token\}[\s\S]*?allow create: if false;/, 'client tidak boleh membuat verifikasi publik');
assert.match(rulesSource, /request\.resource\.data\.status == 'REJECTED'[\s\S]*?approval\.decision == 'REJECTED'/, 'rules harus memiliki kontrak penolakan Kadis tersendiri');
assert.match(environmentTemplate, /SKPT_STORAGE_PROVIDER=GOOGLE_DRIVE/, 'backend harus memilih adapter Google Drive');
assert.match(environmentTemplate, /GOOGLE_DRIVE_SKPT_FOLDER_ID=1q0k68owb_9tLiPlUlu6orwvcIaTlkpM7/, 'folder Drive SKPT harus dikonfigurasi eksplisit');
assert.match(environmentTemplate, /GOOGLE_DRIVE_SKPT_ENVIRONMENT=TEMPORARY_ACTIVE/, 'folder sementara harus ditandai aktif secara eksplisit');
assert.match(environmentTemplate, /GOOGLE_DRIVE_REQUIRE_PRIVATE_FOLDER=false/, 'pengecualian folder privat sementara harus terlihat eksplisit');
assert.match(environmentTemplate, /GOOGLE_DRIVE_TEMPORARY_PERMISSION_EXCEPTION=true/, 'risiko izin sementara harus tercatat sebagai pengecualian');
assert.match(environmentTemplate, /GOOGLE_DRIVE_MIGRATION_TARGET=PEMKAB_SERVER/, 'tujuan migrasi permanen harus tetap server Pemkab');
assert.match(environmentTemplate, /SKPT_PUBLIC_DIRECT_DRIVE_LINKS=false/, 'tautan Drive langsung tidak boleh dipublikasikan');
assert.match(kadisHtml, /js\/epasar\/backend-config\.js/, 'konsol Kadis harus memuat konfigurasi endpoint backend');
assert.match(kadisUiSource, /data-action="upload-tte"/, 'konsol Kadis harus menyediakan unggah PDF melalui backend');
assert.match(kadisUiSource, /data-action="finalize"/, 'konsol Kadis harus menyediakan finalisasi melalui backend');
assert.match(kadisUiSource, /getIdToken\(true\)/, 'permintaan backend harus membawa Firebase ID token terbaru');
assert.match(rulesSource, /match \/skpt_number_counters\/\{yearId\}[\s\S]*?allow read, write: if false;/, 'counter nomor hanya boleh diakses Admin SDK backend');
for (const role of ['SUPER_ADMIN','DISPERINDAG_ADMIN','TRADE_ADMIN','MARKET_ADMIN','MARKET_HEAD','UPTD_HEAD','KADIS','TECH_ADMIN']) {
  assert.match(accountSource, new RegExp(`${role}:`), `ringkasan RBAC harus menjelaskan role ${role}`);
}
assert.match(accountHtml, /id="accountRoleSummary"/, 'halaman akun harus menampilkan ringkasan seluruh role RBAC');
assert.match(accountSource, /function scopeLabel\(/, 'setiap user RBAC harus memiliki keterangan cakupan akses');
assert.match(accountSource, /rbac-user-table/, 'seluruh user RBAC harus ditampilkan dalam bentuk tabel');
assert.match(accountSource, /Tidak dapat ditampilkan/, 'kolom password harus menjelaskan batas keamanan Firebase tanpa membocorkan kredensial');

console.log('PASS full workflow contract: happy path, correction, conflict, rejection, TTE, backend boundary');
