'use strict';

const fs = require('fs');

function assert(value, message) {
  if (!value) throw new Error(message);
}

const html = fs.readFileSync('epasar.html', 'utf8');
const form = fs.readFileSync('js/epasar/trader-form.js', 'utf8');
const mediaUi = fs.readFileSync('js/epasar/media-ui.js', 'utf8');

const conditionalStart = html.indexOf('<div id="skptOnlyAttachments"');
const ktpPosition = html.indexOf('id="identityKtpPhoto"');
const kkPosition = html.indexOf('id="identityKkPhoto"');
const profilePosition = html.indexOf('id="profilePhoto"');
const evidencePosition = html.indexOf('id="businessPhoto"');

assert(conditionalStart > 0, 'Kontainer dokumen khusus e-SKPT harus tersedia.');
assert(ktpPosition > 0 && ktpPosition < conditionalStart, 'KTP harus berada di luar bagian khusus e-SKPT.');
assert(kkPosition > 0 && kkPosition < conditionalStart, 'KK opsional harus tersedia untuk seluruh pendataan.');
assert(profilePosition > conditionalStart, 'Selfie harus berada di bagian khusus e-SKPT.');
assert(evidencePosition > conditionalStart, 'Foto dagangan harus berada di bagian khusus e-SKPT.');
assert((html.match(/id="identityKtpPhoto"/g) || []).length === 1, 'Input KTP tidak boleh terduplikasi.');
assert((html.match(/id="profilePhoto"/g) || []).length === 1, 'Input selfie tidak boleh terduplikasi.');

assert(form.includes("step === 4 && !window.EPASAR_MEDIA_BUFFER?.IDENTITY_KTP"), 'KTP wajib divalidasi untuk seluruh pendataan.');
assert(form.includes("data.applySkpt && !window.EPASAR_MEDIA_BUFFER?.PROFILE"), 'Selfie wajib divalidasi hanya untuk e-SKPT.');
assert(form.includes("data.applySkpt && !window.EPASAR_MEDIA_BUFFER?.EVIDENCE"), 'Foto usaha wajib divalidasi hanya untuk e-SKPT.');
assert(form.includes("data.applySkpt ? ['IDENTITY_KTP', 'IDENTITY_KK', 'PROFILE', 'EVIDENCE'] : ['IDENTITY_KTP', 'IDENTITY_KK']"), 'Pendataan biasa tidak boleh mengunggah media khusus e-SKPT.');
assert(form.includes('if (!createdIntake) {'), 'Retry lampiran tidak boleh membuat intake utama kedua.');
assert(form.includes('if (uploadedMediaKeys.has(key)) continue;'), 'Retry tidak boleh mengunggah ulang media yang sudah berhasil dalam sesi berjalan.');
assert(form.includes("button.textContent = 'Lanjutkan unggah lampiran';"), 'Kegagalan parsial harus menyediakan tindakan retry yang jelas.');
assert(form.includes('form.querySelectorAll(\'input,select,textarea\')'), 'Form harus dikunci setelah intake utama tercatat agar snapshot tidak berubah saat retry.');

for (const marker of ["'PROFILE'", "'EVIDENCE'", "'IDENTITY_KTP'", "'IDENTITY_KK'"]) {
  assert(mediaUi.includes(marker), `Kontrak media ${marker} harus tetap tersedia.`);
}

console.log('PASS document requirement separation');
