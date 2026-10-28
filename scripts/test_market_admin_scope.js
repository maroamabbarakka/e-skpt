'use strict';

const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/epasar/admin-intake-service.js', 'utf8');
const window = {
  EPASAR: {
    canonicalMarketId(value) {
      const id = String(value || '').trim().toUpperCase();
      return /^MKT-0(?:0[1-9]|1[01])$/.test(id) ? id : '';
    }
  }
};
vm.runInNewContext(source, { window, console });

const service = window.EPASAR_ADMIN_INTAKE;
const areaOne = { role: 'MARKET_ADMIN', marketIds: ['MKT-001', 'MKT-002'] };
const areaTwo = { role: 'MARKET_ADMIN', marketIds: ['MKT-010'] };
const central = { role: 'DISPERINDAG_ADMIN', marketIds: [] };
const sentral = { routingMarketIds: ['MKT-010'] };
const multiMarket = { routingMarketIds: ['MKT-002', 'MKT-010'] };
const nonMarket = { routingMarketIds: [] };
const legacyNested = { businessDrafts: [{ locations: [{ marketPlaces: [{ marketId: 'MKT-001' }] }] }] };

function assert(value, message) { if (!value) throw new Error(message); }

assert(!service.canAccess(areaOne, sentral), 'Admin Wilayah I tidak boleh membaca Pasar Sentral.');
assert(service.canAccess(areaTwo, sentral), 'Admin Wilayah II harus dapat membaca Pasar Sentral.');
assert(service.canAccess(areaOne, multiMarket), 'Pendaftaran multi-pasar harus masuk bila salah satu pasar ditugaskan.');
assert(!service.canAccess(areaOne, nonMarket), 'Admin Wilayah tidak menerima pendaftaran non-pasar tanpa kebijakan routing.');
assert(service.canAccess(areaOne, legacyNested), 'Fallback data nested lama harus tetap dikenali di validasi client.');
assert(service.canAccess(central, nonMarket), 'Admin pusat harus dapat membaca pendaftaran non-pasar.');
console.log('PASS market admin intake scope');
