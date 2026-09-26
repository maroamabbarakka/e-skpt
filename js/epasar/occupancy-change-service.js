(function () {
  'use strict';
  const stamp = () => window.firebase.firestore.FieldValue.serverTimestamp();
  const clean = (value, max = 300) => String(value || '').trim().slice(0, max);
  const reviewers = ['KADIS', 'SUPER_ADMIN'];
  function database() { if (!window.db) throw new Error('Layanan data belum siap.'); return window.db; }

  async function listUnits(profile) {
    if (profile.role !== 'MARKET_HEAD') return [];
    const rows = [];
    for (const marketId of profile.marketIds || []) {
      const snapshot = await database().collection('market_units').where('marketId', '==', marketId).limit(50).get();
      snapshot.forEach(document => rows.push({ id: document.id, ...document.data() }));
    }
    return rows.filter(unit => unit.status === 'OCCUPIED' && unit.currentTraderId && unit.currentOccupancyId);
  }

  async function listPending(profile) {
    if (!reviewers.includes(profile.role)) return [];
    const snapshot = await database().collection('correction_requests').where('requestType', '==', 'OCCUPANCY_CHANGE').where('status', '==', 'PENDING_REVIEW').limit(50).get();
    return snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
  }

  async function submit(unit, input, actor) {
    if (actor.role !== 'MARKET_HEAD' || !(actor.marketIds || []).includes(unit.marketId)) throw new Error('Akun tidak berwenang mengajukan perubahan unit ini.');
    const action = input.action;
    if (!['RELEASE', 'TRANSFER'].includes(action)) throw new Error('Jenis perubahan okupansi tidak valid.');
    const reason = clean(input.reason, 500);
    const newTraderId = clean(input.newTraderId, 100);
    if (!reason) throw new Error('Alasan dan hasil pemeriksaan faktual wajib diisi.');
    if (action === 'TRANSFER' && !newTraderId) throw new Error('ID pedagang penerima wajib diisi untuk pengalihan.');
    if (action === 'TRANSFER' && newTraderId === unit.currentTraderId) throw new Error('Pedagang penerima sama dengan pemegang saat ini.');
    const reference = database().collection('correction_requests').doc();
    await reference.set({ requestType: 'OCCUPANCY_CHANGE', action, marketUnitId: unit.id, marketId: unit.marketId, currentOccupancyId: unit.currentOccupancyId, currentTraderId: unit.currentTraderId, newTraderId: action === 'TRANSFER' ? newTraderId : '', reason, status: 'PENDING_REVIEW', submittedBy: actor.uid, submittedRole: actor.role, submittedAt: stamp(), decidedBy: null, decidedAt: null, decisionNote: '', source: 'MARKET_HEAD_VERIFICATION', schemaVersion: 2 });
    return reference.id;
  }

  async function decide(request, decision, note, actor) {
    if (!reviewers.includes(actor.role)) throw new Error('Keputusan perubahan okupansi hanya dapat dilakukan Kadis atau Super Admin.');
    if (!['APPROVED', 'REJECTED'].includes(decision)) throw new Error('Keputusan tidak valid.');
    const decisionNote = clean(note, 500);
    if (!decisionNote) throw new Error('Catatan keputusan wajib diisi.');
    const db = database();
    const requestRef = db.collection('correction_requests').doc(request.id);
    const unitRef = db.collection('market_units').doc(request.marketUnitId);
    const oldOccupancyRef = db.collection('market_occupancies').doc(request.currentOccupancyId);
    const newOccupancyRef = db.collection('market_occupancies').doc();
    let targetTraderRef = null;
    if (request.action === 'TRANSFER') {
      const traderQuery = await db.collection('traders').where('traderId', '==', request.newTraderId).limit(1).get();
      if (traderQuery.empty) throw new Error('Pedagang penerima tidak ditemukan pada data master.');
      targetTraderRef = traderQuery.docs[0].ref;
    }
    await db.runTransaction(async transaction => {
      const reads = [transaction.get(requestRef), transaction.get(unitRef), transaction.get(oldOccupancyRef)];
      if (targetTraderRef) reads.push(transaction.get(targetTraderRef));
      const [requestSnapshot, unitSnapshot, occupancySnapshot, targetTraderSnapshot] = await Promise.all(reads);
      if (!requestSnapshot.exists || requestSnapshot.data().status !== 'PENDING_REVIEW') throw new Error('Permohonan sudah diproses atau tidak tersedia.');
      if (!unitSnapshot.exists || !occupancySnapshot.exists) throw new Error('Data unit atau okupansi aktif tidak ditemukan.');
      const current = requestSnapshot.data();
      const unit = unitSnapshot.data();
      if (unit.currentTraderId !== current.currentTraderId || unit.currentOccupancyId !== current.currentOccupancyId || occupancySnapshot.data().status !== 'ACTIVE') throw new Error('Pemegang unit telah berubah. Permohonan harus diperiksa ulang.');
      if (decision === 'REJECTED') {
        transaction.update(requestRef, { status: 'REJECTED', decidedBy: actor.uid, decidedAt: stamp(), decisionNote });
        return;
      }
      if (current.action === 'TRANSFER' && (!targetTraderSnapshot?.exists || targetTraderSnapshot.data().traderId !== current.newTraderId)) throw new Error('Data pedagang penerima berubah atau tidak tersedia.');
      transaction.update(oldOccupancyRef, { status: 'CLOSED', endedAt: stamp(), endedBy: actor.uid, changeRequestId: request.id });
      if (current.action === 'TRANSFER') {
        transaction.set(newOccupancyRef, { occupancyId: newOccupancyRef.id, marketUnitId: request.marketUnitId, marketId: request.marketId, traderId: current.newTraderId, previousTraderId: current.currentTraderId, changeRequestId: request.id, status: 'ACTIVE', startedAt: stamp(), endedAt: null, createdBy: actor.uid, schemaVersion: 1 });
        transaction.update(unitRef, { status: 'OCCUPIED', currentTraderId: current.newTraderId, currentOccupancyId: newOccupancyRef.id, updatedAt: stamp() });
      } else {
        transaction.update(unitRef, { status: 'AVAILABLE', currentTraderId: '', currentOccupancyId: '', updatedAt: stamp() });
      }
      transaction.update(requestRef, { status: 'APPROVED', newOccupancyId: current.action === 'TRANSFER' ? newOccupancyRef.id : '', decidedBy: actor.uid, decidedAt: stamp(), decisionNote });
    });
  }

  window.EPASAR_OCCUPANCY_CHANGE = { listUnits, listPending, submit, decide };
}());
