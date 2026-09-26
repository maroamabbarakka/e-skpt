import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, setDoc, getDoc, getDocs, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import fs from 'node:fs';

const projectId = 'demo-epasar';
const rules = fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId, firestore: { rules } });

await env.withSecurityRulesDisabled(async context => {
  const db = context.firestore();
  await setDoc(doc(db, 'users', 'market-head-1'), { status: 'ACTIVE', role: 'MARKET_HEAD', marketIds: ['M1'] });
  await setDoc(doc(db, 'users', 'market-head-2'), { status: 'ACTIVE', role: 'MARKET_HEAD', marketIds: ['M2'] });
  await setDoc(doc(db, 'users', 'kadis-1'), { status: 'ACTIVE', role: 'KADIS' });
  await setDoc(doc(db, 'users', 'admin-1'), { status: 'ACTIVE', role: 'DISPERINDAG_ADMIN' });
  await setDoc(doc(db, 'trader_intake', 'private-1'), { status: 'SUBMITTED' });
  await setDoc(doc(db, 'traders', 'target-trader-doc'), { traderId: 'TRD-ATOMIC-2', displayName: 'Penerima Uji', status: 'ACTIVE' });
  await setDoc(doc(db, 'market_claims', 'claim-1'), { traderId: 'TRD-1', marketId: 'M1', verificationStatus: 'UNVERIFIED' });
  await setDoc(doc(db, 'market_claims', 'claim-2'), { traderId: 'TRD-2', marketId: 'M2', verificationStatus: 'UNVERIFIED' });
  await setDoc(doc(db, 'market_claims', 'claim-e2e'), { traderId: 'TRD-E2E', marketId: 'M1', verificationStatus: 'UNVERIFIED', applicationId: 'app-e2e', claimedUnitType: 'KIOS', claimedUnitNumber: 'UAT-1' });
  await setDoc(doc(db, 'market_claims', 'claim-atomic'), { traderId: 'TRD-ATOMIC-1', marketId: 'M1', verificationStatus: 'UNVERIFIED' });
  await setDoc(doc(db, 'market_units', 'unit-1'), { marketId: 'M1', unitNumber: 'A-1' });
  await setDoc(doc(db, 'market_units', 'unit-2'), { marketId: 'M2', unitNumber: 'B-1' });
  await setDoc(doc(db, 'skpt_applications', 'app-1'), { traderId: 'PDG-1', claimId: 'claim-1', marketId: 'M1', status: 'MARKET_VERIFICATION' });
  await setDoc(doc(db, 'skpt_applications', 'app-e2e'), { traderId: 'TRD-E2E', claimId: 'claim-e2e', marketId: 'M1', status: 'MARKET_VERIFICATION' });
  await setDoc(doc(db, 'public_status', 'status-token-1'), { publicToken: 'status-token-1', publicStatus: true, registrationCode: 'REG-PIN-2026-000001', status: 'ADMIN_REVIEW' });
  await setDoc(doc(db, 'public_status', 's'.repeat(32)), { publicToken: 's'.repeat(32), publicStatus: true, registrationCode: 'REG-PIN-2026-MULTI01', status: 'MARKET_VERIFICATION', traderId: 'TRD-1' });
  await setDoc(doc(db, 'public_skpt_verification', 'verify-token-1'), { verificationToken: 'verify-token-1', status: 'ISSUED', number: 'SKPT-1' });
  await setDoc(doc(db, 'public_stats', 'summary'), { totalTraders: 2, totalIssuedSkpt: 1, totalBusinesses: 2, totalLocations: 2, totalCategories: 2, marketTraders: 1, nonMarketTraders: 1, topCategories: [{ label: 'TRADE', count: 1 }, { label: 'CRAFT', count: 1 }], updatedAt: new Date(), schemaVersion: 1 });
  await setDoc(doc(db, 'markets', 'MKT-001'), { marketId: 'MKT-001', name: 'Pasar Rakyat Bungi', status: 'ACTIVE', schemaVersion: 1, updatedAt: new Date() });
  await setDoc(doc(db, 'trader_media', 'private-media-1'), { ownerType: 'TRADER_INTAKE', ownerId: 'private-1', mediaType: 'PROFILE', mime: 'image/webp', width: 600, height: 800, binaryBytes: 3, base64Bytes: 4, dataBase64: 'YWJj', status: 'PENDING', schemaVersion: 1 });
  await setDoc(doc(db, 'trader_media', 'public-photo-token-1'), { ownerType: 'PUBLIC_DOCUMENT', ownerId: 'public-photo-token-1', mediaType: 'PROFILE_PUBLIC', mime: 'image/webp', width: 600, height: 800, binaryBytes: 3, base64Bytes: 4, dataBase64: 'YWJj', status: 'PUBLIC', schemaVersion: 2, sourceMediaId: 'private-media-1' });
  await setDoc(doc(db, 'public_skpt_verification', 'annual-token-1'), { verificationToken: 'annual-token-1', number: 'SKPT-ANNUAL-1', displayName: 'Pedagang Uji', status: 'ISSUED', traderId: 'TRD-1', marketUnitId: 'unit-1', issueDate: '2026-01-01T00:00:00.000Z', validUntil: '2028-01-01T00:00:00.000Z', documentHash: 'hash', hashAlgorithm: 'SHA-256', hashScope: 'CANONICAL_DOCUMENT_SNAPSHOT', tteStatus: 'REGISTERED_MANUAL', officialReference: 'REF-1', documentSnapshot: { displayName: 'Pedagang Uji', address: 'Pinrang', businessType: 'Perdagangan', marketName: 'Pasar Uji', marketId: 'M1', unitType: 'LOS', unitNumber: 'A-1', block: 'A', floor: '1', areaM2: 6 }, signatory: { name: 'Pejabat Uji', nip: '1', rank: 'Pembina', position: 'Kepala Dinas', authority: 'a.n. BUPATI PINRANG' }, annualValidations: [{ year: 2026, status: 'INITIAL_ISSUE' }, { year: 2027, status: 'DUE' }], legalBasisVersion: 'TEST', environment: 'TEST', isDemo: true, schemaVersion: 2 });
  await setDoc(doc(db, 'skpt_documents', 'skpt-doc-1'), { verificationToken: 'annual-token-1', number: 'SKPT-ANNUAL-1', status: 'ISSUED', traderId: 'TRD-1', issueDate: '2026-01-01T00:00:00.000Z', validUntil: '2028-01-01T00:00:00.000Z', documentSnapshot: { marketId: 'M1' }, annualValidations: [{ year: 2026, status: 'INITIAL_ISSUE' }, { year: 2027, status: 'DUE' }] });
  await setDoc(doc(db, 'skpt_documents', 'skpt-doc-2'), { verificationToken: 'annual-token-2', number: 'SKPT-ANNUAL-2', status: 'ISSUED', traderId: 'TRD-2', issueDate: '2026-01-01T00:00:00.000Z', validUntil: '2028-01-01T00:00:00.000Z', documentSnapshot: { marketId: 'M1' }, annualValidations: [{ year: 2026, status: 'INITIAL_ISSUE' }, { year: 2027, status: 'DUE' }] });
});

const marketHead = env.authenticatedContext('market-head-1').firestore();
const otherMarketHead = env.authenticatedContext('market-head-2').firestore();
const kadis = env.authenticatedContext('kadis-1').firestore();
const admin = env.authenticatedContext('admin-1').firestore();
const anonymous = env.unauthenticatedContext().firestore();

await assertSucceeds(getDoc(doc(anonymous, 'markets', 'MKT-001')));
await assertSucceeds(getDocs(collection(anonymous, 'markets')));
await assertFails(setDoc(doc(anonymous, 'markets', 'MKT-099'), { marketId: 'MKT-099', name: 'Pasar Palsu', status: 'ACTIVE', schemaVersion: 1, updatedAt: serverTimestamp() }));
await assertSucceeds(setDoc(doc(admin, 'markets', 'MKT-011'), { marketId: 'MKT-011', name: 'Pasar Rakyat Teppo', status: 'ACTIVE', schemaVersion: 1, updatedAt: serverTimestamp() }));
await assertSucceeds(setDoc(doc(marketHead, 'public_market_units', 'unit-token-public-001'), { verificationToken: 'unit-token-public-001', unitId: 'UNT-PUBLIC-1', marketId: 'M1', marketName: 'Pasar Uji', unitType: 'PELATARAN', unitNumber: 'P-1', block: '', floor: '', areaM2: 4, status: 'TERVERIFIKASI', publicStatus: true, schemaVersion: 1, updatedAt: serverTimestamp() }));
await assertSucceeds(getDoc(doc(anonymous, 'public_market_units', 'unit-token-public-001')));
await assertFails(getDocs(collection(anonymous, 'public_market_units')));
await assertFails(setDoc(doc(otherMarketHead, 'public_market_units', 'forged-unit-token-001'), { verificationToken: 'forged-unit-token-001', unitId: 'UNT-PUBLIC-2', marketId: 'M1', marketName: 'Pasar Uji', unitType: 'KIOS', unitNumber: 'K-1', block: '', floor: '', areaM2: 4, status: 'TERVERIFIKASI', publicStatus: true, schemaVersion: 1, updatedAt: serverTimestamp() }));

const validPublicIntake = {
  registrationCode: 'REG-PIN-2026-MARKET01', submittedAt: serverTimestamp(), status: 'SUBMITTED', source: 'PUBLIC_FORM', schemaVersion: 1, publicToken: 'a'.repeat(32),
  identity: { name: 'Pedagang Uji', phone: '081234567890', district: 'Watang Sawitto', village: 'Uji', address: 'Pinrang', religion: 'Islam', citizenship: 'Indonesia', nik: '7315010101010001' },
  businessDrafts: [{ name: 'Usaha Uji', type: 'Perdagangan' }], hasMarketUnit: true, applySkpt: true,
  marketDraft: { marketName: 'Pasar Sentral Pinrang', unitType: 'KIOS', unitNumber: 'A-1', block: 'A', floor: '1', areaM2: 6, locationHint: 'Dekat pintu utama' },
  statementAccepted: true, statement: { version: 'SKPT-STATEMENT-V2', type: 'PERNYATAAN_ELEKTRONIK_SKPT', text: 'Pernyataan', accepted: true, acceptanceMethod: 'AFFIRMATIVE_CHECKBOX', acceptedAt: serverTimestamp() }
};
await assertSucceeds(setDoc(doc(anonymous, 'trader_intake', 'valid-market-intake'), validPublicIntake));
const validMultiIntake = {
  ...validPublicIntake,
  publicToken: 'v'.repeat(32), schemaVersion: 2,
  statement: { ...validPublicIntake.statement, version: 'SKPT-STATEMENT-V3-PERDA6-2024' },
  businessDrafts: [{ draftId: 'BUS-1', name: 'Usaha Uji', type: 'Toko', group: 'Bahan pangan kering', category: 'Sembako', monthlyRevenue: 10000000, workerCount: 2, expense: '', locations: [{ draftId: 'LOC-1', type: 'MARKET', district: 'Watang Sawitto', village: 'Pinrang', address: 'Kompleks pasar', marketPlaces: [{ draftId: 'PLC-1', marketId: 'M1', marketName: 'Pasar Uji', unitType: 'KIOS', unitNumber: 'A-1', block: 'A', floor: '1', areaM2: 6, locationHint: '', applySkpt: true }, { draftId: 'PLC-2', marketId: 'M2', marketName: 'Pasar Uji 2', unitType: 'PELATARAN', unitNumber: 'P-2', block: '', floor: '', areaM2: null, locationHint: '', applySkpt: true }] }] }],
  marketDraft: { draftId: 'PLC-1', marketId: 'M1', marketName: 'Pasar Uji', unitType: 'KIOS', unitNumber: 'A-1', block: 'A', floor: '1', areaM2: 6, locationHint: '', applySkpt: true },
  requirementsAcceptance: { version: 'SKPT-REQUIREMENTS-V1-PERDA6-2024', accepted: true, acceptedAt: serverTimestamp(), itemCodes: ['DATA_VERIFICATION','SEPARATE_APPLICATION_PER_PLACE','TWO_YEAR_VALIDITY','NOT_PROOF_OF_OWNERSHIP','SAME_LOCATION_LIMIT_REVIEW'] }
};
await assertSucceeds(setDoc(doc(anonymous, 'trader_intake', 'valid-multi-intake'), validMultiIntake));
await assertSucceeds(setDoc(doc(anonymous, 'trader_intake', 'valid-multi-intake-without-skpt'), {
  ...validMultiIntake,
  publicToken: 'n'.repeat(32),
  registrationCode: 'REG-PIN-2026-NOSKPT1',
  applySkpt: false,
  identity: { ...validMultiIntake.identity, religion: '', citizenship: '' },
  businessDrafts: validMultiIntake.businessDrafts.map(business => ({ ...business, locations: business.locations.map(location => ({ ...location, marketPlaces: location.marketPlaces.map(place => ({ ...place, applySkpt: false })) })) })),
  marketDraft: { ...validMultiIntake.marketDraft, applySkpt: false },
  statement: { ...validMultiIntake.statement, type: 'PERNYATAAN_ELEKTRONIK_PENDATAAN' }
}));
await assertFails(setDoc(doc(anonymous, 'trader_intake', 'invalid-no-skpt-statement-type'), {
  ...validMultiIntake,
  publicToken: 'o'.repeat(32),
  registrationCode: 'REG-PIN-2026-NOSKPT2',
  applySkpt: false,
  statement: { ...validMultiIntake.statement, type: 'PERNYATAAN_ELEKTRONIK_SKPT' }
}));
await assertFails(setDoc(doc(anonymous, 'trader_intake', 'invalid-multi-intake'), { ...validMultiIntake, publicToken: 'w'.repeat(32), requirementsAcceptance: { ...validMultiIntake.requirementsAcceptance, accepted: false } }));
const validMarketCorrection = { registrationCode: 'REG-PIN-2026-MULTI01', accessToken: 's'.repeat(32), createdAt: serverTimestamp(), status: 'PENDING_REVIEW', source: 'PUBLIC_FORM', schemaVersion: 2, publicToken: 'r'.repeat(32), section: 'marketUnit', value: 'Nomor yang benar A-2', reason: 'Hasil pemeriksaan ulang', marketId: 'M1', claimId: 'claim-1', routingRoles: ['MARKET_HEAD','DISPERINDAG_ADMIN'] };
await assertSucceeds(setDoc(doc(anonymous, 'correction_requests', 'valid-market-correction-v2'), validMarketCorrection));
await assertFails(setDoc(doc(anonymous, 'correction_requests', 'forged-market-correction-v2'), { ...validMarketCorrection, publicToken: 'q'.repeat(32), marketId: 'M2' }));
await assertSucceeds(setDoc(doc(anonymous, 'trader_intake', 'valid-pelataran-intake'), {
  ...validPublicIntake,
  publicToken: 'p'.repeat(32),
  registrationCode: 'REG-PIN-2026-PLTRN01',
  marketDraft: { ...validPublicIntake.marketDraft, unitType: 'PELATARAN', unitNumber: 'PLT-1' }
}));
await assertFails(setDoc(doc(anonymous, 'trader_intake', 'missing-market-detail'), { ...validPublicIntake, publicToken: 'b'.repeat(32), marketDraft: { ...validPublicIntake.marketDraft, unitNumber: '' } }));
await assertFails(setDoc(doc(anonymous, 'trader_intake', 'skpt-without-market'), { ...validPublicIntake, publicToken: 'c'.repeat(32), hasMarketUnit: false, applySkpt: true }));
const validPerda6Intake = {
  ...validPublicIntake,
  publicToken: 'd'.repeat(32),
  identity: { ...validPublicIntake.identity, religion: 'Islam', citizenship: 'Indonesia' },
  statement: { ...validPublicIntake.statement, version: 'SKPT-STATEMENT-V3-PERDA6-2024' }
};
await assertSucceeds(setDoc(doc(anonymous, 'trader_intake', 'valid-perda6-intake'), validPerda6Intake));
await assertFails(setDoc(doc(anonymous, 'trader_intake', 'missing-perda6-identity'), {
  ...validPerda6Intake, publicToken: 'e'.repeat(32), identity: { ...validPerda6Intake.identity, religion: '' }
}));

await assertSucceeds(getDoc(doc(admin, 'trader_intake', 'private-1')));
await assertFails(getDoc(doc(marketHead, 'trader_intake', 'private-1')));
await assertFails(setDoc(doc(marketHead, 'trader_intake', 'new-1'), { status: 'APPROVED' }));
await assertFails(setDoc(doc(kadis, 'trader_intake', 'new-2'), { status: 'APPROVED' }));
await assertSucceeds(getDoc(doc(marketHead, 'market_claims', 'claim-1')));
await assertFails(getDoc(doc(marketHead, 'market_claims', 'claim-2')));
await assertSucceeds(getDoc(doc(marketHead, 'market_units', 'unit-1')));
await assertSucceeds(getDoc(doc(kadis, 'market_claims', 'claim-1')));
await assertFails(getDoc(doc(marketHead, 'market_units', 'unit-2')));
await assertFails(setDoc(doc(marketHead, 'market_units', 'unit-cross'), { marketId: 'M2', unitNumber: 'X-1' }));
await assertSucceeds(setDoc(doc(marketHead, 'market_units', 'UNT-TWO-STAGE'), { unitId: 'UNT-TWO-STAGE', marketId: 'M1', unitType: 'KIOS', unitNumber: 'TS-1', block: 'A', floor: '1', areaM2: 6, qrUnitToken: 'token-two-stage', status: 'AVAILABLE', currentTraderId: '', currentOccupancyId: '', schemaVersion: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
const twoStageBatch = writeBatch(marketHead);
twoStageBatch.update(doc(marketHead, 'market_units', 'UNT-TWO-STAGE'), { status: 'OCCUPIED', currentTraderId: 'TRD-E2E', currentOccupancyId: 'OCC-TWO-STAGE', updatedAt: serverTimestamp() });
twoStageBatch.set(doc(marketHead, 'market_occupancies', 'OCC-TWO-STAGE'), { occupancyId: 'OCC-TWO-STAGE', marketUnitId: 'UNT-TWO-STAGE', marketId: 'M1', traderId: 'TRD-E2E', claimId: 'claim-e2e', status: 'ACTIVE', startedAt: serverTimestamp(), endedAt: null, createdBy: 'market-head-1', schemaVersion: 1 });
await assertSucceeds(twoStageBatch.commit());
const unitBatch = writeBatch(marketHead);
unitBatch.set(doc(marketHead, 'market_units', 'UNT-ATOMIC-1'), { unitId: 'UNT-ATOMIC-1', marketId: 'M1', unitType: 'LOS', unitNumber: 'A-9', status: 'OCCUPIED', currentTraderId: 'TRD-ATOMIC-1', currentOccupancyId: 'OCC-ATOMIC-1' });
unitBatch.set(doc(marketHead, 'market_occupancies', 'OCC-ATOMIC-1'), { occupancyId: 'OCC-ATOMIC-1', marketUnitId: 'UNT-ATOMIC-1', marketId: 'M1', traderId: 'TRD-ATOMIC-1', claimId: 'claim-atomic', status: 'ACTIVE', createdBy: 'market-head-1' });
await assertSucceeds(unitBatch.commit());
await assertFails(setDoc(doc(marketHead, 'market_units', 'UNT-ATOMIC-1'), { unitId: 'UNT-ATOMIC-1', marketId: 'M1', unitType: 'LOS', unitNumber: 'A-9', status: 'OCCUPIED', currentTraderId: 'TRD-ATOMIC-2', currentOccupancyId: 'OCC-ATOMIC-2' }));
await assertFails(setDoc(doc(otherMarketHead, 'market_occupancies', 'OCC-CROSS'), { occupancyId: 'OCC-CROSS', marketUnitId: 'UNT-ATOMIC-1', marketId: 'M1', traderId: 'TRD-X', status: 'ACTIVE', createdBy: 'market-head-2' }));
const verificationBatch = writeBatch(marketHead);
verificationBatch.update(doc(marketHead, 'market_claims', 'claim-e2e'), { verified: { marketId: 'M1', unitId: 'UNT-E2E', unitNumber: 'UAT-1', unitType: 'KIOS', block: 'UAT', floor: '1', areaM2: 6, actualUser: 'Pedagang Uji', conflict: false }, verificationStatus: 'VERIFIED', marketUnitId: 'UNT-E2E', updatedAt: serverTimestamp() });
verificationBatch.set(doc(marketHead, 'market_units', 'UNT-E2E'), { unitId: 'UNT-E2E', marketId: 'M1', unitType: 'KIOS', unitNumber: 'UAT-1', block: 'UAT', floor: '1', areaM2: 6, qrUnitToken: 'token-e2e', status: 'OCCUPIED', currentTraderId: 'TRD-E2E', currentOccupancyId: 'OCC-E2E', schemaVersion: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
verificationBatch.set(doc(marketHead, 'market_occupancies', 'OCC-E2E'), { occupancyId: 'OCC-E2E', marketUnitId: 'UNT-E2E', marketId: 'M1', traderId: 'TRD-E2E', claimId: 'claim-e2e', status: 'ACTIVE', startedAt: serverTimestamp(), endedAt: null, createdBy: 'market-head-1', schemaVersion: 1 });
verificationBatch.set(doc(marketHead, 'verification_records', 'VER-E2E'), { claimId: 'claim-e2e', marketId: 'M1', marketUnitId: 'UNT-E2E', before: {}, after: {}, reason: 'Uji', actorUid: 'market-head-1', actorRole: 'MARKET_HEAD', status: 'MARKET_VERIFIED', createdAt: serverTimestamp() });
verificationBatch.update(doc(marketHead, 'skpt_applications', 'app-e2e'), { status: 'KADIS_REVIEW', marketUnitId: 'UNT-E2E', verificationRecordId: 'VER-E2E', statusHistory: [], updatedAt: serverTimestamp() });
await assertSucceeds(verificationBatch.commit());
await assertSucceeds(setDoc(doc(kadis, 'skpt_applications', 'app-e2e'), {
  status: 'TTE_PENDING',
  approval: { decision: 'APPROVED', note: 'Disetujui untuk UAT.', actorUid: 'kadis-1', actorRole: 'KADIS', approvedAt: serverTimestamp() },
  statusHistory: [{ from: 'KADIS_REVIEW', to: 'APPROVED' }, { from: 'APPROVED', to: 'TTE_PENDING' }],
  updatedAt: serverTimestamp()
}, { merge: true }));
await assertFails(setDoc(doc(admin, 'skpt_applications', 'app-e2e'), { status: 'ISSUED', skptDocumentId: 'forged-doc', statusHistory: [], updatedAt: serverTimestamp() }, { merge: true }));
const issuedSnapshot = { displayName: 'Pedagang Uji', address: 'Pinrang', businessType: 'Perdagangan', marketName: 'Pasar Uji', marketId: 'M1', unitType: 'KIOS', unitNumber: 'UAT-1', block: 'UAT', floor: '1', areaM2: 6 };
const issuedSignatory = { name: 'Pejabat Uji', nip: '1', rank: 'Pembina', position: 'Kepala Dinas', authority: 'a.n. BUPATI PINRANG' };
const issuedAnnual = [{ year: 2026, status: 'INITIAL_ISSUE' }, { year: 2027, status: 'DUE' }];
const issuedHash = 'a'.repeat(64), issuedToken = 'uat-issued-verification-token-001';
const issuanceBatch = writeBatch(kadis);
issuanceBatch.set(doc(kadis, 'skpt_documents', 'uat-issued-doc-1'), { skptId: 'uat-issued-doc-1', applicationId: 'app-e2e', number: 'SKPT-UAT-001', traderId: 'TRD-E2E', marketUnitId: 'UNT-E2E', issueDate: '2026-09-26T00:00:00.000Z', validUntil: '2028-09-26T00:00:00.000Z', status: 'ISSUED', tteStatus: 'UAT_SIMULATED', documentHash: issuedHash, verificationToken: issuedToken, documentSnapshot: issuedSnapshot, signatory: issuedSignatory, annualValidations: issuedAnnual, environment: 'UAT', isDemo: true, issuedBy: 'kadis-1', issuedAt: serverTimestamp() });
issuanceBatch.update(doc(kadis, 'skpt_applications', 'app-e2e'), { status: 'ISSUED', skptDocumentId: 'uat-issued-doc-1', statusHistory: [{ from: 'TTE_PENDING', to: 'ISSUED' }], updatedAt: serverTimestamp() });
issuanceBatch.set(doc(kadis, 'public_skpt_verification', issuedToken), { verificationToken: issuedToken, documentId: 'uat-issued-doc-1', applicationId: 'app-e2e', number: 'SKPT-UAT-001', displayName: 'Pedagang Uji', status: 'ISSUED', traderId: 'TRD-E2E', marketUnitId: 'UNT-E2E', issueDate: '2026-09-26T00:00:00.000Z', validUntil: '2028-09-26T00:00:00.000Z', documentHash: issuedHash, hashAlgorithm: 'SHA-256', hashScope: 'CANONICAL_DOCUMENT_SNAPSHOT', tteStatus: 'UAT_SIMULATED', officialReference: 'UAT-REF-001', documentSnapshot: issuedSnapshot, signatory: issuedSignatory, annualValidations: issuedAnnual, photoMediaToken: '', legalBasisVersion: 'TEST', environment: 'UAT', isDemo: true, schemaVersion: 3 });
await assertSucceeds(issuanceBatch.commit());
await assertFails(setDoc(doc(kadis, 'skpt_documents', 'uat-issued-doc-1'), { number: 'DIUBAH' }, { merge: true }));
await assertSucceeds(setDoc(doc(kadis, 'skpt_documents', 'uat-issued-doc-1'), { annualValidations: [{ year: 2026, status: 'INITIAL_ISSUE' }, { year: 2027, status: 'VALIDATED' }] }, { merge: true }));
const changeRequest = { requestType: 'OCCUPANCY_CHANGE', action: 'TRANSFER', marketUnitId: 'UNT-ATOMIC-1', marketId: 'M1', currentOccupancyId: 'OCC-ATOMIC-1', currentTraderId: 'TRD-ATOMIC-1', newTraderId: 'TRD-ATOMIC-2', reason: 'Pengalihan telah diperiksa.', status: 'PENDING_REVIEW', submittedBy: 'market-head-1', submittedRole: 'MARKET_HEAD', submittedAt: serverTimestamp(), decidedBy: null, decidedAt: null, decisionNote: '', source: 'MARKET_HEAD_VERIFICATION', schemaVersion: 2 };
await assertSucceeds(setDoc(doc(marketHead, 'correction_requests', 'OCC-CHANGE-1'), changeRequest));
await assertFails(setDoc(doc(otherMarketHead, 'correction_requests', 'OCC-CHANGE-CROSS'), { ...changeRequest, submittedBy: 'market-head-2' }));
const transferBatch = writeBatch(kadis);
transferBatch.update(doc(kadis, 'market_occupancies', 'OCC-ATOMIC-1'), { status: 'CLOSED', endedAt: serverTimestamp(), endedBy: 'kadis-1', changeRequestId: 'OCC-CHANGE-1' });
transferBatch.set(doc(kadis, 'market_occupancies', 'OCC-ATOMIC-2'), { occupancyId: 'OCC-ATOMIC-2', marketUnitId: 'UNT-ATOMIC-1', marketId: 'M1', traderId: 'TRD-ATOMIC-2', previousTraderId: 'TRD-ATOMIC-1', changeRequestId: 'OCC-CHANGE-1', status: 'ACTIVE', startedAt: serverTimestamp(), endedAt: null, createdBy: 'kadis-1', schemaVersion: 1 });
transferBatch.update(doc(kadis, 'market_units', 'UNT-ATOMIC-1'), { status: 'OCCUPIED', currentTraderId: 'TRD-ATOMIC-2', currentOccupancyId: 'OCC-ATOMIC-2', updatedAt: serverTimestamp() });
transferBatch.update(doc(kadis, 'correction_requests', 'OCC-CHANGE-1'), { status: 'APPROVED', newOccupancyId: 'OCC-ATOMIC-2', decidedBy: 'kadis-1', decidedAt: serverTimestamp(), decisionNote: 'Disetujui berdasarkan pemeriksaan.' });
await assertSucceeds(transferBatch.commit());
await assertSucceeds(getDoc(doc(otherMarketHead, 'market_claims', 'claim-2')));
await assertSucceeds(setDoc(doc(marketHead, 'verification_records', 'verification-1'), {
  claimId: 'claim-1', before: { unitNumber: 'A-1' }, after: { unitNumber: 'A-2' }, reason: 'Field check'
}));
await assertFails(setDoc(doc(marketHead, 'verification_records', 'verification-2'), {
  claimId: 'claim-2', before: { unitNumber: 'B-1' }, after: { unitNumber: 'B-2' }, reason: 'Cross-market attempt'
}));
await assertSucceeds(getDoc(doc(kadis, 'skpt_applications', 'app-1')));
await assertSucceeds(setDoc(doc(marketHead, 'skpt_applications', 'app-1'), { status: 'KADIS_REVIEW', verificationRecordId: 'verification-1', statusHistory: [], updatedAt: serverTimestamp() }, { merge: true }));
await assertFails(setDoc(doc(otherMarketHead, 'skpt_applications', 'app-1'), { status: 'KADIS_REVIEW', verificationRecordId: 'forged', statusHistory: [], updatedAt: serverTimestamp() }, { merge: true }));
await assertSucceeds(setDoc(doc(marketHead, 'notifications', 'market-change-1'), { type: 'MATERIAL_MARKET_CHANGE', recipientRole: 'KADIS', marketId: 'M1', actorRole: 'MARKET_HEAD' }));
await assertFails(setDoc(doc(otherMarketHead, 'notifications', 'market-change-cross'), { type: 'MATERIAL_MARKET_CHANGE', recipientRole: 'KADIS', marketId: 'M1', actorRole: 'MARKET_HEAD' }));
await assertFails(setDoc(doc(marketHead, 'skpt_documents', 'doc-1'), { status: 'ISSUED' }));
await assertFails(setDoc(doc(kadis, 'traders', 'trader-1'), { traderId: 'TRD-1' }));
await assertSucceeds(getDoc(doc(anonymous, 'public_status', 'status-token-1')));
await assertSucceeds(setDoc(doc(kadis, 'public_status', 'status-token-1'), { status: 'ISSUED' }, { merge: true }));
await assertSucceeds(getDoc(doc(anonymous, 'public_skpt_verification', 'verify-token-1')));
await assertSucceeds(getDoc(doc(anonymous, 'public_stats', 'summary')));
await assertFails(getDocs(collection(anonymous, 'public_stats')));
await assertFails(setDoc(doc(anonymous, 'public_stats', 'summary'), { totalTraders: 999 }, { merge: true }));
await assertSucceeds(setDoc(doc(admin, 'public_stats', 'summary'), { totalTraders: 2, totalIssuedSkpt: 1, totalBusinesses: 2, totalLocations: 2, totalCategories: 2, marketTraders: 1, nonMarketTraders: 1, topCategories: [{ label: 'TRADE', count: 1 }], updatedAt: serverTimestamp(), schemaVersion: 1 }));
await assertFails(setDoc(doc(admin, 'public_stats', 'summary'), { totalTraders: 2, totalIssuedSkpt: 1, totalBusinesses: 2, totalLocations: 2, totalCategories: 2, marketTraders: 1, nonMarketTraders: 1, topCategories: [{ label: 'TRADE', count: 1, nik: '7315010101010001' }], updatedAt: serverTimestamp(), schemaVersion: 1 }));
await assertSucceeds(getDoc(doc(anonymous, 'trader_media', 'public-photo-token-1')));
await assertFails(getDoc(doc(anonymous, 'trader_media', 'private-media-1')));
await assertFails(getDocs(collection(anonymous, 'trader_media')));
await assertSucceeds(getDocs(query(collection(kadis, 'trader_media'), where('ownerId','==','private-1'), where('mediaType','==','PROFILE'))));
await assertSucceeds(setDoc(doc(kadis, 'trader_media', 'new-public-photo-token'), { ownerType: 'PUBLIC_DOCUMENT', ownerId: 'new-public-photo-token', mediaType: 'PROFILE_PUBLIC', mime: 'image/webp', width: 600, height: 800, binaryBytes: 3, base64Bytes: 4, dataBase64: 'YWJj', status: 'PUBLIC', schemaVersion: 2, sourceMediaId: 'private-media-1', publishedAt: serverTimestamp() }));
await assertFails(setDoc(doc(kadis, 'trader_media', 'mismatched-token'), { ownerType: 'PUBLIC_DOCUMENT', ownerId: 'different-token', mediaType: 'PROFILE_PUBLIC', mime: 'image/webp', width: 600, height: 800, binaryBytes: 3, base64Bytes: 4, dataBase64: 'YWJj', status: 'PUBLIC', schemaVersion: 2, sourceMediaId: 'private-media-1', publishedAt: serverTimestamp() }));
const annualRef = doc(marketHead, 'public_skpt_verification', 'annual-token-1');
await assertFails(setDoc(annualRef, { annualValidations: [{ year: 2026, status: 'INITIAL_ISSUE' }, { year: 2027, status: 'VALIDATED' }] }, { merge: true }));
await assertFails(setDoc(annualRef, { number: 'DIUBAH-DIAM-DIAM' }, { merge: true }));
await assertSucceeds(getDoc(doc(marketHead, 'skpt_documents', 'skpt-doc-1')));
await assertFails(getDoc(doc(otherMarketHead, 'skpt_documents', 'skpt-doc-1')));
const annualSubmission = {
  skptId: 'skpt-doc-1', validationKey: 'skpt-doc-1_2027', verificationToken: 'annual-token-1', number: 'SKPT-ANNUAL-1', traderId: 'TRD-1', marketId: 'M1', validationYear: 2027,
  status: 'PENDING_REVIEW', stillUsesPlace: true, sameBusiness: true, sameUnit: true, hasChanges: false, note: 'Pemeriksaan lapangan sesuai.',
  submittedBy: 'market-head-1', submittedRole: 'MARKET_HEAD', submittedAt: serverTimestamp(), validatedBy: null, validatorRole: null, validatedAt: null,
  decisionNote: '', reviewHistory: [{ action: 'SUBMITTED', actorUid: 'market-head-1', actorRole: 'MARKET_HEAD', at: '2026-09-25T00:00:00.000Z', note: 'Sesuai' }], doesNotExtendValidity: true, policyBasis: 'INTERNAL_ANNUAL_REGISTRATION_DRAFT_V1', schemaVersion: 3
};
await assertSucceeds(setDoc(doc(marketHead, 'skpt_annual_validations', 'skpt-doc-1_2027'), annualSubmission));
await assertFails(setDoc(doc(otherMarketHead, 'skpt_annual_validations', 'forged-annual'), { ...annualSubmission, validationKey: 'forged-annual', submittedBy: 'market-head-2' }));
await assertFails(setDoc(doc(marketHead, 'skpt_annual_validations', 'forged-final'), { ...annualSubmission, validationKey: 'forged-final', status: 'VALIDATED' }));
const returnedEvent = { action: 'RETURNED', actorUid: 'admin-1', actorRole: 'DISPERINDAG_ADMIN' };
await assertSucceeds(setDoc(doc(admin, 'skpt_annual_validations', 'skpt-doc-1_2027'), { status: 'RETURNED', validatedBy: 'admin-1', validatorRole: 'DISPERINDAG_ADMIN', validatedAt: serverTimestamp(), decisionNote: 'Lengkapi catatan.', reviewHistory: [...annualSubmission.reviewHistory, returnedEvent] }, { merge: true }));
await assertFails(setDoc(doc(otherMarketHead, 'skpt_annual_validations', 'skpt-doc-1_2027'), { status: 'PENDING_REVIEW', submittedBy: 'market-head-2', submittedRole: 'MARKET_HEAD', submittedAt: serverTimestamp(), validatedBy: null, validatorRole: null, validatedAt: null, decisionNote: '', reviewHistory: [...annualSubmission.reviewHistory, returnedEvent, { action: 'RESUBMITTED', actorUid: 'market-head-2', actorRole: 'MARKET_HEAD' }] }, { merge: true }));
const resubmittedHistory = [...annualSubmission.reviewHistory, returnedEvent, { action: 'RESUBMITTED', actorUid: 'market-head-1', actorRole: 'MARKET_HEAD' }];
await assertSucceeds(setDoc(doc(marketHead, 'skpt_annual_validations', 'skpt-doc-1_2027'), { status: 'PENDING_REVIEW', stillUsesPlace: true, sameBusiness: true, sameUnit: true, hasChanges: false, note: 'Catatan telah dilengkapi.', submittedBy: 'market-head-1', submittedRole: 'MARKET_HEAD', submittedAt: serverTimestamp(), validatedBy: null, validatorRole: null, validatedAt: null, decisionNote: '', reviewHistory: resubmittedHistory }, { merge: true }));
await assertSucceeds(setDoc(doc(admin, 'skpt_annual_validations', 'skpt-doc-1_2027'), { status: 'VALIDATED', validatedBy: 'admin-1', validatorRole: 'DISPERINDAG_ADMIN', validatedAt: serverTimestamp(), decisionNote: 'Disahkan.', reviewHistory: [...resubmittedHistory, { action: 'VALIDATED', actorUid: 'admin-1', actorRole: 'DISPERINDAG_ADMIN' }] }, { merge: true }));
await assertFails(setDoc(doc(marketHead, 'skpt_annual_validations', 'skpt-doc-1_2027'), { status: 'VALIDATED', validatedBy: 'market-head-1', validatorRole: 'MARKET_HEAD', validatedAt: serverTimestamp(), decisionNote: '' }, { merge: true }));
const changedAnnual = { ...annualSubmission, skptId: 'skpt-doc-2', validationKey: 'skpt-doc-2_2027', verificationToken: 'annual-token-2', number: 'SKPT-ANNUAL-2', traderId: 'TRD-2', sameUnit: false, hasChanges: true };
await assertSucceeds(setDoc(doc(marketHead, 'skpt_annual_validations', 'skpt-doc-2_2027'), changedAnnual));
await assertFails(setDoc(doc(admin, 'skpt_annual_validations', 'skpt-doc-2_2027'), { status: 'VALIDATED', validatedBy: 'admin-1', validatorRole: 'DISPERINDAG_ADMIN', validatedAt: serverTimestamp(), decisionNote: 'Tidak boleh.', reviewHistory: [...changedAnnual.reviewHistory, { action: 'VALIDATED', actorUid: 'admin-1', actorRole: 'DISPERINDAG_ADMIN' }] }, { merge: true }));
await assertSucceeds(setDoc(doc(admin, 'skpt_annual_validations', 'skpt-doc-2_2027'), { status: 'RETURNED', validatedBy: 'admin-1', validatorRole: 'DISPERINDAG_ADMIN', validatedAt: serverTimestamp(), decisionNote: 'Proses perubahan unit dahulu.', reviewHistory: [...changedAnnual.reviewHistory, { action: 'RETURNED', actorUid: 'admin-1', actorRole: 'DISPERINDAG_ADMIN' }] }, { merge: true }));
await assertFails(getDoc(doc(anonymous, 'public_status', 'missing-token')));
await assertFails(getDoc(doc(anonymous, 'skpt_documents', 'doc-1')));

await env.cleanup();
console.log('PASS authenticated role boundary tests');
