(function () {
  'use strict';

  const MARKETS = Object.freeze([
    { id: 'MKT-001', name: 'Pasar Rakyat Bungi', district: 'Duampanua', village: 'Bungi', address: 'Jl. Poros Pinrang - Polman, Desa Bungi', regionId: 'I', skptCode: 'BNG' },
    { id: 'MKT-002', name: 'Pasar Rakyat Cempa', district: 'Cempa', village: 'Cempa', address: 'Jl. Poros Cempa, Kelurahan Cempa', regionId: 'I', skptCode: 'CMP' },
    { id: 'MKT-003', name: 'Pasar Rakyat Kampung Jaya', district: 'Watang Sawitto', village: 'Jaya', address: 'Jl. Anggrek / Kp. Jaya, Kelurahan Jaya', regionId: 'II', skptCode: 'KJY' },
    { id: 'MKT-004', name: 'Pasar Rakyat Kariango', district: 'Mattiro Bulu', village: 'Pananrang', address: 'Jl. Poros Pinrang - Parepare, Dusun Kariango, Desa Pananrang', regionId: 'II', skptCode: 'KRG' },
    { id: 'MKT-005', name: 'Pasar Rakyat Langnga', district: 'Mattiro Sompe', village: 'Langnga', address: 'Jl. Poros Langnga, Kelurahan Langnga', regionId: 'I', skptCode: 'LNG' },
    { id: 'MKT-006', name: 'Pasar Rakyat Lanrisang', district: 'Lanrisang', village: 'Lanrisang', address: 'Jl. Poros Jampue, Desa Lanrisang', regionId: 'II', skptCode: 'LRS' },
    { id: 'MKT-007', name: 'Pasar Rakyat Leppangang', district: 'Patampanua', village: 'Leppangang', address: 'Jl. Poros Pinrang - Enrekang, Desa Leppangang', regionId: 'I', skptCode: 'LPG' },
    { id: 'MKT-008', name: 'Pasar Rakyat Marawi', district: 'Tiroang', village: 'Marawi', address: 'Jl. Poros Tiroang - Marawi, Kelurahan Marawi', regionId: 'II', skptCode: 'MRW' },
    { id: 'MKT-009', name: 'Pasar Rakyat Pekkabata', district: 'Duampanua', village: 'Pekkabata', address: 'Jl. Poros Pekkabata, Kelurahan Pekkabata', regionId: 'I', skptCode: 'PKB' },
    { id: 'MKT-010', name: 'Pasar Rakyat Sentral Pinrang', district: 'Paleteang', village: 'Sawitto', address: 'Jl. Sukowati / Basuki Rahmat, Paleteang / Sawitto', regionId: 'II', skptCode: 'SPG' },
    { id: 'MKT-011', name: 'Pasar Rakyat Teppo', district: 'Patampanua', village: 'Teppo', address: 'Jl. Poros Teppo, Kelurahan Teppo', regionId: 'I', skptCode: 'TPP' }
  ].map(Object.freeze));

  const MARKET_BY_ID = Object.freeze(Object.fromEntries(MARKETS.map(market => [market.id, market])));
  const LEGACY_MARKET_IDS = Object.freeze({
    'pasar-bungi': 'MKT-001',
    'pasar-cempa': 'MKT-002',
    'pasar-kampoeng-djaja': 'MKT-003',
    'pasar-kampung-jaya': 'MKT-003',
    'pasar-kariango': 'MKT-004',
    'pasar-langnga': 'MKT-005',
    'pasar-lanrisang': 'MKT-006',
    'pasar-lanrisang-jampue': 'MKT-006',
    'pasar-leppangang': 'MKT-007',
    'pasar-marawi': 'MKT-008',
    'pasar-pekkabata': 'MKT-009',
    'pasar-sentral-pinrang': 'MKT-010',
    'pasar-teppo': 'MKT-011',
    'pasar-teppo-benteng': 'MKT-011'
  });
  const ADMIN_AREAS = Object.freeze({
    'Watang Sawitto': ['Bentengnge','Jaya','Macorawalie','Penrang','Salo','Sawitto','Siparappe','Sipatokkong'],
    'Tiroang': ['Fakkie','Marawi','Mattiro Deceng','Pammase','Samaturue','Tiroang'],
    'Paleteang': ['Benteng Sawitto','Laleng Bata','Macinnae','Mamminasae','Pacongang','Temmassarangnge'],
    'Mattiro Bulu': ['Alitta','Bunga','Makkawaru','Manarang','Marannu','Padaelo','Padaidi','Padakkalawa','Pananrang'],
    'Lanrisang': ['Amassangeng','Barang Palie','Lanrisang','Lerang','Mallongi-Longi','Samaulue','Wae Tuoe'],
    'Suppa': ['Lero','Lotang Salo','Maritengngae','Polewali','Tasiwalie','Tellumpanua','Ujung Labuang','Watang Pulu','Watang Suppa','Wiring Tasi'],
    'Mattiro Sompe': ['Langnga','Massulowalie','Mattiro Tasi','Mattombong','Mattongang-Tongang','Pallameang','Patobong','Samaenre','Siwolong Polong'],
    'Cempa': ['Cempa','Mangki','Mattunru Tunrue','Salipolo','Sikkuale','Tadangpalie','Tanra Tuo'],
    'Patampanua': ['Benteng','Leppangang','Maccirinna','Malimpung','Masolo','Mattiro Ade','Padang Loang','Pincara','Sipatuo','Teppo','Tonyamang'],
    'Duampanua': ['Bababinanga','Barugae','Battusawe','Bittoeng','Bungi','Data','Kaballangang','Kaliang','Katomporang','Lampa','Maroneng','Massewae','Paria','Pekkabata','Tatae'],
    'Lembang': ['Bakaru','Basseang','Benteng Paremba','Betteng','Binanga Karaeng','Kariango','Lembang','Letta','Mesakada','Pakeng','Pangaparang','Rajang','Sabbang Paru','Sali-Sali','Suppirang','Ulusaddang'],
    'Batulappa': ['Batulappa','Kassa','Kaseralau','Tapporang','Watang Kassa']
  });

  function canonicalMarketId(value) {
    const raw = String(value || '').trim();
    const id = raw.toUpperCase();
    return MARKET_BY_ID[id] ? id : (LEGACY_MARKET_IDS[raw.toLowerCase()] || '');
  }

  function marketById(value) {
    return MARKET_BY_ID[canonicalMarketId(value)] || null;
  }

  const ROMAN_MONTHS = Object.freeze(['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']);
  function marketRegion(value) { return marketById(value)?.regionId || ''; }
  function assignedMarketIds(profile) {
    if (!['MARKET_ADMIN','MARKET_HEAD','UPTD_HEAD'].includes(profile?.role)) return [];
    return [...new Set((profile.marketIds || []).map(canonicalMarketId).filter(Boolean))];
  }
  function formatSkptNumber(sequence, marketId, month, year) {
    const market = marketById(marketId), serial = Number(sequence), monthNumber = Number(month), yearNumber = Number(year);
    if (!market) throw new Error('Kode pasar belum terdaftar pada master pasar.');
    if (!Number.isInteger(serial) || serial < 1 || serial > 9999) throw new Error('Nomor urut SKPT harus berada pada rentang 1 sampai 9999.');
    if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) throw new Error('Bulan nomor SKPT tidak valid.');
    if (!Number.isInteger(yearNumber) || yearNumber < 2024 || yearNumber > 2200) throw new Error('Tahun nomor SKPT tidak valid.');
    return `${String(serial).padStart(4, '0')}/SKPT/${market.skptCode}/${ROMAN_MONTHS[monthNumber - 1]}/${yearNumber}`;
  }

  window.EPASAR = {
    STEPS: 5,
    DRAFT_KEY: 'epasar_trader_draft_v2',
    SCHEMA_VERSION: 2,
    MAX_MARKET_PLACES: 25,
    REGISTRATION_PREFIX: 'REG-PIN',
    REQUIREMENTS_VERSION: 'SKPT-REQUIREMENTS-V2-PERDA6-2024-LAMPIRAN',
    BUSINESS_TYPES: ['Toko', 'Kaki Lima', 'Pasar', 'Warung/Kuliner', 'Rumahan', 'Keliling', 'Online', 'Lainnya'],
    MARKETS,
    MARKET_BY_ID,
    LEGACY_MARKET_IDS,
    ADMIN_AREAS,
    DISTRICTS: Object.freeze(Object.keys(ADMIN_AREAS)),
    villagesByDistrict: district => ADMIN_AREAS[String(district || '').trim()] || [],
    canonicalMarketId,
    marketById,
    marketRegion,
    assignedMarketIds,
    formatSkptNumber
  };
}());
