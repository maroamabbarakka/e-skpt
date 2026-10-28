'use strict';

const fs = require('fs');
const vm = require('vm');

function assert(value, message) {
  if (!value) throw new Error(message);
}

const marketNames = Object.fromEntries(Array.from({ length: 11 }, (_, index) => {
  const id = `MKT-${String(index + 1).padStart(3, '0')}`;
  return [id, { id, name: `Pasar ${id}` }];
}));

const emptyElement = () => ({
  value: '',
  textContent: '',
  hidden: false,
  disabled: false,
  className: '',
  selectedOptions: [],
  addEventListener() {},
  querySelectorAll() { return []; },
  classList: { add() {}, remove() {} }
});

const document = {
  getElementById() { return emptyElement(); },
  querySelectorAll() { return []; },
  addEventListener() {},
  createElement() { return emptyElement(); }
};
const window = {
  EPASAR: {
    MARKETS: Object.values(marketNames),
    canonicalMarketId(value) {
      const id = String(value || '').trim().toUpperCase();
      return /^MKT-0(?:0[1-9]|1[01])$/.test(id) ? id : '';
    },
    marketById(id) { return marketNames[id] || null; }
  },
  EPASAR_AUTH: { requireStaff: () => new Promise(() => {}) },
  EPASAR_INTERNAL_UI: {},
  addEventListener() {},
  location: { origin: 'https://example.test' }
};

const source = fs.readFileSync('js/epasar/database-pedagang.js', 'utf8');

// Guard the critical integration points as well as the pure scope resolver.
assert(source.includes('const isScoped = currentReportScope.scoped;'), 'Loader harus mengaktifkan pembatasan untuk akun wilayah dan kepala pasar.');
assert(source.includes('allRecords = isScoped ? records.filter(record => marketInScope(record.marketId, currentReportScope)) : records;'), 'Hasil gabungan harus difilter ulang sebelum masuk tabel/laporan.');
assert(source.includes("id: 'NON_MARKET'"), 'Konstanta pedagang luar pasar harus tetap tersedia untuk laporan pusat.');
assert(source.includes('cakupan: {'), 'Ekspor JSON harus menyertakan metadata cakupan laporan.');
assert(source.includes('BUKU_INDUK_DAN_REKAPITULASI_${reportFileScope()}_'), 'Nama berkas Excel harus membedakan cakupan wilayah/pasar.');

vm.runInNewContext(source, {
  window,
  document,
  console,
  setTimeout,
  clearTimeout,
  URL,
  Blob,
  Date,
  String,
  Number,
  Array,
  Set,
  Map,
  Promise,
  encodeURIComponent,
  alert() {}
});

const { resolveReportScope, marketInScope } = window.EPASAR_DB;
const wilayahI = resolveReportScope({ role: 'MARKET_ADMIN', marketIds: ['MKT-001','MKT-002','MKT-005','MKT-007','MKT-009','MKT-011'] });
const wilayahII = resolveReportScope({ role: 'MARKET_ADMIN', marketIds: ['MKT-003','MKT-004','MKT-006','MKT-008','MKT-010'] });
const kepalaBungi = resolveReportScope({ role: 'MARKET_HEAD', marketIds: ['MKT-001'] });
const pusat = resolveReportScope({ role: 'KADIS', marketIds: [] });

assert(wilayahI.id === 'WILAYAH_I', 'Daftar pasar Wilayah I harus dikenali secara deterministik.');
assert(wilayahII.id === 'WILAYAH_II', 'Daftar pasar Wilayah II harus dikenali secara deterministik.');
assert(marketInScope('MKT-001', wilayahI), 'Wilayah I harus menerima MKT-001.');
assert(!marketInScope('MKT-010', wilayahI), 'Wilayah I tidak boleh menerima MKT-010.');
assert(marketInScope('MKT-010', wilayahII), 'Wilayah II harus menerima MKT-010.');
assert(!marketInScope('MKT-001', wilayahII), 'Wilayah II tidak boleh menerima MKT-001.');
assert(!marketInScope('NON_MARKET', wilayahI), 'Pedagang non-pasar belum boleh masuk laporan wilayah tanpa routing resmi.');
assert(kepalaBungi.type === 'MARKET' && marketInScope('MKT-001', kepalaBungi), 'Kepala Pasar harus tetap dibatasi pada pasarnya.');
assert(!pusat.scoped && marketInScope('MKT-001', pusat) && marketInScope('MKT-010', pusat), 'Kadis/admin pusat harus tetap memiliki cakupan kabupaten.');

console.log('PASS regional report scope isolation');
