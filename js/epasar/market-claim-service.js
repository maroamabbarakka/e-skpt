(function () {
  'use strict';

  const TYPES = ['KIOS', 'LOS', 'LAPAK', 'PELATARAN'];
  const clean = (value, max) => String(value || '').trim().slice(0, max);

  function claimPayload(input, traderId) {
    const unitType = String(input.unitType || '').toUpperCase();
    if (!traderId) throw new Error('traderId wajib tersedia.');
    const market = window.EPASAR?.marketById(input.marketId);
    if (!market) throw new Error('Pasar tidak ditemukan pada master pasar.');
    if (!TYPES.includes(unitType)) throw new Error('Jenis unit pasar tidak valid.');
    const area = input.areaM2 === '' || input.areaM2 == null ? null : Number(input.areaM2);
    if (area !== null && (!Number.isFinite(area) || area < 0 || area > 10000)) throw new Error('Luas unit tidak valid.');
    return {
      traderId,
      marketId: market.id,
      marketName: market.name,
      claimedUnitType: unitType,
      claimedUnitNumber: clean(input.unitNumber, 50),
      claimedBlock: clean(input.block, 30),
      claimedFloor: clean(input.floor, 20),
      claimedAreaM2: area,
      locationHint: clean(input.locationHint, 300),
      verificationStatus: 'UNVERIFIED',
      schemaVersion: 1,
      createdAt: 'SERVER_TIMESTAMP'
    };
  }

  function verificationRecord(before, after, actor) {
    if (!actor?.uid || actor.role !== 'MARKET_HEAD') throw new Error('Verifikasi wajib dilakukan Kepala Pasar terautentikasi.');
    return {
      before: before || {},
      after: after || {},
      reason: clean(actor.reason, 500),
      actorUid: actor.uid,
      actorRole: actor.role,
      createdAt: 'SERVER_TIMESTAMP'
    };
  }

  window.EPASAR_MARKET_CLAIM = { types: TYPES, claimPayload, verificationRecord };
}());
