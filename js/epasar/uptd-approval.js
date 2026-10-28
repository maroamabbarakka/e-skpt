(function () {
  'use strict';
  const PAGE_SIZE = 15, $ = id => document.getElementById(id), esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  let profile, rows = [], page = 0;
  function note(text, error) { $('message').textContent = text; $('message').className = error ? 'admin-message admin-error' : 'admin-message'; }
  function visibleRows() { return rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE); }
  function render() {
    const visible = visibleRows();
    $('items').innerHTML = visible.length ? visible.map(application => { const info = application.applicantSnapshot || {}; return `<article class="workflow-item"><header><div><p class="eyebrow">MENUNGGU KEPALA UPTD</p><h2>${esc(info.displayName || application.traderId)}</h2></div><span class="status-badge status-processing">${esc(window.EPASAR.marketById(application.marketId)?.name || application.marketId)}</span></header><p>Unit terverifikasi: ${esc(application.marketUnitId || '—')} · Rekaman: ${esc(application.verificationRecordId || '—')}</p><form data-id="${esc(application.id)}"><label>Catatan keputusan<textarea name="note" required maxlength="500" placeholder="Tuliskan dasar persetujuan atau alasan pengembalian"></textarea></label><div class="form-actions"><button class="button primary" type="submit" data-decision="approve">Teruskan ke Kadis</button><button class="button secondary" type="submit" data-decision="return">Kembalikan ke Kepala Pasar</button></div></form></article>`; }).join('') : '<div class="internal-empty"><b>Tidak ada berkas pada halaman ini.</b></div>';
    $('previous').disabled = page === 0; $('next').disabled = (page + 1) * PAGE_SIZE >= rows.length;
    $('items').querySelectorAll('form[data-id]').forEach(form => form.addEventListener('submit', decide));
  }
  async function decide(event) {
    event.preventDefault(); const form = event.currentTarget, application = rows.find(item => item.id === form.dataset.id), approved = event.submitter?.dataset.decision === 'approve', decisionNote = form.elements.note.value.trim();
    if (!application || !decisionNote) return note('Catatan keputusan wajib diisi.', true);
    if (!confirm(approved ? 'Teruskan berkas ini ke Kepala Dinas?' : 'Kembalikan berkas untuk verifikasi ulang Kepala Pasar?')) return;
    form.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try { await window.EPASAR_WORKFLOW.decideUptd(application, approved, decisionNote, profile); rows = rows.filter(item => item.id !== application.id); if (page * PAGE_SIZE >= rows.length && page > 0) page--; render(); note(approved ? 'Berkas diteruskan ke Kepala Dinas.' : 'Berkas dikembalikan untuk verifikasi ulang.'); }
    catch (error) { note(error.message || 'Keputusan belum berhasil disimpan.', true); form.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
  }
  async function refresh() {
    try {
      if (!profile) profile = await window.EPASAR_AUTH.requireStaff(['UPTD_HEAD']);
      const marketIds = window.EPASAR.assignedMarketIds(profile), regions = [...new Set(marketIds.map(window.EPASAR.marketRegion))];
      if (!marketIds.length || regions.length !== 1 || !regions[0]) throw new Error('Penugasan pasar Kepala UPTD belum valid.');
      $('who').textContent = `${profile.displayName || 'Kepala UPTD'} · Wilayah ${regions[0]} · ${marketIds.length} pasar`;
      const snapshots = await Promise.all(marketIds.map(marketId => window.db.collection('skpt_applications').where('marketId','==',marketId).where('status','==','UPTD_REVIEW').orderBy('updatedAt','asc').limit(100).get()));
      rows = snapshots.flatMap(snapshot => snapshot.docs.map(document => ({ id: document.id, ...document.data() }))).sort((left, right) => (left.updatedAt?.toMillis?.() || 0) - (right.updatedAt?.toMillis?.() || 0));
      page = 0; render(); note(`Memuat ${rows.length} berkas, ${PAGE_SIZE} berkas per halaman.`);
    } catch (error) { note(error.message || 'Antrean UPTD belum dapat dimuat.', true); }
  }
  $('refresh').addEventListener('click', refresh); $('previous').addEventListener('click', () => { if (page > 0) { page--; render(); } }); $('next').addEventListener('click', () => { if ((page + 1) * PAGE_SIZE < rows.length) { page++; render(); } }); refresh();
}());
