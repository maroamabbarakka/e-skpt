'use strict';

const UAT_TAG = { isDemo: true, environment: 'INTERNAL_UAT', schemaVersion: 1 };

const traders = [
  { id: 'uat-trader-001', code: 'REG-UAT-0001', name: 'Siti Aminah UAT', marketId: 'MKT-010', business: 'Kuliner', unitClaim: 'A-18', unitVerified: 'A-19', skpt: 'SKPT-UAT-2026-0001', status: 'ISSUED' },
  { id: 'uat-trader-002', code: 'REG-UAT-0002', name: 'Andi Ramadhan UAT', marketId: 'MKT-009', business: 'Perdagangan', unitClaim: 'B-07', unitVerified: 'B-07', skpt: 'SKPT-UAT-2026-0002', status: 'ISSUED' },
  { id: 'uat-trader-003', code: 'REG-UAT-0003', name: 'Nurul Husna UAT', marketId: null, business: 'Kerajinan', unitClaim: null, unitVerified: null, skpt: null, status: 'SUBMITTED' },
  { id: 'uat-trader-004', code: 'REG-UAT-0004', name: 'Budi Konflik UAT', marketId: 'MKT-010', business: 'Perdagangan', unitClaim: 'A-18', unitVerified: null, skpt: 'SKPT-UAT-2026-0004', status: 'CONFLICT' },
];

function documents() {
  return traders.filter((t) => t.skpt && t.status === 'ISSUED').map((t) => ({
    id: `uat-doc-${t.id.slice(-3)}`,
    applicationId: `uat-skpt-${t.id.slice(-3)}`,
    traderId: t.id,
    documentNumber: t.skpt,
    status: t.status,
    documentType: 'SKPT',
    validFrom: '2026-09-25',
    validUntil: '2028-09-24',
    qrPayload: `EPASAR-UAT-DOC-${t.skpt}`,
    hash: `UAT-HASH-${t.id}`,
    tteStatus: 'DEMO_REGISTERED',
    officialReference: null,
    ...UAT_TAG,
  }));
}

function related() {
  const data = {
    businesses: [
      { id: 'uat-business-001', traderId: 'uat-trader-001', name: 'Warung Siti UAT', category: 'FOOD_PROCESSING', status: 'VERIFIED' },
      { id: 'uat-business-002', traderId: 'uat-trader-002', name: 'Toko Andi UAT', category: 'TRADE', status: 'VERIFIED' },
      { id: 'uat-business-003', traderId: 'uat-trader-003', name: 'Kriya Nurul UAT', category: 'CRAFT', status: 'CLAIMED' },
      { id: 'uat-business-004', traderId: 'uat-trader-004', name: 'Toko Konflik UAT', category: 'TRADE', status: 'CLAIMED' },
    ],
    business_locations: [
      { id: 'uat-location-001', traderId: 'uat-trader-001', businessId: 'uat-business-001', marketId: 'MKT-010', locationType: 'MARKET_UNIT', unitNumber: 'A-19' },
      { id: 'uat-location-002', traderId: 'uat-trader-002', businessId: 'uat-business-002', marketId: 'MKT-009', locationType: 'MARKET_UNIT', unitNumber: 'B-07' },
      { id: 'uat-location-003', traderId: 'uat-trader-003', businessId: 'uat-business-003', marketId: '', locationType: 'HOME', unitNumber: '' },
      { id: 'uat-location-004', traderId: 'uat-trader-004', businessId: 'uat-business-004', marketId: 'MKT-010', locationType: 'MARKET_UNIT', unitNumber: 'A-18' },
    ],
    business_classifications: [
      { id: 'uat-class-001', traderId: 'uat-trader-001', classification: 'UMKM', source: 'UAT_SEED', status: 'VERIFIED' },
      { id: 'uat-class-002', traderId: 'uat-trader-002', classification: 'TRADE', source: 'UAT_SEED', status: 'VERIFIED' },
      { id: 'uat-class-003', traderId: 'uat-trader-003', classification: 'CRAFT', source: 'UAT_SEED', status: 'CLAIMED' },
    ],
    market_claims: [
      { id: 'uat-claim-001', traderId: 'uat-trader-001', marketId: 'MKT-010', submittedUnit: 'A-18', status: 'MARKET_VERIFIED' },
      { id: 'uat-claim-002', traderId: 'uat-trader-002', marketId: 'MKT-009', submittedUnit: 'B-07', status: 'MARKET_VERIFIED' },
      { id: 'uat-claim-004', traderId: 'uat-trader-004', marketId: 'MKT-010', submittedUnit: 'A-18', status: 'CONFLICT' },
    ],
    market_units: [
      { id: 'uat-unit-001', marketId: 'MKT-010', unitNumber: 'A-19', unitType: 'KIOS', block: 'A', floor: '1', status: 'VERIFIED' },
      { id: 'uat-unit-002', marketId: 'MKT-009', unitNumber: 'B-07', unitType: 'LOS', block: 'B', floor: '1', status: 'VERIFIED' },
    ],
    market_occupancies: [
      { id: 'uat-occupancy-v2-001', unitId: 'uat-unit-001', traderId: 'uat-trader-001', marketId: 'MKT-010', status: 'ACTIVE' },
      { id: 'uat-occupancy-v2-002', unitId: 'uat-unit-002', traderId: 'uat-trader-002', marketId: 'MKT-009', status: 'ACTIVE' },
    ],
    verification_records: [
      { id: 'uat-verification-001', claimId: 'uat-claim-001', before: 'A-18', after: 'A-19', reason: 'Nomor fisik lapangan', status: 'MARKET_VERIFIED' },
      { id: 'uat-verification-002', claimId: 'uat-claim-002', before: 'B-07', after: 'B-07', reason: 'Sesuai pemeriksaan', status: 'MARKET_VERIFIED' },
    ],
    skpt_annual_validations: [
      { id: 'uat-validation-001', applicationId: 'uat-skpt-001', traderId: 'uat-trader-001', validationYear: 2026, status: 'VALIDATED' },
      { id: 'uat-validation-002', applicationId: 'uat-skpt-002', traderId: 'uat-trader-002', validationYear: 2026, status: 'DUE' },
    ],
    notifications: [
      { id: 'uat-notification-001', type: 'MATERIAL_MARKET_CHANGE', recipientRole: 'KADIS', applicationId: 'uat-skpt-001', status: 'UNREAD', reason: 'Nomor unit berubah A-18 menjadi A-19' },
    ],
    public_status: [
      { id: 'uat-status-token-v2-001', publicToken: 'uat-status-token-v2-001', registrationCode: 'REG-UAT-0001', status: 'ISSUED', publicStatus: true, displayName: 'Siti Aminah UAT', traderId: 'uat-trader-001', businessType: 'Kuliner', marketName: 'Pasar Rakyat Sentral Pinrang', statementVersion: 'SKPT-STATEMENT-V3-PERDA6-2024', statementAcceptedAt: '2026-09-25T08:30:00.000+08:00' },
      { id: 'uat-status-token-v2-002', publicToken: 'uat-status-token-v2-002', registrationCode: 'REG-UAT-0002', status: 'ISSUED', publicStatus: true, displayName: 'Andi Ramadhan UAT', traderId: 'uat-trader-002', businessType: 'Perdagangan', marketName: 'Pasar Rakyat Pekkabata', statementVersion: 'SKPT-STATEMENT-V3-PERDA6-2024', statementAcceptedAt: '2026-09-25T09:15:00.000+08:00' },
    ],
    public_skpt_verification: [
      { id: 'uat-doc-token-v2-001', verificationToken: 'uat-doc-token-v2-001', number: 'SKPT-UAT-2026-0001', displayName: 'Siti Aminah UAT', status: 'ISSUED', traderId: 'uat-trader-001', marketUnitId: 'uat-unit-001', issueDate: '2026-09-25T00:00:00.000Z', validUntil: '2028-09-24T00:00:00.000Z', documentHash: '68b3a9431af30ce6f43aab576913d57f7fa62e51bb82870d9868f03e147f5f61', hashAlgorithm: 'SHA-256', hashScope: 'CANONICAL_DOCUMENT_SNAPSHOT', tteStatus: 'UAT_SIMULATED', officialReference: 'UAT-REF-001', documentSnapshot: { displayName: 'Siti Aminah UAT', address: 'Kelurahan Macorawalie, Kecamatan Watang Sawitto, Kabupaten Pinrang', businessType: 'Kuliner', marketName: 'Pasar Rakyat Sentral Pinrang', marketId: 'MKT-010', unitType: 'KIOS', unitNumber: 'A-19', block: 'A', floor: '1', areaM2: 9 }, signatory: { name: 'MUHAMMAD YUSUF NUR, S.STP', nip: '19800326 200003 1 001', rank: 'Pembina Tk. I', position: 'Kepala Dinas Perindustrian, Perdagangan, Energi dan Sumber Daya Mineral Kabupaten Pinrang', authority: 'a.n. BUPATI PINRANG' }, legalBasisVersion: 'PINRANG-SKPT-2026-DRAFT-01', environment: 'UAT', isDemo: true, schemaVersion: 3 },
      { id: 'uat-doc-token-v2-002', verificationToken: 'uat-doc-token-v2-002', number: 'SKPT-UAT-2026-0002', displayName: 'Andi Ramadhan UAT', status: 'ISSUED', traderId: 'uat-trader-002', marketUnitId: 'uat-unit-002', issueDate: '2026-09-25T00:00:00.000Z', validUntil: '2028-09-24T00:00:00.000Z', documentHash: 'bfc750f42c785f0f058f90852620e257310aa22ba82322a7ab619c5beff06c1a', hashAlgorithm: 'SHA-256', hashScope: 'CANONICAL_DOCUMENT_SNAPSHOT', tteStatus: 'UAT_SIMULATED', officialReference: 'UAT-REF-002', documentSnapshot: { displayName: 'Andi Ramadhan UAT', address: 'Kelurahan Pekkabata, Kecamatan Duampanua, Kabupaten Pinrang', businessType: 'Perdagangan', marketName: 'Pasar Rakyat Pekkabata', marketId: 'MKT-009', unitType: 'LOS', unitNumber: 'B-07', block: 'B', floor: '1', areaM2: 6 }, signatory: { name: 'MUHAMMAD YUSUF NUR, S.STP', nip: '19800326 200003 1 001', rank: 'Pembina Tk. I', position: 'Kepala Dinas Perindustrian, Perdagangan, Energi dan Sumber Daya Mineral Kabupaten Pinrang', authority: 'a.n. BUPATI PINRANG' }, legalBasisVersion: 'PINRANG-SKPT-2026-DRAFT-01', environment: 'UAT', isDemo: true, schemaVersion: 3 },
    ],
  };
  data.public_skpt_verification.forEach((document, index) => {
    document.annualValidations = [
      { year: 2026, status: 'INITIAL_ISSUE', validatedAt: '2026-09-25T00:00:00.000Z', reference: `UAT-REF-00${index + 1}` },
      { year: 2027, status: 'DUE', validatedAt: null, reference: '' }
    ];
  });
  return data;
}

module.exports = { UAT_TAG, traders, documents, related };
