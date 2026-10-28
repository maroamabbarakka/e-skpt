(function () {
  'use strict';

  const STATUSES = Object.freeze([
    'SUBMITTED', 'ADMIN_REVIEW', 'MARKET_VERIFICATION', 'CORRECTION_REQUIRED',
    'CONFLICT', 'NOT_FOUND', 'MARKET_VERIFIED', 'UPTD_REVIEW', 'KADIS_REVIEW',
    'REJECTED', 'TTE_PENDING', 'TTE_UPLOADING', 'TTE_UPLOADED',
    'TTE_REJECTED', 'ISSUED', 'CANCELLED'
  ]);

  const TRANSITIONS = Object.freeze({
    SUBMITTED: ['ADMIN_REVIEW'],
    ADMIN_REVIEW: ['MARKET_VERIFICATION', 'KADIS_REVIEW', 'CORRECTION_REQUIRED', 'REJECTED'],
    MARKET_VERIFICATION: ['MARKET_VERIFIED', 'CORRECTION_REQUIRED', 'CONFLICT', 'NOT_FOUND'],
    MARKET_VERIFIED: ['UPTD_REVIEW'],
    UPTD_REVIEW: ['KADIS_REVIEW', 'MARKET_VERIFICATION'],
    KADIS_REVIEW: ['TTE_PENDING', 'MARKET_VERIFICATION', 'REJECTED'],
    TTE_PENDING: ['TTE_UPLOADING', 'CANCELLED'],
    TTE_UPLOADING: ['TTE_UPLOADED', 'TTE_PENDING'],
    TTE_UPLOADED: ['ISSUED', 'TTE_REJECTED'],
    TTE_REJECTED: ['TTE_PENDING', 'CANCELLED'],
    CORRECTION_REQUIRED: ['ADMIN_REVIEW', 'MARKET_VERIFICATION'],
    CONFLICT: ['MARKET_VERIFICATION', 'CORRECTION_REQUIRED', 'REJECTED'],
    NOT_FOUND: ['MARKET_VERIFICATION', 'REJECTED']
  });

  function canTransition(from, to) {
    return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
  }

  function assertTransition(from, to) {
    if (!canTransition(from, to)) throw new Error(`Transisi status ${from || 'kosong'} ke ${to || 'kosong'} tidak diizinkan.`);
    return true;
  }

  function audit(from, to, actor, note) {
    assertTransition(from, to);
    if (!actor?.uid || !actor?.role) throw new Error('Aktor workflow wajib teridentifikasi.');
    return {
      from, to,
      actorUid: actor.uid,
      actorRole: actor.role,
      note: String(note || '').trim().slice(0, 500),
      at: new Date().toISOString()
    };
  }

  function applicationPayload(traderId, claimId) {
    if (!traderId || !claimId) throw new Error('traderId dan market claim wajib tersedia.');
    return { traderId, claimId, status: 'SUBMITTED', legacy: false, schemaVersion: 2, createdAt: 'SERVER_TIMESTAMP', updatedAt: 'SERVER_TIMESTAMP' };
  }

  window.EPASAR_SKPT = { statuses: STATUSES, transitions: TRANSITIONS, canTransition, assertTransition, audit, applicationPayload };
}());
