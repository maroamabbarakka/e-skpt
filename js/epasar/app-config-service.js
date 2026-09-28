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
      tteMode: 'UAT_SIMULATED', // 'UAT_SIMULATED', 'BSRE_OFFICIAL', 'MANUAL_UPLOAD'
      manualSignatureImage: null, // base64 string jika upload manual
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
    // MASTER 11 PASAR RESMI KABUPATEN PINRANG SESUAI REGULASI & LAMPIRAN
    marketsSchedule: {
      'MKT-001': { marketId: 'MKT-001', marketName: 'Pasar Rakyat Bungi', isDaily: false, activeDays: ['RABU', 'SABTU'], daysCount: 2, scheduleText: 'Pasar Mingguan (Rabu & Sabtu)' },
      'MKT-002': { marketId: 'MKT-002', marketName: 'Pasar Rakyat Cempa', isDaily: false, activeDays: ['SELASA', 'JUMAT'], daysCount: 2, scheduleText: 'Pasar Mingguan (Selasa & Jumat)' },
      'MKT-003': { marketId: 'MKT-003', marketName: 'Pasar Rakyat Kampung Jaya', isDaily: false, activeDays: ['SENIN', 'KAMIS'], daysCount: 2, scheduleText: 'Pasar Mingguan (Senin & Kamis)' },
      'MKT-004': { marketId: 'MKT-004', marketName: 'Pasar Rakyat Kariango', isDaily: false, activeDays: ['SENIN', 'KAMIS'], daysCount: 2, scheduleText: 'Pasar Mingguan (Senin & Kamis)' },
      'MKT-005': { marketId: 'MKT-005', marketName: 'Pasar Rakyat Langnga', isDaily: false, activeDays: ['RABU', 'MINGGU'], daysCount: 2, scheduleText: 'Pasar Mingguan (Rabu & Minggu)' },
      'MKT-006': { marketId: 'MKT-006', marketName: 'Pasar Rakyat Lanrisang', isDaily: false, activeDays: ['SELASA', 'SABTU'], daysCount: 2, scheduleText: 'Pasar Mingguan (Selasa & Sabtu)' },
      'MKT-007': { marketId: 'MKT-007', marketName: 'Pasar Rakyat Leppangang', isDaily: false, activeDays: ['KAMIS', 'MINGGU'], daysCount: 2, scheduleText: 'Pasar Mingguan (Kamis & Minggu)' },
      'MKT-008': { marketId: 'MKT-008', marketName: 'Pasar Rakyat Marawi', isDaily: false, activeDays: ['KAMIS', 'MINGGU'], daysCount: 2, scheduleText: 'Pasar Mingguan (Kamis & Minggu)' },
      'MKT-009': { marketId: 'MKT-009', marketName: 'Pasar Rakyat Pekkabata', isDaily: false, activeDays: ['MINGGU', 'RABU'], daysCount: 2, scheduleText: 'Pasar Mingguan (Minggu & Rabu)' },
      'MKT-010': { marketId: 'MKT-010', marketName: 'Pasar Rakyat Sentral Pinrang', isDaily: true, activeDays: ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'], daysCount: 7, scheduleText: 'Pasar Harian (Setiap Hari)' },
      'MKT-011': { marketId: 'MKT-011', marketName: 'Pasar Rakyat Teppo', isDaily: false, activeDays: ['RABU', 'SABTU'], daysCount: 2, scheduleText: 'Pasar Mingguan (Rabu & Sabtu)' }
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

  function extractScheduleText(val) {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      if (val.scheduleText) return val.scheduleText;
      if (val.isDaily) return 'Pasar Harian (Setiap Hari)';
      if (Array.isArray(val.activeDays) && val.activeDays.length > 0) {
        return `Pasar Mingguan (${val.activeDays.join(' & ')})`;
      }
      return 'Pasar Berkala';
    }
    return String(val);
  }

  function getMarketSchedule(marketId, marketName, currentSettings) {
    const settings = currentSettings || cachedSettings || DEFAULT_SETTINGS;
    const map = settings.marketsSchedule || DEFAULT_SETTINGS.marketsSchedule;

    const idNorm = String(marketId || '').toUpperCase().trim();
    const nameNorm = String(marketName || '').toLowerCase().trim();

    if (map[idNorm]) return extractScheduleText(map[idNorm]);
    if (map[marketId]) return extractScheduleText(map[marketId]);

    for (const [k, v] of Object.entries(map)) {
      const kNorm = k.toLowerCase().replace(/^mkt-/, '').replace(/^pasar-/, '');
      if (nameNorm.includes(kNorm) || idNorm.toLowerCase().includes(kNorm)) {
        return extractScheduleText(v);
      }
    }

    if (idNorm === 'NON_MARKET' || nameNorm.includes('luar') || nameNorm.includes('mandiri')) {
      return 'Usaha Mandiri Non-Pasar';
    }

    if (nameNorm.includes('sentral')) {
      return 'Pasar Harian (Setiap Hari)';
    }

    return 'Pasar Berkala / Mingguan';
  }

  function getMarketScheduleDetails(marketId, marketName, currentSettings) {
    const settings = currentSettings || cachedSettings || DEFAULT_SETTINGS;
    const map = settings.marketsSchedule || DEFAULT_SETTINGS.marketsSchedule;
    const idNorm = String(marketId || '').toUpperCase().trim();
    const nameNorm = String(marketName || '').toLowerCase().trim();

    let found = map[idNorm] || map[marketId];
    if (!found) {
      for (const [k, v] of Object.entries(map)) {
        const kNorm = k.toLowerCase().replace(/^mkt-/, '').replace(/^pasar-/, '');
        if (nameNorm.includes(kNorm) || idNorm.toLowerCase().includes(kNorm)) {
          found = v;
          break;
        }
      }
    }

    if (found && typeof found === 'object') {
      const isDaily = Boolean(found.isDaily);
      const activeDays = Array.isArray(found.activeDays) ? found.activeDays : [];
      return {
        marketId: found.marketId || marketId,
        marketName: found.marketName || marketName,
        isDaily,
        activeDays,
        daysCount: Number(found.daysCount || (isDaily ? 7 : (activeDays.length || 2))),
        scheduleText: extractScheduleText(found)
      };
    }

    const text = extractScheduleText(found) || (nameNorm.includes('sentral') ? 'Pasar Harian (Setiap Hari)' : 'Pasar Mingguan');
    const isDaily = text.toLowerCase().includes('harian') || text.toLowerCase().includes('setiap hari');
    return {
      marketId: marketId || '',
      marketName: marketName || '',
      isDaily,
      activeDays: isDaily ? ['SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU','MINGGU'] : ['RABU','SABTU'],
      daysCount: isDaily ? 7 : 2,
      scheduleText: text
    };
  }

  return {
    DEFAULT_SETTINGS,
    getSettings,
    saveSettings,
    getMarketSchedule,
    getMarketScheduleDetails
  };
}));
