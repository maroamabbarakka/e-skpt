(function () {
  'use strict';
  const $ = id => document.getElementById(id), items = $('items'), message = $('message');
  const esc = value => String(value ?? '—').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  let profile, applications = [];
  function notice(text, error) { message.textContent = text; message.className = error ? 'admin-message admin-error' : 'admin-message'; }
  async function loadRows(status) { const snapshot = await db.collection('skpt_applications').where('status','==',status).limit(100).get(); return snapshot.docs.map(document => ({ id: document.id, ...document.data() })); }
  function summary(application) { const applicant = application.applicantSnapshot || {}; return `<div class="decision-summary"><div><small>Pedagang</small><strong>${esc(applicant.displayName || application.traderId)}</strong></div><div><small>Usaha</small><strong>${esc(applicant.businessName || applicant.businessType)}</strong></div><div><small>Lokasi</small><strong>${esc(applicant.marketName || application.marketId)} · ${esc(applicant.claimedUnitType)} ${esc(applicant.claimedUnitNumber)}</strong></div></div>`; }
  function reviewCard(application) {
    const approvedByUptd = application.uptdApproval?.decision === 'APPROVED' && application.uptdApproval?.marketId === application.marketId;
    return `<article class="workflow-item"><header><div><p class="eyebrow">KEPUTUSAN KEPALA DINAS</p><h2>Persetujuan dan Reservasi Nomor</h2></div><span class="status-badge ${approvedByUptd ? 'status-verified' : 'status-rejected'}">${approvedByUptd ? 'UPTD MENYETUJUI' : 'PERSETUJUAN UPTD TIDAK VALID'}</span></header>${summary(application)}<p class="notice">Persetujuan Kadis hanya mereservasi nomor dan menyiapkan draft. Dokumen belum resmi sebelum PDF hasil TTE tersimpan di penyimpanan permanen dan lolos pemeriksaan hash.</p><p><b>Catatan UPTD:</b> ${esc(application.uptdApproval?.note || 'Tidak tersedia')}</p><form data-action="approve" data-id="${esc(application.id)}"><label>Catatan keputusan Kadis<textarea name="note" required maxlength="500">Disetujui untuk proses TTE berdasarkan pemeriksaan administrasi, verifikasi faktual, dan persetujuan Kepala UPTD.</textarea></label><div class="form-actions"><button class="button primary" type="submit" ${approvedByUptd ? '' : 'disabled'}>Setujui &amp; Reservasi Nomor</button><button class="button danger" type="button" data-reject="${esc(application.id)}">Tolak Permohonan</button></div></form></article>`;
  }
  function pendingCard(application) { return `<article class="workflow-item"><header><div><p class="eyebrow">MENUNGGU TTE</p><h2>Draft Belum Menjadi Dokumen Resmi</h2></div><span class="status-badge status-warning">BELUM TERBIT</span></header>${summary(application)}<p><b>Nomor reservasi:</b> ${esc(application.draftNumber || 'Tidak tersedia')}</p><p><b>Status penyimpanan:</b> ${esc(application.activeStorage?.syncStatus || application.storageStatus || 'NOT_CONFIGURED')}</p><p class="notice">PDF hasil TTE nantinya dapat disimpan di Google Drive, Firebase Storage, atau server Pemkab. QR dan nomor dokumen tidak bergantung pada lokasi penyimpanan.</p><div class="form-actions"><a class="button primary" href="skpt-draft.html?id=${encodeURIComponent(application.id)}" target="_blank" rel="noopener">Buka Draft TTE</a></div></article>`; }
  function filtered() {
    const search = ($('kadisSearch')?.value || '').trim().toLowerCase(), market = $('kadisMarketFilter')?.value || '', stage = $('kadisStageFilter')?.value || '';
    return applications.filter(application => { const applicant = application.applicantSnapshot || {}, haystack = [application.id, application.traderId, applicant.displayName, applicant.businessName, applicant.claimedUnitNumber].join(' ').toLowerCase(); return (!search || haystack.includes(search)) && (!market || market === 'ALL' || application.marketId === market) && (!stage || stage === 'ALL' || application.status === stage); });
  }
  function render() {
    const visible = filtered(), counter = $('kadisCountText') || $('kadisFilterCounter'); if (counter) counter.textContent = `Menampilkan ${visible.length} dari ${applications.length} permohonan`;
    items.innerHTML = visible.length ? visible.map(application => application.status === 'KADIS_REVIEW' ? reviewCard(application) : pendingCard(application)).join('') : '<div class="internal-empty"><b>Tidak ada permohonan yang sesuai.</b></div>';
    items.querySelectorAll('form[data-action="approve"]').forEach(form => form.addEventListener('submit', approve));
    items.querySelectorAll('[data-reject]').forEach(button => button.addEventListener('click', reject));
  }
  async function approve(event) {
    event.preventDefault(); const form = event.currentTarget, application = applications.find(item => item.id === form.dataset.id), note = form.elements.note.value.trim();
    if (!application || !note) return notice('Catatan keputusan wajib diisi.', true);
    if (!confirm('Reservasi nomor resmi dan lanjutkan berkas ke proses TTE? Dokumen belum akan diterbitkan.')) return;
    const button = form.querySelector('[type="submit"]'); button.disabled = true;
    try { const result = await window.EPASAR_WORKFLOW.approveForTte(application, { note }, profile); applications = applications.filter(item => item.id !== application.id); render(); notice(`Nomor ${result.number} berhasil direservasi. Dokumen masih menunggu proses TTE.`); setTimeout(() => window.open(`skpt-draft.html?id=${encodeURIComponent(application.id)}`, '_blank'), 300); }
    catch (error) { notice(error.message || 'Persetujuan belum berhasil disimpan.', true); button.disabled = false; }
  }
  async function reject(event) {
    const application = applications.find(item => item.id === event.currentTarget.dataset.reject), form = event.currentTarget.closest('form'), note = form?.elements.note.value.trim();
    if (!application || !note) return notice('Isi alasan penolakan pada catatan keputusan.', true);
    if (!confirm('Tolak permohonan ini secara final?')) return;
    event.currentTarget.disabled = true;
    try { await window.EPASAR_WORKFLOW.rejectByKadis(application, { note }, profile); applications = applications.filter(item => item.id !== application.id); render(); notice('Permohonan ditolak dan keputusan dicatat.'); }
    catch (error) { notice(error.message || 'Penolakan belum berhasil disimpan.', true); event.currentTarget.disabled = false; }
  }
  function setupFilters() {
    const market = $('kadisMarketFilter'); if (market && market.options.length <= 1) window.EPASAR.MARKETS.forEach(item => market.add(new Option(item.name, item.id)));
    ['kadisSearch','kadisMarketFilter','kadisStageFilter'].forEach(id => $(id)?.addEventListener(id === 'kadisSearch' ? 'input' : 'change', render));
    ($('kadisResetBtn') || $('kadisResetFilter'))?.addEventListener('click', () => { if ($('kadisSearch')) $('kadisSearch').value = ''; if ($('kadisMarketFilter')) $('kadisMarketFilter').value = ''; if ($('kadisStageFilter')) $('kadisStageFilter').value = ''; render(); });
  }
  async function boot() {
    try { profile = await window.EPASAR_AUTH.requireStaff(['KADIS']); window.EPASAR_INTERNAL_UI?.setProfile(profile); $('who').textContent = `${profile.displayName || profile.position || 'Kepala Dinas'} · ruang keputusan final`; const [review, pending] = await Promise.all([loadRows('KADIS_REVIEW'), loadRows('TTE_PENDING')]); applications = [...review, ...pending]; setupFilters(); render(); }
    catch (error) { notice(error.message || 'Ruang keputusan belum dapat dimuat.', true); }
  }
  boot();
}());
