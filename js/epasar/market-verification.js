(function () {
  'use strict';

  const message = document.getElementById('message');
  const items = document.getElementById('items');
  const pendingList = document.getElementById('pendingList');
  const pendingSearch = document.getElementById('pendingSearch');
  const directoryItems = document.getElementById('directoryItems');
  const pendingMore = document.getElementById('pendingMore');
  const directoryMore = document.getElementById('directoryMore');
  let currentProfile = null;
  let pendingRows = [];
  let directoryRows = [];
  let pendingCursors = {};
  let directoryCursors = {};
  let selectedClaimId = '';
  const mediaCache = new Map();
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const marketLabel = marketId => {
    const market = window.EPASAR?.marketById(marketId);
    return market ? `${market.id} · ${market.name}` : String(marketId || '—');
  };
  const notify = (text, error = false) => {
    message.hidden = false;
    message.textContent = text;
    message.className = error ? 'admin-message admin-error' : 'admin-message';
  };
  const empty = (title, detail) => `<div class="internal-empty"><span>✓</span><b>${escapeHtml(title)}</b><p>${escapeHtml(detail)}</p></div>`;

  function stateLabel(state) {
    return ({ UNVERIFIED: 'MENUNGGU VERIFIKASI', VERIFIED: 'TERVERIFIKASI', CONFLICT: 'KONFLIK', NOT_FOUND: 'UNIT TIDAK DITEMUKAN', CORRECTION_REQUIRED: 'PERLU KOREKSI', LEGACY_REVIEW: 'PERLU PEMERIKSAAN DATA LAMA' })[state] || state;
  }

  function traderName(claim) {
    return claim.application?.applicantSnapshot?.displayName || claim.traderDisplayName || claim.trader?.displayName || claim.traderId || 'Nama belum tersedia';
  }

  function pendingMatches(claim, term) {
    const application = claim.application?.applicantSnapshot || {};
    return [traderName(claim), claim.traderId, claim.claimedUnitNumber, claim.submittedUnit, application.businessName, application.address]
      .some(value => String(value || '').toLowerCase().includes(term));
  }

  const mediaLabel = type => ({ PROFILE: 'Foto pedagang', EVIDENCE: 'Foto usaha', LOCATION: 'Foto lokasi/unit' })[type] || 'Foto pendukung';

  async function populateMedia(claim) {
    const gallery = items.querySelector(`[data-media-for="${CSS.escape(claim.id)}"]`);
    if (!gallery) return;
    let media = mediaCache.get(claim.id);
    if (!media) {
      media = await window.EPASAR_MARKET_WORKSPACE.claimMedia(claim);
      mediaCache.set(claim.id, media);
    }
    if (selectedClaimId !== claim.id || !gallery.isConnected) return;
    gallery.innerHTML = media.length ? media.map((item, index) => `<figure><button type="button" data-photo="${index}" aria-label="Perbesar ${escapeHtml(mediaLabel(item.mediaType))}"><img src="data:${escapeHtml(item.mime)};base64,${item.dataBase64}" alt="${escapeHtml(mediaLabel(item.mediaType))}"></button><figcaption>${escapeHtml(mediaLabel(item.mediaType))}</figcaption></figure>`).join('') : '<div class="verification-photo-empty"><strong>Foto belum tersedia</strong><span>Data ini belum memiliki foto pedagang, usaha, atau lokasi. Lakukan pencocokan langsung dan minta admin melengkapi bukti bila diperlukan.</span></div>';
    gallery.querySelectorAll('[data-photo]').forEach(button => button.addEventListener('click', () => {
      const item = media[Number(button.dataset.photo)];
      const dialog = document.createElement('dialog');
      dialog.className = 'verification-photo-dialog';
      dialog.innerHTML = `<button type="button" aria-label="Tutup">×</button><img src="data:${escapeHtml(item.mime)};base64,${item.dataBase64}" alt="${escapeHtml(mediaLabel(item.mediaType))}"><strong>${escapeHtml(mediaLabel(item.mediaType))}</strong>`;
      document.body.appendChild(dialog);
      dialog.querySelector('button').addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => dialog.remove());
      dialog.showModal();
    }));
  }

  function setupTabs() {
    const tabs = [
      { button: document.getElementById('pendingTab'), panel: document.getElementById('pendingPanel') },
      { button: document.getElementById('directoryTab'), panel: document.getElementById('directoryPanel') }
    ];
    tabs.forEach(selected => selected.button.addEventListener('click', () => tabs.forEach(tab => {
      const active = tab === selected;
      tab.button.classList.toggle('active', active);
      tab.button.setAttribute('aria-selected', String(active));
      tab.panel.hidden = !active;
    })));
  }

  function renderPending(claims, profile) {
    const term = pendingSearch.value.trim().toLowerCase();
    const visible = claims.filter(claim => pendingMatches(claim, term));
    if (!visible.some(claim => claim.id === selectedClaimId)) selectedClaimId = visible[0]?.id || '';
    pendingList.innerHTML = visible.map(claim => {
      const selected = claim.id === selectedClaimId;
      const unit = `${claim.claimedUnitType || claim.unitType || 'Unit'} ${claim.claimedUnitNumber || claim.submittedUnit || '-'}`;
      return `<button class="pending-queue-item${selected ? ' selected' : ''}" type="button" data-select="${escapeHtml(claim.id)}" aria-pressed="${selected}"><span><strong>${escapeHtml(traderName(claim))}</strong><small>${escapeHtml(claim.traderId || 'ID tidak tersedia')}</small></span><span><b>${escapeHtml(unit)}</b><small>${escapeHtml(marketLabel(claim.marketId))}</small></span><em>${selected ? 'Sedang diperiksa' : 'Periksa'}</em></button>`;
    }).join('') || empty(term ? 'Data tidak ditemukan' : 'Tidak ada klaim baru', term ? 'Ubah kata pencarian untuk melihat antrean lain.' : 'Tidak ada klaim berstatus UNVERIFIED pada pasar yang ditugaskan.');

    pendingList.querySelectorAll('[data-select]').forEach(button => button.addEventListener('click', () => {
      selectedClaimId = button.dataset.select;
      renderPending(claims, profile);
      if (window.innerWidth < 900) items.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));

    const claim = visible.find(row => row.id === selectedClaimId);
    if (!claim) {
      items.innerHTML = empty('Pilih pedagang', 'Pilih salah satu data pada daftar antrean untuk membuka formulir pemeriksaan.');
      return;
    }
    const applicant = claim.application?.applicantSnapshot || {};
    const name = traderName(claim);
    const identityWarning = name === claim.traderId || name === 'Nama belum tersedia';
    items.innerHTML = `<article class="workflow-item verification-card"><header><div><p class="eyebrow">PEDAGANG YANG DIPERIKSA</p><h2>${escapeHtml(name)}</h2><p>ID ${escapeHtml(claim.traderId)} · ${escapeHtml(marketLabel(claim.marketId))}</p></div><span class="status-badge status-warning">BELUM DIVERIFIKASI</span></header><section class="trader-identification${identityWarning ? ' incomplete' : ''}"><div><small>Nama pedagang</small><strong>${escapeHtml(name)}</strong></div><div><small>Usaha</small><strong>${escapeHtml(applicant.businessName || applicant.businessType || 'Belum tersedia')}</strong></div><div><small>Alamat pemohon</small><strong>${escapeHtml(applicant.address || 'Belum tersedia')}</strong></div>${identityWarning ? '<p>Nama belum tersedia pada data lama. Cocokkan ID pedagang dan unit, atau minta admin melengkapi direktori sebelum memverifikasi.</p>' : ''}</section><form data-id="${escapeHtml(claim.id)}"><div class="verification-layout"><section class="claim-panel"><h3>KLAIM PEDAGANG</h3><div class="claim-value">${escapeHtml(claim.claimedUnitType || claim.unitType || 'Unit')} ${escapeHtml(claim.claimedUnitNumber || claim.submittedUnit || '-')}</div><p>Blok ${escapeHtml(claim.claimedBlock || '-')} · Lantai ${escapeHtml(claim.claimedFloor || '-')}</p><p>Luas ${escapeHtml(claim.claimedAreaM2 ?? '-')} m²</p><div class="notice">Cocokkan klaim ini dengan kondisi fisik di pasar.</div></section><section class="result-panel"><h3>HASIL PEMERIKSAAN</h3><div class="workflow-grid"><label>Jenis unit<select name="unitType" required><option value="KIOS" ${claim.claimedUnitType === 'KIOS' ? 'selected' : ''}>Kios</option><option value="LOS" ${claim.claimedUnitType === 'LOS' ? 'selected' : ''}>Los</option><option value="LAPAK" ${claim.claimedUnitType === 'LAPAK' ? 'selected' : ''}>Lapak</option><option value="PELATARAN" ${claim.claimedUnitType === 'PELATARAN' ? 'selected' : ''}>Pelataran</option></select></label><label>Nomor unit<input name="unitNumber" value="${escapeHtml(claim.claimedUnitNumber || claim.submittedUnit || '')}" required></label><label>Blok<input name="block" value="${escapeHtml(claim.claimedBlock || claim.block || '')}"></label><label>Lantai<input name="floor" value="${escapeHtml(claim.claimedFloor || claim.floor || '')}"></label><label>Luas (m²)<input name="areaM2" value="${escapeHtml(claim.claimedAreaM2 ?? claim.areaM2 ?? '')}" type="number" min="0" step="0.01"></label><label>Pengguna aktual<input name="actualUser" value="${escapeHtml(name === 'Nama belum tersedia' ? '' : name)}" maxlength="120"></label></div><label>Alasan hasil pemeriksaan<textarea name="reason" required maxlength="500" placeholder="Contoh: pedagang dan nomor fisik sesuai pemeriksaan lapangan"></textarea></label><label class="check"><input name="conflict" type="checkbox"><span>Ada konflik atau ketidaksesuaian yang perlu diperiksa ulang</span></label></section></div><p class="notice">Perubahan disimpan sebagai jejak sebelum dan sesudah. Data awal tidak ditimpa diam-diam.</p><div class="verification-action"><button class="button primary" type="submit">Simpan Verifikasi</button></div></form></article>`;

    const identityPanel = items.querySelector('.trader-identification');
    identityPanel.insertAdjacentHTML('beforeend', `<div><small>Jenis usaha</small><strong>${escapeHtml(applicant.businessType || 'Belum tersedia')}</strong></div><div><small>ID pedagang</small><strong>${escapeHtml(claim.traderId || 'Belum tersedia')}</strong></div><div><small>ID klaim</small><strong>${escapeHtml(claim.id)}</strong></div>`);
    const form = items.querySelector('form[data-id]');
    form.insertAdjacentHTML('beforebegin', `<section class="verification-evidence"><div><h3>BUKTI VISUAL PENDAFTARAN</h3><p>Gunakan foto untuk mencocokkan orang, usaha, dan lokasi. Foto KTP/KK tidak ditampilkan karena merupakan dokumen administratif terbatas.</p></div><div class="verification-photo-gallery" data-media-for="${escapeHtml(claim.id)}"><div class="verification-photo-loading">Memuat foto terkait…</div></div></section>`);
    populateMedia(claim).catch(error => {
      console.error(error);
      const gallery = items.querySelector(`[data-media-for="${CSS.escape(claim.id)}"]`);
      if (gallery) gallery.innerHTML = '<div class="verification-photo-empty"><strong>Foto gagal dimuat</strong><span>Periksa koneksi lalu pilih kembali data pedagang ini.</span></div>';
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      if (!claim || button.disabled) return;
      button.disabled = true;
      button.textContent = 'Menyimpan…';
      try {
        const values = Object.fromEntries(new FormData(form));
        values.conflict = form.elements.conflict.checked;
        const result = await window.EPASAR_WORKFLOW.verifyClaim(claim, values, profile);
        notify(result.conflict ? 'Konflik unit tercatat. Berkas tidak diteruskan sampai konflik diselesaikan.' : `Unit ${result.unitId} terverifikasi dan berkas diteruskan untuk review Kadis.`);
        pendingRows = pendingRows.filter(row => row.id !== claim.id);
        directoryRows = directoryRows.map(row => row.id === claim.id ? { ...row, state: result.conflict ? 'CONFLICT' : 'VERIFIED', verificationStatus: result.conflict ? 'CONFLICT' : 'VERIFIED' } : row);
        renderDirectory(directoryRows);
        selectedClaimId = '';
        renderPending(pendingRows, profile);
        document.getElementById('pendingCount').textContent = String(pendingRows.length);
      } catch (error) {
        notify(error.message || 'Verifikasi belum dapat disimpan.', true);
        button.disabled = false;
        button.textContent = 'Simpan Verifikasi';
      }
    });
  }

  function renderDirectory(rows) {
    directoryItems.innerHTML = rows.map(row => {
      const name = traderName(row);
      const statusClass = row.state === 'LEGACY_REVIEW' ? 'market-directory-warning' : row.state === 'CONFLICT' ? 'market-directory-danger' : '';
      return `<article class="market-directory-row"><div><small>Pedagang</small><strong>${escapeHtml(name)}</strong><small>${escapeHtml(row.traderId || 'ID tidak tersedia')}</small></div><div><small>Pasar</small><strong>${escapeHtml(marketLabel(row.marketId))}</strong></div><div><small>Unit diklaim</small><strong>${escapeHtml(row.claimedUnitType || row.unitType || 'Unit')} ${escapeHtml(row.claimedUnitNumber || row.submittedUnit || '-')}</strong></div><div><small>Status</small><strong class="${statusClass}">${escapeHtml(stateLabel(row.state))}</strong></div></article>`;
    }).join('') || empty('Belum ada data pasar', 'Belum ditemukan klaim pedagang pada pasar yang ditugaskan.');
  }

  async function loadMore(kind) {
    const button = kind === 'pending' ? pendingMore : directoryMore;
    if (!currentProfile || button.disabled) return;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Memuat…';
    try {
      if (kind === 'pending') {
        const page = await window.EPASAR_MARKET_WORKSPACE.loadPending(currentProfile, pendingCursors);
        pendingCursors = page.cursors;
        pendingRows = [...pendingRows, ...page.rows];
        renderPending(pendingRows, currentProfile);
        pendingMore.hidden = !page.hasMore;
        document.getElementById('pendingCount').textContent = String(pendingRows.length);
      } else {
        const page = await window.EPASAR_MARKET_WORKSPACE.loadDirectory(currentProfile, directoryCursors);
        directoryCursors = page.cursors;
        directoryRows = [...directoryRows, ...page.rows];
        renderDirectory(directoryRows);
        directoryMore.hidden = !page.hasMore;
        document.getElementById('directoryCount').textContent = String(directoryRows.length);
      }
    } catch (error) {
      notify(error.message || 'Halaman data berikutnya belum dapat dimuat.', true);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function boot() {
    setupTabs();
    directoryItems.insertAdjacentHTML('beforebegin', '<div class="directory-explanation"><strong>Daftar referensi pedagang pasar</strong><span>Gunakan daftar ini untuk melihat siapa yang tercatat dan status unitnya. Verifikasi baru hanya dilakukan dari tab “Menunggu verifikasi”; data yang sudah terverifikasi tidak perlu diproses ulang.</span></div>');
    pendingSearch.addEventListener('input', () => renderPending(pendingRows, currentProfile));
    pendingMore.addEventListener('click', () => loadMore('pending'));
    directoryMore.addEventListener('click', () => loadMore('directory'));
    try {
      const profile = await window.EPASAR_AUTH.requireStaff(['MARKET_HEAD']);
      currentProfile = profile;
      window.EPASAR_INTERNAL_UI?.setProfile(profile);
      const marketIds = window.EPASAR_MARKET_WORKSPACE.assignedMarketIds(profile);
      document.getElementById('who').textContent = `${profile.displayName || profile.position || 'Kepala Pasar'} · ${marketIds.map(marketLabel).join(', ') || 'belum memiliki penugasan pasar'}`;
      if (!marketIds.length) {
        notify('Akun belum memiliki pasar yang ditugaskan. Hubungi Super Admin.', true);
        return;
      }
      const data = await window.EPASAR_MARKET_WORKSPACE.load(profile);
      pendingRows = data.pending;
      directoryRows = data.directory;
      pendingCursors = data.pendingCursors;
      directoryCursors = data.directoryCursors;
      pendingMore.hidden = !data.pendingHasMore;
      directoryMore.hidden = !data.directoryHasMore;
      document.getElementById('pendingCount').textContent = String(pendingRows.length);
      document.getElementById('directoryCount').textContent = String(directoryRows.length);
      renderPending(pendingRows, profile);
      renderDirectory(directoryRows);
      notify(`Data berhasil dimuat untuk ${marketIds.length} pasar. Data lama yang statusnya ambigu hanya ditampilkan untuk pemeriksaan dan tidak dapat diverifikasi dari antrean baru.`);
    } catch (error) {
      console.error(error);
      const detail = /index/i.test(String(error?.message || '')) ? 'Index antrean belum tersedia. Hubungi administrator sistem.' : 'Periksa penugasan pasar, koneksi, dan hak akses akun.';
      notify(`Ruang kerja Kepala Pasar belum dapat dimuat. ${detail}`, true);
    }
  }

  boot();
}());
