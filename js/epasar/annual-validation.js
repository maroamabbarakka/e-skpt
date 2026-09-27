(function () {
  'use strict';
  const message = document.getElementById('message');
  const issuedItems = document.getElementById('issuedItems');
  const pendingItems = document.getElementById('pendingItems');
  const esc = value => String(value ?? '—').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const dateId = value => value ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const yesNo = value => value === true ? 'Ya' : value === false ? 'Tidak' : '—';
  const marketLabel = marketId => { const market = window.EPASAR?.marketById(marketId); return market ? `${market.id} · ${market.name}` : String(marketId || '—'); };
  const notify = (text, isError = false) => { message.textContent = text; message.className = isError ? 'admin-message admin-error' : 'admin-message'; };

  function marketCard(document) {
    const snapshot = document.documentSnapshot || {};
    const year = window.EPASAR_ANNUAL.targetYear(document);
    const returned = document.annualValidation?.status === 'RETURNED';
    const due = window.EPASAR_ANNUAL.dueDate(document);
    const timing = window.EPASAR_ANNUAL.dueState(document);
    return `<article class="annual-item" data-document="${esc(document.id)}"><header><div><h3>${esc(document.number)}</h3><p>${esc(snapshot.displayName)} · ${esc(snapshot.marketName)}</p></div><span class="annual-badge">Tahun ${year}</span></header>
      <div class="annual-meta"><div><b>Unit</b>${esc(snapshot.unitType)} ${esc(snapshot.unitNumber)}</div><div><b>Jenis dagangan</b>${esc(snapshot.businessType)}</div><div><b>Terbit</b>${dateId(document.issueDate)}</div><div><b>Berlaku sampai</b>${dateId(document.validUntil)}</div></div>
      <div class="validation-timeline" aria-label="Linimasa pengesahan"><span class="done">${new Date(document.issueDate).getFullYear()} ✓<small>Diterbitkan</small></span><i></i><span>${year}<small>Pengesahan tahunan</small></span></div><p>${returned ? `<strong>Alasan pengembalian:</strong> ${esc(document.annualValidation.decisionNote)}` : `Jadwal pemeriksaan: ${dateId(due.toISOString())} (${timing === 'UPCOMING' ? 'terjadwal' : 'jatuh tempo'}).`}</p>
      <form><div class="annual-questions">
        <label class="annual-question"><span>Masih menggunakan tempat?</span><span class="annual-options"><label><input type="radio" name="stillUsesPlace" value="yes" required> Ya</label><label><input type="radio" name="stillUsesPlace" value="no"> Tidak</label></span></label>
        <label class="annual-question"><span>Jenis usaha masih sama?</span><span class="annual-options"><label><input type="radio" name="sameBusiness" value="yes" required> Ya</label><label><input type="radio" name="sameBusiness" value="no"> Tidak</label></span></label>
        <label class="annual-question"><span>Unit yang digunakan masih sama?</span><span class="annual-options"><label><input type="radio" name="sameUnit" value="yes" required> Ya</label><label><input type="radio" name="sameUnit" value="no"> Tidak</label></span></label>
      </div><label>Catatan hasil pemeriksaan<textarea name="note" maxlength="500" required placeholder="Tuliskan tanggal/kondisi pemeriksaan dan perubahan yang ditemukan.">${returned ? esc(document.annualValidation.note) : ''}</textarea></label><div class="annual-actions"><button class="button primary" type="submit">${returned ? 'Ajukan ulang pemeriksaan' : 'Kirim untuk ditinjau'}</button></div></form></article>`;
  }

  function reviewCard(row) {
    return `<article class="annual-item" data-validation="${esc(row.id)}"><header><div><h3>${esc(row.number)}</h3><p>Pedagang ${esc(row.traderId)} · Pasar ${esc(marketLabel(row.marketId))}</p></div><span class="annual-badge">MENUNGGU REVIEW</span></header>
      <div class="annual-meta"><div><b>Tahun pengesahan</b>${esc(row.validationYear)}</div><div><b>Masih menggunakan</b>${yesNo(row.stillUsesPlace)}</div><div><b>Usaha sama</b>${yesNo(row.sameBusiness)}</div><div><b>Unit sama</b>${yesNo(row.sameUnit)}</div></div>
      <div class="annual-comparison"><article><h4>Hasil Kepala Pasar</h4><p class="${row.hasChanges ? 'is-alert' : ''}">${row.hasChanges ? 'Ada perubahan yang harus diperiksa.' : 'Tidak ada perubahan dilaporkan.'}</p><p>${esc(row.note)}</p></article><article><h4>Batas keputusan</h4><p>Pengesahan tidak mengubah masa berlaku SKPT. Perubahan data harus diproses melalui workflow koreksi/perubahan terpisah.</p></article></div>
      <label>Catatan keputusan<textarea name="decisionNote" maxlength="500" placeholder="Wajib diisi terutama jika dikembalikan."></textarea></label><div class="annual-actions"><button class="button secondary" data-decision="RETURNED" type="button">Kembalikan</button>${row.hasChanges ? '<span class="is-alert">Selesaikan perubahan data sebelum pengesahan.</span>' : '<button class="button primary" data-decision="VALIDATED" type="button">Sahkan catatan tahunan</button>'}</div></article>`;
  }

  function filterMarketDocs(documents) {
    const term = (document.getElementById('annualMarketSearch')?.value || '').trim().toLowerCase();
    const timingFilter = document.getElementById('annualMarketTimingFilter')?.value || '';

    return documents.filter(doc => {
      const snap = doc.documentSnapshot || {};
      const num = String(doc.number || '').toLowerCase();
      const name = String(snap.displayName || '').toLowerCase();
      const unit = `${snap.unitType || ''} ${snap.unitNumber || ''}`.toLowerCase();
      const matchSearch = !term || num.includes(term) || name.includes(term) || unit.includes(term);

      const returned = doc.annualValidation?.status === 'RETURNED';
      const timing = window.EPASAR_ANNUAL.dueState(doc);
      let matchTiming = true;
      if (timingFilter === 'RETURNED') matchTiming = returned;
      else if (timingFilter === 'DUE') matchTiming = !returned && timing === 'DUE';
      else if (timingFilter === 'UPCOMING') matchTiming = !returned && timing === 'UPCOMING';

      return matchSearch && matchTiming;
    });
  }

  function renderMarketList(documents, profile) {
    const visible = filterMarketDocs(documents);
    const counter = document.getElementById('annualMarketCounter');
    if (counter) counter.textContent = `${visible.length} dari ${documents.length} SKPT`;

    issuedItems.innerHTML = visible.map(marketCard).join('') || '<div class="internal-empty"><span>🔍</span><b>Tidak ada dokumen SKPT yang cocok</b><p>Ubah kata kunci pencarian atau jadwal pemeriksaan.</p></div>';

    issuedItems.querySelectorAll('form').forEach(form => form.addEventListener('submit', async event => {
      event.preventDefault();
      const card = form.closest('[data-document]');
      const document = documents.find(item => item.id === card.dataset.document);
      const data = new FormData(form);
      const input = { stillUsesPlace: data.get('stillUsesPlace') === 'yes', sameBusiness: data.get('sameBusiness') === 'yes', sameUnit: data.get('sameUnit') === 'yes', note: data.get('note') };
      try {
        await window.EPASAR_ANNUAL.submit(document, input, profile);
        notify('Hasil pemeriksaan tersimpan dan menunggu review administrasi.');
        const index = documents.findIndex(item => item.id === document.id);
        if (index !== -1) documents.splice(index, 1);
        renderMarketList(documents, profile);
      } catch (error) {
        notify(error.message, true);
      }
    }));
  }

  function filterAdminPending(rows) {
    const term = (document.getElementById('annualAdminSearch')?.value || '').trim().toLowerCase();
    const changesFilter = document.getElementById('annualAdminChangesFilter')?.value || '';

    return rows.filter(row => {
      const num = String(row.number || '').toLowerCase();
      const trader = String(row.traderId || '').toLowerCase();
      const mLabel = marketLabel(row.marketId).toLowerCase();
      const matchSearch = !term || num.includes(term) || trader.includes(term) || mLabel.includes(term);

      let matchChanges = true;
      if (changesFilter === 'CHANGES') matchChanges = row.hasChanges === true;
      else if (changesFilter === 'NO_CHANGES') matchChanges = !row.hasChanges;

      return matchSearch && matchChanges;
    });
  }

  function renderAdminList(rows, profile) {
    const visible = filterAdminPending(rows);
    const counter = document.getElementById('annualAdminCounter');
    if (counter) counter.textContent = `${visible.length} dari ${rows.length} berkas`;

    pendingItems.innerHTML = visible.map(reviewCard).join('') || '<div class="internal-empty"><span>🔍</span><b>Tidak ada pemeriksaan yang sesuai</b><p>Semua pemeriksaan telah diselesaikan atau sesuaikan kata kunci pencarian.</p></div>';

    pendingItems.querySelectorAll('[data-decision]').forEach(button => button.addEventListener('click', async () => {
      const card = button.closest('[data-validation]');
      const row = rows.find(item => item.id === card.dataset.validation);
      const note = card.querySelector('[name="decisionNote"]').value.trim();
      if (button.dataset.decision === 'RETURNED' && !note) { notify('Tuliskan alasan sebelum mengembalikan pemeriksaan.', true); return; }
      try {
        await window.EPASAR_ANNUAL.decide(row, button.dataset.decision, note, profile);
        notify(button.dataset.decision === 'VALIDATED' ? 'Pengesahan tahunan tercatat tanpa mengubah masa berlaku SKPT.' : 'Pemeriksaan dikembalikan kepada petugas.');
        const index = rows.findIndex(item => item.id === row.id);
        if (index !== -1) rows.splice(index, 1);
        renderAdminList(rows, profile);
      } catch (error) {
        notify(error.message, true);
      }
    }));
  }

  async function boot() {
    try {
      const profile = await window.EPASAR_AUTH.requireStaff(['SUPER_ADMIN', 'DISPERINDAG_ADMIN', 'TRADE_ADMIN', 'MARKET_ADMIN', 'MARKET_HEAD', 'KADIS', 'TECH_ADMIN']);
      window.EPASAR_INTERNAL_UI?.setProfile(profile);
      document.getElementById('who').textContent = `${profile.displayName || profile.position || 'Petugas'} · ${profile.role}`;

      if (profile.role === 'MARKET_HEAD') {
        document.getElementById('marketWorkspace').hidden = false;
        const documents = await window.EPASAR_ANNUAL.listIssued(profile);
        
        const mSearch = document.getElementById('annualMarketSearch');
        const mTiming = document.getElementById('annualMarketTimingFilter');
        const mReset = document.getElementById('annualMarketReset');
        if (mSearch) mSearch.addEventListener('input', () => renderMarketList(documents, profile));
        if (mTiming) mTiming.addEventListener('change', () => renderMarketList(documents, profile));
        if (mReset) {
          mReset.addEventListener('click', () => {
            if (mSearch) mSearch.value = '';
            if (mTiming) mTiming.value = '';
            renderMarketList(documents, profile);
          });
        }

        renderMarketList(documents, profile);
      } else {
        document.getElementById('reviewWorkspace').hidden = false;
        const rows = await window.EPASAR_ANNUAL.listPending(profile);

        const aSearch = document.getElementById('annualAdminSearch');
        const aChanges = document.getElementById('annualAdminChangesFilter');
        const aReset = document.getElementById('annualAdminReset');
        if (aSearch) aSearch.addEventListener('input', () => renderAdminList(rows, profile));
        if (aChanges) aChanges.addEventListener('change', () => renderAdminList(rows, profile));
        if (aReset) {
          aReset.addEventListener('click', () => {
            if (aSearch) aSearch.value = '';
            if (aChanges) aChanges.value = '';
            renderAdminList(rows, profile);
          });
        }

        renderAdminList(rows, profile);
      }
      notify('Data pengesahan tahunan berhasil dimuat.');
    } catch (error) {
      notify('Halaman belum dapat dibuka. Periksa akun, penugasan pasar, dan koneksi data.', true);
      console.error(error);
    }
  }
  boot();
}());
