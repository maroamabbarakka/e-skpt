(function () {
  'use strict';

  const PAGE_SIZE = 20;
  const CENTRAL_ROLES = ['SUPER_ADMIN', 'DISPERINDAG_ADMIN', 'TRADE_ADMIN', 'TECH_ADMIN'];
  const MARKET_ID_PATTERN = /^MKT-0(?:0[1-9]|1[01])$/;

  function canonicalMarketId(value) {
    if (window.EPASAR?.canonicalMarketId) return window.EPASAR.canonicalMarketId(value);
    const id = String(value || '').trim().toUpperCase();
    return MARKET_ID_PATTERN.test(id) ? id : '';
  }

  function assignedMarketIds(profile) {
    if (profile?.role !== 'MARKET_ADMIN') return [];
    return [...new Set((profile.marketIds || []).map(canonicalMarketId).filter(Boolean))];
  }

  function intakeMarketIds(intake) {
    if (Array.isArray(intake?.routingMarketIds)) return intake.routingMarketIds.map(canonicalMarketId).filter(Boolean);
    return [...new Set((intake?.businessDrafts || []).flatMap(business => (business.locations || []).flatMap(location =>
      (location.marketPlaces || []).map(place => canonicalMarketId(place.marketId)).filter(Boolean)
    )))];
  }

  function canAccess(profile, intake) {
    if (CENTRAL_ROLES.includes(profile?.role)) return true;
    if (profile?.role !== 'MARKET_ADMIN') return false;
    const assigned = assignedMarketIds(profile);
    return assigned.length > 0 && intakeMarketIds(intake).some(marketId => assigned.includes(marketId));
  }

  async function rowsForAssignedMarkets(profile, statuses = ['SUBMITTED', 'CORRECTION_REQUIRED'], perMarketLimit = PAGE_SIZE) {
    const marketIds = assignedMarketIds(profile);
    if (!marketIds.length) return [];
    const snapshots = await Promise.all(marketIds.map(marketId => window.db.collection('market_intake_queue')
      .where('marketId', '==', marketId)
      .get()));
    const allowedStatuses = new Set(statuses);
    const intakeIds = [...new Set(snapshots.flatMap(snapshot => snapshot.docs
      .filter(document => allowedStatuses.has(document.data().status))
      .map(document => document.data().intakeId)).filter(Boolean))];
    const documents = await Promise.all(intakeIds.map(intakeId => window.db.collection('trader_intake').doc(intakeId).get()));
    return documents.filter(document => document.exists).map(document => ({ id: document.id, ...document.data() }))
      .filter(row => canAccess(profile, row))
      .sort((left, right) => Number(right.submittedAt?.toMillis?.() || 0) - Number(left.submittedAt?.toMillis?.() || 0))
      .slice(0, perMarketLimit * marketIds.length);
  }

  async function page(profile, cursor) {
    if (!window.db) throw new Error('Firebase belum dikonfigurasi.');
    if (profile?.role === 'MARKET_ADMIN') {
      if (cursor) return { rows: [], last: null, hasMore: false };
      const rows = await rowsForAssignedMarkets(profile);
      return { rows, last: null, hasMore: false };
    }
    let query = window.db.collection('trader_intake').where('status', 'in', ['SUBMITTED', 'CORRECTION_REQUIRED']);
    if (!CENTRAL_ROLES.includes(profile?.role)) {
      throw new Error('Role ini tidak berwenang membaca antrean administrasi.');
    }
    query = query.orderBy('submittedAt', 'desc').limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    const rows = snapshot.docs.map(document => ({ id: document.id, ...document.data() })).filter(row => canAccess(profile, row));
    return { rows, last: snapshot.docs[snapshot.docs.length - 1] || null, hasMore: snapshot.size === PAGE_SIZE };
  }

  window.EPASAR_ADMIN_INTAKE = { page, rowsForAssignedMarkets, canAccess, assignedMarketIds, intakeMarketIds, canonicalMarketId, CENTRAL_ROLES, PAGE_SIZE };
}());
