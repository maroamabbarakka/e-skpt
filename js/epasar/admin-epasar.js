(function () {
  'use strict';

  let currentPage = 1;
  let currentCursor = null;
  const cursorHistory = [];
  let currentHasMore = false;

  const message = document.getElementById('adminMessage');
  const workspace = document.getElementById('adminWorkspace');
  const rows = document.getElementById('intakeRows');
  const nextButton = document.getElementById('nextButton');
  const previousButton = document.getElementById('previousButton');

  function escapeHtml(value) {
    return String(value ?? '—').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  function setMessage(text, isError) {
    message.hidden = false;
    message.className = isError ? 'admin-error' : 'admin-message';
    message.textContent = text;
  }

  function friendlyError(error) {
    const raw = String(error?.message || error || '');
    if (/permission|insufficient permissions/i.test(raw)) return 'Akun Anda berhasil masuk, tetapi ruang kerja untuk role ini belum tersedia.';
    if (/Firebase|configured|konfigurasi/i.test(raw)) return 'Layanan sedang disiapkan. Silakan coba lagi beberapa saat kemudian.';
    return raw.replace(/Missing or insufficient permissions\.?/i, 'Akses ke data ini belum tersedia untuk akun Anda.');
  }

  async function renderRoleWorkspace(profile) {
    const isMarket = profile.role === 'MARKET_HEAD';
    const isKadis = profile.role === 'KADIS';
    const name = profile.displayName || profile.position || profile.role;
    const marketNames = (profile.marketIds || []).map(id => window.EPASAR?.marketById(id)?.name || id).join(', ');
    const subtitle = isMarket 
      ? `Kepala Pasar — ${marketNames || 'Pasar Rakyat Kabupaten Pinrang'}`
      : 'Pimpinan Eksekutif Dinas Perindag-ESDM Kabupaten Pinrang';
    
    document.getElementById('adminUser').textContent = `${name} · ${subtitle}`;
    workspace.hidden = false;
    message.hidden = true;

    if (isMarket) {
      workspace.innerHTML = `
        <div class="kpi-grid dashboard-kpis" style="margin-bottom: 24px;">
          <article class="kpi"><small>Pedagang Terdaftar</small><strong id="kpiMarketTraders">...</strong><p>${marketNames || 'Pasar Penugasan'}</p></article>
          <article class="kpi"><small>Menunggu Verifikasi</small><strong id="kpiMarketPending" style="color:#033bd4">...</strong><p>Klaim perlu ke lapangan</p></article>
          <article class="kpi"><small>Unit Sah Terverifikasi</small><strong id="kpiMarketVerified" style="color:#2b7713">...</strong><p>Kios/Los/Lapak aktif</p></article>
          <article class="kpi"><small>Konflik / Sengketa</small><strong id="kpiMarketConflict" style="color:#b42318">...</strong><p>Perlu mediasi</p></article>
        </div>

        <div class="command-grid" style="margin-bottom: 24px;">
          <section class="app-panel">
            <h2>Pusat Aksi Cepat Kepala Pasar</h2>
            <p class="app-panel-sub">Tugas prioritas pemeriksaan lapangan dan pengelolaan pedagang.</p>
            <div class="action-list">
              <a class="action-item" href="market-verification.html">
                <span><b>Verifikasi Fisik Kios, Los & Lapak</b><small>Periksa kesesuaian pedagang dan nomor unit usaha di lapangan.</small></span>
                <strong>Mulai Verifikasi →</strong>
              </a>
              <a class="action-item" href="database-pedagang.html">
                <span><b>Buku Induk Pedagang Pasarnya</b><small>Lihat direktori master pedagang, cetak laporan & unduh database.</small></span>
                <strong>Buka Database →</strong>
              </a>
              <a class="action-item" href="occupancy-change.html">
                <span><b>Perubahan Pemegang Hak Tempat</b><small>Pemeriksaan pelepasan atau pengalihan hak pemakaian unit pasar.</small></span>
                <strong>Tinjau Mutasi →</strong>
              </a>
              <a class="action-item" href="annual-validation.html">
                <span><b>Pengesahan Tahunan SKPT</b><small>Pencatatan pemeriksaan fisik tahunan SKPT aktif.</small></span>
                <strong>Buka Pengesahan →</strong>
              </a>
            </div>
          </section>

          <aside class="app-panel">
            <h2>Kewenangan Kepala Pasar</h2>
            <p class="app-panel-sub">Pedoman verifikasi fisik sesuai Perda No. 6 Tahun 2024.</p>
            <div class="notice" style="margin-bottom: 12px;">
              <b>Integritas Data Lapangan</b><br>
              Hasil verifikasi faktual Anda menentukan keabsahan rekomendasi penerbitan SKPT resmi oleh Kepala Dinas.
            </div>
            <div style="background: #eef6ff; padding: 12px; border-radius: 8px; font-size: 0.82rem; color: #1e4a73;">
              📍 Pasar Penugasan: <b>${escapeHtml(marketNames || 'Pasar Kabupaten Pinrang')}</b>
            </div>
          </aside>
        </div>

        <section class="app-panel">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <div>
              <h2 style="margin:0;">Klaim Tempat Pasar yang Menunggu Pemeriksaan</h2>
              <p class="app-panel-sub" style="margin:2px 0 0;">Daftar permohonan di pasar Anda yang siap diverifikasi di lapangan.</p>
            </div>
            <a href="market-verification.html" class="button primary" style="font-size:0.8rem; min-height:36px; padding:0 14px; text-decoration:none;">Buka Ruang Verifikasi Lengkap →</a>
          </div>
          <div class="table-wrap">
            <table class="admin-table">
              <thead><tr><th>Pedagang</th><th>Nama Usaha</th><th>Jenis & Unit</th><th>Luas</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody id="marketRecentRows"><tr><td colspan="6">Memuat antrean pasar...</td></tr></tbody>
            </table>
          </div>
        </section>
      `;

      try {
        let assignedIds = [];
        if (window.EPASAR_MARKET_WORKSPACE && typeof window.EPASAR_MARKET_WORKSPACE.assignedMarketIds === 'function') {
          assignedIds = window.EPASAR_MARKET_WORKSPACE.assignedMarketIds(profile);
        } else if (Array.isArray(profile.marketIds)) {
          assignedIds = [...profile.marketIds];
        }
        if (profile.marketId && !assignedIds.includes(profile.marketId)) assignedIds.push(profile.marketId);

        let claims = [];
        if (assignedIds.length > 0) {
          const snaps = await Promise.all(assignedIds.map(mId => window.db.collection('market_claims').where('marketId', '==', mId).limit(100).get()));
          snaps.forEach(snap => snap.forEach(d => claims.push({ id: d.id, ...d.data() })));
        }

        const totalTraders = claims.length;
        const pending = claims.filter(c => c.verificationStatus === 'UNVERIFIED').length;
        const verified = claims.filter(c => c.verificationStatus === 'VERIFIED').length;
        const conflict = claims.filter(c => c.verificationStatus === 'CONFLICT').length;

        document.getElementById('kpiMarketTraders').textContent = totalTraders;
        document.getElementById('kpiMarketPending').textContent = pending;
        document.getElementById('kpiMarketVerified').textContent = verified;
        document.getElementById('kpiMarketConflict').textContent = conflict;

        const recent = claims.slice(0, 8);
        const rowsEl = document.getElementById('marketRecentRows');
        if (recent.length === 0) {
          rowsEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:18px; color:#64748b;">Belum ada klaim tempat yang menunggu verifikasi di pasar ini.</td></tr>';
        } else {
          rowsEl.innerHTML = recent.map(c => `
            <tr>
              <td data-label="Pedagang"><b>${escapeHtml(c.traderDisplayName || c.traderId || 'Pedagang')}</b></td>
              <td data-label="Usaha">${escapeHtml(c.businessName || 'Usaha Perdagangan')}</td>
              <td data-label="Unit">${escapeHtml(c.claimedUnitType || c.unitType || 'KIOS')} · ${escapeHtml(c.claimedUnitNumber || c.unitNumber || '—')}</td>
              <td data-label="Luas">${escapeHtml(c.claimedAreaM2 || c.areaM2 || '8')} m²</td>
              <td data-label="Status"><span style="display:inline-block; padding:3px 8px; border-radius:99px; font-size:0.7rem; font-weight:700; ${c.verificationStatus === 'VERIFIED' ? 'background:#e9f7dc; color:#2e6d0a;' : c.verificationStatus === 'CONFLICT' ? 'background:#fde8e8; color:#9b1c1c;' : 'background:#fff8db; color:#854d0e;'}">${escapeHtml(c.verificationStatus || 'UNVERIFIED')}</span></td>
              <td data-label="Aksi"><a href="market-verification.html" class="button primary" style="font-size:0.74rem; min-height:30px; padding:0 10px; text-decoration:none;">Periksa</a></td>
            </tr>
          `).join('');
        }
      } catch (err) {
        console.warn('Gagal memuat metrik kepala pasar:', err);
      }

    } else if (isKadis) {
      workspace.innerHTML = `
        <div class="kpi-grid dashboard-kpis" style="margin-bottom: 24px;">
          <article class="kpi"><small>Total Pedagang Terdata</small><strong id="kpiKadisTraders">...</strong><p>17 Pasar se-Kab. Pinrang</p></article>
          <article class="kpi"><small>Menunggu Persetujuan Kadis</small><strong id="kpiKadisPending" style="color:#d97706">...</strong><p>Siap diputuskan & TTE</p></article>
          <article class="kpi"><small>SKPT Resmi Diterbitkan</small><strong id="kpiKadisIssued" style="color:#2563eb">...</strong><p>Tervalidasi TTE Elektronik</p></article>
          <article class="kpi"><small>Potensi Retribusi Pasar</small><strong id="kpiKadisRetribusi" style="color:#16a34a">...</strong><p>Estimasi PAD per Bulan</p></article>
        </div>

        <div class="command-grid" style="margin-bottom: 24px;">
          <section class="app-panel">
            <h2>Kewenangan Eksekutif Kepala Dinas</h2>
            <p class="app-panel-sub">Pengambilan keputusan strategis, persetujuan SKPT, dan audit perizinan pasar.</p>
            <div class="action-list">
              <a class="action-item" href="kadis-approval.html">
                <span><b>Persetujuan Permohonan & TTE SKPT</b><small>Tinjau kelayakan berkas, hasil verifikasi pasar, dan sahkan secara elektronik.</small></span>
                <strong style="color:#033bd4">Buka Persetujuan SKPT →</strong>
              </a>
              <a class="action-item" href="database-pedagang.html">
                <span><b>Buku Induk Master Pedagang se-Kabupaten</b><small>Pantau sebaran pedagang di seluruh pasar, cetak dokumen resmi, dan ekspor data.</small></span>
                <strong>Buka Master Database →</strong>
              </a>
              <a class="action-item" href="occupancy-change.html">
                <span><b>Persetujuan Perubahan Hak Tempat Usaha</b><small>Pengesahan pelepasan, balik nama, atau alih kelola unit kios/los pasar.</small></span>
                <strong>Tinjau Mutasi Tempat →</strong>
              </a>
              <a class="action-item" href="annual-validation.html">
                <span><b>Pengesahan Tahunan & Kepatuhan Retribusi</b><small>Evaluasi perpanjangan tahunan dan status kepatuhan kewajiban pedagang.</small></span>
                <strong>Buka Pengesahan →</strong>
              </a>
            </div>
          </section>

          <aside class="app-panel">
            <h2>Otoritas Tanda Tangan Elektronik</h2>
            <p class="app-panel-sub">Dasar hukum penerbitan SKPT Kabupaten Pinrang.</p>
            <div class="notice" style="margin-bottom: 12px; border-left-color: #2563eb; background:#eff6ff; color:#1e40af;">
              <b>Sertifikasi Digital Resmi</b><br>
              SKPT yang disetujui Kepala Dinas langsung dilengkapi QR Code cryptographic yang dapat diverifikasi oleh publik secara real-time.
            </div>
            <div style="background: #f8fafc; border:1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-size: 0.82rem; color: #475569;">
              ⚖️ Perda Kab. Pinrang No. 6 Tahun 2024 tentang Pengelolaan Pasar Rakyat dan Retribusi Jasa Umum.
            </div>
          </aside>
        </div>

        <section class="app-panel">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <div>
              <h2 style="margin:0;">Antrean Permohonan SKPT Menunggu Persetujuan Kadis</h2>
              <p class="app-panel-sub" style="margin:2px 0 0;">Berkas yang telah selesai diverifikasi oleh Admin dan Kepala Pasar.</p>
            </div>
            <a href="kadis-approval.html" class="button primary" style="font-size:0.8rem; min-height:36px; padding:0 14px; text-decoration:none;">Buka Konsol Persetujuan Kadis →</a>
          </div>
          <div class="table-wrap">
            <table class="admin-table">
              <thead><tr><th>Nama Pemohon</th><th>Nama Usaha</th><th>Pasar Rakyat</th><th>Unit</th><th>Tanggal Pengajuan</th><th>Tindakan</th></tr></thead>
              <tbody id="kadisPendingRows"><tr><td colspan="6">Memuat berkas permohonan...</td></tr></tbody>
            </table>
          </div>
        </section>
      `;

      try {
        const [tradersSnap, pendingAppsSnap, issuedAppsSnap] = await Promise.all([
          window.db.collection('traders').limit(300).get(),
          window.db.collection('skpt_applications').where('status', '==', 'KADIS_REVIEW').limit(100).get(),
          window.db.collection('skpt_applications').where('status', '==', 'ISSUED').limit(100).get()
        ]);

        const totalTraders = tradersSnap.size;
        const pendingCount = pendingAppsSnap.size;
        const issuedCount = issuedAppsSnap.size;
        const totalEstimatedRetribution = totalTraders * 75000;

        document.getElementById('kpiKadisTraders').textContent = totalTraders;
        document.getElementById('kpiKadisPending').textContent = pendingCount;
        document.getElementById('kpiKadisIssued').textContent = issuedCount;
        document.getElementById('kpiKadisRetribusi').textContent = 'Rp ' + Number(totalEstimatedRetribution).toLocaleString('id-ID');

        const pendingList = [];
        pendingAppsSnap.forEach(d => pendingList.push({ id: d.id, ...d.data() }));

        const rowsEl = document.getElementById('kadisPendingRows');
        if (pendingList.length === 0) {
          rowsEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">Tidak ada permohonan SKPT yang menunggu persetujuan saat ini. Seluruh berkas telah diproses.</td></tr>';
        } else {
          rowsEl.innerHTML = pendingList.slice(0, 8).map(a => {
            const m = window.EPASAR?.marketById(a.marketId);
            const mName = m?.name || a.marketName || a.marketId || 'Pasar Rakyat';
            const dateStr = a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString('id-ID') : 'Hari ini';
            return `
              <tr>
                <td data-label="Nama"><b>${escapeHtml(a.applicantSnapshot?.displayName || a.traderDisplayName || 'Pedagang')}</b></td>
                <td data-label="Usaha">${escapeHtml(a.applicantSnapshot?.businessName || 'Usaha Perdagangan')}</td>
                <td data-label="Pasar">${escapeHtml(mName)}</td>
                <td data-label="Unit">${escapeHtml(a.unitType || 'KIOS')} · ${escapeHtml(a.unitNumber || '—')}</td>
                <td data-label="Tanggal">${escapeHtml(dateStr)}</td>
                <td data-label="Tindakan"><a href="kadis-approval.html?id=${encodeURIComponent(a.id)}" class="button primary" style="font-size:0.74rem; min-height:30px; padding:0 12px; text-decoration:none;">Tinjau & Setujui</a></td>
              </tr>
            `;
          }).join('');
        }
      } catch (err) {
        console.warn('Gagal memuat metrik kadis:', err);
      }
    }
  }

  let rawIntakeList = [];

  function populateIntakeMarketOptions() {
    const marketSelect = document.getElementById('intakeMarketFilter');
    if (!marketSelect || marketSelect.children.length > 1) return;
    const markets = window.EPASAR?.MARKETS || [
      { id: 'MKT-010', name: 'Pasar Rakyat Sentral Pinrang' },
      { id: 'MKT-001', name: 'Pasar Rakyat Kariango' },
      { id: 'MKT-002', name: 'Pasar Rakyat Pekkabata' },
      { id: 'MKT-003', name: 'Pasar Rakyat Batulappa' },
      { id: 'MKT-004', name: 'Pasar Rakyat Bungi' }
    ];
    markets.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.id} · ${m.name}`;
      marketSelect.appendChild(opt);
    });
  }

  function filterAndRenderIntake() {
    populateIntakeMarketOptions();
    const searchVal = (document.getElementById('intakeSearch')?.value || '').trim().toLowerCase();
    const marketVal = document.getElementById('intakeMarketFilter')?.value || '';
    const statusVal = document.getElementById('intakeStatusFilter')?.value || '';
    const skptVal = document.getElementById('intakeSkptFilter')?.value || '';

    const filtered = rawIntakeList.filter(item => {
      const reg = String(item.registrationCode || '').toLowerCase();
      const name = String(item.identity?.name || '').toLowerCase();
      const district = String(item.identity?.district || '').toLowerCase();
      const village = String(item.identity?.village || '').toLowerCase();
      const bNames = (item.businessDrafts || []).map(b => String(b.name || '').toLowerCase()).join(' ');

      const matchSearch = !searchVal || reg.includes(searchVal) || name.includes(searchVal) || district.includes(searchVal) || village.includes(searchVal) || bNames.includes(searchVal);

      // Pasar
      let matchMarket = true;
      if (marketVal) {
        const itemMarketIds = (item.businessDrafts || []).flatMap(business => (business.locations || []).flatMap(location => (location.marketPlaces || []).map(place => place.marketId || ''))).filter(Boolean);
        matchMarket = itemMarketIds.includes(marketVal) || itemMarketIds.map(id => window.EPASAR?.canonicalMarketId(id)).includes(marketVal);
      }

      // Status
      let matchStatus = true;
      if (statusVal) {
        matchStatus = item.status === statusVal;
      }

      // SKPT
      let matchSkpt = true;
      if (skptVal === 'yes') matchSkpt = item.applySkpt === true;
      if (skptVal === 'no') matchSkpt = item.applySkpt !== true;

      return matchSearch && matchMarket && matchStatus && matchSkpt;
    });

    const badge = document.getElementById('intakeCountBadge');
    if (badge) {
      badge.textContent = `Menampilkan ${filtered.length} dari ${rawIntakeList.length} pendaftaran`;
    }

    render(filtered);
  }

  function render(list) {
    document.getElementById('kpiPage').textContent = currentPage;
    rows.innerHTML = list.map(item => {
      const submittedAt = item.submittedAt?.toDate
        ? item.submittedAt.toDate().toLocaleString('id-ID') : '—';
      const marketNames = (item.businessDrafts || []).flatMap(business => (business.locations || []).flatMap(location => (location.marketPlaces || []).map(place => window.EPASAR?.marketById(place.marketId)?.name || place.marketName || place.marketId))).filter(Boolean);
      return `<tr>
        <td data-label="Registrasi"><b>${escapeHtml(item.registrationCode)}</b></td>
        <td data-label="Nama">${escapeHtml(item.identity?.name)}</td>
        <td data-label="Wilayah">${escapeHtml(item.identity?.district)} / ${escapeHtml(item.identity?.village)}</td>
        <td data-label="Pasar">${marketNames.length ? escapeHtml([...new Set(marketNames)].join(', ')) : (item.hasMarketUnit === true ? 'Data lama: perlu diperiksa' : 'Non-pasar')}</td>
        <td data-label="SKPT">${item.applySkpt === true ? '<span style="color:#033bd4; font-weight:700;">Ya</span>' : '<span style="color:#64748b;">Tidak</span>'}</td>
        <td data-label="Waktu">${escapeHtml(submittedAt)}</td>
        <td data-label="Tindakan"><div class="table-actions"><a class="button primary" href="admin-intake-review.html?id=${encodeURIComponent(item.id)}">${item.status === 'CORRECTION_REQUIRED' ? 'Tinjau koreksi' : 'Review'}</a><a class="button secondary" href="photo-editor.html?intake=${encodeURIComponent(item.id)}">Olah foto</a></div></td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">Tidak ada data pendaftaran yang cocok dengan pencarian / filter ini.</td></tr>';
    nextButton.disabled = !currentHasMore;
    previousButton.disabled = currentPage === 1;
  }

  async function count(collectionName, field, operator, value) {
    let query = window.db.collection(collectionName);
    if (field) query = query.where(field, operator, value);
    if (typeof query.count === 'function') {
      const aggregate = await query.count().get();
      return aggregate.data().count;
    }
    const snapshot = await query.get();
    return snapshot.size;
  }

  async function loadMetrics() {
    const targets = {
      kpiTotalTraders: count('traders', 'status', '==', 'ACTIVE'),
      kpiSubmitted: count('trader_intake', 'status', '==', 'SUBMITTED'),
      kpiMarket: count('market_claims', 'verificationStatus', '==', 'UNVERIFIED'),
      kpiConflict: count('market_claims', 'verificationStatus', '==', 'CONFLICT'),
      kpiKadis: count('skpt_applications', 'status', '==', 'KADIS_REVIEW'),
      kpiIssued: count('skpt_documents', 'status', '==', 'ISSUED'),
      kpiAnnual: count('skpt_annual_validations', 'status', '==', 'PENDING_REVIEW')
    };
    await Promise.all(Object.entries(targets).map(async ([id, promise]) => {
      try { document.getElementById(id).textContent = await promise; }
      catch (error) { console.warn(`[e-PASAR] KPI ${id} belum tersedia`, error); document.getElementById(id).textContent = '—'; }
    }));
  }

  async function load(cursor) {
    setMessage('Memuat antrean…', false);
    try {
      if (!window.EPASAR_FIREBASE_READY) {
        throw new Error('Firebase/Auth belum dikonfigurasi. Akses admin dinonaktifkan.');
      }
      const result = await window.EPASAR_ADMIN_INTAKE.page(cursor);
      currentCursor = result.last || null;
      currentHasMore = result.hasMore;
      rawIntakeList = result.rows;
      filterAndRenderIntake();
      if (currentPage === 1) loadMetrics();
      workspace.hidden = false;
      message.hidden = true;
    } catch (error) {
      workspace.hidden = true;
      setMessage(friendlyError(error), true);
    }
  }

  function setupIntakeFilterEvents() {
    const searchInput = document.getElementById('intakeSearch');
    const marketSelect = document.getElementById('intakeMarketFilter');
    const statusSelect = document.getElementById('intakeStatusFilter');
    const skptSelect = document.getElementById('intakeSkptFilter');
    const resetBtn = document.getElementById('intakeResetBtn');

    if (searchInput) searchInput.addEventListener('input', filterAndRenderIntake);
    if (marketSelect) marketSelect.addEventListener('change', filterAndRenderIntake);
    if (statusSelect) statusSelect.addEventListener('change', filterAndRenderIntake);
    if (skptSelect) skptSelect.addEventListener('change', filterAndRenderIntake);
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (marketSelect) marketSelect.value = '';
        if (statusSelect) statusSelect.value = '';
        if (skptSelect) skptSelect.value = '';
        filterAndRenderIntake();
      });
    }
  }

  document.getElementById('refreshButton').addEventListener('click', () => {
    currentPage = 1;
    currentCursor = null;
    cursorHistory.length = 0;
    load(null);
  });

  nextButton.addEventListener('click', () => {
    if (!currentHasMore || !currentCursor) return;
    cursorHistory.push(currentCursor);
    currentPage += 1;
    load(currentCursor);
  });

  previousButton.addEventListener('click', () => {
    if (currentPage === 1) return;
    currentPage -= 1;
    const previousCursor = currentPage === 1 ? null : cursorHistory[currentPage - 2];
    cursorHistory.splice(currentPage - 1);
    load(previousCursor);
  });

  document.getElementById('logoutButton').addEventListener('click', async () => { await window.EPASAR_AUTH.signOut(); location.href = 'login.html'; });
  (async function boot() {
    try {
      if (window.EPASAR_FIREBASE_INIT) window.EPASAR_FIREBASE_INIT();
      const profile = await window.EPASAR_AUTH.requireStaff(['SUPER_ADMIN','DISPERINDAG_ADMIN','TRADE_ADMIN','MARKET_ADMIN','MARKET_HEAD','KADIS','TECH_ADMIN']);
      window.EPASAR_INTERNAL_UI?.setProfile(profile);
      setupIntakeFilterEvents();
      if (profile.role === 'MARKET_HEAD' || profile.role === 'KADIS') renderRoleWorkspace(profile);
      else load(null);
    } catch (error) {
      workspace.hidden = true;
      setMessage(`${friendlyError(error)} Mengalihkan ke halaman login…`, true);
      setTimeout(() => { location.href = 'login.html'; }, 900);
    }
  }());
}());
