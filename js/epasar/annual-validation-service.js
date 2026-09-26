(function () {
  'use strict';
  const POLICY = 'INTERNAL_ANNUAL_REGISTRATION_DRAFT_V1';
  const clean = (value, max) => String(value || '').trim().slice(0, max);
  const stamp = () => window.firebase.firestore.FieldValue.serverTimestamp();

  function database() {
    if (!window.db) throw new Error('Layanan data belum siap.');
    return window.db;
  }

  function targetYear(document) {
    const issue = new Date(document.issueDate);
    if (Number.isNaN(issue.getTime())) throw new Error('Tanggal terbit SKPT tidak valid.');
    return issue.getFullYear() + 1;
  }

  function dueDate(document) {
    const issue = new Date(document.issueDate);
    if (Number.isNaN(issue.getTime())) throw new Error('Tanggal terbit SKPT tidak valid.');
    issue.setFullYear(issue.getFullYear() + 1);
    return issue;
  }

  function dueState(document, now = new Date()) {
    const expiry = new Date(document.validUntil);
    if (!Number.isNaN(expiry.getTime()) && now.getTime() > expiry.getTime()) return 'EXPIRED';
    return now.getTime() < dueDate(document).getTime() ? 'UPCOMING' : 'DUE';
  }

  function assertActive(document, now = new Date()) {
    if (!document || document.status !== 'ISSUED') throw new Error('Pengesahan hanya tersedia untuk SKPT yang telah diterbitkan.');
    const expiry = new Date(document.validUntil);
    if (Number.isNaN(expiry.getTime())) throw new Error('Tanggal berakhir SKPT tidak valid.');
    if (now.getTime() > expiry.getTime()) throw new Error('Masa berlaku SKPT telah berakhir. Ajukan permohonan periode baru.');
  }

  function validationId(skptId, year) {
    return `${clean(skptId, 100)}_${Number(year)}`.replace(/[^A-Za-z0-9_-]/g, '_');
  }

  async function listIssued(profile) {
    const roles = ['SUPER_ADMIN', 'DISPERINDAG_ADMIN', 'TRADE_ADMIN', 'MARKET_ADMIN', 'TECH_ADMIN', 'KADIS'];
    const rows = [];
    const existing = new Map();
    if (profile.role === 'MARKET_HEAD') {
      for (const marketId of profile.marketIds || []) {
        const [snap, validationSnap] = await Promise.all([
          database().collection('skpt_documents').where('documentSnapshot.marketId', '==', marketId).where('status', '==', 'ISSUED').limit(40).get(),
          database().collection('skpt_annual_validations').where('marketId', '==', marketId).limit(100).get()
        ]);
        validationSnap.forEach(doc => existing.set(doc.id, { id: doc.id, ...doc.data() }));
        snap.forEach(doc => rows.push({ id: doc.id, ...doc.data() }));
      }
    } else if (roles.includes(profile.role)) {
      const snap = await database().collection('skpt_documents').where('status', '==', 'ISSUED').limit(80).get();
      snap.forEach(doc => rows.push({ id: doc.id, ...doc.data() }));
    }
    return rows.map(document => {
      const annualValidation = existing.get(validationId(document.id, targetYear(document))) || null;
      return { ...document, annualValidation };
    }).filter(document => !document.annualValidation || document.annualValidation.status === 'RETURNED');
  }

  async function listPending(profile) {
    if (!['SUPER_ADMIN', 'DISPERINDAG_ADMIN', 'TRADE_ADMIN', 'MARKET_ADMIN', 'TECH_ADMIN', 'KADIS'].includes(profile.role)) return [];
    const snap = await database().collection('skpt_annual_validations').where('status', '==', 'PENDING_REVIEW').limit(80).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function submit(document, input, actor) {
    if (actor.role !== 'MARKET_HEAD') throw new Error('Pemeriksaan faktual hanya dapat dikirim oleh Kepala Pasar.');
    assertActive(document);
    const marketId = clean(document.documentSnapshot?.marketId, 100);
    if (!marketId || !(actor.marketIds || []).includes(marketId)) throw new Error('SKPT tidak termasuk pasar yang ditugaskan kepada akun ini.');
    const year = targetYear(document);
    if (![input.stillUsesPlace, input.sameBusiness, input.sameUnit].every(value => typeof value === 'boolean')) throw new Error('Lengkapi seluruh hasil pemeriksaan faktual.');
    const id = validationId(document.id, year);
    const db = database();
    const ref = db.collection('skpt_annual_validations').doc(id);
    const hasChanges = Boolean(input.hasChanges || !input.stillUsesPlace || !input.sameBusiness || !input.sameUnit);
    await db.runTransaction(async transaction => {
      const existing = await transaction.get(ref);
      if (existing.exists && existing.data().status !== 'RETURNED') throw new Error('Pemeriksaan tahunan untuk periode ini sedang atau sudah diproses.');
      const priorHistory = existing.exists && Array.isArray(existing.data().reviewHistory) ? existing.data().reviewHistory : [];
      if (priorHistory.length >= 10) throw new Error('Batas riwayat pemeriksaan tercapai. Hubungi administrator untuk penanganan lanjutan.');
      const reviewHistory = [...priorHistory, { action: existing.exists ? 'RESUBMITTED' : 'SUBMITTED', actorUid: actor.uid, actorRole: actor.role, at: new Date().toISOString(), note: clean(input.note, 200) }].slice(-10);
      const payload = {
      skptId: document.id,
      validationKey: id,
      verificationToken: clean(document.verificationToken, 128),
      number: clean(document.number, 80),
      traderId: clean(document.traderId, 100),
      marketId,
      validationYear: year,
      status: 'PENDING_REVIEW',
      stillUsesPlace: input.stillUsesPlace,
      sameBusiness: input.sameBusiness,
      sameUnit: input.sameUnit,
      hasChanges,
      note: clean(input.note, 500),
      submittedBy: actor.uid,
      submittedRole: actor.role,
      submittedAt: stamp(),
      validatedBy: null,
      validatorRole: null,
      validatedAt: null,
      decisionNote: '',
      reviewHistory,
      doesNotExtendValidity: true,
      policyBasis: POLICY,
      schemaVersion: 3
      };
      if (existing.exists) transaction.update(ref, payload); else transaction.set(ref, payload);
    });
    return id;
  }

  async function decide(validation, decision, note, actor) {
    if (!['SUPER_ADMIN', 'DISPERINDAG_ADMIN', 'TRADE_ADMIN', 'MARKET_ADMIN', 'TECH_ADMIN', 'KADIS'].includes(actor.role)) throw new Error('Akun tidak berwenang menetapkan hasil pengesahan tahunan.');
    if (!['VALIDATED', 'RETURNED'].includes(decision)) throw new Error('Keputusan pengesahan tidak valid.');
    const db = database();
    const validationRef = db.collection('skpt_annual_validations').doc(validation.id);
    const documentRef = db.collection('skpt_documents').doc(validation.skptId);
    const publicRef = db.collection('public_skpt_verification').doc(validation.verificationToken);
    await db.runTransaction(async transaction => {
      const [validationSnap, documentSnap, publicSnap] = await Promise.all([transaction.get(validationRef), transaction.get(documentRef), transaction.get(publicRef)]);
      if (!validationSnap.exists || validationSnap.data().status !== 'PENDING_REVIEW') throw new Error('Pemeriksaan ini sudah diproses atau tidak tersedia.');
      const currentValidation = validationSnap.data();
      if (Array.isArray(currentValidation.reviewHistory) && currentValidation.reviewHistory.length >= 10) throw new Error('Batas riwayat pemeriksaan tercapai. Hubungi administrator untuk penanganan lanjutan.');
      if (decision === 'VALIDATED' && (currentValidation.hasChanges || !currentValidation.stillUsesPlace || !currentValidation.sameBusiness || !currentValidation.sameUnit)) throw new Error('Pemeriksaan yang menemukan perubahan harus dikembalikan dan diselesaikan melalui koreksi/perubahan data sebelum dapat disahkan.');
      if (!documentSnap.exists) throw new Error('Dokumen SKPT induk tidak ditemukan.');
      const document = documentSnap.data();
      assertActive(document);
      const annual = Array.isArray(document.annualValidations) ? [...document.annualValidations] : [];
      const index = annual.findIndex(item => Number(item.year) === Number(validation.validationYear));
      const entry = { year: Number(validation.validationYear), status: decision, validatedAt: decision === 'VALIDATED' ? new Date().toISOString() : null, reference: clean(note, 100) };
      if (index >= 0) annual[index] = entry; else annual.push(entry);
      const reviewHistory = [...(Array.isArray(currentValidation.reviewHistory) ? currentValidation.reviewHistory : []), { action: decision, actorUid: actor.uid, actorRole: actor.role, at: new Date().toISOString(), note: clean(note, 200) }].slice(-10);
      transaction.update(validationRef, { status: decision, validatedBy: actor.uid, validatorRole: actor.role, validatedAt: stamp(), decisionNote: clean(note, 500), reviewHistory });
      transaction.update(documentRef, { annualValidations: annual });
      if (publicSnap.exists) transaction.update(publicRef, { annualValidations: annual });
    });
  }

  window.EPASAR_ANNUAL = { POLICY, targetYear, dueDate, dueState, assertActive, validationId, listIssued, listPending, submit, decide };
}());
