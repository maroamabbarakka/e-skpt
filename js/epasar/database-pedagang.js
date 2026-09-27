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

  // Menghitung estimasi retribusi bulanan sesuai jenis unit (Simulasi Tarif Perda Pinrang No. 6 Tahun 2024)
  function calculateRetribution(unitType, areaM2) {
    const type = String(unitType || '').toUpperCase();
    let dailyRate = 1000;
    if (type === 'KIOS') dailyRate = 2500;
    else if (type === 'LOS') dailyRate = 1500;
    else if (type === 'LAPAK') dailyRate = 1000;
    else if (type === 'PELATARAN') dailyRate = 500;
    
    // Faktor luas jika tersedia
    if (areaM2 && areaM2 > 10) dailyRate += Math.round((areaM2 - 10) * 100);
    return dailyRate * 30; // 30 hari operasional
  }

  const getDb = () => {
    if (window.db) return window.db;
    if (typeof firebase !== 'undefined' && firebase.firestore) return firebase.firestore();
    throw new Error('Koneksi Firestore belum siap.');
  };

  async function loadDatabase(profile) {
    notice('Mengumpulkan master database pedagang dan lokasi pasar…');
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

      // 4. Ambil data skpt_applications
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

        processedTraderIds.add(traderId);
        const marketObj = window.EPASAR?.marketById(claim.marketId);
        const marketName = marketObj?.name || claim.marketName || claim.marketId || 'Pasar Rakyat';
        const unitType = claim.claimedUnitType || claim.unitType || 'KIOS';
        const unitNumber = claim.claimedUnitNumber || claim.unitNumber || '—';
        const block = claim.claimedBlock || claim.block || '—';
        const floor = claim.claimedFloor || claim.floor || '1';
        const areaM2 = claim.claimedAreaM2 ?? claim.areaM2 ?? 8;
        const monthlyRevenue = business.monthlyRevenue || 10000000;
        const monthlyRetribution = calculateRetribution(unitType, areaM2);

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
          monthlyRetribution,
          verificationStatus: claim.verificationStatus || 'UNVERIFIED',
          skptStatus: app.status || 'BELUM_PENGAJUAN',
          skptNumber: app.skptNumber || (app.status === 'ISSUED' ? `SKPT-PIN-${String(claim.marketId || '').slice(-3)}-${traderId.slice(-4)}` : '—'),
          hasSkpt: app.status === 'ISSUED',
          claimId: claim.id,
          applicationId: app.id || claim.applicationId || '',
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
              monthlyRetribution: 0,
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
    const totalRetribusi = filteredRecords.reduce((sum, r) => sum + (Number(r.monthlyRetribution) || 0), 0);

    document.getElementById('kpiTraders').textContent = totalTraders.toLocaleString('id-ID');
    document.getElementById('kpiUnits').textContent = totalUnits.toLocaleString('id-ID');
    document.getElementById('kpiArea').textContent = totalArea.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' m²';
    document.getElementById('kpiOmzet').textContent = formatRupiah(totalOmzet);
    document.getElementById('kpiRetribusi').textContent = formatRupiah(totalRetribusi);
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
      const retributionInfo = row.marketId === 'NON_MARKET' ? '—' : `<b>${formatRupiah(row.monthlyRetribution)}</b><br><small>per bulan</small>`;

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
        <td>${retributionInfo}</td>
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
      signNameEl.textContent = 'H. HARTONO MEKKA, S.E., M.Si.';
      signNipEl.textContent = 'NIP. 19681231 199403 1 025';
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
      'Estimasi Retribusi Bulanan (Rp)',
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
      r.monthlyRetribution,
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

  // EKSPOR KE JSON (UNTUK PEMETAAN SPASIAL / RETRIBUSI)
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
          retribusiBulananEstimasi: r.monthlyRetribution
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
    link.setAttribute('download', `SPASIAL_RETRIBUSI_PEDAGANG_${timeStamp}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function viewDetail(traderId, claimId) {
    const record = filteredRecords.find(r => r.traderId === traderId && (!claimId || r.claimId === claimId)) || filteredRecords.find(r => r.traderId === traderId);
    if (!record) return;

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
    document.getElementById('modalRetribution').textContent = `${formatRupiah(record.monthlyRetribution)} / bulan (Perda No. 6/2024)`;
    document.getElementById('modalSkpt').textContent = record.hasSkpt ? record.skptNumber : record.skptStatus;
    document.getElementById('modalVerification').textContent = record.verificationStatus;

    modal.hidden = false;
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

    document.getElementById('closeModalBtn').addEventListener('click', () => {
      document.getElementById('detailModal').hidden = true;
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
    exportJson
  };

  boot();
})();
