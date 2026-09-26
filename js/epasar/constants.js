(function () {
  'use strict';

  const MARKETS = Object.freeze([
    { id: 'MKT-001', name: 'Pasar Rakyat Bungi' },
    { id: 'MKT-002', name: 'Pasar Rakyat Cempa' },
    { id: 'MKT-003', name: 'Pasar Rakyat Kampung Jaya' },
    { id: 'MKT-004', name: 'Pasar Rakyat Kariango' },
    { id: 'MKT-005', name: 'Pasar Rakyat Langnga' },
    { id: 'MKT-006', name: 'Pasar Rakyat Lanrisang' },
    { id: 'MKT-007', name: 'Pasar Rakyat Leppangang' },
    { id: 'MKT-008', name: 'Pasar Rakyat Marawi' },
    { id: 'MKT-009', name: 'Pasar Rakyat Pekkabata' },
    { id: 'MKT-010', name: 'Pasar Rakyat Sentral Pinrang' },
    { id: 'MKT-011', name: 'Pasar Rakyat Teppo' }
  ].map(Object.freeze));

  const MARKET_BY_ID = Object.freeze(Object.fromEntries(MARKETS.map(market => [market.id, market])));
  const LEGACY_MARKET_IDS = Object.freeze({
    'pasar-pekkabata': 'MKT-009',
    'pasar-sentral-pinrang': 'MKT-010'
  });

  function canonicalMarketId(value) {
    const raw = String(value || '').trim();
    const id = raw.toUpperCase();
    return MARKET_BY_ID[id] ? id : (LEGACY_MARKET_IDS[raw.toLowerCase()] || '');
  }

  function marketById(value) {
    return MARKET_BY_ID[canonicalMarketId(value)] || null;
  }

  window.EPASAR = {
    STEPS: 5,
    DRAFT_KEY: 'epasar_trader_draft_v2',
    SCHEMA_VERSION: 2,
    REGISTRATION_PREFIX: 'REG-PIN',
    REQUIREMENTS_VERSION: 'SKPT-REQUIREMENTS-V1-PERDA6-2024',
    BUSINESS_TYPES: ['Toko', 'Kaki Lima', 'Pasar', 'Warung/Kuliner', 'Rumahan', 'Keliling', 'Online', 'Lainnya'],
    MARKETS,
    MARKET_BY_ID,
    LEGACY_MARKET_IDS,
    canonicalMarketId,
    marketById
  };
}());
