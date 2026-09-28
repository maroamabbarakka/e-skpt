(function () {
  'use strict';

  let currentProfile = null;
  let allRecords = [];
  let filteredRecords = [];
  let currentPage = 1;
  const pageSize = 15;

  const esc = value => String(value ?? '—').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const formatRupiah = num => 'Rp ' + Number(num || 0).toLocaleString('id-ID');

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

  async function loadDatabase(profile) {
    notice('Mengumpulkan master database pedagang dan lokasi pasar…');
    if (window.EPASAR_CONFIG_SERVICE && typeof window.EPASAR_CONFIG_SERVICE.getSettings === 'function') {
      try {
        currentAppSettings = await window.EPASAR_CONFIG_SERVICE.getSettings();
      } catch (_) {}
    }
    const isMarketHead = profile.role === 'MARKET_HEAD';
    let assignedIds = [];
    if (isMarketHead) {
      if (window.EPASAR_MARKET_WORKSPACE && typeof window.EPASAR_MARKET_WORKSPACE.assignedMarketIds === 'function') {
        assignedIds = window.EPASAR_MARKET_WORKSPACE.assignedMarketIds(profile);
      } else if (Array.isArray(profile.marketIds)) {
        assignedIds = [...profile.marketIds];
      }
      if (profile.marketId && !assignedIds.includes(profile.marketId)) {
        assignedIds.push(profile.marketId);
      }
    }
    const db = getDb();

    try {
      // 1. Ambil data traders
      const tradersSnap = await db.collection('traders').limit(300).get();
      const tradersMap = new Map();
      tradersSnap.forEach(doc => {
        tradersMap.set(doc.data().traderId || doc.id, { id: doc.id, ...doc.data() });
      });

      // 2. Ambil data businesses
      const businessesSnap = await db.collection('businesses').limit(300).get();
      const businessesByTrader = new Map();
      businessesSnap.forEach(doc => {
        const b = doc.data();
        if (b.traderId) {
          if (!businessesByTrader.has(b.traderId)) businessesByTrader.set(b.traderId, []);
          businessesByTrader.get(b.traderId).push({ id: doc.id, ...b });
        }
      });

      // 3. Ambil data market_claims
      let claimsList = [];
      if (isMarketHead && assignedIds.length > 0) {
        const claimsSnaps = await Promise.all(
          assignedIds.map(mId => db.collection('market_claims').where('marketId', '==', mId).limit(200).get())
        );
        claimsSnaps.forEach(snap => {
          snap.forEach(doc => claimsList.push({ id: doc.id, ...doc.data() }));
        });
      } else {
        const claimsSnap = await db.collection('market_claims').limit(300).get();
        claimsSnap.forEach(doc => claimsList.push({ id: doc.id, ...doc.data() }));
      }

      // 4. Ambil data skpt_applications & skpt_documents
      let appsSnapshots = [];
      if (isMarketHead && assignedIds.length > 0) {
        appsSnapshots = await Promise.all(
          assignedIds.map(mId => db.collection('skpt_applications').where('marketId', '==', mId).limit(200).get())
        );
      } else {
        const globalAppsSnap = await db.collection('skpt_applications').limit(300).get();
        appsSnapshots = [globalAppsSnap];
      }
      const appsByClaim = new Map();
      const appsByTrader = new Map();
      appsSnapshots.forEach(snap => {
        snap.forEach(doc => {
          const a = doc.data();
          if (a.claimId) appsByClaim.set(a.claimId, { id: doc.id, ...a });
          if (a.traderId) appsByTrader.set(a.traderId, { id: doc.id, ...a });
        });
      });

      // Ambil juga dokumen resmi SKPT yang sudah terbit (skpt_documents)
      const skptDocsByApp = new Map();
      const skptDocsByTrader = new Map();
      const skptDocsById = new Map();
      try {
        const skptDocsSnap = await db.collection('skpt_documents').where('status', '==', 'ISSUED').limit(300).get();
        skptDocsSnap.forEach(doc => {
          const sd = doc.data();
          skptDocsById.set(doc.id, { id: doc.id, ...sd });
          if (sd.applicationId) skptDocsByApp.set(sd.applicationId, { id: doc.id, ...sd });
          if (sd.traderId) skptDocsByTrader.set(sd.traderId, { id: doc.id, ...sd });
        });
      } catch (errSkpt) {
        console.warn('skpt_documents belum dapat dimuat lengkap:', errSkpt);
      }

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
        const areaM2 = claim.claimedAreaM2 ?? claim.areaM2 ?? 8;
        const monthlyRevenue = business.monthlyRevenue || 10000000;
        const operatingSchedule = getMarketSchedule(claim.marketId, marketName);

        const hasSkpt = Boolean(skptDoc.verificationToken || app.status === 'ISSUED' || skptDoc.status === 'ISSUED');
        const skptNumber = skptDoc.number || app.skptNumber || app.number || (hasSkpt ? (skptDoc.number || `SKPT-PIN-${String(claim.marketId || '').slice(-3)}-${traderId.slice(-4)}`) : '—');
        const verificationToken = skptDoc.verificationToken || app.verificationToken || '';
        const documentHash = skptDoc.documentHash || '';
        const publicToken = app.publicToken || trader.publicToken || claim.publicToken || trader.intakeId || '';
        const registrationCode = trader.registrationCode || app.registrationCode || trader.code || '';
        const validUntil = skptDoc.validUntil || '';
        const phone = trader.phone || app.applicantSnapshot?.phone || business.phone || '';

        records.push({
          traderId,
          traderDocId: trader.id || '',
          displayName: claim.traderDisplayName || trader.displayName || app.applicantSnapshot?.displayName || 'Pedagang Pasar',
          nikMasked: '7315' + '************',
          businessName: business.name || app.applicantSnapshot?.businessName || 'Usaha Dagang',
          businessType: business.type || 'Toko',
          businessCategory: business.category || business.group || 'Barang Campuran',
          monthlyRevenue,
          workerCount: business.workerCount || 1,
          marketId: claim.marketId,
          marketName,
          unitType,
          unitNumber,
          block,
          floor,
          areaM2,
          operatingSchedule,
          verificationStatus: claim.verificationStatus || 'UNVERIFIED',
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
      if (!isMarketHead) {
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
              monthlyRevenue: b.monthlyRevenue || 5000000,
              workerCount: b.workerCount || 1,
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

      allRecords = records;
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

    const isMarketHead = profile.role === 'MARKET_HEAD';
    const assignedIds = (isMarketHead && Array.isArray(profile.marketIds)) ? profile.marketIds : [];

    const markets = window.EPASAR?.MARKETS || [
      { id: 'MKT-010', name: 'Pasar Rakyat Sentral Pinrang' },
      { id: 'MKT-001', name: 'Pasar Rakyat Kariango' },
      { id: 'MKT-002', name: 'Pasar Rakyat Pekkabata' },
      { id: 'MKT-003', name: 'Pasar Rakyat Batulappa' },
      { id: 'MKT-004', name: 'Pasar Rakyat Bungi' }
    ];

    marketSelect.innerHTML = isMarketHead ? '' : '<option value="">Semua Pasar se-Kabupaten Pinrang</option>';

    markets.forEach(m => {
      const isAssigned = assignedIds.includes(m.id) || assignedIds.includes(window.EPASAR?.canonicalMarketId(m.id));
      if (!isMarketHead || isAssigned) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.id} · ${m.name}`;
        marketSelect.appendChild(opt);
      }
    });

    if (!isMarketHead) {
      const optNon = document.createElement('option');
      optNon.value = 'NON_MARKET';
      optNon.textContent = 'Pedagang Mandiri (Luar Pasar)';
      marketSelect.appendChild(optNon);
    } else {
      marketSelect.disabled = true; // Kepala Pasar terkunci ke pasarnya
    }
  }

  function applyFilters() {
    const keyword = document.getElementById('filterSearch').value.trim().toLowerCase();
    const market = document.getElementById('filterMarket').value;
    const unitType = document.getElementById('filterUnitType').value;
    const skptStatus = document.getElementById('filterSkpt').value;
    const verifyStatus = document.getElementById('filterVerify').value;

    filteredRecords = allRecords.filter(item => {
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
    updateKpis();
    renderTable();
    updateFilterMeta();
  }

  function updateKpis() {
    const totalTraders = new Set(filteredRecords.map(r => r.traderId)).size;
    const totalUnits = filteredRecords.filter(r => r.marketId !== 'NON_MARKET').length;
    const totalArea = filteredRecords.reduce((sum, r) => sum + (Number(r.areaM2) || 0), 0);
    const totalOmzet = filteredRecords.reduce((sum, r) => sum + (Number(r.monthlyRevenue) || 0), 0);
    const marketCount = new Set(filteredRecords.map(r => r.marketId).filter(id => id !== 'NON_MARKET')).size;

    document.getElementById('kpiTraders').textContent = totalTraders.toLocaleString('id-ID');
    document.getElementById('kpiUnits').textContent = totalUnits.toLocaleString('id-ID');
    document.getElementById('kpiArea').textContent = totalArea.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' m²';
    document.getElementById('kpiOmzet').textContent = formatRupiah(totalOmzet);
    const scheduleEl = document.getElementById('kpiSchedule') || document.getElementById('kpiRetribusi');
    if (scheduleEl) {
      scheduleEl.textContent = `${marketCount} Pasar`;
    }
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
      let statusBadge = '<span class="db-badge db-badge-neutral">Belum diverifikasi</span>';
      if (row.verificationStatus === 'VERIFIED') statusBadge = '<span class="db-badge db-badge-success">✓ Terverifikasi</span>';
      else if (row.verificationStatus === 'CONFLICT') statusBadge = '<span class="db-badge db-badge-danger">⚠ Konflik Lapangan</span>';

      let skptBadge = '<span class="db-badge db-badge-neutral">Tanpa SKPT</span>';
      if (row.hasSkpt) skptBadge = `<span class="db-badge db-badge-success">SKPT Aktif<br><small>${esc(row.skptNumber)}</small></span>`;
      else if (row.skptStatus === 'KADIS_REVIEW' || row.skptStatus === 'TTE_PENDING') skptBadge = '<span class="db-badge db-badge-info">Proses Kadis</span>';
      else if (row.skptStatus === 'MARKET_VERIFICATION') skptBadge = '<span class="db-badge db-badge-warning">Verifikasi Pasar</span>';
      else if (row.skptStatus === 'REJECTED') skptBadge = '<span class="db-badge db-badge-danger">Ditolak</span>';

      const unitInfo = row.marketId === 'NON_MARKET' ? '—' : `${esc(row.unitType)} ${esc(row.unitNumber)}<br><small>Blok ${esc(row.block)} · Lt. ${esc(row.floor)} · ${row.areaM2} m²</small>`;
      const scheduleInfo = row.marketId === 'NON_MARKET'
        ? '<span class="db-badge db-badge-neutral" style="font-size:0.68rem;">Mandiri</span>'
        : `<span class="db-badge db-badge-info" style="font-size:0.68rem; padding:3px 8px; white-space:nowrap;">🗓️ ${esc(row.operatingSchedule)}</span><br><small style="color:#64748b; font-size:0.68rem;">Intensitas Hari Aktif</small>`;

      return `<tr>
        <td>${no}</td>
        <td>
          <div class="db-trader-meta">
            <strong>${esc(row.displayName)}</strong>
            <small>ID: ${esc(row.traderId)}</small>
            <small>NIK: ${esc(row.nikMasked)}</small>
          </div>
        </td>
        <td>
          <b>${esc(row.businessName)}</b><br>
          <small>${esc(row.businessType)} · ${esc(row.businessCategory)}</small>
        </td>
        <td>
          <strong>${esc(row.marketName)}</strong>
        </td>
        <td>${unitInfo}</td>
        <td>${skptBadge}</td>
        <td>${scheduleInfo}</td>
        <td>${statusBadge}</td>
        <td class="no-print">
          <button class="button secondary" style="min-height:32px;padding:4px 10px;font-size:0.7rem" onclick="window.EPASAR_DB.viewDetail('${esc(row.traderId)}', '${esc(row.claimId)}')">Rincian</button>
        </td>
      </tr>`;
    }).join('');

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

    metaContainer.innerHTML = tags.map(t => `<span class="db-filter-tag">${esc(t)}</span>`).join('') || '<span style="color:#8094aa">Menampilkan semua data tanpa filter khusus</span>';
  }

  // CETAK LAPORAN RESMI
  function printReport() {
    const isMarketHead = currentProfile?.role === 'MARKET_HEAD';
    const marketName = isMarketHead
      ? (document.getElementById('filterMarket').selectedOptions[0]?.text || 'Pasar Rakyat')
      : (document.getElementById('filterMarket').value ? document.getElementById('filterMarket').selectedOptions[0].text : 'Seluruh Pasar Rakyat Kabupaten Pinrang');

    // Update metadata cetak
    document.getElementById('printMarketTitle').textContent = isMarketHead ? `BUKU INDUK PEDAGANG ${marketName.toUpperCase()}` : 'DAFTAR INDUK PEDAGANG PASAR RAKYAT KABUPATEN PINRANG';
    document.getElementById('printFilterScope').textContent = `Cakupan Lokasi: ${marketName} · Dicetak pada: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
    
    // Tanda Tangan Cetak
    const signRoleEl = document.getElementById('printSignRole');
    const signNameEl = document.getElementById('printSignName');
    const signNipEl = document.getElementById('printSignNip');

    if (isMarketHead) {
      signRoleEl.textContent = `Kepala Pasar ${marketName.replace(/^MKT-\d+\s*·\s*/, '')}`;
      signNameEl.textContent = currentProfile?.displayName || 'Kepala Pasar';
      signNipEl.textContent = 'NIP. ' + (currentProfile?.nip || '19820514 200801 1 012');
    } else {
      signRoleEl.textContent = 'Kepala Dinas Perindustrian, Perdagangan, ESDM\nKabupaten Pinrang';
      const kadisName = (currentProfile?.role === 'KADIS' && currentProfile?.displayName && currentProfile.displayName !== 'Kepala Dinas')
        ? currentProfile.displayName
        : 'MUHAMMAD YUSUF NUR, S.STP';
      const kadisNip = (currentProfile?.role === 'KADIS' && currentProfile?.nip)
        ? currentProfile.nip
        : '19800326 200003 1 001';
      signNameEl.textContent = kadisName;
      signNipEl.textContent = 'NIP. ' + kadisNip;
    }

    window.print();
  }

  // EKSPOR KE EXCEL (CSV UTF-8 DENGAN BOM)
  function exportCsv() {
    if (!filteredRecords.length) {
      alert('Tidak ada data pedagang yang dapat diekspor.');
      return;
    }

    const headers = [
      'No',
      'ID Pedagang',
      'Nama Pedagang',
      'Nama Usaha',
      'Jenis Usaha',
      'Kategori Komoditas',
      'Omzet Bulanan (Rp)',
      'Jumlah Tenaga Kerja',
      'Kode Pasar',
      'Nama Pasar',
      'Jenis Tempat',
      'Nomor Unit',
      'Blok',
      'Lantai',
      'Luas (m2)',
      'Jadwal Operasional Pasar',
      'Status Verifikasi Fisik',
      'Status SKPT',
      'Nomor SKPT',
      'Tanggal Pendataan'
    ];

    const rows = filteredRecords.map((r, i) => [
      i + 1,
      `"${r.traderId}"`,
      `"${r.displayName.replaceAll('"', '""')}"`,
      `"${r.businessName.replaceAll('"', '""')}"`,
      `"${r.businessType}"`,
      `"${r.businessCategory}"`,
      r.monthlyRevenue,
      r.workerCount,
      `"${r.marketId}"`,
      `"${r.marketName.replaceAll('"', '""')}"`,
      `"${r.unitType}"`,
      `"${r.unitNumber}"`,
      `"${r.block}"`,
      `"${r.floor}"`,
      r.areaM2,
      `"${r.operatingSchedule}"`,
      `"${r.verificationStatus}"`,
      `"${r.skptStatus}"`,
      `"${r.skptNumber}"`,
      `"${r.registeredAt}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timeStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `DATABASE_PEDAGANG_PINRANG_${timeStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    link.setAttribute('download', `SPASIAL_PEDAGANG_PINRANG_${timeStamp}.json`);
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

    return record;
  }

  function formatWaMessage(record) {
    const origin = window.location.origin;
    const actualSkptToken = record.verificationToken || record.publicToken;
    const skptUrl = actualSkptToken ? `${origin}/skpt-pdf.html?token=${encodeURIComponent(actualSkptToken)}` : `${origin}/verifikasi-skpt.html`;
    const cardUrl = `${origin}/trader-card.html?token=${encodeURIComponent(record.publicToken || record.verificationToken)}`;
    const statusUrl = `${origin}/epasar-status.html?code=${encodeURIComponent(record.registrationCode || '')}&token=${encodeURIComponent(record.publicToken || record.verificationToken)}`;

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
    document.getElementById('modalTraderName').textContent = record.displayName;
    document.getElementById('modalTraderId').textContent = record.traderId;
    document.getElementById('modalNik').textContent = record.nikMasked;
    document.getElementById('modalBusiness').textContent = `${record.businessName} (${record.businessType})`;
    document.getElementById('modalCommodity').textContent = record.businessCategory;
    document.getElementById('modalMarket').textContent = record.marketName;
    document.getElementById('modalUnit').textContent = `${record.unitType} ${record.unitNumber} (Blok ${record.block}, Lt. ${record.floor})`;
    document.getElementById('modalArea').textContent = `${record.areaM2} m²`;
    document.getElementById('modalRevenue').textContent = formatRupiah(record.monthlyRevenue);
    const modalDaysEl = document.getElementById('modalMarketDays');
    if (modalDaysEl) modalDaysEl.textContent = record.operatingSchedule || 'Jadwal Reguler';
    const modalRetEl = document.getElementById('modalRetribution');
    if (modalRetEl) modalRetEl.textContent = 'Mengikuti intensitas hari pasar aktif sesuai Perda Pajak & Retribusi Daerah';
    document.getElementById('modalSkpt').textContent = record.hasSkpt ? record.skptNumber : record.skptStatus;
    document.getElementById('modalVerification').textContent = record.verificationStatus;

    // Aksi Dokumen Legalitas (Cetak SKPT, Kartu Pedagang, WhatsApp)
    const skptContainer = document.getElementById('modalSkptActionContainer');
    if (skptContainer) {
      if (record.hasSkpt || record.verificationToken) {
        skptContainer.hidden = false;
        const btnSkpt = document.getElementById('modalBtnPrintSkpt');
        const btnCard = document.getElementById('modalBtnPrintCard');
        const btnWa = document.getElementById('modalBtnSendWa');

        if (btnSkpt) {
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
        if (btnCard) {
          btnCard.href = `trader-card.html?token=${encodeURIComponent(record.publicToken || record.verificationToken)}`;
        }
        if (btnWa) {
          btnWa.onclick = () => sendSkptToWa(record);
        }
      } else {
        skptContainer.hidden = true;
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

    document.getElementById('btnPrint').addEventListener('click', printReport);
    document.getElementById('btnExportCsv').addEventListener('click', exportCsv);
    document.getElementById('btnExportJson').addEventListener('click', exportJson);
    document.getElementById('btnRefresh').addEventListener('click', () => loadDatabase(currentProfile));

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
        'SUPER_ADMIN', 'DISPERINDAG_ADMIN', 'TRADE_ADMIN', 'MARKET_ADMIN', 'MARKET_HEAD', 'KADIS', 'TECH_ADMIN'
      ]);
      currentProfile = profile;
      window.EPASAR_INTERNAL_UI?.setProfile(profile);

      const isMarketHead = profile.role === 'MARKET_HEAD';
      const roleTitle = isMarketHead ? 'Ruang Kerja Kepala Pasar' : 'Pusat Data Eksekutif & Pelaporan';
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
    exportCsv,
    exportJson,
    getRecord: (id) => allRecords.find(r => r.traderId === id || r.claimId === id),
    formatWaMessage,
    resolveRecordLegalData
  };

  boot();
})();
