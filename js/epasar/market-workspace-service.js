(function () {
  'use strict';

  const PAGE_SIZE = 25;
  const TERMINAL = new Set(['VERIFIED', 'CONFLICT', 'NOT_FOUND', 'CORRECTION_REQUIRED']);
  const clean = value => String(value || '').trim();
  const directoryId = claim => `${clean(claim.marketId)}__${clean(claim.traderId)}`.replaceAll('/', '_');

  function database() {
    if (!window.db) throw new Error('Layanan data belum siap.');
    return window.db;
  }

  function assignedMarketIds(profile) {
    if (!profile || profile.role !== 'MARKET_HEAD' || !Array.isArray(profile.marketIds)) return [];
    const list = [];
    profile.marketIds.forEach(id => {
      const canonical = window.EPASAR?.canonicalMarketId ? window.EPASAR.canonicalMarketId(id) : id;
      if (canonical) list.push(canonical);
      const cleanId = clean(id);
      if (cleanId) list.push(cleanId);
    });
    return [...new Set(list.filter(Boolean))];
  }

  function claimState(claim) {
    const verificationStatus = clean(claim?.verificationStatus).toUpperCase();
    if (verificationStatus === 'UNVERIFIED') return 'UNVERIFIED';
    if (TERMINAL.has(verificationStatus)) return verificationStatus;
    return 'LEGACY_REVIEW';
  }

  async function queryPerMarket(marketIds, cursors, buildQuery) {
    const activeMarkets = marketIds.filter(marketId => cursors?.[marketId] !== false);
    const snapshots = await Promise.all(activeMarkets.map(marketId => {
      let query = buildQuery(database().collection('market_claims'), marketId).limit(PAGE_SIZE + 1);
      if (cursors?.[marketId]) query = query.startAfter(cursors[marketId]);
      return query.get();
    }));
    const rows = [];
    const nextCursors = { ...(cursors || {}) };
    let hasMore = false;
    snapshots.forEach((snapshot, index) => {
      const marketId = activeMarkets[index];
      const pageDocuments = snapshot.docs.slice(0, PAGE_SIZE);
      pageDocuments.forEach(document => rows.push({ id: document.id, ...document.data(), assignedMarketId: marketId }));
      if (snapshot.size > PAGE_SIZE) {
        nextCursors[marketId] = pageDocuments[pageDocuments.length - 1];
        hasMore = true;
      } else {
        nextCursors[marketId] = false;
      }
    });
    return { rows, cursors: nextCursors, hasMore };
  }

  async function pending(profile, cursors) {
    const marketIds = assignedMarketIds(profile);
    if (!marketIds.length) return { rows: [], cursors: {}, hasMore: false };
    const page = await queryPerMarket(marketIds, cursors, (collection, marketId) => collection
      .where('marketId', '==', marketId)
      .where('verificationStatus', '==', 'UNVERIFIED')
      .orderBy('createdAt', 'asc'));
    page.rows.sort((left, right) => (left.createdAt?.toMillis?.() || 0) - (right.createdAt?.toMillis?.() || 0));
    return page;
  }

  async function directory(profile, cursors) {
    const marketIds = assignedMarketIds(profile);
    if (!marketIds.length) return { rows: [], cursors: {}, hasMore: false };
    return queryPerMarket(marketIds, cursors, (collection, marketId) => collection
      .where('marketId', '==', marketId)
      .orderBy(window.firebase.firestore.FieldPath.documentId(), 'asc'));
  }

  function chunks(values, size) {
    const result = [];
    for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
    return result;
  }

  async function directoryProfiles(claims) {
    const byMarket = new Map();
    (claims || []).forEach(claim => {
      const marketId = clean(claim.marketId), traderId = clean(claim.traderId);
      if (!marketId || !traderId) return;
      if (!byMarket.has(marketId)) byMarket.set(marketId, new Set());
      byMarket.get(marketId).add(traderId);
    });
    const snapshots = await Promise.all([...byMarket.entries()].flatMap(([marketId, ids]) => chunks([...ids], 10).map(group => database()
      .collection('market_trader_directory')
      .where('marketId', '==', marketId)
      .where('traderId', 'in', group)
      .get())));
    const entries = [];
    snapshots.forEach(snapshot => snapshot.forEach(document => {
      const row = { id: document.id, ...document.data() };
      entries.push([directoryId(row), row]);
    }));
    return new Map(entries);
  }

  async function applicationsByClaim(claims) {
    const applicationIds = [...new Set((claims || []).map(claim => clean(claim.applicationId)).filter(Boolean))];
    const snapshots = await Promise.all(applicationIds.map(applicationId => database().collection('skpt_applications').doc(applicationId).get().catch(() => null)));
    const result = new Map();
    snapshots.filter(snapshot => snapshot?.exists).forEach(snapshot => {
      const row = { id: snapshot.id, ...snapshot.data() };
      result.set(snapshot.id, row);
      if (row.claimId) result.set(row.claimId, row);
    });
    return result;
  }

  async function legacyTradersById(claims, profile) {
    if (profile?.marketDirectoryScoped === true) return new Map();
    const ids = [...new Set((claims || []).map(claim => clean(claim.traderId)).filter(Boolean))];
    if (!ids.length) return new Map();
    try {
      const entries = await Promise.all(chunks(ids, 10).map(async group => {
        const snapshot = await database().collection('traders').where('traderId', 'in', group).get();
        return snapshot.docs.map(document => [document.data().traderId, { id: document.id, ...document.data() }]);
      }));
      return new Map(entries.flat());
    } catch (error) {
      console.warn('Fallback identitas pedagang lama tidak tersedia.', error);
      return new Map();
    }
  }

  async function enrichClaims(claims, profile) {
    const [directory, applications, legacyTraders] = await Promise.all([
      directoryProfiles(claims),
      applicationsByClaim(claims),
      legacyTradersById(claims, profile)
    ]);
    return claims.map(claim => ({
      ...claim,
      state: claimState(claim),
      trader: directory.get(directoryId(claim)) || legacyTraders.get(claim.traderId) || null,
      application: applications.get(claim.applicationId) || applications.get(claim.id) || null
    }));
  }

  async function claimMedia(claim) {
    const intakeId = clean(claim?.application?.sourceIntakeId);
    const allowedTypes = ['PROFILE', 'EVIDENCE', 'LOCATION'];
    if (!intakeId) return [];
    const snapshots = await Promise.all(allowedTypes.map(mediaType => database()
      .collection('trader_media')
      .where('ownerId', '==', intakeId)
      .where('mediaType', '==', mediaType)
      .limit(5)
      .get()
      .catch(error => {
        console.warn(`Media ${mediaType} tidak dapat dimuat.`, error);
        return null;
      })));
    return snapshots.filter(Boolean).flatMap(snapshot => snapshot.docs.map(document => ({ id: document.id, ...document.data() })))
      .filter(media => allowedTypes.includes(media.mediaType) && media.mime === 'image/webp' && media.dataBase64);
  }

  async function enrichPage(page, profile) {
    return { ...page, rows: await enrichClaims(page.rows, profile) };
  }

  async function loadPending(profile, cursors) {
    return enrichPage(await pending(profile, cursors), profile);
  }

  async function loadDirectory(profile, cursors) {
    return enrichPage(await directory(profile, cursors), profile);
  }

  async function load(profile, pendingCursors, directoryCursors) {
    const [pendingPage, directoryPage] = await Promise.all([pending(profile, pendingCursors), directory(profile, directoryCursors)]);
    const allRows = [...pendingPage.rows, ...directoryPage.rows];
    const enriched = await enrichClaims(allRows, profile);
    const pendingRows = enriched.slice(0, pendingPage.rows.length);
    const directoryRows = enriched.slice(pendingPage.rows.length);
    return {
      pending: pendingRows,
      directory: directoryRows,
      pendingCursors: pendingPage.cursors,
      directoryCursors: directoryPage.cursors,
      pendingHasMore: pendingPage.hasMore,
      directoryHasMore: directoryPage.hasMore,
      pageSize: PAGE_SIZE
    };
  }

  window.EPASAR_MARKET_WORKSPACE = { PAGE_SIZE, assignedMarketIds, claimState, pending, directory, directoryProfiles, applicationsByClaim, legacyTradersById, claimMedia, loadPending, loadDirectory, load };
}());
