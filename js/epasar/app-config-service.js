/**
 * app-config-service.js
 * Modul Konfigurasi Sistem Dinamis (Full Custom) untuk Super Admin & Kadis
 * e-PASAR Kabupaten Pinrang
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EPASAR_CONFIG_SERVICE = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SETTINGS_DOC_ID = 'general';
  let cachedSettings = null;

  const DEFAULT_SETTINGS = {
    signatory: {
      name: 'MUHAMMAD YUSUF NUR, S.STP',
      nip: '19800326 200003 1 001',
      rank: 'Pembina Tingkat I (IV/b)',
      position: 'Kepala Dinas Perindustrian, Perdagangan, Energi dan Sumber Daya Mineral',
      authority: 'a.n. BUPATI PINRANG',
      tteMode: 'UAT_SIMULATED',
      tteNotice: 'Telah ditandatangani secara elektronik menggunakan sertifikat digital terverifikasi'
    },
    cardDesign: {
      theme: 'navy', // navy, emerald, gold, dark
      headerTitle: 'KARTU IDENTITAS PEDAGANG RESMI',
      headerSubtitle: 'PEMERINTAH KABUPATEN PINRANG',
      agencyName: 'DINAS PERINDAG ESDM PINRANG',
      showPhoto: true,
      showQr: true,
      showNik: true,
      showExpiry: true,
      accentColor: '#1d4ed8'
    },
    frontpage: {
      heroTitle: 'Satu Data Pedagang, Satu Layanan yang Lebih Mudah',
      heroSubtitle: 'Pendataan terpadu, penataan ruang pasar, dan penerbitan legalitas e-SKPT resmi Kabupaten Pinrang.',
      announcement: 'PEMBERITAHUAN RESMI: Seluruh pedagang pasar tradisional di Kabupaten Pinrang berhak memperoleh e-SKPT dan Kartu Pedagang Resmi melalui verifikasi unit pasar tanpa perantara.',
      helpdeskWa: '081242334455',
      officeAddress: 'Jalan Bintang No. 1, Manding, Kec. Watang Sawitto, Kabupaten Pinrang, Sulawesi Selatan 91212',
      serviceHours: 'Senin s.d. Jumat (08.00 - 15.30 WITA)',
      contactEmail: 'disperindag@pinrangkab.go.id'
    },
    marketsSchedule: {
      'MKT-010': 'Pasar Harian (Setiap Hari)',
      'pasar-sentral-pinrang': 'Pasar Harian (Setiap Hari)',
      'MKT-001': 'Pasar Mingguan (Senin & Kamis)',
      'pasar-kariango': 'Pasar Mingguan (Senin & Kamis)',
      'MKT-002': 'Pasar Mingguan (Minggu & Rabu)',
      'pasar-pekkabata': 'Pasar Mingguan (Minggu & Rabu)',
      'MKT-003': 'Pasar Mingguan (Selasa & Jumat)',
      'pasar-batulappa': 'Pasar Mingguan (Selasa & Jumat)',
      'MKT-004': 'Pasar Mingguan (Rabu & Sabtu)',
      'pasar-bungi': 'Pasar Mingguan (Rabu & Sabtu)',
      'MKT-005': 'Pasar Mingguan (Kamis & Minggu)',
      'pasar-teppo': 'Pasar Mingguan (Rabu & Sabtu)',
      'pasar-paria': 'Pasar Mingguan (Senin & Kamis)',
      'pasar-tadokkai': 'Pasar Mingguan (Minggu & Rabu)',
      'pasar-marawi': 'Pasar Mingguan (Kamis & Minggu)',
      'pasar-suppa': 'Pasar Mingguan (Selasa & Sabtu)',
      'pasar-langnga': 'Pasar Mingguan (Rabu & Minggu)'
    },
    legalBasis: {
      perdaMarket: 'Peraturan Daerah Kabupaten Pinrang Nomor 6 Tahun 2024 tentang Pengelolaan Pasar Rakyat',
      perdaTax: 'Peraturan Daerah Kabupaten Pinrang Nomor 1 Tahun 2024 tentang Pajak Daerah dan Retribusi Daerah',
      validityYears: 2
    }
  };

  const getDb = () => {
    if (window.db) return window.db;
    if (typeof firebase !== 'undefined' && firebase.firestore) return firebase.firestore();
    return null;
  };

  async function getSettings(forceRefresh) {
    if (cachedSettings && !forceRefresh) return cachedSettings;

    const db = getDb();
    if (!db) return DEFAULT_SETTINGS;

    try {
      const snap = await db.collection('app_settings').doc(SETTINGS_DOC_ID).get();
      if (snap.exists) {
        const data = snap.data();
        // Gabungkan dengan default untuk menjaga properti lengkap
        cachedSettings = {
          signatory: { ...DEFAULT_SETTINGS.signatory, ...(data.signatory || {}) },
          cardDesign: { ...DEFAULT_SETTINGS.cardDesign, ...(data.cardDesign || {}) },
          frontpage: { ...DEFAULT_SETTINGS.frontpage, ...(data.frontpage || {}) },
          marketsSchedule: { ...DEFAULT_SETTINGS.marketsSchedule, ...(data.marketsSchedule || {}) },
          legalBasis: { ...DEFAULT_SETTINGS.legalBasis, ...(data.legalBasis || {}) }
        };
        return cachedSettings;
      }
    } catch (err) {
      console.warn('Gagal memuat app_settings dari Firestore, gunakan default:', err.message);
    }

    cachedSettings = { ...DEFAULT_SETTINGS };
    return cachedSettings;
  }

  async function saveSettings(newSettings, userProfile) {
    const role = userProfile?.role || '';
    if (!['SUPER_ADMIN', 'KADIS'].includes(role)) {
      throw new Error('Hanya Super Admin dan Kepala Dinas yang memiliki hak kustomisasi aplikasi.');
    }

    const db = getDb();
    if (!db) throw new Error('Koneksi basis data Firestore tidak tersedia.');

    const payload = {
      signatory: newSettings.signatory || DEFAULT_SETTINGS.signatory,
      cardDesign: newSettings.cardDesign || DEFAULT_SETTINGS.cardDesign,
      frontpage: newSettings.frontpage || DEFAULT_SETTINGS.frontpage,
      marketsSchedule: newSettings.marketsSchedule || DEFAULT_SETTINGS.marketsSchedule,
      legalBasis: newSettings.legalBasis || DEFAULT_SETTINGS.legalBasis,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: userProfile.uid || userProfile.email || 'USER',
      updatedByRole: role,
      schemaVersion: 1
    };

    await db.collection('app_settings').doc(SETTINGS_DOC_ID).set(payload, { merge: true });
    cachedSettings = { ...payload };
    return cachedSettings;
  }

  function getMarketSchedule(marketId, marketName, currentSettings) {
    const settings = currentSettings || cachedSettings || DEFAULT_SETTINGS;
    const map = settings.marketsSchedule || DEFAULT_SETTINGS.marketsSchedule;

    const idNorm = String(marketId || '').toLowerCase().trim();
    const nameNorm = String(marketName || '').toLowerCase().trim();

    // 1. Coba lookup langsung ID
    if (map[marketId]) return map[marketId];
    if (map[idNorm]) return map[idNorm];

    // 2. Coba lookup dari nama
    for (const [k, v] of Object.entries(map)) {
      const kNorm = k.toLowerCase().replace(/^pasar-/, '').replace(/^mkt-/, '');
      if (nameNorm.includes(kNorm) || idNorm.includes(kNorm)) {
        return v;
      }
    }

    if (idNorm === 'non_market' || nameNorm.includes('luar') || nameNorm.includes('mandiri')) {
      return 'Usaha Mandiri Non-Pasar';
    }

    if (nameNorm.includes('sentral')) {
      return 'Pasar Harian (Setiap Hari)';
    }

    return 'Pasar Berkala / Mingguan';
  }

  return {
    DEFAULT_SETTINGS,
    getSettings,
    saveSettings,
    getMarketSchedule
  };
}));
