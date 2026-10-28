(function () {
  'use strict';

  let currentPage = 1;
  let currentCursor = null;
  const cursorHistory = [];
  let currentHasMore = false;
  let currentProfile = null;

  const message = document.getElementById('adminMessage');
  const workspace = document.getElementById('adminWorkspace');
  const rows = document.getElementById('intakeRows');
  const nextButton = document.getElementById('nextButton');
  const previousButton = document.getElementById('previousButton');
  let traderNotifications = [];
  const NON_MARKET_CACHE_TTL_MS = 60 * 1000;
  let nonMarketCache = { expiresAt: 0, rows: null, promise: null };
  let publicStatsCache = { expiresAt: 0, data: null, promise: null };
  let metricsPromise = null;

  function escapeHtml(value) {
    return String(value ?? '—').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }
  const esc = escapeHtml;

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

  async function getPublicStatsSummary(options = {}) {
    const now = Date.now();
    if (!options.force && publicStatsCache.data && publicStatsCache.expiresAt > now) return publicStatsCache.data;
    if (publicStatsCache.promise) return publicStatsCache.promise;
    publicStatsCache.promise = window.db.collection('public_stats').doc('summary').get()
      .then(snapshot => snapshot.exists ? snapshot.data() : null)
      .catch(error => {
        console.warn('Ringkasan statistik belum tersedia:', error);
        return publicStatsCache.data;
      })
      .then(data => {
        if (data) {
          publicStatsCache.data = data;
          publicStatsCache.expiresAt = Date.now() + NON_MARKET_CACHE_TTL_MS;
        }
        return data;
      })
      .finally(() => { publicStatsCache.promise = null; });
    return publicStatsCache.promise;
  }

  function notificationSource(row) {
    return ({ ADMIN_INTAKE_REVIEW: 'Admin', MARKET_VERIFICATION: 'Kepala Pasar', KADIS_DECISION: 'Kadis' })[row.sourceType] || row.sourceRole || 'Petugas';
  }

  function renderTraderNotifications() {
    const body = document.getElementById('notificationRows');
    const badge = document.getElementById('notificationCountBadge');
    if (!body) return;
    if (badge) badge.textContent = `${traderNotifications.length} belum dikirim`;
    body.innerHTML = traderNotifications.map(row => `<tr>
      <td data-label="Pedagang"><b>${esc(row.traderName || row.traderId || 'Pedagang')}</b><small style="display:block;color:#64748b;">${esc(row.registrationCode || 'Tanpa nomor registrasi')}</small></td>
      <td data-label="Keputusan"><span class="status-badge ${row.decision === 'REJECTED' ? 'status-rejected' : 'status-warning'}">${row.decision === 'REJECTED' ? 'DITOLAK' : 'PERLU PERBAIKAN'}</span></td>
      <td data-label="Sumber">${esc(notificationSource(row))}</td>
      <td data-label="Alasan">${esc(row.reason || row.summary || '—')}</td>
      <td data-label="WhatsApp"><input data-notification-phone="${esc(row.id)}" type="tel" value="${esc(row.phone || '')}" placeholder="08xxxxxxxxxx" style="min-width:145px;margin:0;"></td>
      <td data-label="Tindakan"><button class="button primary" type="button" data-send-notification="${esc(row.id)}">Kirim via WA</button></td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:18px;color:#64748b;">Tidak ada penolakan atau perbaikan yang menunggu pengiriman.</td></tr>';
  }

  async function loadTraderNotifications() {
    const panel = document.getElementById('notificationQueue');
    if (!panel || !window.EPASAR_ADMIN_NOTIFICATIONS) return;
    try {
      traderNotifications = await window.EPASAR_ADMIN_NOTIFICATIONS.pending(currentProfile);
      renderTraderNotifications();
    } catch (error) {
      document.getElementById('notificationRows').innerHTML = `<tr><td colspan="6">${esc(friendlyError(error))}</td></tr>`;
    }
  }

  document.getElementById('notificationRows')?.addEventListener('click', async event => {
    const button = event.target.closest('[data-send-notification]');
    if (!button) return;
    const row = traderNotifications.find(item => item.id === button.dataset.sendNotification);
    const input = document.querySelector(`[data-notification-phone="${CSS.escape(button.dataset.sendNotification)}"]`);
    const phone = window.EPASAR_ADMIN_NOTIFICATIONS.normalizePhone(input?.value);
    if (!phone) { alert('Masukkan nomor WhatsApp pedagang yang valid.'); input?.focus(); return; }
    const popup = window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(window.EPASAR_ADMIN_NOTIFICATIONS.message(row))}`, '_blank');
    if (!popup) { alert('WhatsApp tidak dapat dibuka. Izinkan pop-up lalu coba kembali.'); return; }
    button.disabled = true;
    try {
      await window.EPASAR_ADMIN_NOTIFICATIONS.markOpened(row, currentProfile, phone);
      traderNotifications = traderNotifications.filter(item => item.id !== row.id);
      renderTraderNotifications();
    } catch (error) {
      button.disabled = false;
      alert(friendlyError(error));
    }
  });

  async function renderRoleWorkspace(profile) {
    currentProfile = profile;
    const isMarket = profile.role === 'MARKET_HEAD';
    const isKadis = profile.role === 'KADIS';
    const name = profile.displayName || profile.position || profile.role;
    const marketNames = (profile.marketIds || []).map(id => window.EPASAR?.marketById(id)?.name || id).join(', ');
    const primaryMarketId = profile.marketId || profile.marketIds?.[0] || '';
    if (primaryMarketId) window.EPASAR_MARKET_THEME?.apply(document.documentElement, primaryMarketId, marketNames);
    const subtitle = isMarket 
      ? `Kepala Pasar — ${marketNames || 'Pasar Rakyat Kabupaten Pinrang'}`
      : 'Pimpinan Eksekutif Dinas Perindag-ESDM Kabupaten Pinrang';
    
    document.getElementById('adminUser').textContent = `${name} · ${subtitle}`;
    workspace.hidden = false;
    message.hidden = true;

    if (isMarket) {
      workspace.innerHTML = `
        <div class="kpi-grid dashboard-kpis" style="margin-bottom: 24px;">
          <article class="kpi kpi-soft-blue" data-market-kpi="kpiMarketTraders" title="Klik untuk rincian pedagang di pasar ini"><small>Pedagang Terdaftar</small><strong id="kpiMarketTraders">...</strong><p>${marketNames || 'Pasar Penugasan'}</p></article>
          <article class="kpi kpi-soft-amber" data-market-kpi="kpiMarketPending" title="Klik untuk klaim menunggu verifikasi fisik"><small>Menunggu Verifikasi</small><strong id="kpiMarketPending">...</strong><p>Klaim perlu ke lapangan</p></article>
          <article class="kpi kpi-soft-green" data-market-kpi="kpiMarketVerified" title="Klik untuk unit tempat sah terverifikasi"><small>Unit Sah Terverifikasi</small><strong id="kpiMarketVerified">...</strong><p>Kios/Los/Lapak aktif</p></article>
          <article class="kpi kpi-soft-rose" data-market-kpi="kpiMarketConflict" title="Klik untuk sengketa unit tempat"><small>Konflik / Sengketa</small><strong id="kpiMarketConflict">...</strong><p>Perlu mediasi</p></article>
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
                <p class="notice"><strong>ALUR KERJA</strong><br>Antrean verifikasi adalah tugas aktif Anda. <strong>Semua data pasar:</strong> hanya daftar referensi untuk pencarian dan pemeriksaan riwayat.</p>
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
          <article class="kpi kpi-soft-blue" data-kadis-kpi="kpiKadisTraders" title="Klik untuk rincian sebaran pedagang di 11 pasar"><small>Total Pedagang Terdata</small><strong id="kpiKadisTraders">...</strong><p>11 Pasar se-Kab. Pinrang</p></article>
          <article class="kpi kpi-soft-amber" data-kadis-kpi="kpiKadisPending" title="Klik untuk berkas menunggu persetujuan Kadis"><small>Menunggu Persetujuan Kadis</small><strong id="kpiKadisPending">...</strong><p>Siap diputuskan & TTE</p></article>
          <article class="kpi kpi-soft-green" data-kadis-kpi="kpiKadisIssued" title="Klik untuk SKPT resmi yang telah diterbitkan"><small>SKPT Resmi Diterbitkan</small><strong id="kpiKadisIssued">...</strong><p>Tervalidasi TTE Elektronik</p></article>
          <article class="kpi kpi-soft-cyan" data-kadis-kpi="kpiKadisNonMarket" title="Klik untuk rincian pedagang non-pasar / mandiri"><small>Pedagang Non-Pasar</small><strong id="kpiKadisNonMarket">...</strong><p>Mandiri Luar Pasar</p></article>
          <article class="kpi kpi-soft-purple" data-kadis-kpi="kpiKadisMarkets" title="Klik untuk direktori 11 pasar resmi & jadwal aktif"><small>Unit Pasar Resmi Terkelola</small><strong id="kpiKadisMarkets">11 Pasar</strong><p>Jadwal Operasional Dinamis</p></article>
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
        const [totalTraders, pendingCount, issuedCount, pendingAppsSnap, stats] = await Promise.all([
          count('traders'),
          count('skpt_applications', 'status', '==', 'KADIS_REVIEW'),
          count('skpt_applications', 'status', '==', 'ISSUED'),
          window.db.collection('skpt_applications').where('status', '==', 'KADIS_REVIEW').limit(8).get(),
          getPublicStatsSummary()
        ]);

        document.getElementById('kpiKadisTraders').textContent = totalTraders;
        document.getElementById('kpiKadisPending').textContent = pendingCount;
        document.getElementById('kpiKadisIssued').textContent = issuedCount;
        const kpiKadisNonMarketEl = document.getElementById('kpiKadisNonMarket');
        if (kpiKadisNonMarketEl) {
          const projectedCount = Number(stats?.nonMarketTraders);
          if (Number.isFinite(projectedCount)) kpiKadisNonMarketEl.textContent = projectedCount;
          else kpiKadisNonMarketEl.textContent = (await getNonMarketTradersData()).length;
        }
        const kpiMarketsEl = document.getElementById('kpiKadisMarkets');
        if (kpiMarketsEl) kpiMarketsEl.textContent = '11 Pasar';

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
    const allowedMarkets = currentProfile?.role === 'MARKET_ADMIN'
      ? markets.filter(market => (currentProfile.marketIds || []).includes(market.id))
      : markets;
    allowedMarkets.forEach(m => {
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

  async function getNonMarketTradersData(options = {}) {
    const force = options.force === true;
    const now = Date.now();
    if (!force && nonMarketCache.rows && nonMarketCache.expiresAt > now) return nonMarketCache.rows;
    if (nonMarketCache.promise) return nonMarketCache.promise;

    nonMarketCache.promise = (async () => {
      try {
        const [tradersSnap, claimsSnap, bizSnap] = await Promise.all([
          window.db.collection('traders').limit(300).get(),
          window.db.collection('market_claims').limit(400).get(),
          window.db.collection('businesses').limit(300).get()
        ]);

        const marketTraderIds = new Set();
        claimsSnap.forEach(d => {
          const cd = d.data();
          if (cd.traderId) marketTraderIds.add(cd.traderId);
        });

        const bizByTrader = new Map();
        bizSnap.forEach(d => {
          const bd = d.data();
          if (bd.traderId && !bizByTrader.has(bd.traderId)) {
            bizByTrader.set(bd.traderId, bd);
          }
        });

        const nonMarketList = [];
        tradersSnap.forEach(d => {
          const td = d.data();
          const tId = td.traderId || d.id;
          const isMarketTrader = marketTraderIds.has(tId);
          const explicitNonMarket = td.marketId === 'NON_MARKET' || td.locationType === 'GENERAL' || td.hasMarketUnit === false;

          if (!isMarketTrader || explicitNonMarket) {
            const biz = bizByTrader.get(tId) || {};
            const token = td.publicToken || td.verificationToken || td.intakeId || tId;
            nonMarketList.push({
            id: d.id,
            traderId: tId,
            displayName: td.displayName || td.name || 'Pelaku Usaha Mandiri',
            nikMasked: td.nikMasked || '7315************',
            phone: td.phone || biz.phone || '',
            businessName: biz.name || td.businessName || 'Usaha Perdagangan Mandiri',
            businessType: biz.type || td.businessType || 'Non-Pasar',
            businessCategory: biz.category || biz.group || 'Umum',
            district: td.district || td.identity?.district || 'Kabupaten Pinrang',
            village: td.village || td.identity?.village || '—',
            address: td.address || td.identity?.address || '',
            registrationCode: td.registrationCode || td.code || tId,
            publicToken: token,
            verificationToken: token,
            status: td.status || 'ACTIVE',
            isNonMarket: true,
            unitType: 'NON_PASAR',
            marketId: 'NON_MARKET',
            marketName: 'Luar Kawasan Pasar (Mandiri)'
            });
          }
        });
        nonMarketCache.rows = nonMarketList;
        nonMarketCache.expiresAt = Date.now() + NON_MARKET_CACHE_TTL_MS;
        return nonMarketList;
      } catch (err) {
        console.warn('Gagal memuat data pedagang non-pasar:', err);
        if (nonMarketCache.rows) return nonMarketCache.rows;
        return [];
      } finally {
        nonMarketCache.promise = null;
      }
    })();
    return nonMarketCache.promise;
  }

  async function loadMetrics(options = {}) {
    if (metricsPromise) return metricsPromise;
    metricsPromise = (async () => {
      const targets = {
        kpiTotalTraders: count('traders', 'status', '==', 'ACTIVE'),
        kpiSubmitted: count('trader_intake', 'status', '==', 'SUBMITTED'),
        kpiMarket: count('market_claims', 'verificationStatus', '==', 'UNVERIFIED'),
        kpiConflict: count('market_claims', 'verificationStatus', '==', 'CONFLICT'),
        kpiKadis: count('skpt_applications', 'status', '==', 'KADIS_REVIEW'),
        kpiIssued: count('skpt_documents', 'status', '==', 'ISSUED'),
        kpiAnnual: count('skpt_annual_validations', 'status', '==', 'PENDING_REVIEW')
      };
      if (currentProfile?.role === 'MARKET_ADMIN') {
        delete targets.kpiSubmitted;
        const marketIds = window.EPASAR_ADMIN_INTAKE.assignedMarketIds(currentProfile);
        const submitted = marketIds.length
          ? await window.db.collection('trader_intake').where('routingMarketIds', 'array-contains-any', marketIds).where('status', '==', 'SUBMITTED').get()
          : { size: 0 };
        const submittedElement = document.getElementById('kpiSubmitted');
        if (submittedElement) submittedElement.textContent = submitted.size;
      }
      await Promise.all(Object.entries(targets).map(async ([id, promise]) => {
        try { document.getElementById(id).textContent = await promise; }
        catch (error) { console.warn(`[e-PASAR] KPI ${id} belum tersedia`, error); document.getElementById(id).textContent = '—'; }
      }));

      const metricLabels = {
        kpiTotalTraders: ['Total Pedagang Aktif', 'Master pedagang resmi', 'Jumlah master pedagang aktif; tidak termasuk pengajuan yang belum disetujui.'],
        kpiSubmitted: ['Pengajuan Baru', 'Belum menjadi master pedagang', 'Berkas berstatus SUBMITTED yang masih menunggu review admin.'],
        kpiMarket: ['Klaim Menunggu Verifikasi', 'Bukan jumlah pedagang atau unit fisik', 'Klaim lokasi atau unit berstatus UNVERIFIED; satu pedagang dapat memiliki lebih dari satu klaim.']
      };
      Object.entries(metricLabels).forEach(([id, text]) => {
        const value = document.getElementById(id);
        const card = value?.closest('.kpi');
        if (value?.previousElementSibling) value.previousElementSibling.textContent = text[0];
        if (value?.nextElementSibling) value.nextElementSibling.textContent = text[1];
        if (card) card.title = text[2];
      });

      try {
        const nonMarketEl = document.getElementById('kpiNonMarketTraders');
        if (nonMarketEl) {
          const stats = await getPublicStatsSummary(options);
          const projectedCount = Number(stats?.nonMarketTraders);
          if (Number.isFinite(projectedCount)) nonMarketEl.textContent = projectedCount;
          else nonMarketEl.textContent = (await getNonMarketTradersData(options)).length;
        }
      } catch (errNm) {
        console.warn('Gagal set KPI non market:', errNm);
      }
    })();
    try { return await metricsPromise; }
    finally { metricsPromise = null; }
  }

  async function load(cursor) {
    setMessage('Memuat antrean…', false);
    try {
      if (!window.EPASAR_FIREBASE_READY) {
        throw new Error('Firebase/Auth belum dikonfigurasi. Akses admin dinonaktifkan.');
      }
      const result = await window.EPASAR_ADMIN_INTAKE.page(currentProfile, cursor);
      currentCursor = result.last || null;
      currentHasMore = result.hasMore;
      rawIntakeList = result.rows;
      filterAndRenderIntake();
      if (currentPage === 1) await loadMetrics();
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

  let currentKpiData = [];
  let currentKpiType = '';
  let activeAdminWaRecord = null;

  async function resolveAdminRecordLegalData(record) {
    if (!record) return record;
    const db = window.db;
    if (!db) return record;
    if (!record.registrationCode && record.applicationId) {
      try {
        const appSnap = await db.collection('skpt_applications').doc(record.applicationId).get();
        if (appSnap.exists) {
          const ad = appSnap.data();
          record.publicToken = record.publicToken || ad.publicToken;
          record.registrationCode = record.registrationCode || ad.registrationCode;
          record.phone = record.phone || ad.applicantSnapshot?.phone;
        }
      } catch (_) {}
    }
    if (!record.registrationCode && record.publicToken) {
      try {
        const psSnap = await db.collection('public_status').doc(record.publicToken).get();
        if (psSnap.exists) {
          const ps = psSnap.data();
          record.registrationCode = record.registrationCode || ps.registrationCode;
        }
      } catch (_) {}
    }
    return record;
  }

  function formatAdminWaMessage(record) {
    const origin = window.location.origin;
    const name = record.displayName || record.applicantSnapshot?.displayName || record.documentSnapshot?.displayName || 'Pelaku Usaha';
    const isNonMarket = record.isNonMarket === true || record.unitType === 'NON_PASAR' || record.marketId === 'NON_MARKET';

    if (isNonMarket) {
      const biz = record.businessName || record.applicantSnapshot?.businessName || 'Usaha Perdagangan Mandiri';
      const loc = record.district ? `${record.district}${record.village && record.village !== '—' ? ' / ' + record.village : ''}` : 'Kabupaten Pinrang';
      const token = record.publicToken || record.verificationToken || record.traderId || record.id;
      const cardUrl = `${origin}/trader-card.html?token=${encodeURIComponent(token)}`;
      const statusUrl = `${origin}/epasar-status.html?code=${encodeURIComponent(record.registrationCode || '')}&token=${encodeURIComponent(token)}`;
      const regCodeText = record.registrationCode ? `🔢 *Nomor Registrasi:*\n${record.registrationCode}\n\n` : '';

      return `*PEMERINTAH KABUPATEN PINRANG*\n*Dinas Perindustrian, Perdagangan, ESDM*\n-------------------------------------------\nYth. Bapak/Ibu *${name}*,\nBerikut rincian legalitas identitas resmi *Pelaku Usaha Mandiri (Non-Pasar Rakyat)* Anda yang telah terdaftar pada sistem satu data e-PASAR:\n\n💼 *Nama Usaha:* ${biz}\n📍 *Lokasi Usaha:* ${loc}\n${regCodeText}Silakan akses & unduh Kartu Pedagang Digital resmi Anda:\n🪪 *Unduh Kartu Pedagang Digital:*\n${cardUrl}\n\n🔍 *Cek Status & Profil Usaha:*\n${statusUrl}\n\n_Catatan: Kartu ini merupakan identitas resmi kepesertaan Satu Data Perdagangan Dinas Perindag-ESDM Kabupaten Pinrang._`;
    }

    const skptNumber = record.number || record.skptNumber || '—';
    const market = record.documentSnapshot?.marketName || record.applicantSnapshot?.marketName || record.marketName || 'Pasar Rakyat Pinrang';
    const unit = `${record.documentSnapshot?.unitType || record.applicantSnapshot?.claimedUnitType || 'Unit'} ${record.documentSnapshot?.unitNumber || record.applicantSnapshot?.claimedUnitNumber || ''}`;
    const business = record.documentSnapshot?.businessType || record.applicantSnapshot?.businessName || 'Usaha Pasar';

    const actualToken = record.verificationToken || record.publicToken;
    const skptUrl = actualToken ? `${origin}/skpt-pdf.html?token=${encodeURIComponent(actualToken)}` : `${origin}/verifikasi-skpt.html`;
    const cardUrl = `${origin}/trader-card.html?token=${encodeURIComponent(record.publicToken || record.verificationToken)}`;
    const statusUrl = `${origin}/epasar-status.html?code=${encodeURIComponent(record.registrationCode || '')}&token=${encodeURIComponent(record.publicToken || record.verificationToken)}`;

    const regCodeText = record.registrationCode ? `🔢 *Nomor Registrasi Pendaftaran:*\n${record.registrationCode}\n\n` : '';
    const tokenText = record.publicToken ? `🔑 *Token Akses Pribadi:*\n${record.publicToken}\n\n` : '';
    const hashText = record.documentHash ? `🛡️ *Kode Hash Dokumen SKPT (SHA-256):*\n${record.documentHash}\n\n` : '';

    return `*PEMERINTAH KABUPATEN PINRANG*\n*Dinas Perindustrian, Perdagangan, ESDM*\n-------------------------------------------\nYth. Bapak/Ibu *${name}*,\nBerikut rincian legalitas resmi izin pemakaian tempat usaha pasar Anda yang telah disahkan:\n\n📋 *Nomor SKPT:* ${skptNumber}\n${regCodeText}${tokenText}${hashText}🏪 *Unit Pasar:* ${market} (${unit})\n💼 *Usaha:* ${business}\n\nSilakan unduh & simpan dokumen digital resmi Anda:\n1. 📄 *Unduh Dokumen SKPT Resmi (PDF):*\n${skptUrl}\n\n2. 🪪 *Unduh Kartu Pedagang Digital:*\n${cardUrl}\n\n3. 🔍 *Cek Status & Verifikasi Digital:*\n${statusUrl}\n\n_Catatan Penting: Harap simpan Nomor Registrasi Pendaftaran dan Token Akses Pribadi ini dengan baik untuk keperluan pembukaan berkas, cetak ulang dokumen, verifikasi lapangan, maupun pengesahan tahunan / perpanjangan SKPT di portal resmi e-PASAR Kabupaten Pinrang._`;
  }

  async function sendAdminWa(record) {
    activeAdminWaRecord = record;
    await resolveAdminRecordLegalData(record);
    let phone = String(record.phone || record.applicantSnapshot?.phone || '').trim().replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);

    if (phone && phone.length >= 10) {
      const text = encodeURIComponent(formatAdminWaMessage(record));
      window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${text}`, '_blank');
    } else {
      const modal = document.getElementById('adminWaModal');
      const input = document.getElementById('adminWaPhoneInput');
      if (input) input.value = phone || '';
      if (modal) modal.hidden = false;
      if (input) setTimeout(() => input.focus(), 100);
    }
  }

  async function openAdminKpi(type, context = {}) {
    currentKpiType = type;
    const modal = document.getElementById('adminKpiModal');
    const titleEl = document.getElementById('adminKpiTitle');
    const subtitleEl = document.getElementById('adminKpiSubtitle');
    const countEl = document.getElementById('adminKpiCount');
    const bodyEl = document.getElementById('adminKpiModalBody');
    const searchInput = document.getElementById('adminKpiSearchInput');
    if (searchInput) searchInput.value = '';

    modal.hidden = false;
    bodyEl.innerHTML = '<div style="text-align:center;padding:30px;color:#64748b;">Memuat data rincian…</div>';

    const titles = {
      kpiTotalTraders: { title: 'Daftar Master Pedagang Aktif', subtitle: 'SATU DATA PEDAGANG KABUPATEN PINRANG' },
      kpiSubmitted: { title: 'Antrean Pendaftaran Baru Masuk', subtitle: 'PENDAFTARAN MENUNGGU TINJAUAN ADMIN' },
      kpiMarket: { title: 'Klaim Menunggu Verifikasi Fisik Pasar', subtitle: 'PEMERIKSAAN KEPALA PASAR' },
      kpiConflict: { title: 'Daftar Unit Tercatat Konflik', subtitle: 'PENANGANAN & KOREKSI LAPANGAN' },
      kpiKadis: { title: 'Permohonan Siap Pengesahan Kadis', subtitle: 'KEPUTUSAN KEPALA DINAS' },
      kpiIssued: { title: 'Dokumen SKPT Resmi Diterbitkan', subtitle: 'DOKUMEN LEGALITAS AKTIF' },
      kpiAnnual: { title: 'Pemeriksaan & Validasi Tahunan', subtitle: 'MONITORING SKPT DUA TAHUN' },
      kpiPage: { title: 'Informasi Paginasi & Navigasi Antrean', subtitle: 'KONTROL ANTREAN PENDAFTARAN' },
      kpiMarketTraders: { title: `Daftar Pedagang di ${context.marketNames || 'Pasar Penugasan'}`, subtitle: 'DATA UNIT PASAR KEPALA PASAR' },
      kpiMarketPending: { title: 'Klaim Menunggu Verifikasi Fisik Lapangan', subtitle: 'ANTREAN VERIFIKASI KEPALA PASAR' },
      kpiMarketVerified: { title: 'Unit Kios, Los & Lapak Sah Terverifikasi', subtitle: 'STATUS HAK PEMAKAIAN SAH' },
      kpiMarketConflict: { title: 'Daftar Kasus Konflik / Sengketa Tempat Usaha', subtitle: 'MEDIASI & TINDAK LANJUT LAPANGAN' },
      kpiKadisTraders: { title: 'Sebaran Pedagang di 11 Pasar Rakyat Resmi', subtitle: 'MONITORING EKSEKUTIF KEPALA DINAS' },
      kpiKadisPending: { title: 'Permohonan SKPT Menunggu Persetujuan Kadis', subtitle: 'BERKAS SIAP TTE ELEKTRONIK' },
      kpiKadisIssued: { title: 'SKPT Resmi Terbit & Tersertifikasi Digital', subtitle: 'LEGALITAS RESMI PEMERINTAH KABUPATEN PINRANG' },
      kpiKadisMarkets: { title: 'Direktori 11 Pasar Rakyat Resmi & Jadwal Operasional Aktif', subtitle: 'MASTER DATABASE RETRIBUSI PASAR PINRANG' },
      kpiNonMarketTraders: { title: 'Daftar Pedagang Non-Pasar (Pelaku Usaha Mandiri)', subtitle: 'SATU DATA PEDAGANG KABUPATEN PINRANG · LUAR KAWASAN PASAR' },
      kpiKadisNonMarket: { title: 'Daftar Pedagang Non-Pasar (Pelaku Usaha Mandiri)', subtitle: 'MONITORING EKSEKUTIF KADIS · PELAKU USAHA MANDIRI' }
    };

    const cfg = titles[type] || { title: 'Rincian Data', subtitle: 'DASHBOARD METRIK' };
    titleEl.textContent = cfg.title;
    subtitleEl.textContent = cfg.subtitle;

    try {
      if (type === 'kpiNonMarketTraders' || type === 'kpiKadisNonMarket') {
        currentKpiData = await getNonMarketTradersData();
      } else if (type === 'kpiIssued' || type === 'kpiKadisIssued') {
        const snap = await window.db.collection('skpt_documents').where('status', '==', 'ISSUED').limit(100).get();
        currentKpiData = [];
        snap.forEach(d => currentKpiData.push({ id: d.id, ...d.data() }));
      } else if (type === 'kpiSubmitted') {
        let query = window.db.collection('trader_intake').where('status', '==', 'SUBMITTED');
        if (currentProfile?.role === 'MARKET_ADMIN') {
          const marketIds = window.EPASAR_ADMIN_INTAKE.assignedMarketIds(currentProfile);
          if (!marketIds.length) { currentKpiData = []; filterAndRenderAdminKpi(); return; }
          query = query.where('routingMarketIds', 'array-contains-any', marketIds);
        }
        const snap = await query.limit(80).get();
        currentKpiData = [];
        snap.forEach(d => currentKpiData.push({ id: d.id, ...d.data() }));
      } else if (type === 'kpiMarket') {
        const snap = await window.db.collection('market_claims').where('verificationStatus', '==', 'UNVERIFIED').limit(80).get();
        currentKpiData = [];
        snap.forEach(d => currentKpiData.push({ id: d.id, ...d.data() }));
      } else if (type === 'kpiConflict') {
        const snap = await window.db.collection('market_claims').where('verificationStatus', '==', 'CONFLICT').limit(80).get();
        currentKpiData = [];
        snap.forEach(d => currentKpiData.push({ id: d.id, ...d.data() }));
      } else if (type === 'kpiKadis' || type === 'kpiKadisPending') {
        const snap = await window.db.collection('skpt_applications').where('status', '==', 'KADIS_REVIEW').limit(100).get();
        currentKpiData = [];
        snap.forEach(d => currentKpiData.push({ id: d.id, ...d.data() }));
      } else if (type === 'kpiTotalTraders' || type === 'kpiKadisTraders') {
        const snap = await window.db.collection('traders').limit(150).get();
        currentKpiData = [];
        snap.forEach(d => currentKpiData.push({ id: d.id, ...d.data() }));
      } else if (type === 'kpiAnnual') {
        const snap = await window.db.collection('skpt_annual_validations').limit(80).get();
        currentKpiData = [];
        snap.forEach(d => currentKpiData.push({ id: d.id, ...d.data() }));
      } else if (type === 'kpiMarketTraders' || type === 'kpiMarketPending' || type === 'kpiMarketVerified' || type === 'kpiMarketConflict') {
        const assignedIds = context.assignedIds || (currentProfile?.marketIds ? currentProfile.marketIds : (currentProfile?.marketId ? [currentProfile.marketId] : []));
        let claims = [];
        if (assignedIds.length > 0) {
          const snaps = await Promise.all(assignedIds.map(mId => window.db.collection('market_claims').where('marketId', '==', mId).limit(100).get()));
          snaps.forEach(snap => snap.forEach(d => claims.push({ id: d.id, ...d.data() })));
        } else {
          const snap = await window.db.collection('market_claims').limit(80).get();
          snap.forEach(d => claims.push({ id: d.id, ...d.data() }));
        }
        if (type === 'kpiMarketPending') {
          currentKpiData = claims.filter(c => c.verificationStatus === 'UNVERIFIED');
        } else if (type === 'kpiMarketVerified') {
          currentKpiData = claims.filter(c => c.verificationStatus === 'VERIFIED');
        } else if (type === 'kpiMarketConflict') {
          currentKpiData = claims.filter(c => c.verificationStatus === 'CONFLICT');
        } else {
          currentKpiData = claims;
        }
      } else if (type === 'kpiKadisMarkets') {
        let schedMap = {};
        try {
          if (window.EPASAR_CONFIG_SERVICE) {
            const s = await window.EPASAR_CONFIG_SERVICE.getSettings();
            schedMap = s?.marketsSchedule || {};
          }
        } catch (_) {}

        const officialList = [
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

        currentKpiData = officialList.map(m => {
          const s = schedMap[m.id];
          let isDaily = true;
          let activeDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
          let scheduleText = 'Setiap Hari (Pasar Harian)';
          let daysCount = 7;

          if (typeof s === 'string') {
            scheduleText = s;
            isDaily = s.toLowerCase().includes('setiap');
          } else if (s && typeof s === 'object') {
            isDaily = s.isDaily !== false;
            activeDays = Array.isArray(s.activeDays) && s.activeDays.length ? s.activeDays : (isDaily ? ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] : []);
            daysCount = isDaily ? 7 : activeDays.length;
            scheduleText = isDaily ? 'Setiap Hari (Pasar Harian)' : (activeDays.join(', ') || 'Belum diatur');
          }

          return {
            id: m.id,
            name: m.name,
            isDaily,
            activeDays,
            daysCount,
            scheduleText
          };
        });
      } else if (type === 'kpiPage') {
        currentKpiData = [{ id: 'page-info', page: currentPage, totalQueue: rawIntakeList.length }];
      }

      filterAndRenderAdminKpi();
    } catch (err) {
      console.error(err);
      bodyEl.innerHTML = `<div style="text-align:center;padding:25px;color:#dc2626;">Gagal memuat rincian: ${esc(err.message)}</div>`;
    }
  }

  function filterAndRenderAdminKpi() {
    const term = (document.getElementById('adminKpiSearchInput')?.value || '').trim().toLowerCase();
    const bodyEl = document.getElementById('adminKpiModalBody');
    const countEl = document.getElementById('adminKpiCount');

    const matching = currentKpiData.filter(item => {
      if (!term) return true;
      const snap = item.documentSnapshot || item.applicantSnapshot || {};
      const name = String(item.displayName || snap.displayName || item.traderDisplayName || item.name || '').toLowerCase();
      const num = String(item.number || item.registrationCode || item.traderId || item.id || '').toLowerCase();
      const mName = String(snap.marketName || item.marketName || item.marketId || item.name || '').toLowerCase();
      const uNum = String(snap.unitNumber || snap.claimedUnitNumber || item.unitNumber || item.claimedUnitNumber || item.submittedUnit || '').toLowerCase();
      const sch = String(item.scheduleText || '').toLowerCase();
      return name.includes(term) || num.includes(term) || mName.includes(term) || uNum.includes(term) || sch.includes(term);
    });

    countEl.textContent = `Menampilkan ${matching.length} dari ${currentKpiData.length} data`;

    if (!matching.length) {
      bodyEl.innerHTML = '<div style="text-align:center;padding:30px;color:#64748b;">Tidak ada data yang sesuai pencarian.</div>';
      return;
    }

    if (currentKpiType === 'kpiIssued' || currentKpiType === 'kpiKadisIssued') {
      bodyEl.innerHTML = `<table class="db-popup-table">
        <thead>
          <tr>
            <th style="width: 36px; text-align: center;">No</th>
            <th>Pedagang</th>
            <th>Pasar & Unit</th>
            <th>Nomor SKPT</th>
            <th style="width: 120px; text-align: center;">Aksi Legalitas</th>
          </tr>
        </thead>
        <tbody>${
        matching.map((r, i) => {
          const snap = r.documentSnapshot || {};
          const token = r.verificationToken || r.publicToken || '';
          const pToken = r.publicToken || token || r.id;
          const issueDateStr = r.issueDate ? new Date(r.issueDate).toLocaleDateString('id-ID') : 'Terbit';
          return `<tr>
            <td style="text-align: center; font-weight: 750; color: #64748b;">${i + 1}</td>
            <td>
              <strong style="color:#0f172a; font-size:0.82rem;">${esc(snap.displayName || r.displayName || r.traderId)}</strong><br>
              <small style="color:#64748b;">${esc(snap.businessType || 'Usaha Pasar')}</small>
            </td>
            <td>
              <strong style="color:#1e293b;">${esc(snap.marketName || r.marketId)}</strong><br>
              <small style="color:#0284c7; font-weight:600;">${esc(snap.unitType || 'Unit')} ${esc(snap.unitNumber || '-')}</small>
            </td>
            <td>
              <div class="db-skpt-cell">
                <span class="db-code-badge" style="font-size:0.68rem;" title="Nomor SKPT Resmi">${esc(r.number)}</span>
                <small style="color:#64748b; font-size:0.65rem;">Terbit: ${esc(issueDateStr)}</small>
              </div>
            </td>
            <td style="text-align: center;">
              <div class="db-icon-actions">
                <a href="skpt-pdf.html?token=${encodeURIComponent(token)}" target="_blank" class="db-action-icon-btn btn-skpt-pdf" title="Cetak Dokumen SKPT Resmi (PDF)" aria-label="Cetak SKPT">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </a>
                <a href="trader-card.html?token=${encodeURIComponent(token || pToken)}" target="_blank" class="db-action-icon-btn btn-trader-card" title="Lihat & Cetak Kartu Pedagang Digital" aria-label="Kartu Pedagang">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                    <circle cx="8" cy="10" r="2"></circle>
                    <path d="M14 9h4m-4 4h4m-8 3h8"></path>
                  </svg>
                </a>
                <button type="button" class="db-action-icon-btn btn-send-wa" data-admin-wa="${esc(r.id)}" title="Kirim Berkas & Tautan ke WhatsApp Pedagang" aria-label="Kirim WhatsApp">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 18.07c-1.5 0-2.97-.4-4.25-1.17l-.3-.18-3.12.82.83-3.04-.2-.32a8.04 8.04 0 0 1-1.23-4.27c0-4.47 3.64-8.11 8.12-8.11 2.17 0 4.21.85 5.74 2.39a8.07 8.07 0 0 1 2.38 5.72c0 4.47-3.65 8.11-8.12 8.11zm4.45-6.08c-.24-.12-1.44-.71-1.66-.79-.23-.08-.39-.12-.56.12-.17.24-.65.79-.8 1-.15.2-.3.24-.54.12-.24-.12-1.03-.38-1.96-1.21-.72-.64-1.21-1.44-1.35-1.68-.15-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02s.87 2.34 1 2.51c.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28z"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>`;
        }).join('')
      }</tbody></table>`;

      bodyEl.querySelectorAll('button[data-admin-wa]').forEach(btn => {
        btn.addEventListener('click', () => {
          const record = matching.find(row => row.id === btn.dataset.adminWa);
          if (record) sendAdminWa(record);
        });
      });
    } else if (currentKpiType === 'kpiNonMarketTraders' || currentKpiType === 'kpiKadisNonMarket') {
      bodyEl.innerHTML = `
        <div style="margin-bottom:12px; font-size:0.78rem; color:#047857; background:#f0fdfa; border:1px solid #99f6e4; padding:10px 14px; border-radius:10px;">
          🏪 <b>Direktori Pelaku Usaha Mandiri (Non-Pasar Rakyat)</b> — Pedagang mandiri di luar 11 pasar rakyat resmi yang terdata dalam basis data terpusat e-PASAR Pinrang. Setiap pedagang berhak memiliki Kartu Digital Pelaku Usaha Mandiri resmi.
        </div>
        <table class="db-popup-table">
          <thead>
            <tr>
              <th style="width: 36px; text-align: center;">No</th>
              <th>Pelaku Usaha</th>
              <th>Usaha & Domisili</th>
              <th>Status & Kategori</th>
              <th style="width: 105px; text-align: center;">Aksi</th>
            </tr>
          </thead>
          <tbody>${
            matching.map((r, i) => {
              const token = r.publicToken || r.traderId;
              return `<tr>
                <td style="text-align: center; font-weight: 750; color: #64748b;">${i + 1}</td>
                <td>
                  <strong style="color:#0f172a; font-size:0.82rem;">${esc(r.displayName)}</strong><br>
                  <small style="color:#64748b;">ID: ${esc(r.traderId)}</small>
                </td>
                <td>
                  <strong style="color:#1e293b;">${esc(r.businessName)}</strong><br>
                  <small style="color:#059669; font-weight:600;">📍 ${esc(r.district)}${r.village && r.village !== '—' ? ' / ' + esc(r.village) : ''}</small>
                </td>
                <td>
                  <span class="db-badge" style="background: linear-gradient(135deg, #0284c7 0%, #16a34a 100%); color:#fff; font-weight:700; font-size:0.68rem; padding:3px 8px; border-radius:99px;">
                    NON-PASAR RAKYAT
                  </span><br>
                  <small style="color:#64748b; font-size:0.65rem;">Pelaku Usaha Mandiri</small>
                </td>
                <td style="text-align: center;">
                  <div class="db-icon-actions">
                    <a href="trader-card.html?token=${encodeURIComponent(token)}" target="_blank" class="db-action-icon-btn btn-trader-card" title="Lihat & Unduh Kartu Pelaku Usaha Mandiri" aria-label="Kartu Pedagang">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                        <circle cx="8" cy="10" r="2"></circle>
                        <path d="M14 9h4m-4 4h4m-8 3h8"></path>
                      </svg>
                    </a>
                    <button type="button" class="db-action-icon-btn btn-send-wa" data-nonmarket-wa="${esc(r.id)}" title="Kirim Kartu & Informasi ke WhatsApp Pedagang" aria-label="Kirim WhatsApp">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 18.07c-1.5 0-2.97-.4-4.25-1.17l-.3-.18-3.12.82.83-3.04-.2-.32a8.04 8.04 0 0 1-1.23-4.27c0-4.47 3.64-8.11 8.12-8.11 2.17 0 4.21.85 5.74 2.39a8.07 8.07 0 0 1 2.38 5.72c0 4.47-3.65 8.11-8.12 8.11zm4.45-6.08c-.24-.12-1.44-.71-1.66-.79-.23-.08-.39-.12-.56.12-.17.24-.65.79-.8 1-.15.2-.3.24-.54.12-.24-.12-1.03-.38-1.96-1.21-.72-.64-1.21-1.44-1.35-1.68-.15-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02s.87 2.34 1 2.51c.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28z"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>`;
            }).join('')
          }</tbody>
        </table>
      `;

      bodyEl.querySelectorAll('button[data-nonmarket-wa]').forEach(btn => {
        btn.addEventListener('click', () => {
          const record = matching.find(row => row.id === btn.dataset.nonmarketWa);
          if (record) sendAdminWa(record);
        });
      });
    } else if (currentKpiType === 'kpiSubmitted') {
      bodyEl.innerHTML = `<table class="db-popup-table"><thead><tr><th>No</th><th>Registrasi</th><th>Nama Pemohon</th><th>Pasar</th><th>Unit Diklaim</th><th>Aksi</th></tr></thead><tbody>${
        matching.map((r, i) => `<tr>
          <td>${i + 1}</td>
          <td><b>${esc(r.registrationCode)}</b><br><small>${r.submittedAt?.toDate ? r.submittedAt.toDate().toLocaleDateString('id-ID') : 'Baru'}</small></td>
          <td>${esc(r.displayName)}<br><small>NIK: ${esc(r.nikMasked || '7315************')}</small></td>
          <td>${esc(r.marketName || r.marketId)}</td>
          <td>${esc(r.claimedUnitType)} ${esc(r.claimedUnitNumber)}</td>
          <td><a href="#pendaftaran" class="button secondary" style="min-height:28px;padding:2px 8px;font-size:0.68rem;text-decoration:none;" onclick="document.getElementById('adminKpiModal').hidden=true;">Periksa Berkas →</a></td>
        </tr>`).join('')
      }</tbody></table>`;
    } else if (currentKpiType === 'kpiMarket' || currentKpiType === 'kpiMarketPending') {
      bodyEl.innerHTML = `<table class="db-popup-table"><thead><tr><th>No</th><th>ID Pedagang</th><th>Pasar</th><th>Unit Diklaim</th><th>Status Verifikasi</th><th>Aksi</th></tr></thead><tbody>${
        matching.map((r, i) => `<tr>
          <td>${i + 1}</td>
          <td><b>${esc(r.traderDisplayName || r.traderId)}</b><br><small>Usaha: ${esc(r.businessName || 'Perdagangan')}</small></td>
          <td>${esc(r.marketId)}</td>
          <td>${esc(r.claimedUnitType || r.unitType || 'KIOS')} ${esc(r.claimedUnitNumber || r.unitNumber || '—')}</td>
          <td><span class="db-badge db-badge-warning">${esc(r.verificationStatus || 'UNVERIFIED')}</span></td>
          <td><a href="market-verification.html" class="button primary" style="min-height:28px;padding:2px 8px;font-size:0.68rem;text-decoration:none;">Buka Verifikasi →</a></td>
        </tr>`).join('')
      }</tbody></table>`;
    } else if (currentKpiType === 'kpiMarketVerified') {
      bodyEl.innerHTML = `<table class="db-popup-table"><thead><tr><th>No</th><th>Pedagang</th><th>Unit Usaha</th><th>Luas</th><th>Status Tempat</th><th>Aksi</th></tr></thead><tbody>${
        matching.map((r, i) => `<tr>
          <td>${i + 1}</td>
          <td><b>${esc(r.traderDisplayName || r.traderId)}</b><br><small>${esc(r.businessName || 'Usaha Sah')}</small></td>
          <td>${esc(r.claimedUnitType || r.unitType || 'KIOS')} ${esc(r.claimedUnitNumber || r.unitNumber || '—')}</td>
          <td>${esc(r.claimedAreaM2 || r.areaM2 || '8')} m²</td>
          <td><span class="db-badge db-badge-success">VERIFIED · SAH</span></td>
          <td><a href="market-verification.html" class="button secondary" style="min-height:28px;padding:2px 8px;font-size:0.68rem;text-decoration:none;">Rincian Fisik →</a></td>
        </tr>`).join('')
      }</tbody></table>`;
    } else if (currentKpiType === 'kpiConflict' || currentKpiType === 'kpiMarketConflict') {
      bodyEl.innerHTML = `<table class="db-popup-table"><thead><tr><th>No</th><th>Unit Sengketa</th><th>Pedagang Pengklaim</th><th>Pasar</th><th>Status</th><th>Aksi Mediasi</th></tr></thead><tbody>${
        matching.map((r, i) => `<tr>
          <td>${i + 1}</td>
          <td><b>${esc(r.claimedUnitType || r.unitType || 'Unit')} ${esc(r.claimedUnitNumber || r.unitNumber || '—')}</b></td>
          <td>${esc(r.traderDisplayName || r.traderId)}<br><small>Klaim ID: ${esc(r.id)}</small></td>
          <td>${esc(r.marketId)}</td>
          <td><span class="db-badge db-badge-danger" style="background:#fee2e2;color:#991b1b;">SENGKETA / KONFLIK</span></td>
          <td><a href="market-verification.html" class="button primary" style="min-height:28px;padding:2px 8px;font-size:0.68rem;text-decoration:none;">Tindak Lanjuti →</a></td>
        </tr>`).join('')
      }</tbody></table>`;
    } else if (currentKpiType === 'kpiKadis' || currentKpiType === 'kpiKadisPending') {
      bodyEl.innerHTML = `<table class="db-popup-table"><thead><tr><th>No</th><th>ID Permohonan</th><th>Pemohon</th><th>Pasar & Unit</th><th>Status</th><th>Aksi Pengesahan</th></tr></thead><tbody>${
        matching.map((r, i) => `<tr>
          <td>${i + 1}</td>
          <td><b>${esc(r.id)}</b><br><small>Pedagang: ${esc(r.traderId)}</small></td>
          <td>${esc(r.applicantSnapshot?.displayName || r.traderDisplayName || 'Pemohon')}<br><small>${esc(r.applicantSnapshot?.businessName || '')}</small></td>
          <td>${esc(r.applicantSnapshot?.marketName || r.marketId)}<br><small>${esc(r.applicantSnapshot?.claimedUnitType || r.unitType)} ${esc(r.applicantSnapshot?.claimedUnitNumber || r.unitNumber)}</small></td>
          <td><span class="db-badge db-badge-info">SIAP KEPUTUSAN</span></td>
          <td><a href="kadis-approval.html?id=${encodeURIComponent(r.id)}" class="button primary" style="min-height:28px;padding:2px 8px;font-size:0.68rem;text-decoration:none;">Tinjau & Setujui Kadis →</a></td>
        </tr>`).join('')
      }</tbody></table>`;
    } else if (currentKpiType === 'kpiKadisMarkets') {
      bodyEl.innerHTML = `
        <div style="margin-bottom:12px; font-size:0.78rem; color:#475569; background:#f0f9ff; border:1px solid #bae6fd; padding:10px 14px; border-radius:10px;">
          🏢 <b>Master 11 Pasar Resmi Kabupaten Pinrang</b> — Data hari pasar aktif tersimpan secara terstruktur (checklist) sebagai basis penarikan retribusi daerah ke depan.
        </div>
        <table class="db-popup-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Kode Pasar</th>
              <th>Nama Pasar Rakyat</th>
              <th>Pola Operasional</th>
              <th>Hari Pasar Aktif</th>
              <th>Hari/Pekan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${matching.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><span style="font-family:monospace; font-weight:700; color:#0369a1;">${esc(r.id)}</span></td>
                <td><b>${esc(r.name)}</b></td>
                <td><span class="db-badge ${r.isDaily ? 'db-badge-success' : 'db-badge-info'}">${r.isDaily ? 'PASAR HARIAN' : 'HARI TERTENTU'}</span></td>
                <td><span style="font-size:0.78rem; font-weight:600; color:#1e293b;">${esc(r.scheduleText)}</span></td>
                <td><b style="color:#0284c7;">${r.daysCount} Hari</b><br><small style="color:#64748b;">per minggu</small></td>
                <td><a href="admin-kustomisasi.html" class="button secondary" style="min-height:28px;padding:2px 8px;font-size:0.68rem;text-decoration:none;">⚙️ Kelola Jadwal</a></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (currentKpiType === 'kpiPage') {
      bodyEl.innerHTML = `
        <div style="padding:20px; text-align:center;">
          <div style="font-size:2.5rem; margin-bottom:10px;">📑</div>
          <h3 style="margin:0 0 8px; color:#1e3a5f;">Navigasi Antrean Pendaftaran Pedagang</h3>
          <p style="color:#64748b; font-size:0.85rem; max-width:480px; margin:0 auto 16px;">
            Saat ini Anda berada di halaman antrean pendaftaran pedagang baru. Sistem menampilkan data berkas secara bertahap (pagination) untuk efisiensi koneksi jaringan.
          </p>
          <div style="display:flex; justify-content:center; gap:10px;">
            <button class="button primary" type="button" onclick="document.getElementById('adminKpiModal').hidden=true; document.getElementById('pendaftaran').scrollIntoView({behavior:'smooth'});">Buka Antrean Berkas Pendaftaran ↓</button>
          </div>
        </div>
      `;
    } else {
      bodyEl.innerHTML = `<table class="db-popup-table"><thead><tr><th>No</th><th>ID</th><th>Nama</th><th>Pasar</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${
        matching.map((r, i) => `<tr>
          <td>${i + 1}</td>
          <td><b>${esc(r.traderId || r.id)}</b></td>
          <td>${esc(r.displayName || r.applicantSnapshot?.displayName || 'Data')}</td>
          <td>${esc(r.primaryMarketId || r.marketId || '—')}</td>
          <td><span class="db-badge db-badge-success">${esc(r.status || 'ACTIVE')}</span></td>
          <td><a href="database-pedagang.html" class="button secondary" style="min-height:28px;padding:2px 8px;font-size:0.68rem;text-decoration:none;">Lihat di Database →</a></td>
        </tr>`).join('')
      }</tbody></table>`;
    }
  }

  function setupKpiInteractions() {
    // Satu-satunya handler kartu KPI. Delegation juga mencakup kartu role yang dibuat dinamis.
    document.addEventListener('click', (e) => {
      const card = e.target.closest('[data-admin-kpi], [data-market-kpi], [data-kadis-kpi]');
      if (!card) return;
      const type = card.dataset.adminKpi || card.dataset.marketKpi || card.dataset.kadisKpi;
      if (type) {
        e.preventDefault();
        openAdminKpi(type);
      }
    });

    const closeKpi = () => { document.getElementById('adminKpiModal').hidden = true; };
    document.getElementById('closeAdminKpiBtn')?.addEventListener('click', closeKpi);
    document.getElementById('closeAdminKpiFooterBtn')?.addEventListener('click', closeKpi);
    document.getElementById('adminKpiModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'adminKpiModal') closeKpi();
    });
    document.getElementById('adminKpiSearchInput')?.addEventListener('input', filterAndRenderAdminKpi);

    const closeWa = () => { document.getElementById('adminWaModal').hidden = true; };
    document.getElementById('closeAdminWaBtn')?.addEventListener('click', closeWa);
    document.getElementById('cancelAdminWaBtn')?.addEventListener('click', closeWa);
    document.getElementById('adminWaModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'adminWaModal') closeWa();
    });
    document.getElementById('submitAdminWaBtn')?.addEventListener('click', () => {
      const input = document.getElementById('adminWaPhoneInput');
      let phone = String(input?.value || '').trim().replace(/\D/g, '');
      if (phone.startsWith('0')) phone = '62' + phone.slice(1);
      if (!phone || phone.length < 10) {
        alert('Masukkan nomor WhatsApp yang valid (contoh: 081234567890).');
        input?.focus();
        return;
      }
      closeWa();
      if (activeAdminWaRecord) {
        const text = encodeURIComponent(formatAdminWaMessage(activeAdminWaRecord));
        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${text}`, '_blank');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeKpi();
        closeWa();
      }
    });
  }

  document.getElementById('refreshButton').addEventListener('click', () => {
    currentPage = 1;
    currentCursor = null;
    cursorHistory.length = 0;
    nonMarketCache.expiresAt = 0;
    publicStatsCache.expiresAt = 0;
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
      const profile = await window.EPASAR_AUTH.requireStaff(['SUPER_ADMIN','DISPERINDAG_ADMIN','TRADE_ADMIN','MARKET_ADMIN','MARKET_HEAD','UPTD_HEAD','KADIS','TECH_ADMIN']);
      currentProfile = profile;
      window.EPASAR_INTERNAL_UI?.setProfile(profile);
      if (profile.role === 'UPTD_HEAD') { location.replace('uptd-approval.html'); return; }
      setupIntakeFilterEvents();
      setupKpiInteractions();
      if (profile.role === 'MARKET_HEAD' || profile.role === 'KADIS') renderRoleWorkspace(profile);
      else { await Promise.all([load(null), loadTraderNotifications()]); }
    } catch (error) {
      workspace.hidden = true;
      setMessage(`${friendlyError(error)} Mengalihkan ke halaman login…`, true);
      setTimeout(() => { location.href = 'login.html'; }, 900);
    }
  }());
}());
