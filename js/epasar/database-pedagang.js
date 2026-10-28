(function () {
  'use strict';

  let currentProfile = null;
  let allRecords = [];
  let filteredRecords = [];
  let currentPage = 1;
  const pageSize = 15;
  let currentReportScope = null;
  let metricSource = {
    activeTraderIds: new Set(),
    businesses: [],
    units: [],
    occupancies: []
  };

  const REPORT_REGIONS = [
    { id: 'WILAYAH_I', label: 'Wilayah Administrasi Pasar I', marketIds: ['MKT-001','MKT-002','MKT-005','MKT-007','MKT-009','MKT-011'] },
    { id: 'WILAYAH_II', label: 'Wilayah Administrasi Pasar II', marketIds: ['MKT-003','MKT-004','MKT-006','MKT-008','MKT-010'] }
  ];

  const esc = value => String(value ?? '—').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const formatRupiah = num => 'Rp ' + Number(num || 0).toLocaleString('id-ID');
  const formatDateId = val => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (_) { return String(val); }
  };

  function notice(text, error = false) {
    const el = document.getElementById('dbMessage');
    if (!el) return;
    el.textContent = text;
    el.className = error ? 'admin-message admin-error' : 'admin-message';
    el.hidden = !text;
  }

  // Mendapatkan jadwal operasional pasar dinamis dari konfigurasi sistem
  function getMarketSchedule(marketId, marketName) {
    if (window.EPASAR_CONFIG_SERVICE && typeof window.EPASAR_CONFIG_SERVICE.getMarketSchedule === 'function') {
      return window.EPASAR_CONFIG_SERVICE.getMarketSchedule(marketId, marketName, currentAppSettings);
    }
    const name = String(marketName || '').toLowerCase();
    if (name.includes('sentral')) return 'Pasar Harian (Setiap Hari)';
    if (name.includes('kariango')) return 'Pasar Mingguan (Senin & Kamis)';
    if (name.includes('pekkabata')) return 'Pasar Mingguan (Minggu & Rabu)';
    if (name.includes('teppo')) return 'Pasar Mingguan (Rabu & Sabtu)';
    if (name.includes('batulappa')) return 'Pasar Mingguan (Selasa & Jumat)';
    if (name.includes('bungi')) return 'Pasar Mingguan (Rabu & Sabtu)';
    return 'Pasar Berkala / Mingguan';
  }

  const getDb = () => {
    if (window.db) return window.db;
    if (typeof firebase !== 'undefined' && firebase.firestore) return firebase.firestore();
    throw new Error('Koneksi Firestore belum siap.');
  };

  let currentAppSettings = null;

  function chunks(values, size = 10) {
    const rows = [];
    for (let index = 0; index < values.length; index += size) rows.push(values.slice(index, index + size));
    return rows;
  }

  async function readAll(query, batchSize = 300) {
    const rows = [];
    let cursor = null;
    do {
      let pageQuery = query.orderBy(firebase.firestore.FieldPath.documentId()).limit(batchSize);
      if (cursor) pageQuery = pageQuery.startAfter(cursor);
      const snapshot = await pageQuery.get();
      snapshot.forEach(doc => rows.push({ id: doc.id, ...doc.data() }));
      cursor = snapshot.docs[snapshot.docs.length - 1] || null;
      if (snapshot.size < batchSize) break;
    } while (cursor);
    return rows;
  }

  function canonicalMarketIds(profile) {
    const source = Array.isArray(profile?.marketIds) ? [...profile.marketIds] : [];
    if (profile?.marketId) source.push(profile.marketId);
    return [...new Set(source.map(value => window.EPASAR?.canonicalMarketId?.(value) || String(value || '').trim()).filter(Boolean))];
  }

  function sameMarketSet(left, right) {
    return left.length === right.length && left.every(value => right.includes(value));
  }

  function resolveReportScope(profile) {
    const marketIds = canonicalMarketIds(profile);
    if (profile?.role === 'MARKET_ADMIN') {
      const region = REPORT_REGIONS.find(item => sameMarketSet(item.marketIds, marketIds));
      return {
        type: 'REGION',
        id: region?.id || 'WILAYAH_PENUGASAN',
        label: region?.label || profile.position || profile.displayName || 'Wilayah Penugasan Pasar',
        marketIds,
        scoped: true
      };
    }
    if (profile?.role === 'MARKET_HEAD') {
      const names = marketIds.map(id => window.EPASAR?.marketById?.(id)?.name || id);
      return {
        type: marketIds.length === 1 ? 'MARKET' : 'MARKET_SET',
        id: marketIds.length === 1 ? marketIds[0] : 'PASAR_PENUGASAN',
        label: marketIds.length === 1 ? names[0] : 'Pasar dalam Penugasan Kepala Pasar',
        marketIds,
        scoped: true
      };
    }
    return { type: 'CENTRAL', id: 'KABUPATEN_PINRANG', label: 'Seluruh Pasar Rakyat Kabupaten Pinrang', marketIds: [], scoped: false };
  }

  function marketInScope(marketId, scope = currentReportScope) {
    if (!scope?.scoped) return true;
    const canonical = window.EPASAR?.canonicalMarketId?.(marketId) || String(marketId || '').trim();
    return scope.marketIds.includes(canonical);
  }

  function selectedReportLabel() {
    const select = document.getElementById('filterMarket');
    if (select?.value) {
      return (select.selectedOptions[0]?.text || select.value)
        .replace(/^[●\s]*[A-Z0-9-]+\s*·\s*/i, '')
        .replace(/\s*\([^)]*\)$/, '')
        .trim();
    }
    return currentReportScope?.label || 'Seluruh Pasar Rakyat Kabupaten Pinrang';
  }

  function reportFileScope() {
    const selectedMarket = document.getElementById('filterMarket')?.value;
    const raw = selectedMarket || currentReportScope?.id || 'KABUPATEN_PINRANG';
    return String(raw).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  async function loadDatabase(profile) {
    notice('Mengumpulkan master database pedagang dan lokasi pasar…');
    if (window.EPASAR_CONFIG_SERVICE && typeof window.EPASAR_CONFIG_SERVICE.getSettings === 'function') {
      try {
        currentAppSettings = await window.EPASAR_CONFIG_SERVICE.getSettings();
      } catch (_) {}
    }
    currentReportScope = resolveReportScope(profile);
    const isScoped = currentReportScope.scoped;
    const assignedIds = currentReportScope.marketIds;
    const db = getDb();

    try {
      if (isScoped && !assignedIds.length) {
        throw new Error('Akun wilayah belum memiliki penugasan pasar. Hubungi Super Admin sebelum membuka laporan.');
      }
      // Kepala Pasar tidak boleh memindai master pedagang lintas pasar. Klaim
      // pasar menjadi sumber scope, lalu identitas dibaca dari projection
      // market_trader_directory yang memang dibatasi oleh Firestore Rules.
      const tradersMap = new Map();
      let claimsList = [];
      if (isScoped && assignedIds.length > 0) {
        const claimGroups = await Promise.all(
          assignedIds.map(mId => readAll(db.collection('market_claims').where('marketId', '==', mId)))
        );
        claimGroups.forEach(group => { claimsList.push(...group); });
      } else {
        claimsList = await readAll(db.collection('market_claims'));
      }

      const scopedTraderIds = [...new Set(claimsList.map(claim => claim.traderId).filter(Boolean))];
      if (isScoped) {
        const directorySnapshots = await Promise.all(assignedIds.flatMap(marketId => chunks(scopedTraderIds).map(group => db
          .collection('market_trader_directory')
          .where('marketId', '==', marketId)
          .where('traderId', 'in', group)
          .get())));
        directorySnapshots.forEach(snapshot => snapshot.forEach(doc => {
          const trader = { id: doc.id, ...doc.data() };
          tradersMap.set(trader.traderId || doc.id, trader);
        }));
      } else {
        const traders = await readAll(db.collection('traders'));
        traders.forEach(trader => tradersMap.set(trader.traderId || trader.id, trader));
      }

      // Data usaha Kepala Pasar hanya diminta untuk pedagang yang sudah berada
      // dalam klaim pasar penugasannya, bukan melalui pemindaian koleksi global.
      const businessesByTrader = new Map();
      const businessSnapshots = isScoped
        ? await Promise.all(chunks(scopedTraderIds).map(group => db.collection('businesses').where('traderId', 'in', group).get()))
        : [await readAll(db.collection('businesses'))];
      businessSnapshots.forEach(snapshot => {
        const list = Array.isArray(snapshot) ? snapshot : snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        list.forEach(business => {
        if (!business.traderId) return;
        if (!businessesByTrader.has(business.traderId)) businessesByTrader.set(business.traderId, []);
        businessesByTrader.get(business.traderId).push(business);
        });
      });

      // 4. Ambil data skpt_applications & skpt_documents
      let appsSnapshots = [];
      if (isScoped && assignedIds.length > 0) {
        appsSnapshots = await Promise.all(
          assignedIds.map(mId => readAll(db.collection('skpt_applications').where('marketId', '==', mId)))
        );
      } else {
        appsSnapshots = [await readAll(db.collection('skpt_applications'))];
      }
      const appsByClaim = new Map();
      const appsByTrader = new Map();
      appsSnapshots.forEach(snapshot => {
        const list = Array.isArray(snapshot) ? snapshot : snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        list.forEach(a => {
          if (a.claimId) appsByClaim.set(a.claimId, a);
          if (a.traderId) appsByTrader.set(a.traderId, a);
        });
      });

      // Ambil juga dokumen resmi SKPT yang sudah terbit (skpt_documents)
      const skptDocsByApp = new Map();
      const skptDocsByTrader = new Map();
      const skptDocsById = new Map();
      try {
        const skptSnapshots = isScoped
          ? await Promise.all(assignedIds.map(marketId => readAll(db.collection('skpt_documents')
            .where('documentSnapshot.marketId', '==', marketId)
            .where('status', '==', 'ISSUED'))))
          : [await readAll(db.collection('skpt_documents').where('status', '==', 'ISSUED'))];
        skptSnapshots.forEach(snapshot => {
          const list = Array.isArray(snapshot) ? snapshot : snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          list.forEach(document => {
          skptDocsById.set(document.id, document);
          if (document.applicationId) skptDocsByApp.set(document.applicationId, document);
          if (document.traderId) skptDocsByTrader.set(document.traderId, document);
          });
        });
      } catch (errSkpt) {
        console.warn('skpt_documents belum dapat dimuat lengkap:', errSkpt);
      }

      const [unitGroups, occupancyGroups] = await Promise.all([
        isScoped
          ? Promise.all(assignedIds.map(marketId => readAll(db.collection('market_units').where('marketId', '==', marketId))))
          : Promise.resolve([await readAll(db.collection('market_units'))]),
        isScoped
          ? Promise.all(assignedIds.map(marketId => readAll(db.collection('market_occupancies').where('marketId', '==', marketId))))
          : Promise.resolve([await readAll(db.collection('market_occupancies'))])
      ]);
      const activeTraderIds = new Set();
      tradersMap.forEach((trader, traderId) => {
        if (String(trader.status || 'ACTIVE').toUpperCase() === 'ACTIVE') activeTraderIds.add(traderId);
      });
      metricSource = {
        activeTraderIds,
        businesses: [...businessesByTrader.values()].flat().filter(business => String(business.status || 'ACTIVE').toUpperCase() === 'ACTIVE'),
        units: unitGroups.flat(),
        occupancies: occupancyGroups.flat().filter(occupancy => String(occupancy.status || '').toUpperCase() === 'ACTIVE')
      };

      // 5. Gabungkan menjadi flat Master Records
      const records = [];
      const processedTraderIds = new Set();

      // Olah yang memiliki klaim tempat pasar
      claimsList.forEach(claim => {
        const traderId = claim.traderId;
        const trader = tradersMap.get(traderId) || {};
        const businesses = businessesByTrader.get(traderId) || [];
        const app = appsByClaim.get(claim.id) || appsByTrader.get(traderId) || {};
        const business = businesses[0] || {};
        const skptDoc = skptDocsByApp.get(app.id) || skptDocsByTrader.get(traderId) || (app.skptDocumentId ? skptDocsById.get(app.skptDocumentId) : {}) || {};

        processedTraderIds.add(traderId);
        const marketObj = window.EPASAR?.marketById(claim.marketId);
        const marketName = marketObj?.name || claim.marketName || claim.marketId || 'Pasar Rakyat';
        const unitType = claim.claimedUnitType || claim.unitType || 'KIOS';
        const unitNumber = claim.claimedUnitNumber || claim.unitNumber || '—';
        const block = claim.claimedBlock || claim.block || '—';
        const floor = claim.claimedFloor || claim.floor || '1';
        const areaM2 = claim.claimedAreaM2 ?? claim.areaM2 ?? null;
        const monthlyRevenue = business.monthlyRevenue ?? null;
        const operatingSchedule = getMarketSchedule(claim.marketId, marketName);

        const hasSkpt = Boolean(skptDoc.verificationToken || app.status === 'ISSUED' || skptDoc.status === 'ISSUED');
        const skptNumber = skptDoc.number || app.skptNumber || app.number || (hasSkpt ? (skptDoc.number || `SKPT-PIN-${String(claim.marketId || '').slice(-3)}-${traderId.slice(-4)}`) : '—');
        const verificationToken = skptDoc.verificationToken || app.verificationToken || '';
        const documentHash = skptDoc.documentHash || '';
        const publicToken = app.publicToken || trader.publicToken || claim.publicToken || trader.intakeId || '';
        const registrationCode = trader.registrationCode || app.registrationCode || trader.code || '';
        const validUntil = skptDoc.validUntil || '';
        const phone = trader.phone || app.applicantSnapshot?.phone || business.phone || '';

        // Deteksi dan bentuk rincian alasan konflik fisik lapangan
        const verifiedObj = claim.verified || {};
        const isConflict = claim.verificationStatus === 'CONFLICT' || app.status === 'CONFLICT' || Boolean(verifiedObj.conflict);
        const conflictData = isConflict ? {
          isConflict: true,
          reason: verifiedObj.reason || claim.conflictReason || 'Unit fisik terindikasi sengketa atau pengguna aktual lapangan berbeda dengan identitas pemohon.',
          actualUser: verifiedObj.actualUser || 'Pengguna aktual lain di pasar',
          unitClaimed: `${unitType} ${unitNumber} (Blok ${block}, Lt. ${floor})`,
          verifiedAt: verifiedObj.verifiedAt || claim.updatedAt || claim.createdAt || ''
        } : null;

        records.push({
          traderId,
          traderDocId: trader.id || '',
          displayName: claim.traderDisplayName || trader.displayName || app.applicantSnapshot?.displayName || 'Pedagang Pasar',
          nikMasked: '7315' + '************',
          businessName: business.name || app.applicantSnapshot?.businessName || 'Belum terdata',
          businessType: business.type || 'Belum terdata',
          businessCategory: business.category || business.group || 'Belum terdata',
          monthlyRevenue,
          workerCount: business.workerCount ?? null,
          marketId: claim.marketId,
          marketName,
          unitType,
          unitNumber,
          block,
          floor,
          areaM2,
          operatingSchedule,
          verificationStatus: isConflict ? 'CONFLICT' : (claim.verificationStatus || 'UNVERIFIED'),
          conflictData,
          verificationRecordId: claim.verificationRecordId || app.verificationRecordId || '',
          skptStatus: app.status || (hasSkpt ? 'ISSUED' : 'BELUM_PENGAJUAN'),
          skptNumber,
          hasSkpt,
          verificationToken,
          documentHash,
          registrationCode,
          publicToken,
          validUntil,
          phone,
          claimId: claim.id,
          applicationId: app.id || claim.applicationId || '',
          skptDocumentId: app.skptDocumentId || skptDoc.id || '',
          registeredAt: claim.createdAt?.toDate ? claim.createdAt.toDate().toISOString() : new Date().toISOString()
        });
      });

      // Tambahkan pedagang non-pasar jika staff bukan kepala pasar
      if (!isScoped) {
        tradersMap.forEach((trader, tId) => {
          if (!processedTraderIds.has(tId)) {
            const businesses = businessesByTrader.get(tId) || [];
            const b = businesses[0] || {};
            records.push({
              traderId: tId,
              traderDocId: trader.id,
              displayName: trader.displayName || 'Pedagang Non-Pasar',
              nikMasked: '7315************',
              businessName: b.name || 'Usaha Perdagangan',
              businessType: b.type || 'Non-Pasar',
              businessCategory: b.category || b.group || 'Umum',
              monthlyRevenue: b.monthlyRevenue ?? null,
              workerCount: b.workerCount ?? null,
              marketId: 'NON_MARKET',
              marketName: 'Luar Kawasan Pasar (Mandiri)',
              unitType: 'NON_PASAR',
              unitNumber: '—',
              block: '—',
              floor: '—',
              areaM2: 0,
              operatingSchedule: 'Mandiri (Luar Kawasan Pasar)',
              verificationStatus: 'TERDATA',
              skptStatus: 'TIDAK_MEMERLUKAN',
              skptNumber: '—',
              hasSkpt: false,
              claimId: '',
              applicationId: '',
              registeredAt: trader.createdAt?.toDate ? trader.createdAt.toDate().toISOString() : new Date().toISOString()
            });
          }
        });
      }

      allRecords = isScoped ? records.filter(record => marketInScope(record.marketId, currentReportScope)) : records;
      allRecords = allRecords.filter(record => metricSource.activeTraderIds.has(record.traderId));
      notice('');
      populateMarketFilter(profile);
      applyFilters();
    } catch (err) {
      console.error('Error memuat database pedagang:', err);
      notice('Gagal memuat master database: ' + err.message, true);
    }
  }

  function populateMarketFilter(profile) {
    const marketSelect = document.getElementById('filterMarket');
    if (!marketSelect) return;

    const scope = currentReportScope || resolveReportScope(profile);
    const assignedIds = scope.marketIds;

    const markets = window.EPASAR?.MARKETS || [
      { id: 'MKT-001', name: 'Pasar Rakyat Bungi' },
      { id: 'MKT-002', name: 'Pasar Rakyat Cempa' },
      { id: 'MKT-003', name: 'Pasar Rakyat Kampung Jaya' },
      { id: 'MKT-004', name: 'Pasar Rakyat Kariango' },
      { id: 'MKT-005', name: 'Pasar Rakyat Langnga' },
      { id: 'MKT-006', name: 'Pasar Rakyat Lanrisang' },
      { id: 'MKT-007', name: 'Pasar Rakyat Leppangang' },
      { id: 'MKT-008', name: 'Pasar Rakyat Marawi' },
      { id: 'MKT-009', name: 'Pasar Rakyat Pekkabata' },
      { id: 'MKT-010', name: 'Pasar Rakyat Sentral Pinrang' },
      { id: 'MKT-011', name: 'Pasar Rakyat Teppo' }
    ];

    marketSelect.disabled = false;
    marketSelect.innerHTML = scope.scoped
      ? `<option value="">Semua Pasar dalam ${esc(scope.label)}</option>`
      : '<option value="">Semua Pasar se-Kabupaten Pinrang</option>';

    markets.forEach(m => {
      const isAssigned = assignedIds.includes(m.id) || assignedIds.includes(window.EPASAR?.canonicalMarketId(m.id));
      if (!scope.scoped || isAssigned) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.id} · ${m.name}`;
        const color = window.EPASAR_MARKET_THEME?.palette(m.id, m.name).primary || '#174F83';
        opt.textContent = `● ${m.id} · ${m.name} (${color})`;
        opt.style.color = color;
        marketSelect.appendChild(opt);
      }
    });

    if (!scope.scoped) {
      const optNon = document.createElement('option');
      optNon.value = 'NON_MARKET';
      optNon.textContent = 'Pedagang Mandiri (Luar Pasar)';
      marketSelect.appendChild(optNon);
    } else if (assignedIds.length === 1) {
      marketSelect.value = assignedIds[0];
      marketSelect.disabled = true;
    }
  }

  let currentSort = { key: null, order: 'asc' };

  function applySort() {
    if (!currentSort.key) return;
    const { key, order } = currentSort;
    const factor = order === 'asc' ? 1 : -1;

    filteredRecords.sort((a, b) => {
      let valA = a[key] ?? '';
      let valB = b[key] ?? '';

      if (key === 'no') {
        return (allRecords.indexOf(a) - allRecords.indexOf(b)) * factor;
      }
      if (key === 'areaM2' || key === 'monthlyRevenue' || key === 'workerCount') {
        return (Number(valA) - Number(valB)) * factor;
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB, 'id', { numeric: true, sensitivity: 'base' }) * factor;
      }
      return (valA > valB ? 1 : valA < valB ? -1 : 0) * factor;
    });
  }

  function handleSortClick(key) {
    if (currentSort.key === key) {
      currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
      currentSort.key = key;
      currentSort.order = 'asc';
    }

    document.querySelectorAll('.db-table th.sortable').forEach(th => {
      const thKey = th.dataset.sort;
      const icon = th.querySelector('.sort-icon');
      if (thKey === currentSort.key) {
        th.classList.remove('sorted-asc', 'sorted-desc');
        th.classList.add(currentSort.order === 'asc' ? 'sorted-asc' : 'sorted-desc');
        if (icon) icon.textContent = currentSort.order === 'asc' ? '▲' : '▼';
      } else {
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (icon) icon.textContent = '↕';
      }
    });

    applySort();
    currentPage = 1;
    renderTable();
  }

  function applyFilters() {
    const keyword = document.getElementById('filterSearch').value.trim().toLowerCase();
    const market = document.getElementById('filterMarket').value;
    const unitType = document.getElementById('filterUnitType').value;
    const skptStatus = document.getElementById('filterSkpt').value;
    const verifyStatus = document.getElementById('filterVerify').value;

    filteredRecords = allRecords.filter(item => {
      if (!marketInScope(item.marketId)) return false;
      if (keyword) {
        const hay = `${item.displayName} ${item.traderId} ${item.businessName} ${item.businessCategory} ${item.unitNumber} ${item.skptNumber}`.toLowerCase();
        if (!hay.includes(keyword)) return false;
      }
      if (market && item.marketId !== market) return false;
      if (unitType && item.unitType !== unitType) return false;
      if (skptStatus) {
        if (skptStatus === 'ISSUED' && !item.hasSkpt) return false;
        if (skptStatus === 'NO_SKPT' && item.hasSkpt) return false;
        if (skptStatus === 'PROCESS' && (item.hasSkpt || item.skptStatus === 'BELUM_PENGAJUAN')) return false;
      }
      if (verifyStatus && item.verificationStatus !== verifyStatus) return false;
      return true;
    });

    currentPage = 1;
    applySort();
    updateKpis();
    renderTable();
    updateFilterMeta();
  }

  function updateKpis() {
    const visibleTraderIds = new Set(filteredRecords.map(record => record.traderId).filter(Boolean));
    const selectedMarket = document.getElementById('filterMarket')?.value || '';
    const selectedUnitType = document.getElementById('filterUnitType')?.value || '';
    const totalTraders = [...visibleTraderIds].filter(traderId => metricSource.activeTraderIds.has(traderId)).length;
    const unitById = new Map(metricSource.units.map(unit => [unit.unitId || unit.id, unit]));
    const visibleOccupancies = metricSource.occupancies.filter(occupancy => {
      if (!visibleTraderIds.has(occupancy.traderId) || !marketInScope(occupancy.marketId)) return false;
      if (selectedMarket && occupancy.marketId !== selectedMarket) return false;
      return true;
    });
    const occupiedUnitIds = new Set(visibleOccupancies.map(occupancy => occupancy.marketUnitId || occupancy.unitId).filter(Boolean));
    const occupiedUnits = [...occupiedUnitIds].map(unitId => unitById.get(unitId)).filter(unit =>
      unit && (!selectedUnitType || unit.unitType === selectedUnitType));
    const totalUnits = occupiedUnits.length;
    const totalArea = occupiedUnits.reduce((sum, unit) => sum + (Number(unit.areaM2) || 0), 0);
    const uniqueBusinesses = new Map();
    metricSource.businesses.forEach(business => {
      if (visibleTraderIds.has(business.traderId)) uniqueBusinesses.set(business.businessId || business.id, business);
    });
    const revenueRows = [...uniqueBusinesses.values()].filter(business =>
      business.monthlyRevenue !== null && business.monthlyRevenue !== undefined && business.monthlyRevenue !== '' && Number.isFinite(Number(business.monthlyRevenue)));
    const totalOmzet = revenueRows.reduce((sum, business) => sum + Number(business.monthlyRevenue), 0);
    const marketCount = new Set(occupiedUnits.map(unit => unit.marketId).filter(Boolean)).size;

    document.getElementById('kpiTraders').textContent = totalTraders.toLocaleString('id-ID');
    document.getElementById('kpiUnits').textContent = totalUnits.toLocaleString('id-ID');
    document.getElementById('kpiArea').textContent = totalArea.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' m²';
    document.getElementById('kpiOmzet').textContent = revenueRows.length ? formatRupiah(totalOmzet) : 'Belum tersedia';
    const scheduleEl = document.getElementById('kpiSchedule') || document.getElementById('kpiRetribusi');
    if (scheduleEl) {
      scheduleEl.textContent = `${marketCount} Pasar`;
    }
    const labels = {
      kpiTraders: ['Total Pedagang Aktif', 'Master pedagang berstatus aktif'],
      kpiUnits: ['Unit dengan Okupansi Aktif', 'Unit fisik terhubung ke pemegang aktif'],
      kpiArea: ['Luas Unit Aktif', 'Dari unit fisik dengan okupansi aktif'],
      kpiOmzet: ['Omzet Usaha Terdata', 'Tanpa nilai asumsi untuk data kosong'],
      kpiSchedule: ['Pasar dengan Okupansi', 'Pasar yang memiliki unit aktif']
    };
    Object.entries(labels).forEach(([id, text]) => {
      const value = document.getElementById(id);
      if (value?.previousElementSibling) value.previousElementSibling.textContent = text[0];
      if (value?.nextElementSibling) value.nextElementSibling.textContent = text[1];
    });
    const coverage = document.getElementById('dbMetricCoverage');
    if (coverage) coverage.textContent = `Cakupan saat ini: ${totalTraders.toLocaleString('id-ID')} pedagang aktif, ${visibleOccupancies.length.toLocaleString('id-ID')} okupansi aktif, dan ${revenueRows.length.toLocaleString('id-ID')} usaha dengan nilai omzet. KPI mengikuti filter di bawah.`;
  }

  function renderTable() {
    const tbody = document.getElementById('dbRows');
    const start = (currentPage - 1) * pageSize;
    const pageRows = filteredRecords.slice(start, start + pageSize);

    if (!pageRows.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:36px;color:#60738d">Data pedagang tidak ditemukan dengan kriteria filter saat ini.</td></tr>';
      document.getElementById('pageInfo').textContent = 'Menampilkan 0 dari 0 data';
      document.getElementById('btnPrev').disabled = true;
      document.getElementById('btnNext').disabled = true;
      return;
    }

    tbody.innerHTML = pageRows.map((row, index) => {
      const no = start + index + 1;
      
      // Status Verifikasi Fisik
      let statusBadge = '<span class="db-badge db-badge-neutral">○ Belum Cek</span>';
      if (row.verificationStatus === 'VERIFIED') statusBadge = '<span class="db-badge db-badge-success">✓ Terverifikasi</span>';
      else if (row.verificationStatus === 'CONFLICT') statusBadge = '<span class="db-badge db-badge-danger">⚠ Konflik</span>';

      // Status e-SKPT & Nomor SKPT Resmi
      let skptBadge = '<span class="db-badge db-badge-neutral">Tanpa SKPT</span>';
      let skptDetail = '';
      if (row.hasSkpt) {
        skptBadge = '<span class="db-badge db-badge-success">✓ SKPT Terbit</span>';
        skptDetail = `<span class="db-code-badge" title="Nomor SKPT">${esc(row.skptNumber)}</span>`;
      } else if (row.skptStatus === 'KADIS_REVIEW' || row.skptStatus === 'TTE_PENDING') {
        skptBadge = '<span class="db-badge db-badge-info">⏳ Proses Kadis</span>';
        skptDetail = '<span class="db-sub-hint">Siap TTE</span>';
      } else if (row.skptStatus === 'MARKET_VERIFICATION') {
        skptBadge = '<span class="db-badge db-badge-warning">🔍 Verifikasi Pasar</span>';
        skptDetail = '<span class="db-sub-hint">Cek Lapangan</span>';
      } else if (row.skptStatus === 'REJECTED') {
        skptBadge = '<span class="db-badge db-badge-danger">✕ Ditolak</span>';
      }

      // Unit Penempatan
      const unitInfo = row.marketId === 'NON_MARKET'
        ? '<span class="db-badge db-badge-neutral">Non-Pasar</span>'
        : `<div class="db-unit-cell">
             <div class="db-unit-badge">
               <span class="unit-type">${esc(row.unitType)}</span>
               <span class="unit-num">${esc(row.unitNumber)}</span>
             </div>
             <div class="db-unit-meta">
               <span>Blok ${esc(row.block)}</span>
               <span class="meta-dot">·</span>
               <span>Lt. ${esc(row.floor)}</span>
               <span class="meta-dot">·</span>
               <span>${row.areaM2} m²</span>
             </div>
           </div>`;

      // Jadwal Operasional (Harian / Tertentu)
      let scheduleInfo = '<span class="db-badge db-badge-neutral">Mandiri</span>';
      if (row.marketId !== 'NON_MARKET') {
        const rawSched = String(row.operatingSchedule || '').trim();
        const isDaily = rawSched.toLowerCase().includes('harian') || rawSched.toLowerCase().includes('setiap');
        if (isDaily) {
          scheduleInfo = `<div class="db-sched-cell">
            <span class="db-sched-pill is-daily">☀️ Harian</span>
            <span class="db-sched-days">7 Hari / Minggu</span>
          </div>`;
        } else {
          // Bersihkan teks "Pasar Mingguan (...)" agar ringkas
          let cleanSched = rawSched.replace(/^pasar mingguan\s*\(/i, '').replace(/\)\s*-\s*\d+\s*hari.*$/i, '').replace(/\)\s*·.*$/i, '').replace(/\)$/, '');
          scheduleInfo = `<div class="db-sched-cell">
            <span class="db-sched-pill is-custom">📅 ${esc(cleanSched || rawSched)}</span>
          </div>`;
        }
      }

      const initialChar = row.displayName ? row.displayName.trim().charAt(0).toUpperCase() : 'P';
      const marketDisplayName = String(row.marketName || 'Lokasi tidak tersedia').replace(/^Pasar\s+Rakyat\s+/i, '').trim();
      const marketKind = row.marketId === 'NON_MARKET' ? 'Usaha non-pasar' : 'Pasar Rakyat';

      return `<tr class="db-data-row ${row.marketId !== 'NON_MARKET' ? 'market-themed-row' : ''}" data-market-id="${esc(row.marketId)}" data-market-name="${esc(row.marketName)}" data-trader-id="${esc(row.traderId)}" data-claim-id="${esc(row.claimId)}" tabindex="0" title="Buka rincian ${esc(row.displayName)}" style="${row.marketId !== 'NON_MARKET' ? (window.EPASAR_MARKET_THEME?.style(row.marketId, row.marketName) || '') : ''}">
        <td data-label="Nomor" style="text-align:center;"><span class="db-cell-no">${no}</span></td>
        <td data-label="Identitas Pedagang">
          <div class="db-trader-cell">
            <div class="db-trader-avatar">${esc(initialChar)}</div>
            <div class="db-trader-info">
              <strong class="db-trader-name">${esc(row.displayName)}</strong>
              <div class="db-trader-chips">
                <span class="db-chip-code" title="ID Pedagang"><span class="chip-lbl">ID</span>${esc(row.traderId)}</span>
                <span class="db-chip-code" title="NIK Terdaftar"><span class="chip-lbl">NIK</span>${esc(row.nikMasked)}</span>
              </div>
            </div>
          </div>
        </td>
        <td data-label="Usaha & Komoditas">
          <div class="db-biz-cell">
            <strong class="db-biz-title">${esc(row.businessName)}</strong>
            <span class="db-biz-category">${esc(row.businessType)} · ${esc(row.businessCategory)}</span>
          </div>
        </td>
        <td data-label="Lokasi Pasar">
          <div class="db-market-cell" title="${esc(row.marketName)}">
            <span class="db-market-kind"><i aria-hidden="true"></i>${esc(marketKind)}</span>
            <strong class="db-market-name">${esc(marketDisplayName || row.marketName)}</strong>
            ${row.marketId && row.marketId !== 'NON_MARKET' ? `<span class="db-market-code">${esc(row.marketId)}</span>` : ''}
          </div>
        </td>
        <td data-label="Penempatan Unit">${unitInfo}</td>
        <td data-label="Status e-SKPT">
          <div class="db-skpt-cell">
            ${skptBadge}
            ${skptDetail}
          </div>
        </td>
        <td data-label="Jadwal Operasional">${scheduleInfo}</td>
        <td data-label="Verifikasi Fisik">${statusBadge}</td>
        <td data-label="Aksi" class="no-print" style="text-align:center;">
          <div class="db-icon-actions">
            <a href="trader-card.html?token=${encodeURIComponent(row.publicToken || row.verificationToken || row.traderId)}" target="_blank" class="db-action-icon-btn btn-trader-card" title="Lihat & Unduh Kartu Pedagang Digital" aria-label="Kartu Pedagang">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <circle cx="8" cy="10" r="2"></circle>
                <path d="M14 9h4m-4 4h4m-8 3h8"></path>
              </svg>
            </a>
            <button type="button" class="db-action-icon-btn btn-send-wa" data-trader-wa="${esc(row.traderId)}" data-claim-id="${esc(row.claimId)}" title="Kirim Kartu & Dokumen ke WhatsApp" aria-label="Kirim WhatsApp">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 18.07c-1.5 0-2.97-.4-4.25-1.17l-.3-.18-3.12.82.83-3.04-.2-.32a8.04 8.04 0 0 1-1.23-4.27c0-4.47 3.64-8.11 8.12-8.11 2.17 0 4.21.85 5.74 2.39a8.07 8.07 0 0 1 2.38 5.72c0 4.47-3.65 8.11-8.12 8.11zm4.45-6.08c-.24-.12-1.44-.71-1.66-.79-.23-.08-.39-.12-.56.12-.17.24-.65.79-.8 1-.15.2-.3.24-.54.12-.24-.12-1.03-.38-1.96-1.21-.72-.64-1.21-1.44-1.35-1.68-.15-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02s.87 2.34 1 2.51c.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28z"/>
              </svg>
            </button>
            <button class="db-action-icon-btn btn-view-detail" type="button" onclick="window.EPASAR_DB.viewDetail('${esc(row.traderId)}', '${esc(row.claimId)}')" title="Lihat Rincian Lengkap Pedagang" aria-label="Rincian">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.db-data-row').forEach(tableRow => {
      const open = () => window.EPASAR_DB.viewDetail(tableRow.dataset.traderId, tableRow.dataset.claimId);
      tableRow.addEventListener('click', event => { if (!event.target.closest('button,a,input,select,textarea')) open(); });
      tableRow.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    });

    // Pasang listener pengiriman WA dari tombol aksi tabel
    tbody.querySelectorAll('button[data-trader-wa]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tId = btn.dataset.traderWa;
        const cId = btn.dataset.claimId;
        const record = filteredRecords.find(r => r.traderId === tId && (!cId || r.claimId === cId)) || filteredRecords.find(r => r.traderId === tId);
        if (record) sendSkptToWa(record);
      });
    });

    // Buat baris tabel dapat diklik untuk membuka modal rincian pedagang
    tbody.querySelectorAll('tr').forEach(trRow => {
      trRow.style.cursor = 'pointer';
      trRow.addEventListener('click', (e) => {
        if (e.target.closest('button, a, input, select')) return;
        const btnDetail = trRow.querySelector('.btn-view-detail');
        if (btnDetail) btnDetail.click();
      });
    });

    const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
    document.getElementById('pageInfo').textContent = `Menampilkan ${start + 1}–${Math.min(start + pageSize, filteredRecords.length)} dari ${filteredRecords.length} data (Halaman ${currentPage}/${totalPages})`;
    document.getElementById('btnPrev').disabled = currentPage <= 1;
    document.getElementById('btnNext').disabled = currentPage >= totalPages;
  }

  function updateFilterMeta() {
    const metaContainer = document.getElementById('filterTags');
    const tags = [];
    const market = document.getElementById('filterMarket').value;
    const unitType = document.getElementById('filterUnitType').value;
    const skpt = document.getElementById('filterSkpt').value;

    if (market) tags.push(`Pasar: ${document.getElementById('filterMarket').selectedOptions[0].text}`);
    if (unitType) tags.push(`Jenis: ${unitType}`);
    if (skpt) tags.push(`SKPT: ${document.getElementById('filterSkpt').selectedOptions[0].text}`);

    if (currentReportScope?.scoped && !market) tags.unshift(`Cakupan: ${currentReportScope.label}`);
    metaContainer.innerHTML = tags.map(t => `<span class="db-filter-tag">${esc(t)}</span>`).join('') || '<span style="color:#8094aa">Menampilkan semua data tanpa filter khusus</span>';
  }

  // MENGHASILKAN RINGKASAN REKAPITULASI STATISTIK PASAR RAKYAT
  function generateMarketSummaries(recordsToSummarize) {
    const records = recordsToSummarize || filteredRecords;
    const selectedMarketId = document.getElementById('filterMarket')?.value || '';
    const markets = (window.EPASAR?.MARKETS || []).filter(market => {
      if (selectedMarketId) return market.id === selectedMarketId;
      return marketInScope(market.id);
    });

    // Mapping ringkasan per market
    const summaryMap = new Map();
    markets.forEach(m => {
      summaryMap.set(m.id, {
        id: m.id,
        name: m.name,
        district: m.district || 'Pinrang',
        operatingSchedule: getMarketSchedule(m.id, m.name),
        traderCount: 0,
        kioskCount: 0,
        losCount: 0,
        lapakCount: 0,
        pelataranCount: 0,
        otherUnitCount: 0,
        totalUnits: 0,
        skptIssuedCount: 0,
        verifiedCount: 0,
        totalOmzet: 0,
        _traderIds: new Set()
      });
    });

    let nonMarketSummary = {
      id: 'NON_MARKET',
      name: 'Pedagang Mandiri (Luar Pasar)',
      district: 'Kab. Pinrang',
      operatingSchedule: 'Setiap Hari',
      traderCount: 0,
      kioskCount: 0,
      losCount: 0,
      lapakCount: 0,
      pelataranCount: 0,
      otherUnitCount: 0,
      totalUnits: 0,
      skptIssuedCount: 0,
      verifiedCount: 0,
      totalOmzet: 0
    };

    records.forEach(r => {
      const canonicalId = window.EPASAR?.canonicalMarketId(r.marketId) || r.marketId;
      let target = summaryMap.get(canonicalId);
      if (!target) {
        if (r.marketId === 'NON_MARKET' || String(r.unitType).toUpperCase() === 'NON_PASAR') {
          target = nonMarketSummary;
        } else {
          target = {
            id: r.marketId || 'LAINNYA',
            name: r.marketName || 'Pasar Rakyat',
            district: 'Pinrang',
            operatingSchedule: r.operatingSchedule || 'Pasar Berkala',
            traderCount: 0,
            kioskCount: 0,
            losCount: 0,
            lapakCount: 0,
            pelataranCount: 0,
            otherUnitCount: 0,
            totalUnits: 0,
            skptIssuedCount: 0,
            verifiedCount: 0,
            totalOmzet: 0
          };
          summaryMap.set(r.marketId, target);
        }
      }

      target._traderIds = target._traderIds || new Set();
      target._traderIds.add(r.traderId || `${r.marketId}:${r.claimId}`);
      target.traderCount = target._traderIds.size;
      const uType = String(r.unitType || '').toUpperCase();
      if (uType === 'KIOS') target.kioskCount++;
      else if (uType === 'LOS') target.losCount++;
      else if (uType === 'LAPAK') target.lapakCount++;
      else if (uType === 'PELATARAN') target.pelataranCount++;
      else target.otherUnitCount++;

      if (uType !== 'NON_PASAR') target.totalUnits++;
      if (r.hasSkpt || r.skptStatus === 'ISSUED') target.skptIssuedCount++;
      if (r.verificationStatus === 'VERIFIED') target.verifiedCount++;
      target.totalOmzet += (Number(r.monthlyRevenue) || 0);
    });

    const list = Array.from(summaryMap.values());
    if (nonMarketSummary.traderCount > 0) {
      list.push(nonMarketSummary);
    }

    // Hitung Grand Total
    const grandTotal = {
      traderCount: 0,
      kioskCount: 0,
      losCount: 0,
      lapakCount: 0,
      pelataranCount: 0,
      totalUnits: 0,
      skptIssuedCount: 0,
      verifiedCount: 0,
      totalOmzet: 0
    };

    const uniqueRegionalTraders = new Set(records.map(record => record.traderId || `${record.marketId}:${record.claimId}`));
    list.forEach(item => {
      grandTotal.kioskCount += item.kioskCount;
      grandTotal.losCount += item.losCount;
      grandTotal.lapakCount += item.lapakCount;
      grandTotal.pelataranCount += item.pelataranCount;
      grandTotal.totalUnits += item.totalUnits;
      grandTotal.skptIssuedCount += item.skptIssuedCount;
      grandTotal.verifiedCount += item.verifiedCount;
      grandTotal.totalOmzet += item.totalOmzet;
    });
    grandTotal.traderCount = uniqueRegionalTraders.size;

    list.forEach(item => { delete item._traderIds; });

    return { list, grandTotal };
  }

  // Memformat jadwal operasional agar hanya menampilkan nama-nama hari atau "Setiap Hari" (Cukup 1 baris)
  function formatScheduleDisplay(scheduleText) {
    if (!scheduleText) return 'Setiap Hari';
    const s = String(scheduleText).trim();
    if (/harian|setiap hari/i.test(s)) return 'Setiap Hari';
    const match = s.match(/\(([^)]+)\)/);
    if (match && match[1]) return match[1].trim();
    const cleaned = s.replace(/pasar\s+(mingguan|harian|berkala)\s*/gi, '').trim();
    return cleaned || 'Setiap Hari';
  }

  // Format tanggal ringkas (contoh: 28 Sep 2028) agar tidak patah baris
  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const day = d.getDate();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch (_) {
      return String(dateStr);
    }
  }

  // MERENDER ELEMEN DOKUMEN CETAK RESMI SIAP CETAK (A4 LANDSCAPE)
  function renderPrintReport() {
    const isMarketHead = currentProfile?.role === 'MARKET_HEAD';
    const isRegionalAdmin = currentProfile?.role === 'MARKET_ADMIN';
    const filterMarketVal = document.getElementById('filterMarket')?.value;
    const filterMarketText = document.getElementById('filterMarket')?.selectedOptions[0]?.text || '';
    const filterUnitVal = document.getElementById('filterUnitType')?.value || '';
    const filterSkptVal = document.getElementById('filterSkpt')?.value || '';
    const filterVerifyVal = document.getElementById('filterVerify')?.value || '';

    const cleanMarketName = filterMarketVal
      ? filterMarketText.replace(/^[●\s]*[A-Z0-9-]+\s*·\s*/i, '').replace(/\s*\([^)]*\)$/, '').trim()
      : 'Seluruh Pasar Rakyat Kabupaten Pinrang';
    const reportScopeName = selectedReportLabel();

    // 1. Metadata Dokumen Laporan Resmi
    const titleEl = document.getElementById('printMarketTitle');
    if (titleEl) {
      titleEl.textContent = filterMarketVal || currentReportScope?.scoped
        ? `BUKU INDUK DAN REKAPITULASI PENATAAN PEDAGANG ${reportScopeName.toUpperCase()}`
        : 'BUKU INDUK DAN REKAPITULASI PENATAAN PASAR RAKYAT KABUPATEN PINRANG';
    }

    const scopeParts = [`Cakupan: ${reportScopeName}`];
    if (filterUnitVal) scopeParts.push(`Jenis: ${filterUnitVal}`);
    if (filterSkptVal) scopeParts.push(`SKPT: ${filterSkptVal}`);
    if (filterVerifyVal) scopeParts.push(`Verifikasi: ${filterVerifyVal}`);

    const filterScopeEl = document.getElementById('printFilterScope');
    if (filterScopeEl) filterScopeEl.textContent = scopeParts.join(' · ');

    const now = new Date();
    const formattedDate = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const genDateEl = document.getElementById('printGeneratedDate');
    if (genDateEl) genDateEl.textContent = `Tanggal Pengesahan Cetak: ${formattedDate} Pukul ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WITA`;

    const totalCountEl = document.getElementById('printTotalRecordsCount');
    if (totalCountEl) totalCountEl.textContent = `Total Data Terdata: ${filteredRecords.length} Pedagang Aktif`;

    // 2. Render Bagian I: Tabel Rekapitulasi Statistik per Pasar
    const { list: summaries, grandTotal } = generateMarketSummaries(filteredRecords);
    const summaryBody = document.getElementById('printSummaryTableBody');
    const summaryFoot = document.getElementById('printSummaryTableFoot');

    if (summaryBody) {
      summaryBody.innerHTML = summaries.map((m, idx) => `
        <tr>
          <td style="text-align: center; font-weight: 600;">${idx + 1}</td>
          <td class="print-nowrap" style="font-weight: 700;">${esc(m.name)}</td>
          <td class="print-nowrap">${esc(m.district)}</td>
          <td class="print-nowrap" style="text-align: center; font-weight: 600;">${esc(formatScheduleDisplay(m.operatingSchedule))}</td>
          <td style="text-align: center; font-weight: 750;">${m.traderCount}</td>
          <td style="text-align: center;">${m.kioskCount || 0}</td>
          <td style="text-align: center;">${m.losCount || 0}</td>
          <td style="text-align: center;">${m.lapakCount || 0}</td>
          <td style="text-align: center;">${m.pelataranCount || 0}</td>
          <td style="text-align: center; font-weight: 750;">${m.totalUnits}</td>
          <td style="text-align: center; font-weight: 750;" class="print-status-success">${m.skptIssuedCount}</td>
          <td style="text-align: center; font-weight: 750;" class="print-status-success">${m.verifiedCount}</td>
          <td class="print-nowrap" style="text-align: right; font-weight: 750;">${formatRupiah(m.totalOmzet)}</td>
        </tr>
      `).join('') || `<tr><td colspan="13" style="text-align:center; padding:12px;">Tidak ada data pasar untuk ditampilkan.</td></tr>`;
    }

    if (summaryFoot) {
      summaryFoot.innerHTML = `
        <tr>
          <th colspan="4" style="text-align: right; text-transform: uppercase; letter-spacing: 0.04em;">${currentReportScope?.scoped ? `TOTAL ${esc(currentReportScope.label)}` : 'TOTAL KESELURUHAN (GRAND TOTAL)'}</th>
          <th style="text-align: center; font-size: 7.5pt;">${grandTotal.traderCount}</th>
          <th style="text-align: center;">${grandTotal.kioskCount}</th>
          <th style="text-align: center;">${grandTotal.losCount}</th>
          <th style="text-align: center;">${grandTotal.lapakCount}</th>
          <th style="text-align: center;">${grandTotal.pelataranCount}</th>
          <th style="text-align: center; font-size: 7.5pt;">${grandTotal.totalUnits}</th>
          <th style="text-align: center; font-size: 7.5pt;" class="print-status-success">${grandTotal.skptIssuedCount}</th>
          <th style="text-align: center; font-size: 7.5pt;" class="print-status-success">${grandTotal.verifiedCount}</th>
          <th style="text-align: right; font-size: 7.5pt;" class="print-nowrap">${formatRupiah(grandTotal.totalOmzet)}</th>
        </tr>
      `;
    }

    // 3. Render Bagian II: Buku Induk Rincian Pedagang Resmi (Format Super Kompak & Presisi)
    const tradersSubtitle = document.getElementById('printTradersSubtitle');
    if (tradersSubtitle) {
      tradersSubtitle.textContent = `Menampilkan seluruh ${filteredRecords.length} data pedagang aktif tanpa pemotongan halaman pagination`;
    }

    const tradersBody = document.getElementById('printTradersTableBody');
    if (tradersBody) {
      tradersBody.innerHTML = filteredRecords.map((r, i) => {
        const skptStatusClass = r.hasSkpt ? 'print-status-success' : (r.skptStatus === 'TIDAK_MEMERLUKAN' ? 'print-status-neutral' : 'print-status-warning');
        const skptText = r.hasSkpt
          ? `✓ ${esc(r.skptNumber)}`
          : (r.skptStatus === 'TIDAK_MEMERLUKAN' ? 'Bebas SKPT' : (r.skptStatus === 'KADIS_REVIEW' ? 'Telaah Kadis' : 'Dalam Proses'));

        const verifyClass = r.verificationStatus === 'VERIFIED' ? 'print-status-success' : (r.verificationStatus === 'CONFLICT' ? 'print-status-danger' : 'print-status-warning');
        const verifyText = r.verificationStatus === 'VERIFIED' ? '✓ VALID' : (r.verificationStatus === 'CONFLICT' ? '⚠ KONFLIK' : 'PENDING');

        const unitPlaceText = r.unitType === 'NON_PASAR'
          ? 'Mandiri (Luar Pasar)'
          : `<b>${esc(r.unitType)} ${esc(r.unitNumber)}</b> <span style="color:#475569; font-size:6.8pt;">(${r.areaM2} m²)</span><br><span style="color:#64748b; font-size:6.8pt;">Blok ${esc(r.block)} · Lt. ${esc(r.floor)}</span>`;

        return `
          <tr>
            <td style="text-align: center; font-weight: 600;">${i + 1}</td>
            <td>
              <b style="font-size: 7.2pt;">${esc(r.traderId)}</b>
              <br><span style="color: #475569; font-size: 6.8pt;">NIK: ${esc(r.nikMasked)}</span>
            </td>
            <td>
              <b style="font-size: 7.3pt;">${esc(r.displayName)}</b>
            </td>
            <td>
              <b>${esc(r.businessName)}</b> <span style="color: #64748b; font-size: 6.8pt;">(${esc(r.businessCategory)})</span>
              <br><span style="color: #1e3a8a; font-weight: 600; font-size: 6.8pt;">Omzet: ${formatRupiah(r.monthlyRevenue)}/bln</span>
            </td>
            <td class="print-nowrap" title="${esc(r.marketName)}">
              <b>${esc(r.marketName)}</b>
            </td>
            <td>
              ${unitPlaceText}
            </td>
            <td class="print-nowrap" style="text-align: center;">
              <small style="font-weight: 600;">${esc(formatScheduleDisplay(r.operatingSchedule))}</small>
            </td>
            <td>
              <span class="print-status-tag ${skptStatusClass}">${skptText}</span>
              ${r.validUntil ? `<br><span style="color: #64748b; font-size: 6.6pt;">s.d ${formatDateShort(r.validUntil)}</span>` : ''}
            </td>
            <td style="text-align: center;">
              <span class="print-status-tag ${verifyClass}">${verifyText}</span>
            </td>
          </tr>
        `;
      }).join('') || `<tr><td colspan="9" style="text-align:center; padding: 18px;">Tidak ada data pedagang yang memenuhi filter.</td></tr>`;
    }

    // 4. Update Lembar Pengesahan Tanda Tangan
    const signDateEl = document.getElementById('printCurrentDate');
    if (signDateEl) {
      signDateEl.textContent = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    const signRoleEl = document.getElementById('printSignRole');
    const signNameEl = document.getElementById('printSignName');
    const signNipEl = document.getElementById('printSignNip');

    if (isMarketHead) {
      if (signRoleEl) signRoleEl.innerHTML = `Kepala Pasar ${cleanMarketName.replace(/^MKT-\d+\s*·\s*/, '')}<br>Dinas Perindag-ESDM Pinrang`;
      if (signNameEl) signNameEl.textContent = currentProfile?.displayName || 'Kepala Pasar';
      if (signNipEl) signNipEl.textContent = 'NIP. ' + (currentProfile?.nip || '19820514 200801 1 012');
    } else if (isRegionalAdmin) {
      if (signRoleEl) signRoleEl.innerHTML = `Penanggung Jawab ${esc(currentReportScope?.label || 'Wilayah Pasar')}<br>Dinas Perindag-ESDM Pinrang`;
      if (signNameEl) signNameEl.textContent = currentProfile?.displayName || currentProfile?.position || 'Admin Wilayah Pasar';
      if (signNipEl) signNipEl.textContent = currentProfile?.nip ? 'NIP. ' + currentProfile.nip : 'Petugas sesuai akun terautentikasi';
    } else {
      if (signRoleEl) signRoleEl.innerHTML = 'Kepala Dinas Perindustrian, Perdagangan, ESDM<br>Kabupaten Pinrang';
      const kadisName = (currentProfile?.role === 'KADIS' && currentProfile?.displayName && currentProfile.displayName !== 'Kepala Dinas')
        ? currentProfile.displayName
        : 'MUHAMMAD YUSUF NUR, S.STP';
      const kadisNip = (currentProfile?.role === 'KADIS' && currentProfile?.nip)
        ? currentProfile.nip
        : '19800326 200003 1 001';
      if (signNameEl) signNameEl.textContent = kadisName;
      if (signNipEl) signNipEl.textContent = 'NIP. ' + kadisNip;
    }

    const opNameEl = document.getElementById('printOperatorName');
    if (opNameEl) {
      opNameEl.textContent = currentProfile?.displayName || 'Administrator e-PASAR';
    }
  }

  // CETAK LAPORAN RESMI
  function printReport() {
    renderPrintReport();
    setTimeout(() => {
      window.print();
    }, 150);
  }

  // EKSPOR KE EXCEL (.XLSX) MULTI-SHEET & LAYOUT PROFESIONAL SIAP CETAK
  function exportXlsx() {
    if (!filteredRecords.length) {
      alert('Tidak ada data pedagang yang dapat diekspor.');
      return;
    }

    if (typeof XLSX === 'undefined') {
      alert('Modul SheetJS Excel belum siap dimuat di peramban Anda. Silakan muat ulang halaman.');
      return;
    }

    const wb = XLSX.utils.book_new();
    const timeStamp = new Date().toISOString().slice(0, 10);
    const printDate = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const scopeLabel = selectedReportLabel();

    // -------------------------------------------------------------
    // SHEET 1: REKAPITULASI STATISTIK PASAR RAKYAT
    // -------------------------------------------------------------
    const { list: summaries, grandTotal } = generateMarketSummaries(filteredRecords);

    const sheet1Data = [
      ['PEMERINTAH KABUPATEN PINRANG'],
      ['DINAS PERINDUSTRIAN, PERDAGANGAN, ENERGI DAN SUMBER DAYA MINERAL'],
      ['LAPORAN REKAPITULASI EKSEKUTIF PENATAAN PASAR RAKYAT'],
      [`Cakupan Data: ${scopeLabel} | Pasar: ${currentReportScope?.scoped ? currentReportScope.marketIds.join(', ') : 'Seluruh Kabupaten Pinrang'}`],
      [`Waktu Penarikan Data: ${printDate} | Dasar Hukum: Perda Kab. Pinrang No. 6 Tahun 2024`],
      [],
      [
        'No',
        'Kode Pasar',
        'Nama Pasar Rakyat',
        'Kecamatan',
        'Hari Operasional Pasar',
        'Jumlah Pedagang',
        'Kios',
        'Los',
        'Lapak',
        'Pelataran',
        'Total Unit Usaha',
        'SKPT Terbit (Legal)',
        'Fisik Terverifikasi',
        'Estimasi Perputaran Omzet Bulanan (Rp)'
      ]
    ];

    summaries.forEach((m, idx) => {
      sheet1Data.push([
        idx + 1,
        m.id,
        m.name,
        m.district,
        formatScheduleDisplay(m.operatingSchedule),
        m.traderCount,
        m.kioskCount,
        m.losCount,
        m.lapakCount,
        m.pelataranCount,
        m.totalUnits,
        m.skptIssuedCount,
        m.verifiedCount,
        m.totalOmzet
      ]);
    });

    // Baris Grand Total
    sheet1Data.push([
      '',
      '',
      currentReportScope?.scoped ? `TOTAL ${currentReportScope.label.toUpperCase()}` : 'TOTAL KESELURUHAN (GRAND TOTAL)',
      '',
      '',
      grandTotal.traderCount,
      grandTotal.kioskCount,
      grandTotal.losCount,
      grandTotal.lapakCount,
      grandTotal.pelataranCount,
      grandTotal.totalUnits,
      grandTotal.skptIssuedCount,
      grandTotal.verifiedCount,
      grandTotal.totalOmzet
    ]);

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);

    // Atur Lebar Kolom Sheet 1
    ws1['!cols'] = [
      { wch: 5 },  // No
      { wch: 12 }, // Kode Pasar
      { wch: 32 }, // Nama Pasar
      { wch: 18 }, // Kecamatan
      { wch: 30 }, // Hari Operasional
      { wch: 16 }, // Jumlah Pedagang
      { wch: 10 }, // Kios
      { wch: 10 }, // Los
      { wch: 10 }, // Lapak
      { wch: 12 }, // Pelataran
      { wch: 16 }, // Total Unit
      { wch: 18 }, // SKPT Terbit
      { wch: 18 }, // Fisik Terverifikasi
      { wch: 32 }  // Omzet Bulanan
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'Rekapitulasi Pasar');

    // -------------------------------------------------------------
    // SHEET 2: BUKU INDUK DAFTAR RINCIAN PEDAGANG RESMI
    // -------------------------------------------------------------
    const filterMarketVal = document.getElementById('filterMarket')?.value;
    const filterMarketText = document.getElementById('filterMarket')?.selectedOptions[0]?.text || '';
    const cleanMarketName = filterMarketVal
      ? filterMarketText.replace(/^[●\s]*[A-Z0-9-]+\s*·\s*/i, '').replace(/\s*\([^)]*\)$/, '').trim()
      : 'Seluruh Pasar Rakyat Kab. Pinrang';
    const reportScopeName = scopeLabel;

    const sheet2Data = [
      ['PEMERINTAH KABUPATEN PINRANG - DINAS PERINDAG ESDM'],
      ['BUKU INDUK DAN MASTER BASIS DATA PEDAGANG PASAR RAKYAT'],
      [`Cakupan: ${reportScopeName} | Total Data: ${filteredRecords.length} Pedagang | Tanggal: ${printDate}`],
      [],
      [
        'No',
        'ID Pedagang',
        'Nomor Registrasi',
        'Nama Lengkap Pedagang',
        'Nomor Induk Kependudukan (NIK)',
        'Nomor Telepon / WhatsApp',
        'Nama Usaha Dagang',
        'Jenis Tempat Usaha',
        'Kategori Komoditas Dagangan',
        'Kode Pasar',
        'Nama Pasar Rakyat',
        'Jenis Tempat',
        'Nomor Unit',
        'Blok',
        'Lantai',
        'Luas Tempat (m2)',
        'Hari Pasar / Jadwal Operasional',
        'Status Legalitas e-SKPT',
        'Nomor Dokumen SKPT Resmi',
        'Masa Berlaku Izin',
        'Status Verifikasi Fisik Lapangan',
        'Omzet Bulanan (Rp)',
        'Jumlah Tenaga Kerja',
        'Waktu Registrasi'
      ]
    ];

    filteredRecords.forEach((r, idx) => {
      sheet2Data.push([
        idx + 1,
        String(r.traderId || ''),
        String(r.registrationCode || ''),
        String(r.displayName || ''),
        String(r.nikMasked || ''),
        String(r.phone || ''),
        String(r.businessName || ''),
        String(r.businessType || ''),
        String(r.businessCategory || ''),
        String(r.marketId || ''),
        String(r.marketName || ''),
        String(r.unitType || ''),
        String(r.unitNumber || ''),
        String(r.block || ''),
        String(r.floor || ''),
        r.areaM2 === null || r.areaM2 === undefined || r.areaM2 === '' ? '' : Number(r.areaM2),
        String(formatScheduleDisplay(r.operatingSchedule)),
        String(r.skptStatus || ''),
        String(r.skptNumber || ''),
        String(r.validUntil || ''),
        String(r.verificationStatus || ''),
        r.monthlyRevenue === null || r.monthlyRevenue === undefined || r.monthlyRevenue === '' ? '' : Number(r.monthlyRevenue),
        r.workerCount === null || r.workerCount === undefined || r.workerCount === '' ? '' : Number(r.workerCount),
        String(r.registeredAt || '')
      ]);
    });

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);

    // Format Kolom NIK dan Nomor Telepon secara eksplisit sebagai Teks (String) agar tidak ilmiah/terpotong
    const range = XLSX.utils.decode_range(ws2['!ref']);
    for (let R = 5; R <= range.e.r; ++R) {
      // Kolom E (index 4) adalah NIK
      const cellNik = ws2[XLSX.utils.encode_cell({ r: R, c: 4 })];
      if (cellNik) {
        cellNik.t = 's';
      }
      // Kolom F (index 5) adalah Phone
      const cellPhone = ws2[XLSX.utils.encode_cell({ r: R, c: 5 })];
      if (cellPhone) {
        cellPhone.t = 's';
      }
    }

    // Atur Lebar Kolom Sheet 2
    ws2['!cols'] = [
      { wch: 5 },  // No
      { wch: 14 }, // ID Pedagang
      { wch: 22 }, // No Registrasi
      { wch: 28 }, // Nama Lengkap
      { wch: 20 }, // NIK
      { wch: 18 }, // No HP/WA
      { wch: 28 }, // Nama Usaha
      { wch: 16 }, // Jenis Usaha
      { wch: 24 }, // Kategori
      { wch: 12 }, // Kode Pasar
      { wch: 30 }, // Nama Pasar
      { wch: 14 }, // Jenis Tempat
      { wch: 12 }, // Nomor Unit
      { wch: 8 },  // Blok
      { wch: 8 },  // Lantai
      { wch: 14 }, // Luas
      { wch: 26 }, // Hari Pasar
      { wch: 18 }, // Status SKPT
      { wch: 24 }, // No SKPT
      { wch: 16 }, // Masa Berlaku
      { wch: 22 }, // Status Verifikasi
      { wch: 20 }, // Omzet
      { wch: 14 }, // Tenaga Kerja
      { wch: 22 }  // Waktu Registrasi
    ];

    XLSX.utils.book_append_sheet(wb, ws2, 'Buku Induk Pedagang');

    // Memicu unduhan file .xlsx
    XLSX.writeFile(wb, `BUKU_INDUK_DAN_REKAPITULASI_${reportFileScope()}_${timeStamp}.xlsx`);
  }

  // EKSPOR KE JSON (UNTUK PEMETAAN SPASIAL / GIS)
  function exportJson() {
    if (!filteredRecords.length) {
      alert('Tidak ada data pedagang yang dapat diekspor.');
      return;
    }

    const payload = {
      sumber: 'e-PASAR Dinas Perindag-ESDM Kabupaten Pinrang',
      dasarHukum: 'Peraturan Daerah Kabupaten Pinrang Nomor 6 Tahun 2024',
      waktuEkspor: new Date().toISOString(),
      cakupan: {
        tipe: currentReportScope?.type || 'CENTRAL',
        id: currentReportScope?.id || 'KABUPATEN_PINRANG',
        label: selectedReportLabel(),
        marketIds: currentReportScope?.scoped ? [...currentReportScope.marketIds] : [],
        pasarTerpilih: document.getElementById('filterMarket')?.value || null
      },
      dibuatOleh: {
        uid: currentProfile?.uid || null,
        role: currentProfile?.role || null,
        nama: currentProfile?.displayName || currentProfile?.position || null
      },
      totalData: filteredRecords.length,
      data: filteredRecords.map(r => ({
        identitas: {
          id: r.traderId,
          nama: r.displayName,
          nikMasked: r.nikMasked
        },
        usaha: {
          nama: r.businessName,
          jenis: r.businessType,
          komoditas: r.businessCategory,
          omzetBulanan: r.monthlyRevenue,
          tenagaKerja: r.workerCount
        },
        spasialUnit: {
          kodePasar: r.marketId,
          namaPasar: r.marketName,
          warnaIdentitasHex: window.EPASAR_MARKET_THEME?.palette(r.marketId, r.marketName).primary || null,
          jenisTempat: r.unitType,
          nomorUnit: r.unitNumber,
          blok: r.block,
          lantai: r.floor,
          luasM2: r.areaM2,
          jadwalOperasional: r.operatingSchedule,
          ketentuanRetribusi: 'Mengikuti intensitas hari pasar aktif sesuai Perda Pajak & Retribusi Daerah'
        },
        legalitasSkpt: {
          status: r.skptStatus,
          nomorSkpt: r.skptNumber,
          terbit: r.hasSkpt,
          verifikasiFaktual: r.verificationStatus
        }
      }))
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timeStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `SPASIAL_PEDAGANG_${reportFileScope()}_${timeStamp}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  let activeWaRecord = null;
  let activeKpiType = 'traders';

  async function resolveRecordLegalData(record) {
    if (!record) return record;
    const db = getDb();
    if (!record.verificationToken || !record.documentHash || String(record.skptNumber || '').startsWith('SKPT-PIN-')) {
      try {
        if (record.skptDocumentId) {
          const docSnap = await db.collection('skpt_documents').doc(record.skptDocumentId).get();
          if (docSnap.exists) {
            const sd = docSnap.data();
            record.verificationToken = sd.verificationToken || record.verificationToken;
            record.documentHash = sd.documentHash || record.documentHash;
            record.skptNumber = sd.number || record.skptNumber;
            record.validUntil = sd.validUntil || record.validUntil;
          }
        }
        if (!record.verificationToken && record.traderId) {
          const qTrd = await db.collection('skpt_documents').where('traderId', '==', record.traderId).limit(1).get();
          if (!qTrd.empty) {
            const sd = qTrd.docs[0].data();
            record.verificationToken = sd.verificationToken || record.verificationToken;
            record.documentHash = sd.documentHash || record.documentHash;
            record.skptNumber = sd.number || record.skptNumber;
            record.validUntil = sd.validUntil || record.validUntil;
            record.skptDocumentId = qTrd.docs[0].id;
          }
        }
      } catch (e) {
        console.warn('Gagal resolve legal skpt_documents:', e);
      }
    }

    if (!record.registrationCode && record.publicToken) {
      try {
        const psSnap = await db.collection('public_status').doc(record.publicToken).get();
        if (psSnap.exists) {
          const ps = psSnap.data();
          record.registrationCode = ps.registrationCode || record.registrationCode;
        }
      } catch (e) {
        console.warn('Gagal resolve public_status:', e);
      }
    }

    // Resolve catatan alasan konflik fisik lapangan dari verification_records
    if (record.verificationStatus === 'CONFLICT') {
      try {
        let vrData = null;
        if (record.verificationRecordId) {
          const vrSnap = await db.collection('verification_records').doc(record.verificationRecordId).get();
          if (vrSnap.exists) vrData = vrSnap.data();
        }
        if (!vrData && record.claimId) {
          const qVr = await db.collection('verification_records').where('claimId', '==', record.claimId).limit(1).get();
          if (!qVr.empty) vrData = qVr.docs[0].data();
        }
        if (vrData) {
          record.conflictData = {
            isConflict: true,
            reason: vrData.reason || record.conflictData?.reason || 'Unit fisik terindikasi sengketa penggunaan.',
            actualUser: vrData.actualUser || record.conflictData?.actualUser || 'Pengguna aktual lain di lapangan',
            unitClaimed: `${record.unitType} ${record.unitNumber} (${record.marketName})`,
            verifiedAt: vrData.verifiedAt || record.conflictData?.verifiedAt || '',
            actorRole: vrData.actorRole || 'Kepala Pasar'
          };
        }
      } catch (errVr) {
        console.warn('Gagal resolve verification_records untuk konflik:', errVr);
      }
    }

    return record;
  }

  function formatWaMessage(record) {
    const origin = window.location.origin;
    const name = record.displayName || 'Pelaku Usaha';
    const isNonMarket = record.marketId === 'NON_MARKET' || record.unitType === 'NON_PASAR';

    if (isNonMarket) {
      const biz = record.businessName || 'Usaha Perdagangan Mandiri';
      const token = record.publicToken || record.verificationToken || record.traderId;
      const cardUrl = `${origin}/trader-card.html?token=${encodeURIComponent(token)}`;
      const statusUrl = `${origin}/epasar-status.html?code=${encodeURIComponent(record.registrationCode || '')}&token=${encodeURIComponent(token)}`;
      const regCodeText = record.registrationCode ? `🔢 *Nomor Registrasi:*\n${record.registrationCode}\n\n` : '';

      return `*PEMERINTAH KABUPATEN PINRANG*\n*Dinas Perindustrian, Perdagangan, ESDM*\n-------------------------------------------\nYth. Bapak/Ibu *${name}*,\nBerikut identitas resmi *Pelaku Usaha Mandiri (Non-Pasar Rakyat)* Anda yang terdaftar pada sistem satu data e-PASAR Pinrang:\n\n💼 *Nama Usaha:* ${biz}\n🪪 *ID Pedagang:* ${record.traderId}\n${regCodeText}Silakan akses & simpan Kartu Pedagang Digital resmi Anda:\n🪪 *Unduh Kartu Pedagang Digital:*\n${cardUrl}\n\n🔍 *Cek Status & Profil Digital:*\n${statusUrl}\n\n_Catatan: Kartu ini merupakan bukti kepesertaan pembinaan dan fasilitasi Satu Data Perdagangan Dinas Perindag-ESDM Kabupaten Pinrang._`;
    }

    const actualSkptToken = record.verificationToken || record.publicToken;
    const skptUrl = actualSkptToken ? `${origin}/skpt-pdf.html?token=${encodeURIComponent(actualSkptToken)}` : `${origin}/verifikasi-skpt.html`;
    const cardUrl = `${origin}/trader-card.html?token=${encodeURIComponent(record.publicToken || record.verificationToken || record.traderId)}`;
    const statusUrl = `${origin}/epasar-status.html?code=${encodeURIComponent(record.registrationCode || '')}&token=${encodeURIComponent(record.publicToken || record.verificationToken || record.traderId)}`;

    const regCodeText = record.registrationCode ? `🔢 *Nomor Registrasi Pendaftaran:*\n${record.registrationCode}\n\n` : '';
    const tokenText = record.publicToken ? `🔑 *Token Akses Pribadi:*\n${record.publicToken}\n\n` : '';
    const hashText = record.documentHash ? `🛡️ *Kode Hash Dokumen SKPT (SHA-256):*\n${record.documentHash}\n\n` : '';

    return `*PEMERINTAH KABUPATEN PINRANG*\n*Dinas Perindustrian, Perdagangan, ESDM*\n-------------------------------------------\nYth. Bapak/Ibu *${record.displayName}*,\nBerikut rincian legalitas resmi izin pemakaian tempat usaha pasar Anda yang telah disahkan:\n\n📋 *Nomor SKPT:* ${record.skptNumber}\n${regCodeText}${tokenText}${hashText}🏪 *Unit Pasar:* ${record.marketName} (${record.unitType} ${record.unitNumber})\n💼 *Usaha:* ${record.businessName} (${record.businessType})\n\nSilakan unduh & simpan dokumen digital resmi Anda:\n1. 📄 *Unduh Dokumen SKPT Resmi (PDF):*\n${skptUrl}\n\n2. 🪪 *Unduh Kartu Pedagang Digital:*\n${cardUrl}\n\n3. 🔍 *Cek Status & Verifikasi Digital:*\n${statusUrl}\n\n_Catatan Penting: Harap simpan Nomor Registrasi Pendaftaran dan Token Akses Pribadi ini dengan baik untuk keperluan pembukaan berkas, cetak ulang dokumen, verifikasi lapangan, maupun pengesahan tahunan / perpanjangan SKPT di portal resmi e-PASAR Kabupaten Pinrang._`;
  }

  async function sendSkptToWa(record) {
    activeWaRecord = record;
    await resolveRecordLegalData(record);
    let phone = String(record.phone || '').trim().replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);

    if (phone && phone.length >= 10) {
      const text = encodeURIComponent(formatWaMessage(record));
      window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${text}`, '_blank');
    } else {
      const waModal = document.getElementById('waPromptModal');
      const waInput = document.getElementById('waPhoneNumberInput');
      if (waInput) waInput.value = phone || '';
      if (waModal) waModal.hidden = false;
      if (waInput) setTimeout(() => waInput.focus(), 100);
    }
  }

  async function viewDetail(traderId, claimId) {
    const record = filteredRecords.find(r => r.traderId === traderId && (!claimId || r.claimId === claimId)) || filteredRecords.find(r => r.traderId === traderId);
    if (!record) return;

    await resolveRecordLegalData(record);

    const modal = document.getElementById('detailModal');
    if (record.marketId !== 'NON_MARKET') window.EPASAR_MARKET_THEME?.apply(modal, record.marketId, record.marketName);
    document.getElementById('modalTraderName').textContent = record.displayName;
    document.getElementById('modalTraderId').textContent = record.traderId;
    document.getElementById('modalNik').textContent = record.nikMasked;
    document.getElementById('modalBusiness').textContent = `${record.businessName} (${record.businessType})`;
    document.getElementById('modalCommodity').textContent = record.businessCategory;
    const modalMarket = document.getElementById('modalMarket');
    modalMarket.textContent = record.marketName;
    modalMarket.classList.toggle('market-identity', record.marketId !== 'NON_MARKET');
    modalMarket.dataset.marketId = record.marketId;
    document.getElementById('modalUnit').textContent = `${record.unitType} ${record.unitNumber} (Blok ${record.block}, Lt. ${record.floor})`;
    document.getElementById('modalArea').textContent = `${record.areaM2} m²`;
    document.getElementById('modalRevenue').textContent = formatRupiah(record.monthlyRevenue);
    const modalDaysEl = document.getElementById('modalMarketDays');
    if (modalDaysEl) modalDaysEl.textContent = record.operatingSchedule || 'Jadwal Reguler';
    const modalRetEl = document.getElementById('modalRetribution');
    if (modalRetEl) modalRetEl.textContent = 'Mengikuti intensitas hari pasar aktif sesuai Perda Pajak & Retribusi Daerah';
    document.getElementById('modalSkpt').textContent = record.hasSkpt ? record.skptNumber : (record.skptStatus === 'KADIS_REVIEW' ? 'Menunggu Telaah Kadis' : (record.skptStatus === 'CONFLICT' ? 'Ditangguhkan (Konflik Lapangan)' : record.skptStatus));

    // Status Verifikasi Fisik
    const verifyEl = document.getElementById('modalVerification');
    if (verifyEl) {
      if (record.verificationStatus === 'CONFLICT') {
        verifyEl.innerHTML = '<span style="color:#dc2626; font-weight:800;">⚠ Terjadi Konflik Fisik Lapangan</span>';
      } else if (record.verificationStatus === 'VERIFIED') {
        verifyEl.innerHTML = '<span style="color:#16a34a; font-weight:800;">✓ Terverifikasi Sesuai Fisik Pasar</span>';
      } else {
        verifyEl.textContent = record.verificationStatus;
      }
    }

    // Blok Peringatan Khusus Jika Unit Berstatus Konflik Lapangan
    const conflictContainer = document.getElementById('modalConflictContainer');
    if (conflictContainer) {
      if (record.verificationStatus === 'CONFLICT' || record.conflictData?.isConflict) {
        conflictContainer.hidden = false;
        const cd = record.conflictData || {};
        document.getElementById('modalConflictReason').textContent = cd.reason || 'Pengguna aktual di lokasi berbeda dengan identitas pemohon; nomor unit memerlukan mediasi atau penataan ulang.';
        document.getElementById('modalConflictActualUser').textContent = cd.actualUser || 'Pengguna aktual lain di lokasi';
        document.getElementById('modalConflictUnit').textContent = `${record.unitType} ${record.unitNumber} (${record.marketName} · Blok ${record.block}, Lt. ${record.floor})`;

        const dateEl = document.getElementById('modalConflictDate');
        if (dateEl) {
          if (cd.verifiedAt) {
            const rawDate = typeof cd.verifiedAt === 'string' ? cd.verifiedAt : (cd.verifiedAt?.toDate ? cd.verifiedAt.toDate().toISOString() : '');
            dateEl.textContent = 'Pemeriksaan: ' + (rawDate ? formatDateId(rawDate) : 'Verifikasi Kepala Pasar');
          } else {
            dateEl.textContent = 'Hasil Pemeriksaan Lapangan Kepala Pasar';
          }
        }
      } else {
        conflictContainer.hidden = true;
      }
    }

    // Aksi Dokumen Legalitas (Cetak SKPT, Kartu Pedagang, WhatsApp)
    const skptContainer = document.getElementById('modalSkptActionContainer');
    if (skptContainer) {
      skptContainer.hidden = false;
      const btnSkpt = document.getElementById('modalBtnPrintSkpt');
      const btnCard = document.getElementById('modalBtnPrintCard');
      const btnWa = document.getElementById('modalBtnSendWa');
      const badgeEl = document.getElementById('modalSkptActionBadge');
      const descEl = document.getElementById('modalSkptDesc');
      const dateEl = document.getElementById('modalSkptDate');

      const isNonMarket = record.marketId === 'NON_MARKET' || record.unitType === 'NON_PASAR';
      const cardTok = record.publicToken || record.verificationToken || record.traderId;

      if (isNonMarket) {
        if (badgeEl) {
          badgeEl.textContent = '✓ Pelaku Usaha Mandiri Terdaftar';
          badgeEl.style.background = 'linear-gradient(135deg, #0284c7 0%, #16a34a 100%)';
          badgeEl.style.color = '#ffffff';
        }
        if (dateEl) dateEl.textContent = 'Tipe Non-Pasar Rakyat';
        if (descEl) descEl.textContent = 'Pelaku usaha terdaftar secara resmi pada basis data terpadu e-PASAR. Kartu identitas pelaku usaha mandiri dapat dicetak dan dikirim langsung ke WhatsApp.';
        if (btnSkpt) btnSkpt.style.display = 'none';
      } else if (record.hasSkpt || record.verificationToken) {
        if (badgeEl) {
          badgeEl.textContent = '✓ SKPT Resmi Terbit';
          badgeEl.style.background = '#e9f7dc';
          badgeEl.style.color = '#2e6d0a';
        }
        if (dateEl) dateEl.textContent = 'Masa berlaku 2 tahun';
        if (descEl) descEl.textContent = 'Dokumen legalitas pemakaian unit pasar telah disahkan oleh Kepala Dinas dan terdaftar pada sistem satu data e-PASAR Pinrang.';
        if (btnSkpt) {
          btnSkpt.style.display = 'inline-flex';
          const skptTok = record.verificationToken || record.publicToken;
          btnSkpt.href = `skpt-pdf.html?token=${encodeURIComponent(skptTok)}`;
          btnSkpt.onclick = async (e) => {
            if (!record.verificationToken) {
              e.preventDefault();
              await resolveRecordLegalData(record);
              window.open(`skpt-pdf.html?token=${encodeURIComponent(record.verificationToken || record.publicToken)}`, '_blank');
            }
          };
        }
      } else {
        if (badgeEl) {
          badgeEl.textContent = '✓ Identitas Pedagang Terdata';
          badgeEl.style.background = '#e0f2fe';
          badgeEl.style.color = '#0369a1';
        }
        if (dateEl) dateEl.textContent = 'Satu Data e-PASAR';
        if (descEl) descEl.textContent = 'Identitas pedagang telah tersimpan dalam buku induk. Kartu pedagang digital dapat diakses dan dibagikan.';
        if (btnSkpt) btnSkpt.style.display = 'none';
      }

      if (btnCard) {
        btnCard.style.display = 'inline-flex';
        btnCard.href = `trader-card.html?token=${encodeURIComponent(cardTok)}`;
      }
      if (btnWa) {
        btnWa.style.display = 'inline-flex';
        btnWa.onclick = () => sendSkptToWa(record);
      }
    }

    modal.hidden = false;
  }

  // MODAL BREAKDOWN KPI DENGAN FILTER PENCARIAN
  function openKpiModal(type) {
    activeKpiType = type;
    const modal = document.getElementById('kpiModal');
    const titleEl = document.getElementById('kpiModalTitle');
    const subtitleEl = document.getElementById('kpiModalSubtitle');
    const searchInput = document.getElementById('kpiSearchInput');
    if (searchInput) searchInput.value = '';

    const titles = {
      traders: { title: 'Rincian Seluruh Pedagang Pasar', subtitle: 'DATA MASTER PEDAGANG' },
      units: { title: 'Sebaran Unit Tempat Usaha', subtitle: 'INVENTARIS FISIK PASAR' },
      area: { title: 'Pemanfaatan Luas Area Produktif', subtitle: 'ANALISIS SPASIAL PASAR' },
      omzet: { title: 'Estimasi Perputaran Omzet Pedagang', subtitle: 'INDIKATOR EKONOMI DAERAH' },
      schedule: { title: 'Sebaran Jadwal Hari Operasional Pasar', subtitle: 'HARI PASAR AKTIF KABUPATEN PINRANG' }
    };

    const cfg = titles[type] || titles.traders;
    titleEl.textContent = cfg.title;
    subtitleEl.textContent = cfg.subtitle;

    renderKpiModalBody('');
    modal.hidden = false;
  }

  function renderKpiModalBody(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    const bodyEl = document.getElementById('kpiModalBody');
    const countEl = document.getElementById('kpiModalCount');

    let matching = allRecords.filter(r => {
      if (!term) return true;
      return (
        r.displayName.toLowerCase().includes(term) ||
        r.businessName.toLowerCase().includes(term) ||
        r.marketName.toLowerCase().includes(term) ||
        r.unitNumber.toLowerCase().includes(term) ||
        r.traderId.toLowerCase().includes(term) ||
        String(r.skptNumber || '').toLowerCase().includes(term)
      );
    });

    countEl.textContent = `Menampilkan ${matching.length} data sesuai`;

    if (activeKpiType === 'units') {
      bodyEl.innerHTML = `<table class="db-popup-table"><thead><tr><th>No</th><th>Pedagang</th><th>Pasar</th><th>Unit</th><th>Blok / Lt</th><th>Luas</th><th>Status Tempat</th></tr></thead><tbody>${
        matching.slice(0, 100).map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(r.displayName)}</b><br><small>${esc(r.traderId)}</small></td><td>${esc(r.marketName)}</td><td><span class="db-badge db-badge-info">${esc(r.unitType)} ${esc(r.unitNumber)}</span></td><td>Blok ${esc(r.block)} · Lt. ${esc(r.floor)}</td><td>${r.areaM2} m²</td><td><span class="db-badge ${r.verificationStatus === 'VERIFIED' ? 'db-badge-success' : 'db-badge-warning'}">${esc(r.verificationStatus)}</span></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#888;">Tidak ada data yang cocok.</td></tr>'
      }</tbody></table>`;
    } else if (activeKpiType === 'schedule') {
      bodyEl.innerHTML = `<table class="db-popup-table"><thead><tr><th>No</th><th>Pedagang</th><th>Pasar</th><th>Unit</th><th>Jadwal Operasional</th><th>Legalitas SKPT</th><th>Aksi</th></tr></thead><tbody>${
        matching.slice(0, 100).map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(r.displayName)}</b><br><small>${esc(r.businessName)}</small></td><td>${esc(r.marketName)}</td><td>${esc(r.unitType)} ${esc(r.unitNumber)} (${r.areaM2} m²)</td><td><span class="db-badge db-badge-info" style="font-size:0.68rem; padding:3px 8px;">🗓️ ${esc(r.operatingSchedule)}</span></td><td><span class="db-badge ${r.hasSkpt ? 'db-badge-success' : 'db-badge-neutral'}">${r.hasSkpt ? 'SKPT Terbit' : 'Belum Ada'}</span></td><td><button class="button secondary" style="min-height:28px;padding:2px 8px;font-size:0.68rem;" onclick="window.EPASAR_DB.viewDetail('${esc(r.traderId)}', '${esc(r.claimId)}')">Detail</button></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#888;">Tidak ada data yang cocok.</td></tr>'
      }</tbody></table>`;
    } else {
      bodyEl.innerHTML = `<table class="db-popup-table"><thead><tr><th>No</th><th>Nama Pedagang</th><th>Usaha & Komoditas</th><th>Pasar</th><th>Unit</th><th>Legalitas e-SKPT</th><th>Aksi</th></tr></thead><tbody>${
        matching.slice(0, 100).map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(r.displayName)}</b><br><small>ID: ${esc(r.traderId)}</small></td><td>${esc(r.businessName)}<br><small style="color:#64748b;">${esc(r.businessCategory)}</small></td><td>${esc(r.marketName)}</td><td>${esc(r.unitType)} ${esc(r.unitNumber)}</td><td><span class="db-badge ${r.hasSkpt ? 'db-badge-success' : 'db-badge-neutral'}">${esc(r.skptNumber)}</span></td><td><button class="button secondary" style="min-height:28px;padding:2px 8px;font-size:0.68rem;" onclick="window.EPASAR_DB.viewDetail('${esc(r.traderId)}', '${esc(r.claimId)}')">Rincian</button></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#888;">Tidak ada data yang cocok.</td></tr>'
      }</tbody></table>`;
    }
  }

  function setupEvents() {
    // Event listener untuk pengurutan tabel dinamis (Sortable Table Headers)
    document.querySelectorAll('.db-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const sortKey = th.dataset.sort;
        if (sortKey) handleSortClick(sortKey);
      });
    });

    document.getElementById('filterSearch').addEventListener('input', applyFilters);
    document.getElementById('filterMarket').addEventListener('change', applyFilters);
    document.getElementById('filterUnitType').addEventListener('change', applyFilters);
    document.getElementById('filterSkpt').addEventListener('change', applyFilters);
    document.getElementById('filterVerify').addEventListener('change', applyFilters);

    document.getElementById('btnPrev').addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });

    document.getElementById('btnNext').addEventListener('click', () => {
      const totalPages = Math.ceil(filteredRecords.length / pageSize);
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
      }
    });

    document.getElementById('btnPrint')?.addEventListener('click', printReport);
    document.getElementById('btnExportXlsx')?.addEventListener('click', exportXlsx);
    document.getElementById('btnExportCsv')?.addEventListener('click', exportXlsx);
    document.getElementById('btnRefresh')?.addEventListener('click', () => loadDatabase(currentProfile));

    // Tutup Modal Detail Pedagang
    const closeModal = () => { document.getElementById('detailModal').hidden = true; };
    document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('detailModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'detailModal') closeModal();
    });

    // Card KPI Interaktif (Klik Membuka Modal Breakdown)
    const kpiCards = document.querySelectorAll('.db-kpi-card');
    if (kpiCards[0]) kpiCards[0].addEventListener('click', () => openKpiModal('traders'));
    if (kpiCards[1]) kpiCards[1].addEventListener('click', () => openKpiModal('units'));
    if (kpiCards[2]) kpiCards[2].addEventListener('click', () => openKpiModal('area'));
    if (kpiCards[3]) kpiCards[3].addEventListener('click', () => openKpiModal('omzet'));
    if (kpiCards[4]) kpiCards[4].addEventListener('click', () => openKpiModal('schedule'));

    // Modal KPI Controls
    const closeKpiModal = () => { document.getElementById('kpiModal').hidden = true; };
    document.getElementById('closeKpiModalBtn')?.addEventListener('click', closeKpiModal);
    document.getElementById('closeKpiModalFooterBtn')?.addEventListener('click', closeKpiModal);
    document.getElementById('kpiModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'kpiModal') closeKpiModal();
    });
    document.getElementById('kpiSearchInput')?.addEventListener('input', (e) => {
      renderKpiModalBody(e.target.value);
    });

    // Modal WhatsApp Controls
    const closeWaModal = () => { document.getElementById('waPromptModal').hidden = true; };
    document.getElementById('closeWaModalBtn')?.addEventListener('click', closeWaModal);
    document.getElementById('cancelWaBtn')?.addEventListener('click', closeWaModal);
    document.getElementById('waPromptModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'waPromptModal') closeWaModal();
    });
    document.getElementById('sendWaSubmitBtn')?.addEventListener('click', () => {
      const phoneInput = document.getElementById('waPhoneNumberInput');
      let phone = String(phoneInput?.value || '').trim().replace(/\D/g, '');
      if (phone.startsWith('0')) phone = '62' + phone.slice(1);
      if (!phone || phone.length < 10) {
        alert('Masukkan nomor WhatsApp yang valid (minimal 10 digit, contoh: 081234567890).');
        phoneInput?.focus();
        return;
      }
      closeWaModal();
      if (activeWaRecord) {
        const text = encodeURIComponent(formatWaMessage(activeWaRecord));
        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${text}`, '_blank');
      }
    });

    // Keyboard ESC to close any open modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        closeKpiModal();
        closeWaModal();
      }
    });
  }

  async function boot() {
    try {
      const profile = await window.EPASAR_AUTH.requireStaff([
        'SUPER_ADMIN', 'DISPERINDAG_ADMIN', 'TRADE_ADMIN', 'MARKET_ADMIN', 'MARKET_HEAD', 'UPTD_HEAD', 'KADIS', 'TECH_ADMIN'
      ]);
      currentProfile = profile;
      if (profile.role === 'UPTD_HEAD') { location.replace('uptd-approval.html'); return; }
      currentReportScope = resolveReportScope(profile);
      window.EPASAR_INTERNAL_UI?.setProfile(profile);

      const isMarketHead = profile.role === 'MARKET_HEAD';
      const roleTitle = isMarketHead
        ? 'Ruang Kerja Kepala Pasar'
        : profile.role === 'MARKET_ADMIN'
          ? `Pelaporan Terbatas · ${currentReportScope.label}`
          : 'Pusat Data Eksekutif & Pelaporan';
      document.getElementById('dbUserSubtitle').textContent = `${profile.displayName || profile.position || 'Petugas'} · ${roleTitle}`;

      setupEvents();
      await loadDatabase(profile);
    } catch (err) {
      console.error(err);
      notice('Gagal memverifikasi izin akses modul database: ' + err.message, true);
    }
  }

  window.EPASAR_DB = {
    viewDetail,
    printReport,
    renderPrintReport,
    exportXlsx,
    exportCsv: exportXlsx,
    exportJson,
    getRecord: (id) => allRecords.find(r => r.traderId === id || r.claimId === id),
    formatWaMessage,
    resolveRecordLegalData,
    resolveReportScope,
    marketInScope
  };

  boot();
})();
