(function () {
  'use strict';
  const roles = ['SUPER_ADMIN', 'DISPERINDAG_ADMIN', 'TRADE_ADMIN', 'MARKET_ADMIN'];
  const allowedSections = ['IDENTITY', 'BUSINESS', 'LOCATION', 'MARKET_UNIT', 'DOCUMENT'];
  const stamp = () => window.firebase.firestore.FieldValue.serverTimestamp();
  const clean = (value, max) => String(value || '').trim().slice(0, max);
  async function decide(intake, actor, input) {
    if (!window.db || !intake?.id || !intake.publicToken) throw new Error('Pendaftaran belum siap diputuskan.');
    if (!actor?.uid || !roles.includes(actor.role)) throw new Error('Akun tidak berwenang mengambil keputusan administrasi.');
    const action = clean(input.action, 30), reason = clean(input.reason, 500);
    const sections = [...new Set((input.sections || []).filter(value => allowedSections.includes(value)))];
    if (!['CORRECTION_REQUIRED', 'REJECTED'].includes(action)) throw new Error('Keputusan administrasi tidak valid.');
    if (reason.length < 10) throw new Error('Alasan wajib spesifik, minimal 10 karakter.');
    if (!sections.length) throw new Error('Pilih minimal satu bagian yang menjadi dasar keputusan.');
    const intakeRef = window.db.collection('trader_intake').doc(intake.id), statusRef = window.db.collection('public_status').doc(intake.publicToken);
    await window.db.runTransaction(async transaction => {
      const current = await transaction.get(intakeRef);
      if (!current.exists || !['SUBMITTED', 'CORRECTION_REQUIRED'].includes(current.data().status) || current.data().traderId) throw new Error('Pendaftaran sudah diproses atau statusnya berubah. Muat ulang halaman.');
      const event = { action, reason, sections, actorUid: actor.uid, actorRole: actor.role, at: new Date().toISOString() };
      const history = Array.isArray(current.data().reviewHistory) ? current.data().reviewHistory : [];
      transaction.update(intakeRef, { status: action, reviewDecision: event, reviewHistory: [...history, event].slice(-20), reviewedBy: actor.uid, updatedAt: stamp() });
      transaction.set(statusRef, { intakeId: intake.id, publicToken: intake.publicToken, registrationCode: intake.registrationCode, status: action, publicStatus: true, displayName: clean(intake.identity?.name, 120), traderId: '', businessType: '', marketName: '', marketRoutes: [], statementVersion: intake.statement?.version || '', statementAcceptedAt: intake.statement?.acceptedAt || '', photoMediaToken: '', reviewMessage: reason, correctionSections: sections, canResubmit: action === 'CORRECTION_REQUIRED', environment: 'UAT', isDemo: true, schemaVersion: 2, updatedAt: stamp() }, { merge: true });
    });
    return { status: action };
  }
  async function corrections(registrationCode) {
    if (!window.db || !registrationCode) return [];
    const snapshot = await window.db.collection('correction_requests').where('registrationCode', '==', registrationCode).limit(25).get();
    return snapshot.docs.map(document => ({ id: document.id, ...document.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  }
  window.EPASAR_INTAKE_REVIEW = { decide, corrections, allowedSections };
}());
