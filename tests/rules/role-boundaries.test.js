import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
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
    await setDoc(doc(db, 'users', 'trade-admin'), profile('trade-admin', 'TRADE_ADMIN'));
    await setDoc(doc(db, 'users', 'uptd-1'), profile('uptd-1', 'UPTD_HEAD', ['MKT-001', 'MKT-002']));
    await setDoc(doc(db, 'market_claims', 'claim-1'), {
      claimId: 'claim-1', marketId: 'MKT-001', traderId: 'T1', verificationStatus: 'VERIFIED', updatedAt: new Date()
    });
    await setDoc(doc(db, 'market_claims', 'claim-2'), {
      claimId: 'claim-2', marketId: 'MKT-003', traderId: 'T2', verificationStatus: 'VERIFIED', updatedAt: new Date()
    });
    await setDoc(doc(db, 'skpt_applications', 'app-1'), {
      applicationId: 'app-1', claimId: 'claim-1', marketId: 'MKT-001', traderId: 'T1',
      status: 'UPTD_REVIEW', statusHistory: [], updatedAt: new Date()
    });
    await setDoc(doc(db, 'skpt_applications', 'app-2'), {
      applicationId: 'app-2', claimId: 'claim-2', marketId: 'MKT-003', traderId: 'T2',
      status: 'UPTD_REVIEW', statusHistory: [], updatedAt: new Date()
    });
    await setDoc(doc(db, 'market_trader_directory', 'MKT-001__T1'), { marketId: 'MKT-001', traderId: 'T1', status: 'ACTIVE' });
    await setDoc(doc(db, 'market_trader_directory', 'MKT-003__T2'), { marketId: 'MKT-003', traderId: 'T2', status: 'ACTIVE' });
    await setDoc(doc(db, 'market_units', 'unit-1'), { unitId: 'unit-1', marketId: 'MKT-001', unitType: 'KIOS', unitNumber: '1', status: 'AVAILABLE', currentTraderId: '', currentOccupancyId: '' });
    await setDoc(doc(db, 'market_units', 'unit-2'), { unitId: 'unit-2', marketId: 'MKT-003', unitType: 'KIOS', unitNumber: '2', status: 'AVAILABLE', currentTraderId: '', currentOccupancyId: '' });
  });

  const superDb = env.authenticatedContext('super').firestore();
  const marketAdminDb = env.authenticatedContext('market-admin-1').firestore();
  const tradeAdminDb = env.authenticatedContext('trade-admin').firestore();
  const uptdDb = env.authenticatedContext('uptd-1').firestore();

  await assertSucceeds(setDoc(doc(marketAdminDb, 'market_claims', 'own-claim'), {
    claimId: 'own-claim', marketId: 'MKT-001', traderId: 'T3', verificationStatus: 'UNVERIFIED'
  }));
  await assertFails(setDoc(doc(marketAdminDb, 'market_claims', 'cross-claim'), {
    claimId: 'cross-claim', marketId: 'MKT-003', traderId: 'T4', verificationStatus: 'UNVERIFIED'
  }));
  await assertFails(updateDoc(doc(marketAdminDb, 'market_claims', 'claim-2'), {
    verificationStatus: 'UNVERIFIED', updatedAt: serverTimestamp()
  }));
  await assertSucceeds(getDoc(doc(marketAdminDb, 'market_claims', 'claim-1')));
  await assertFails(getDoc(doc(marketAdminDb, 'market_claims', 'claim-2')));
  await assertSucceeds(getDoc(doc(marketAdminDb, 'skpt_applications', 'app-1')));
  await assertFails(getDoc(doc(marketAdminDb, 'skpt_applications', 'app-2')));
  await assertSucceeds(getDoc(doc(marketAdminDb, 'market_trader_directory', 'MKT-001__T1')));
  await assertFails(getDoc(doc(marketAdminDb, 'market_trader_directory', 'MKT-003__T2')));
  await assertSucceeds(getDoc(doc(marketAdminDb, 'market_units', 'unit-1')));
  await assertFails(getDoc(doc(marketAdminDb, 'market_units', 'unit-2')));
  await assertSucceeds(setDoc(doc(tradeAdminDb, 'market_claims', 'central-claim'), {
    claimId: 'central-claim', marketId: 'MKT-003', traderId: 'T5', verificationStatus: 'UNVERIFIED'
  }));

  await assertSucceeds(getDoc(doc(uptdDb, 'market_claims', 'claim-1')));
  await assertFails(getDoc(doc(uptdDb, 'market_claims', 'claim-2')));
  await assertSucceeds(getDoc(doc(uptdDb, 'skpt_applications', 'app-1')));
  await assertFails(getDoc(doc(uptdDb, 'skpt_applications', 'app-2')));

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

  console.log('PASS: batas peran pasar, UPTD, dan validasi wilayah akun');
} finally {
  await env.cleanup();
}
