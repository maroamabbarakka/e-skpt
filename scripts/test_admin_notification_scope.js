'use strict';

const fs = require('fs');
const vm = require('vm');

const intakeSource = fs.readFileSync('js/epasar/admin-intake-service.js', 'utf8');
const notificationSource = fs.readFileSync('js/epasar/admin-notification-service.js', 'utf8');
const window = {
  EPASAR: {
    canonicalMarketId(value) {
      const id = String(value || '').trim().toUpperCase();
      return /^MKT-0(?:0[1-9]|1[01])$/.test(id) ? id : '';
    }
  },
  firebase: { firestore: { FieldValue: { serverTimestamp() { return 'STAMP'; } } } }
};
vm.runInNewContext(intakeSource, { window, console });
vm.runInNewContext(notificationSource, { window, console, location: { origin: '', pathname: '/' } });

const service = window.EPASAR_ADMIN_NOTIFICATIONS;
const areaOne = { role: 'MARKET_ADMIN', marketIds: ['MKT-001', 'MKT-002'] };
const areaTwo = { role: 'MARKET_ADMIN', marketIds: ['MKT-010'] };
const central = { role: 'DISPERINDAG_ADMIN', marketIds: [] };
const projected = { routingMarketIds: ['MKT-010'] };
const legacyDirect = { marketId: 'MKT-001' };
const legacyIntake = { businessDrafts: [{ locations: [{ marketPlaces: [{ marketId: 'MKT-002' }] }] }] };

function assert(value, message) { if (!value) throw new Error(message); }

assert(!service.canAccess(areaOne, projected), 'Wilayah I tidak boleh melihat notifikasi Wilayah II.');
assert(service.canAccess(areaTwo, projected), 'Wilayah II harus melihat notifikasi pasarnya.');
assert(service.canAccess(areaOne, legacyDirect), 'Notifikasi lama dengan marketId harus tetap terlihat.');
assert(service.canAccess(areaOne, {}, legacyIntake), 'Notifikasi lama harus dapat mewarisi routing pendaftaran sumber.');
assert(service.canAccess(central, {}), 'Admin pusat harus tetap melihat seluruh notifikasi.');
assert(!service.canAccess({ role: 'MARKET_ADMIN', marketIds: [] }, legacyDirect), 'Admin tanpa pasar tidak boleh melihat notifikasi pasar.');
console.log('PASS admin notification market scope');
