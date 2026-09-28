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

  async function renderRoleWorkspace(profile) {
    currentProfile = profile;
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

        // Pasang event listener klik interaktif untuk kartu Kepala Pasar
        document.querySelectorAll('[data-market-kpi]').forEach(card => {
          card.addEventListener('click', () => {
            const kpiType = card.dataset.marketKpi;
            openAdminKpi(kpiType, { assignedIds, marketNames });
          });
        });

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
        const [tradersSnap, pendingAppsSnap, issuedAppsSnap] = await Promise.all([
          window.db.collection('traders').limit(300).get(),
          window.db.collection('skpt_applications').where('status', '==', 'KADIS_REVIEW').limit(100).get(),
          window.db.collection('skpt_applications').where('status', '==', 'ISSUED').limit(100).get()
        ]);

        const totalTraders = tradersSnap.size;
        const pendingCount = pendingAppsSnap.size;
        const issuedCount = issuedAppsSnap.size;

        document.getElementById('kpiKadisTraders').textContent = totalTraders;
        document.getElementById('kpiKadisPending').textContent = pendingCount;
        document.getElementById('kpiKadisIssued').textContent = issuedCount;
        const kpiMarketsEl = document.getElementById('kpiKadisMarkets');
        if (kpiMarketsEl) kpiMarketsEl.textContent = '11 Pasar';

        // Pasang event listener klik interaktif untuk kartu Kepala Dinas
        document.querySelectorAll('[data-kadis-kpi]').forEach(card => {
          card.addEventListener('click', () => {
            const kpiType = card.dataset.kadisKpi;
            openAdminKpi(kpiType);
          });
        });

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
    const name = record.displayName || record.applicantSnapshot?.displayName || record.documentSnapshot?.displayName || 'Pedagang';
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
      kpiKadisMarkets: { title: 'Direktori 11 Pasar Rakyat Resmi & Jadwal Operasional Aktif', subtitle: 'MASTER DATABASE RETRIBUSI PASAR PINRANG' }
    };

    const cfg = titles[type] || { title: 'Rincian Data', subtitle: 'DASHBOARD METRIK' };
    titleEl.textContent = cfg.title;
    subtitleEl.textContent = cfg.subtitle;

    try {
      if (type === 'kpiIssued' || type === 'kpiKadisIssued') {
        const snap = await window.db.collection('skpt_documents').where('status', '==', 'ISSUED').limit(100).get();
        currentKpiData = [];
        snap.forEach(d => currentKpiData.push({ id: d.id, ...d.data() }));
      } else if (type === 'kpiSubmitted') {
        const snap = await window.db.collection('trader_intake').where('status', '==', 'SUBMITTED').limit(80).get();
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
      bodyEl.innerHTML = `<table class="db-popup-table"><thead><tr><th>No</th><th>Pedagang</th><th>Pasar & Unit</th><th>Nomor SKPT</th><th>Aksi Legalitas</th></tr></thead><tbody>${
        matching.map((r, i) => {
          const snap = r.documentSnapshot || {};
          const token = r.verificationToken || r.publicToken || '';
          const pToken = r.publicToken || r.photoMediaToken || token;
          return `<tr>
            <td>${i + 1}</td>
            <td><b>${esc(snap.displayName || r.displayName || r.traderId)}</b><br><small>${esc(snap.businessType || 'Usaha Pasar')}</small></td>
            <td>${esc(snap.marketName || r.marketId)}<br><small>${esc(snap.unitType || 'Unit')} ${esc(snap.unitNumber || '-')}</small></td>
            <td><span class="db-badge db-badge-success">${esc(r.number)}</span><br><small>${r.issueDate ? new Date(r.issueDate).toLocaleDateString('id-ID') : 'Terbit'}</small></td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <a href="skpt-pdf.html?token=${encodeURIComponent(token)}" target="_blank" class="button primary" style="min-height:28px;padding:2px 8px;font-size:0.68rem;text-decoration:none;">📄 Cetak SKPT</a>
                <a href="trader-card.html?token=${encodeURIComponent(pToken)}" target="_blank" class="button secondary" style="min-height:28px;padding:2px 8px;font-size:0.68rem;text-decoration:none;">🪪 Kartu</a>
                <button type="button" class="db-btn db-btn-whatsapp" style="min-height:28px;padding:2px 8px;font-size:0.68rem;" data-admin-wa="${esc(r.id)}">💬 WA</button>
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
    // Global delegation klik card KPI untuk semua role (Super Admin, Kepala Pasar, Kepala Dinas)
    document.addEventListener('click', (e) => {
      const card = e.target.closest('[data-admin-kpi], [data-market-kpi], [data-kadis-kpi]');
      if (!card) return;
      const type = card.dataset.adminKpi || card.dataset.marketKpi || card.dataset.kadisKpi;
      if (type) {
        e.preventDefault();
        openAdminKpi(type);
      }
    });

    const kpis = [
      { id: 'kpiTotalTraders', type: 'kpiTotalTraders' },
      { id: 'kpiSubmitted', type: 'kpiSubmitted' },
      { id: 'kpiMarket', type: 'kpiMarket' },
      { id: 'kpiConflict', type: 'kpiConflict' },
      { id: 'kpiKadis', type: 'kpiKadis' },
      { id: 'kpiIssued', type: 'kpiIssued' },
      { id: 'kpiAnnual', type: 'kpiAnnual' },
      { id: 'kpiPage', type: 'kpiPage' }
    ];

    kpis.forEach(item => {
      const el = document.getElementById(item.id);
      const article = el?.closest('.kpi');
      if (article) {
        article.style.cursor = 'pointer';
        article.addEventListener('click', () => openAdminKpi(item.type));
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
      currentProfile = profile;
      window.EPASAR_INTERNAL_UI?.setProfile(profile);
      setupIntakeFilterEvents();
      setupKpiInteractions();
      if (profile.role === 'MARKET_HEAD' || profile.role === 'KADIS') renderRoleWorkspace(profile);
      else load(null);
    } catch (error) {
      workspace.hidden = true;
      setMessage(`${friendlyError(error)} Mengalihkan ke halaman login…`, true);
      setTimeout(() => { location.href = 'login.html'; }, 900);
    }
  }());
}());
