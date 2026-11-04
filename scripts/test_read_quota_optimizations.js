'use strict';

const fs = require('fs');
const vm = require('vm');

function assert(value, message) {
  if (!value) throw new Error(message);
}

const adminSource = fs.readFileSync('js/epasar/admin-epasar.js', 'utf8');
const restReadSource = fs.readFileSync('scripts/lib/firebase_rest_read.js', 'utf8');
const inventorySource = fs.readFileSync('scripts/inventory_live_uat.js', 'utf8');
const databaseSource = fs.readFileSync('js/epasar/database-pedagang.js', 'utf8');
const refreshStatsSource = fs.readFileSync('scripts/refresh_public_stats.js', 'utf8');
assert(!adminSource.includes("querySelectorAll('[data-market-kpi]')"), 'Kartu Kepala Pasar tidak boleh memiliki handler klik kedua.');
assert(!adminSource.includes("querySelectorAll('[data-kadis-kpi]')"), 'Kartu Kadis tidak boleh memiliki handler klik kedua.');
assert(!adminSource.includes("openAdminKpi(item.type)"), 'Kartu admin tidak boleh memiliki handler klik individual selain delegation.');
assert(adminSource.includes('if (metricsPromise) return metricsPromise;'), 'Pemuatan metrik harus menduplikasi request yang sedang berjalan.');
assert(adminSource.includes("collection('public_stats').doc('summary').get()"), 'KPI non-pasar harus memakai dokumen ringkasan lebih dahulu.');
assert(restReadSource.includes("EPASAR_ALLOW_FULL_SCAN !== 'YES'"), 'Helper full-scan wajib memiliki interlock eksplisit.');
assert(inventorySource.includes("EPASAR_ALLOW_FULL_SCAN !== 'YES'"), 'Inventory live wajib memiliki interlock eksplisit.');
assert(databaseSource.includes('bounded-operational-page'), 'Database pedagang wajib memakai mode pembacaan operasional terbatas.');
assert(databaseSource.includes('query.limit(SERVER_PAGE_SIZE).get()'), 'Query utama database pedagang wajib memiliki limit server.');
assert(!/btnRefresh[^\n]+loadDatabaseLegacyFull/.test(databaseSource), 'Tombol refresh tidak boleh memanggil full scan lama.');
assert(refreshStatsSource.includes("EPASAR_ALLOW_FULL_SCAN !== 'YES'"), 'Penyegaran statistik penuh wajib memiliki interlock eksplisit.');

const whereCalls = [];
const query = {
  where(field, operator, value) {
    whereCalls.push([field, operator, value]);
    return this;
  },
  limit(value) {
    this.limitValue = value;
    return this;
  },
  async get() {
    return {
      docs: [{
        id: 'pending-1',
        data: () => ({
          type: 'TRADER_DECISION',
          deliveryStatus: 'PENDING_ADMIN',
          registrationCode: 'REG-1',
          phone: '081234567890',
          routingMarketIds: ['MKT-001']
        })
      }]
    };
  }
};
const window = {
  db: { collection: () => query },
  EPASAR_ADMIN_INTAKE: {
    canonicalMarketId: value => String(value || '').trim().toUpperCase(),
    assignedMarketIds: profile => profile.marketIds || [],
    intakeMarketIds: () => []
  },
  firebase: { firestore: { FieldValue: { serverTimestamp: () => 'STAMP' } } }
};
const notificationSource = fs.readFileSync('js/epasar/admin-notification-service.js', 'utf8');
vm.runInNewContext(notificationSource, { window, console, location: { origin: '', pathname: '/' }, Date, JSON, String, Array, Set, Promise });

(async () => {
  const rows = await window.EPASAR_ADMIN_NOTIFICATIONS.pending({ uid: 'admin-1', role: 'DISPERINDAG_ADMIN', marketIds: [] });
  assert(rows.length === 1, 'Query notifikasi pending harus mengembalikan data yang relevan.');
  assert(whereCalls.some(call => call[0] === 'deliveryStatus' && call[2] === 'PENDING_ADMIN'), 'Status pending harus difilter oleh Firestore, bukan hanya di browser.');
  assert(query.limitValue === 40, 'Antrean notifikasi harus mempunyai batas baca yang konservatif.');
  console.log('PASS read quota optimizations');
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
