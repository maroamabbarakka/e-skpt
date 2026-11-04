import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import fs from 'node:fs';

const projectId = 'demo-epasar-role-boundaries';
const rules = fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId, firestore: { rules } });

function profile(uid, role, marketIds = []) {
  return {
    uid, username: uid, displayName: uid, position: 'Petugas Uji', role, marketIds,
    marketDirectoryScoped: ['MARKET_ADMIN', 'MARKET_HEAD', 'UPTD_HEAD'].includes(role),
    status: 'ACTIVE', phone: '', photoMediaId: null, schemaVersion: 1,
    createdAt: new Date(), updatedAt: new Date()
  };
}

try {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'super'), profile('super', 'SUPER_ADMIN'));
    await setDoc(doc(db, 'users', 'market-admin-1'), profile('market-admin-1', 'MARKET_ADMIN', ['MKT-001']));
    await setDoc(doc(db, 'users', 'market-head-1'), profile('market-head-1', 'MARKET_HEAD', ['MKT-001']));
    await setDoc(doc(db, 'users', 'trade-admin'), profile('trade-admin', 'TRADE_ADMIN'));
    await setDoc(doc(db, 'users', 'uptd-1'), profile('uptd-1', 'UPTD_HEAD', ['MKT-001', 'MKT-002']));
    await setDoc(doc(db, 'users', 'kadis-1'), profile('kadis-1', 'KADIS'));
    await setDoc(doc(db, 'market_claims', 'claim-1'), {
      claimId: 'claim-1', marketId: 'MKT-001', traderId: 'T1', verificationStatus: 'VERIFIED', updatedAt: new Date()
    });
    await setDoc(doc(db, 'market_claims', 'claim-2'), {
      claimId: 'claim-2', marketId: 'MKT-003', traderId: 'T2', verificationStatus: 'VERIFIED', updatedAt: new Date()
    });
    await setDoc(doc(db, 'traders', 'trader-private-boundary'), {
      traderId: 'T-PRIVATE', displayName: 'Pedagang Privat', status: 'ACTIVE'
    });
    await setDoc(doc(db, 'trader_private', 'trader-private-boundary'), {
      traderId: 'T-PRIVATE', nik: '7315010101010001', accessClass: 'RESTRICTED'
    });
    await setDoc(doc(db, 'nik_registry', 'nik-private-boundary'), {
      traderId: 'T-PRIVATE', traderDocumentId: 'trader-private-boundary'
    });
    await setDoc(doc(db, 'skpt_applications', 'app-1'), {
      applicationId: 'app-1', claimId: 'claim-1', marketId: 'MKT-001', traderId: 'T1',
      status: 'UPTD_REVIEW', statusHistory: [], updatedAt: new Date()
    });
    await setDoc(doc(db, 'skpt_applications', 'app-2'), {
      applicationId: 'app-2', claimId: 'claim-2', marketId: 'MKT-003', traderId: 'T2',
      status: 'UPTD_REVIEW', statusHistory: [], updatedAt: new Date()
    });
    await setDoc(doc(db, 'skpt_applications', 'app-tte'), {
      applicationId: 'app-tte', claimId: 'claim-1', marketId: 'MKT-001', traderId: 'T1',
      status: 'TTE_PENDING', statusHistory: [], updatedAt: new Date()
    });
    await setDoc(doc(db, 'skpt_applications', 'app-kadis-reject'), {
      applicationId: 'app-kadis-reject', claimId: 'claim-1', marketId: 'MKT-001', traderId: 'T1',
      status: 'KADIS_REVIEW', statusHistory: [], publicToken: 'public-reject-token', updatedAt: new Date()
    });
    await setDoc(doc(db, 'skpt_applications', 'app-photo'), { applicationId:'app-photo', claimId:'claim-1', marketId:'MKT-001', traderId:'T1', status:'MARKET_VERIFICATION' });
    await setDoc(doc(db, 'skpt_documents', 'document-market-1'), {
      status: 'ISSUED', documentSnapshot: { marketId: 'MKT-001' }, traderId: 'T1'
    });
    await setDoc(doc(db, 'skpt_documents', 'document-market-3'), {
      status: 'ISSUED', documentSnapshot: { marketId: 'MKT-003' }, traderId: 'T2'
    });
    await setDoc(doc(db, 'skpt_annual_validations', 'annual-market-1'), {
      marketId: 'MKT-001', status: 'PENDING_REVIEW', skptId: 'document-market-1'
    });
    await setDoc(doc(db, 'public_status', 'public-reject-token'), {
      publicToken: 'public-reject-token', publicStatus: true, status: 'KADIS_REVIEW'
    });
    await setDoc(doc(db, 'market_trader_directory', 'MKT-001__T1'), { marketId: 'MKT-001', traderId: 'T1', status: 'ACTIVE' });
    await setDoc(doc(db, 'market_trader_directory', 'MKT-003__T2'), { marketId: 'MKT-003', traderId: 'T2', status: 'ACTIVE' });
    await setDoc(doc(db, 'market_units', 'unit-1'), { unitId: 'unit-1', marketId: 'MKT-001', unitType: 'KIOS', unitNumber: '1', status: 'AVAILABLE', currentTraderId: '', currentOccupancyId: '' });
    await setDoc(doc(db, 'market_units', 'unit-2'), { unitId: 'unit-2', marketId: 'MKT-003', unitType: 'KIOS', unitNumber: '2', status: 'AVAILABLE', currentTraderId: '', currentOccupancyId: '' });
    await setDoc(doc(db, 'trader_intake', 'intake-market-1'), {
      registrationCode: 'REG-MKT-001', status: 'SUBMITTED', routingMarketIds: ['MKT-001'], submittedAt: new Date()
    });
    await setDoc(doc(db, 'trader_intake', 'intake-market-3'), {
      registrationCode: 'REG-MKT-003', status: 'SUBMITTED', routingMarketIds: ['MKT-003'], submittedAt: new Date()
    });
    await setDoc(doc(db, 'notifications', 'notification-market-1'), {
      type: 'TRADER_DECISION', deliveryStatus: 'PENDING_ADMIN', routingMarketIds: ['MKT-001'], marketId: 'MKT-001'
    });
    await setDoc(doc(db, 'notifications', 'notification-market-3'), {
      type: 'TRADER_DECISION', deliveryStatus: 'PENDING_ADMIN', routingMarketIds: ['MKT-003'], marketId: 'MKT-003'
    });
    await setDoc(doc(db, 'trader_media', 'media-intake-market-1'), {
      ownerType: 'TRADER_INTAKE', ownerId: 'intake-market-1', mediaType: 'PROFILE', mime: 'image/webp', dataBase64: 'aaaa'
    });
    await setDoc(doc(db, 'correction_requests', 'correction-market-1'), {
      registrationCode: 'REG-MKT-001', marketId: 'MKT-001', status: 'PENDING_REVIEW'
    });
    await setDoc(doc(db, 'businesses', 'business-existing'), { businessId: 'business-existing', traderId: 'T1', name: 'Usaha Lama' });
    await setDoc(doc(db, 'business_locations', 'location-existing'), { locationId: 'location-existing', businessId: 'business-existing', traderId: 'T1' });
  });

  const superDb = env.authenticatedContext('super').firestore();
  const marketAdminDb = env.authenticatedContext('market-admin-1').firestore();
  const marketHeadDb = env.authenticatedContext('market-head-1').firestore();
  const tradeAdminDb = env.authenticatedContext('trade-admin').firestore();
  const uptdDb = env.authenticatedContext('uptd-1').firestore();
  const kadisDb = env.authenticatedContext('kadis-1').firestore();

  await assertSucceeds(setDoc(doc(marketAdminDb, 'market_claims', 'own-claim'), {
    claimId: 'own-claim', marketId: 'MKT-001', traderId: 'T3', verificationStatus: 'UNVERIFIED'
  }));
  const boundedBatch = writeBatch(marketAdminDb);
  boundedBatch.set(doc(marketAdminDb, 'trader_market_place_ledgers', 'T-LIMIT__MKT-001'), {
    ledgerId: 'T-LIMIT__MKT-001', traderId: 'T-LIMIT', marketId: 'MKT-001',
    claimIds: ['bounded-claim-1', 'bounded-claim-2'], activePlaceCount: 2, maximumPlaces: 2,
    schemaVersion: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  boundedBatch.set(doc(marketAdminDb, 'market_claims', 'bounded-claim-1'), {
    traderId: 'T-LIMIT', marketId: 'MKT-001', claimId: 'bounded-claim-1', verificationStatus: 'UNVERIFIED', schemaVersion: 2
  });
  boundedBatch.set(doc(marketAdminDb, 'market_claims', 'bounded-claim-2'), {
    traderId: 'T-LIMIT', marketId: 'MKT-001', claimId: 'bounded-claim-2', verificationStatus: 'UNVERIFIED', schemaVersion: 2
  });
  await assertSucceeds(boundedBatch.commit());
  await assertFails(updateDoc(doc(marketAdminDb, 'trader_market_place_ledgers', 'T-LIMIT__MKT-001'), {
    claimIds: ['bounded-claim-1', 'bounded-claim-2', 'bounded-claim-3'], activePlaceCount: 3, updatedAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(marketAdminDb, 'market_claims', 'bounded-claim-3'), {
    traderId: 'T-LIMIT', marketId: 'MKT-001', claimId: 'bounded-claim-3', verificationStatus: 'UNVERIFIED', schemaVersion: 2
  }));
  await assertFails(setDoc(doc(marketAdminDb, 'market_claims', 'cross-claim'), {
    claimId: 'cross-claim', marketId: 'MKT-003', traderId: 'T4', verificationStatus: 'UNVERIFIED'
  }));
  await assertFails(updateDoc(doc(marketAdminDb, 'market_claims', 'claim-2'), {
    verificationStatus: 'UNVERIFIED', updatedAt: serverTimestamp()
  }));
  await assertSucceeds(getDoc(doc(marketAdminDb, 'market_claims', 'claim-1')));
  await assertFails(getDoc(doc(marketAdminDb, 'market_claims', 'claim-2')));
  const photoRevision = { ownerType:'MARKET_CORRECTION', ownerId:'claim-1', claimId:'claim-1', applicationId:'app-photo', traderId:'T1', marketId:'MKT-001', mediaType:'LOCATION', mime:'image/webp', width:10, height:10, binaryBytes:10, base64Bytes:12, dataBase64:'aaaaaaaaaaaa', status:'ACTIVE', previousMediaId:'old-photo', reason:'Foto lokasi lama tidak sesuai kondisi lapangan.', actorUid:'market-head-1', actorRole:'MARKET_HEAD', schemaVersion:3, createdAt:serverTimestamp() };
  await assertSucceeds(setDoc(doc(marketHeadDb, 'trader_media', 'photo-revision-valid'), photoRevision));
  await assertFails(setDoc(doc(marketHeadDb, 'trader_media', 'photo-revision-cross-market'), { ...photoRevision, marketId:'MKT-003' }));
  await assertFails(setDoc(doc(marketHeadDb, 'trader_media', 'photo-revision-after-uptd'), { ...photoRevision, applicationId:'app-1' }));
  await assertSucceeds(getDoc(doc(marketAdminDb, 'skpt_applications', 'app-1')));
  await assertFails(getDoc(doc(marketAdminDb, 'skpt_applications', 'app-2')));
  await assertSucceeds(getDoc(doc(marketAdminDb, 'market_trader_directory', 'MKT-001__T1')));
  await assertFails(getDoc(doc(marketAdminDb, 'market_trader_directory', 'MKT-003__T2')));
  await assertSucceeds(getDoc(doc(marketAdminDb, 'market_units', 'unit-1')));
  await assertFails(getDoc(doc(marketAdminDb, 'market_units', 'unit-2')));
  await assertSucceeds(getDocs(query(collection(marketAdminDb, 'market_trader_directory'), where('marketId', '==', 'MKT-001'), where('status', '==', 'ACTIVE'))));
  await assertSucceeds(getDocs(query(collection(marketAdminDb, 'market_claims'), where('marketId', '==', 'MKT-001'), where('verificationStatus', '==', 'VERIFIED'))));
  await assertSucceeds(getDocs(query(collection(marketAdminDb, 'skpt_applications'), where('marketId', '==', 'MKT-001'), where('status', '==', 'UPTD_REVIEW'))));
  await assertSucceeds(getDocs(query(collection(marketAdminDb, 'skpt_documents'), where('documentSnapshot.marketId', '==', 'MKT-001'), where('status', '==', 'ISSUED'))));
  await assertSucceeds(getDocs(query(collection(marketAdminDb, 'skpt_annual_validations'), where('marketId', '==', 'MKT-001'))));
  const ownIntakeQuery = query(
    collection(marketAdminDb, 'trader_intake'),
    where('status', 'in', ['SUBMITTED', 'CORRECTION_REQUIRED']),
    where('routingMarketIds', 'array-contains-any', ['MKT-001']),
    orderBy('submittedAt', 'desc'),
    limit(20)
  );
  await assertSucceeds(getDocs(ownIntakeQuery));
  await assertSucceeds(getDocs(query(collection(marketAdminDb, 'trader_intake'), where('status', '==', 'SUBMITTED'))));
  await assertSucceeds(getDocs(query(collection(marketAdminDb, 'notifications'), where('routingMarketIds', 'array-contains-any', ['MKT-001']), limit(40))));
  await assertSucceeds(getDocs(query(collection(marketAdminDb, 'notifications'), where('marketId', '==', 'MKT-001'), limit(40))));
  await assertSucceeds(getDocs(query(collection(marketAdminDb, 'notifications'), where('type', '==', 'TRADER_DECISION'), limit(40))));
  await assertSucceeds(getDocs(query(collection(marketAdminDb, 'trader_media'), where('ownerId', '==', 'intake-market-1'), limit(20))));
  await assertSucceeds(getDocs(query(collection(marketAdminDb, 'correction_requests'), where('registrationCode', '==', 'REG-MKT-001'), limit(25))));
  await assertSucceeds(getDocs(query(collection(marketHeadDb, 'trader_media'), where('ownerId', '==', 'intake-market-1'), where('mediaType', '==', 'PROFILE'), limit(5))));
  await assertSucceeds(getDocs(query(collection(marketAdminDb, 'market_claims'), where('marketId', 'in', ['MKT-001']), limit(30))));
  await assertSucceeds(getDocs(query(collection(marketHeadDb, 'market_claims'), where('marketId', 'in', ['MKT-001']), limit(30))));
  await assertSucceeds(getDocs(query(collection(marketHeadDb, 'market_units'), where('marketId', '==', 'MKT-001'), limit(50))));
  await assertSucceeds(getDocs(query(collection(marketHeadDb, 'skpt_documents'), where('documentSnapshot.marketId', '==', 'MKT-001'), where('status', '==', 'ISSUED'), limit(40))));
  await assertSucceeds(getDocs(query(collection(marketHeadDb, 'skpt_annual_validations'), where('marketId', '==', 'MKT-001'), limit(100))));
  await assertSucceeds(setDoc(doc(superDb, 'app_settings', 'general'), { signatory: { tteMode: 'MANUAL_UPLOAD' } }));
  await assertFails(setDoc(doc(tradeAdminDb, 'app_settings', 'general'), { signatory: { tteMode: 'MANUAL_UPLOAD' } }));
  await assertSucceeds(setDoc(doc(marketAdminDb, 'businesses', 'business-new'), { businessId: 'business-new', traderId: 'T3', name: 'Usaha Baru' }));
  await assertSucceeds(setDoc(doc(marketAdminDb, 'business_locations', 'location-new'), { locationId: 'location-new', businessId: 'business-new', traderId: 'T3' }));
  await assertFails(updateDoc(doc(marketAdminDb, 'businesses', 'business-existing'), { name: 'Perubahan tanpa otorisasi pusat' }));
  await assertFails(updateDoc(doc(marketAdminDb, 'business_locations', 'location-existing'), { address: 'Perubahan tanpa otorisasi pusat' }));
  await assertSucceeds(setDoc(doc(tradeAdminDb, 'market_claims', 'central-claim'), {
    claimId: 'central-claim', marketId: 'MKT-003', traderId: 'T5', verificationStatus: 'UNVERIFIED'
  }));
  await assertFails(getDoc(doc(marketAdminDb, 'traders', 'trader-private-boundary')));
  await assertFails(getDoc(doc(marketAdminDb, 'trader_private', 'trader-private-boundary')));
  await assertSucceeds(getDoc(doc(marketAdminDb, 'nik_registry', 'nik-private-boundary')));
  await assertSucceeds(getDoc(doc(tradeAdminDb, 'traders', 'trader-private-boundary')));
  await assertSucceeds(getDoc(doc(tradeAdminDb, 'trader_private', 'trader-private-boundary')));

  await assertSucceeds(getDoc(doc(uptdDb, 'market_claims', 'claim-1')));
  await assertFails(getDoc(doc(uptdDb, 'market_claims', 'claim-2')));
  await assertSucceeds(getDoc(doc(uptdDb, 'skpt_applications', 'app-1')));
  await assertFails(getDoc(doc(uptdDb, 'skpt_applications', 'app-2')));
  await assertSucceeds(getDocs(query(collection(uptdDb, 'skpt_applications'), where('marketId', '==', 'MKT-001'), where('status', '==', 'UPTD_REVIEW'), orderBy('updatedAt', 'asc'), limit(100))));

  const returnBatch = writeBatch(uptdDb);
  returnBatch.update(doc(uptdDb, 'market_claims', 'claim-1'), {
    verificationStatus: 'UNVERIFIED', updatedAt: serverTimestamp()
  });
  returnBatch.update(doc(uptdDb, 'skpt_applications', 'app-1'), {
    status: 'MARKET_VERIFICATION',
    uptdApproval: {
      decision: 'RETURNED', note: 'Periksa kembali nomor unit.', actorUid: 'uptd-1',
      actorRole: 'UPTD_HEAD', marketId: 'MKT-001', regionId: 'I', decidedAt: serverTimestamp()
    },
    statusHistory: [{ from: 'UPTD_REVIEW', to: 'MARKET_VERIFICATION', actorUid: 'uptd-1' }],
    updatedAt: serverTimestamp()
  });
  await assertSucceeds(returnBatch.commit());

  await assertSucceeds(setDoc(doc(superDb, 'users', 'uptd-valid'), profile('uptd-valid', 'UPTD_HEAD', ['MKT-001', 'MKT-011'])));
  await assertFails(setDoc(doc(superDb, 'users', 'uptd-cross-region'), profile('uptd-cross-region', 'UPTD_HEAD', ['MKT-001', 'MKT-003'])));
  await assertFails(setDoc(doc(superDb, 'users', 'market-admin-empty'), profile('market-admin-empty', 'MARKET_ADMIN', [])));

  await assertFails(updateDoc(doc(superDb, 'skpt_applications', 'app-tte'), {
    status: 'ISSUED', skptDocumentId: 'forged-document', updatedAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(superDb, 'skpt_documents', 'forged-document'), {
    skptId: 'forged-document', applicationId: 'app-tte', status: 'ISSUED',
    environment: 'UAT', isDemo: true, tteStatus: 'UAT_SIMULATED'
  }));
  await assertFails(setDoc(doc(superDb, 'public_skpt_verification', 'forged-token'), {
    verificationToken: 'forged-token', applicationId: 'app-tte', documentId: 'forged-document', status: 'ISSUED'
  }));
  await assertFails(updateDoc(doc(superDb, 'skpt_applications', 'app-kadis-reject'), {
    status: 'REJECTED',
    approval: {
      decision: 'REJECTED', note: 'Keputusan palsu oleh Super Admin.',
      actorUid: 'super', actorRole: 'SUPER_ADMIN', approvedAt: serverTimestamp()
    },
    statusHistory: [{ from: 'KADIS_REVIEW', to: 'REJECTED', actorUid: 'super', actorRole: 'SUPER_ADMIN' }],
    updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(doc(kadisDb, 'skpt_applications', 'app-kadis-reject'), {
    status: 'TTE_PENDING', draftNumber: '0001/SKPT/BNG/X/2026', numberReservationId: '2026-0001',
    verificationToken: 'a'.repeat(32), storageStatus: 'NOT_CONFIGURED',
    approval: { decision: 'APPROVED', note: 'Percobaan client langsung.', actorUid: 'kadis-1', actorRole: 'KADIS', approvedAt: serverTimestamp() },
    statusHistory: [{ from: 'KADIS_REVIEW', to: 'TTE_PENDING', actorUid: 'kadis-1', actorRole: 'KADIS' }],
    updatedAt: serverTimestamp()
  }));

  await assertSucceeds(updateDoc(doc(kadisDb, 'skpt_applications', 'app-kadis-reject'), {
    status: 'REJECTED',
    approval: {
      decision: 'REJECTED', note: 'Lokasi tidak memenuhi keputusan penataan.',
      actorUid: 'kadis-1', actorRole: 'KADIS', approvedAt: serverTimestamp()
    },
    statusHistory: [{ from: 'KADIS_REVIEW', to: 'REJECTED', actorUid: 'kadis-1', actorRole: 'KADIS' }],
    updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(doc(kadisDb, 'public_status', 'public-reject-token'), {
    status: 'REJECTED', reviewMessage: 'Lokasi tidak memenuhi keputusan penataan.'
  }));

  console.log('PASS: batas peran pasar, UPTD, validasi wilayah, dan penguncian penerbitan backend');
} finally {
  await env.cleanup();
}
