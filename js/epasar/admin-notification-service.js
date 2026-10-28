(function () {
  'use strict';
  const stamp = () => window.firebase.firestore.FieldValue.serverTimestamp();
  const clean = value => String(value || '').trim();
  const centralRoles = ['SUPER_ADMIN', 'DISPERINDAG_ADMIN', 'TRADE_ADMIN', 'TECH_ADMIN'];
  const PENDING_LIMIT = 40;
  const CACHE_TTL_MS = 30 * 1000;
  let pendingCache = { key: '', expiresAt: 0, rows: null, promise: null };
  const canonicalMarketId = value => window.EPASAR_ADMIN_INTAKE?.canonicalMarketId(value) || '';

  function notificationMarketIds(row, intake) {
    const projected = Array.isArray(row?.routingMarketIds) ? row.routingMarketIds : [];
    const direct = row?.marketId ? [row.marketId] : [];
    const inherited = intake ? window.EPASAR_ADMIN_INTAKE?.intakeMarketIds(intake) || [] : [];
    return [...new Set([...projected, ...direct, ...inherited].map(canonicalMarketId).filter(Boolean))];
  }

  function canAccess(profile, row, intake) {
    if (centralRoles.includes(profile?.role)) return true;
    if (profile?.role !== 'MARKET_ADMIN') return false;
    const assigned = window.EPASAR_ADMIN_INTAKE?.assignedMarketIds(profile) || [];
    return notificationMarketIds(row, intake).some(marketId => assigned.includes(marketId));
  }

  function profileKey(profile) {
    return JSON.stringify({ uid: profile?.uid || '', role: profile?.role || '', marketIds: profile?.marketIds || [] });
  }

  async function pending(profile, options = {}) {
    if (!window.db) throw new Error('Layanan data belum siap.');
    const key = profileKey(profile);
    const now = Date.now();
    if (!options.force && pendingCache.key === key && pendingCache.rows && pendingCache.expiresAt > now) return pendingCache.rows;
    if (pendingCache.key === key && pendingCache.promise) return pendingCache.promise;

    pendingCache.key = key;
    pendingCache.promise = (async () => {
    // Filter di server agar notifikasi yang sudah dikirim tidak ikut dihitung sebagai document read.
    // Fallback mempertahankan kompatibilitas jika indeks project belum selesai dibangun.
    let snap;
    try {
      snap = await window.db.collection('notifications')
        .where('type', '==', 'TRADER_DECISION')
        .where('deliveryStatus', '==', 'PENDING_ADMIN')
        .limit(PENDING_LIMIT)
        .get();
    } catch (error) {
      if (!/index|failed-precondition/i.test(String(error?.code || error?.message || error))) throw error;
      snap = await window.db.collection('notifications').where('type', '==', 'TRADER_DECISION').limit(100).get();
    }
    const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(row => row.deliveryStatus === 'PENDING_ADMIN')
      .slice(0, PENDING_LIMIT);
    const visible = [];
    await Promise.all(rows.map(async row => {
      const sourceIntakeId = clean(row.sourceIntakeId || (row.sourceType === 'ADMIN_INTAKE_REVIEW' ? row.sourceId : ''));
      let data = null;
      if (sourceIntakeId && ((!row.phone || !row.registrationCode) || !notificationMarketIds(row).length)) {
        try {
          const intake = await window.db.collection('trader_intake').doc(sourceIntakeId).get();
          if (intake.exists) data = intake.data();
        } catch (error) {
          // Dokumen di luar cakupan memang ditolak oleh Rules; itu bukan kegagalan antrean.
          if (centralRoles.includes(profile?.role)) throw error;
        }
        if (data) {
          row.routingMarketIds = notificationMarketIds(row, data);
          row.phone = row.phone || data.identity?.phone || '';
          row.registrationCode = row.registrationCode || data.registrationCode || '';
          row.traderName = row.traderName || data.identity?.name || '';
          row.publicToken = row.publicToken || data.publicToken || '';
        }
      }
      if (canAccess(profile, row, data)) visible.push(row);
    }));
    const result = visible.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    pendingCache.rows = result;
    pendingCache.expiresAt = Date.now() + CACHE_TTL_MS;
    return result;
    })();
    try { return await pendingCache.promise; }
    finally { pendingCache.promise = null; }
  }

  function normalizePhone(value) {
    let phone = clean(value).replace(/\D/g, '');
    if (phone.startsWith('0')) phone = `62${phone.slice(1)}`;
    if (!phone.startsWith('62') || phone.length < 10 || phone.length > 15) return '';
    return phone;
  }

  function statusUrl(row) {
    if (!row.publicToken) return `${location.origin}${location.pathname.replace(/[^/]+$/, '')}epasar-status.html`;
    return `${location.origin}${location.pathname.replace(/[^/]+$/, '')}epasar-status.html?token=${encodeURIComponent(row.publicToken)}`;
  }

  function message(row) {
    const decision = row.decision === 'REJECTED' ? 'ditolak' : 'dikembalikan untuk diperbaiki';
    const sections = Array.isArray(row.correctionSections) && row.correctionSections.length ? `\nBagian yang perlu diperhatikan: ${row.correctionSections.join(', ')}` : '';
    return `Yth. Bapak/Ibu ${row.traderName || 'Pedagang'},\n\nPendaftaran/permohonan e-PASAR Anda${row.registrationCode ? ` dengan nomor registrasi ${row.registrationCode}` : ''} ${decision}.\n\nCatatan petugas: ${row.reason || '-'}${sections}\n\nSilakan periksa status dan tindak lanjut melalui tautan berikut:\n${statusUrl(row)}\n\nPesan ini disampaikan oleh Admin e-PASAR Kabupaten Pinrang.`;
  }

  async function markOpened(row, actor, phone) {
    if (!actor?.uid || !['SUPER_ADMIN','DISPERINDAG_ADMIN','TRADE_ADMIN','MARKET_ADMIN','TECH_ADMIN'].includes(actor.role)) throw new Error('Hanya Admin yang dapat mengirim notifikasi pedagang.');
    if (!canAccess(actor, row)) throw new Error('Notifikasi berada di luar cakupan pasar akun ini. Muat ulang halaman.');
    const batch = window.db.batch();
    batch.update(window.db.collection('notifications').doc(row.id), { deliveryStatus: 'WHATSAPP_OPENED', status: 'READ', dispatchedBy: actor.uid, dispatchedRole: actor.role, dispatchedPhone: normalizePhone(phone), dispatchedAt: stamp() });
    if (row.publicToken && row.decision === 'CORRECTION_REQUIRED') {
      batch.update(window.db.collection('public_status').doc(row.publicToken), { status: 'CORRECTION_REQUIRED', reviewMessage: String(row.reason || '').slice(0, 500), correctionSections: Array.isArray(row.correctionSections) ? row.correctionSections.slice(0, 5) : [], canResubmit: true, updatedAt: stamp() });
    }
    await batch.commit();
    pendingCache.expiresAt = 0;
    if (pendingCache.rows) pendingCache.rows = pendingCache.rows.filter(item => item.id !== row.id);
  }

  window.EPASAR_ADMIN_NOTIFICATIONS = { pending, normalizePhone, statusUrl, message, markOpened, canAccess, notificationMarketIds };
}());
