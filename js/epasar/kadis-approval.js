(function () {
  'use strict';
  const message = document.getElementById('message'), items = document.getElementById('items');
  const esc = value => String(value ?? '—').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  function notice(text, error = false) { message.textContent = text; message.className = error ? 'admin-message admin-error' : 'admin-message'; }
  async function rows(status) {
    const snapshot = await db.collection('skpt_applications').where('status', '==', status).limit(20).get(), result = [];
    snapshot.forEach(document => result.push({ id: document.id, ...document.data() }));
    await Promise.all(result.map(async application => {
      if (!application.verificationRecordId) return;
      const record = await db.collection('verification_records').doc(application.verificationRecordId).get();
      if (record.exists) application.verificationRecord = { id: record.id, ...record.data() };
    }));
    return result;
  }
  function summary(application) {
    const applicant = application.applicantSnapshot || {};
    return `<div class="decision-summary"><div><small>Pedagang</small><strong>${esc(applicant.displayName || application.traderId)}</strong></div><div><small>Usaha</small><strong>${esc(applicant.businessName || applicant.businessType)}</strong></div><div><small>Lokasi</small><strong>${esc(applicant.marketName || application.marketId)} · ${esc(applicant.claimedUnitType)} ${esc(applicant.claimedUnitNumber)}</strong></div></div>`;
  }
  function comparison(application) {
    const record = application.verificationRecord || {}, before = record.before || {}, after = record.after || {};
    if (!record.id) return '<p class="admin-error">Rekaman perbandingan verifikasi belum tersedia. Jangan menyetujui berkas sebelum data ini diperiksa.</p>';
    const field = (label, original, verified) => `<div><small>${esc(label)}</small><span>${esc(original ?? '—')}</span><b>${esc(verified ?? '—')}</b></div>`;
    return `<section class="kadis-comparison"><header><h3>Data pemohon dan hasil verifikasi</h3><span class="status-badge ${after.conflict ? 'status-rejected' : 'status-verified'}">${after.conflict ? 'KONFLIK' : 'TERVERIFIKASI'}</span></header><div class="kadis-compare-head"><b>DATA PEMOHON</b><b>HASIL VERIFIKASI</b></div>${field('Nomor unit', before.unitNumber, after.unitNumber)}${field('Jenis tempat', before.unitType, after.unitType)}${field('Blok', before.block, after.block)}${field('Lantai', before.floor, after.floor)}${field('Luas', before.areaM2 == null ? '—' : `${before.areaM2} m²`, after.areaM2 == null ? '—' : `${after.areaM2} m²`)}<p><strong>Alasan pemeriksaan:</strong> ${esc(record.reason || 'Tidak dicatat')}</p><small>Petugas: ${esc(record.actorUid || '—')} · ${esc(record.actorRole || '—')}</small></section>`;
  }
  function approvalCard(application) {
    return `<article class="workflow-item"><header><div><p class="eyebrow">KEPUTUSAN KEPALA DINAS</p><h2>Permohonan e-SKPT</h2></div><span class="status-badge status-processing">MENUNGGU KEPUTUSAN</span></header>${summary(application)}${comparison(application)}<p class="compare-note">✓ Review administrasi lengkap<br>✓ Verifikasi faktual pasar tersedia</p><details><summary>Lihat detail proses</summary><p>ID permohonan: ${esc(application.id)}<br>ID pedagang: ${esc(application.traderId)}</p></details><form data-action="approve" data-id="${esc(application.id)}"><label>Catatan keputusan<textarea name="note" required maxlength="500" placeholder="Tuliskan dasar pertimbangan keputusan atau alasan penolakan"></textarea></label><div class="form-actions"><button class="button primary" type="submit" ${application.verificationRecord ? '' : 'disabled'}>Setujui Permohonan</button><button class="button danger" type="button" data-action="reject" ${application.verificationRecord ? '' : 'disabled'}>Tolak Permohonan</button></div></form></article>`;
  }
  function issueCard(application) {
    return `<article class="workflow-item"><header><div><p class="eyebrow">REGISTRASI DOKUMEN UAT</p><h2>Penerbitan e-SKPT Uji Coba</h2></div><span class="status-badge status-warning">MENUNGGU DOKUMEN UAT</span></header>${summary(application)}<p class="notice"><strong>Mode UAT internal.</strong> Dokumen akan memakai QR pengesahan simulasi dan penanda “Dokumen Uji Coba”. Dokumen ini bukan SKPT produksi dan bukan hasil TTE resmi.</p><form data-action="issue" data-id="${esc(application.id)}"><div class="workflow-grid"><label>Nama pada dokumen<input name="displayName" required maxlength="120" value="${esc(application.applicantSnapshot?.displayName || '')}"></label><label>Nomor SKPT UAT<input name="number" required maxlength="80" placeholder="SKPT-UAT-2026-0001"></label><label>Referensi uji coba<input name="reference" required maxlength="300" placeholder="Contoh: UAT-INTERNAL-2026-001"></label></div><div class="form-actions"><button class="button primary" type="submit">Terbitkan Dokumen Uji Coba</button></div></form></article>`;
  }
  let allApplications = [], reviewRows = [], pendingRows = [], currentProfile = null;

  function renderList(list) {
    if (!list.length) {
      items.innerHTML = '<div class="internal-empty"><span>🔍</span><b>Tidak ada permohonan yang sesuai</b><p>Coba sesuaikan kata kunci pencarian atau ganti filter pasar / tahapan.</p></div>';
      return;
    }
    items.innerHTML = list.map(app => app.status === 'KADIS_REVIEW' ? approvalCard(app) : issueCard(app)).join('');
    bindActions();
  }

  function filterApplications() {
    const search = (document.getElementById('kadisSearchInput')?.value || '').trim().toLowerCase();
    const market = document.getElementById('kadisMarketFilter')?.value || 'ALL';
    const stage = document.getElementById('kadisStageFilter')?.value || 'ALL';

    const filtered = allApplications.filter(app => {
      const snap = app.applicantSnapshot || {};
      const matchSearch = !search ||
        (snap.displayName && snap.displayName.toLowerCase().includes(search)) ||
        (snap.businessName && snap.businessName.toLowerCase().includes(search)) ||
        (snap.nik && snap.nik.toLowerCase().includes(search)) ||
        (snap.claimedUnitNumber && snap.claimedUnitNumber.toLowerCase().includes(search)) ||
        (app.id && app.id.toLowerCase().includes(search)) ||
        (app.traderId && app.traderId.toLowerCase().includes(search));

      const matchMarket = market === 'ALL' ||
        app.marketId === market ||
        snap.marketId === market ||
        (snap.marketName && snap.marketName.toLowerCase().includes(market.toLowerCase()));

      const matchStage = stage === 'ALL' || app.status === stage;

      return matchSearch && matchMarket && matchStage;
    });

    const counter = document.getElementById('kadisFilterCounter');
    if (counter) {
      counter.textContent = `Menampilkan ${filtered.length} dari ${allApplications.length} berkas`;
    }

    renderList(filtered);
  }

  function bindActions() {
    items.querySelectorAll('form[data-action]').forEach(form => form.addEventListener('submit', async event => {
      event.preventDefault();
      const application = allApplications.find(row => row.id === form.dataset.id);
      if (!application) return;
      const values = Object.fromEntries(new FormData(form)), applicant = application.applicantSnapshot || {}, approving = form.dataset.action === 'approve';
      if (approving && !application.verificationRecord) return notice('Rekaman verifikasi belum tersedia. Berkas belum dapat disetujui.', true);
      const accepted = await window.EPASAR_INTERNAL_UI.confirm({
        title: approving ? 'Setujui penerbitan e-SKPT?' : 'Terbitkan dokumen e-SKPT?',
        message: `<b>${esc(applicant.displayName || application.traderId)}</b><br>${esc(applicant.marketName || application.marketId)} · ${esc(applicant.claimedUnitType)} ${esc(applicant.claimedUnitNumber)}<br><br>${approving ? 'Setelah disetujui, proses penerbitan dokumen dapat dilanjutkan.' : 'Dokumen akan memperoleh nomor dan tautan verifikasi publik.'}`,
        confirmText: approving ? 'Ya, Setujui' : 'Ya, Terbitkan'
      });
      if (!accepted) return;
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        if (approving) {
          await window.EPASAR_WORKFLOW.approveForTte(application, values, currentProfile);
          notice('Permohonan disetujui dan masuk tahap menunggu pengesahan.');
          allApplications = allApplications.filter(r => r.id !== application.id);
          filterApplications();
        } else {
          const output = await window.EPASAR_WORKFLOW.issue(application, values, currentProfile);
          notice(`SKPT ${output.number} berhasil diterbitkan.`);
          allApplications = allApplications.filter(r => r.id !== application.id);
          filterApplications();
          setTimeout(() => location.href = `skpt-pdf.html?token=${encodeURIComponent(output.verificationToken)}`, 600);
        }
      } catch (error) {
        console.error(error);
        notice('Tindakan belum berhasil diproses. Periksa status berkas dan koneksi, lalu coba kembali.', true);
        submit.disabled = false;
      }
    }));

    items.querySelectorAll('button[data-action="reject"]').forEach(button => button.addEventListener('click', async event => {
      event.preventDefault();
      const form = button.closest('form');
      const application = allApplications.find(row => row.id === form?.dataset.id);
      if (!application) return;
      const note = form.querySelector('[name="note"]')?.value.trim();
      if (!note) {
        notice('Catatan alasan penolakan wajib diisi sebelum menolak permohonan.', true);
        form.querySelector('[name="note"]')?.focus();
        return;
      }
      const applicant = application.applicantSnapshot || {};
      const accepted = await window.EPASAR_INTERNAL_UI.confirm({
        title: 'Tolak permohonan e-SKPT?',
        message: `<b>${esc(applicant.displayName || application.traderId)}</b><br>${esc(applicant.marketName || application.marketId)} · ${esc(applicant.claimedUnitType)} ${esc(applicant.claimedUnitNumber)}<br><br>Permohonan akan ditolak dan berkas tidak diterbitkan. Catatan penolakan akan dicatat secara permanen.`,
        confirmText: 'Ya, Tolak'
      });
      if (!accepted) return;
      button.disabled = true;
      try {
        await window.EPASAR_WORKFLOW.rejectByKadis(application, { note }, currentProfile);
        notice('Permohonan resmi ditolak oleh Kepala Dinas. Dokumen tidak diterbitkan.');
        allApplications = allApplications.filter(r => r.id !== application.id);
        filterApplications();
      } catch (error) {
        console.error(error);
        notice('Penolakan belum berhasil diproses. ' + (error.message || ''), true);
        button.disabled = false;
      }
    }));
  }

  function setupFilterEvents() {
    const searchInput = document.getElementById('kadisSearchInput');
    const marketFilter = document.getElementById('kadisMarketFilter');
    const stageFilter = document.getElementById('kadisStageFilter');
    const resetBtn = document.getElementById('kadisResetFilter');

    if (searchInput) searchInput.addEventListener('input', filterApplications);
    if (marketFilter) marketFilter.addEventListener('change', filterApplications);
    if (stageFilter) stageFilter.addEventListener('change', filterApplications);
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (marketFilter) marketFilter.value = 'ALL';
        if (stageFilter) stageFilter.value = 'ALL';
        filterApplications();
      });
    }
  }

  async function boot() {
    try {
      currentProfile = await window.EPASAR_AUTH.requireStaff(['KADIS', 'SUPER_ADMIN']);
      window.EPASAR_INTERNAL_UI?.setProfile(currentProfile);
      document.getElementById('who').textContent = `${currentProfile.displayName || currentProfile.position || 'Kepala Dinas'} · ruang keputusan final`;
      const [review, pending] = await Promise.all([rows('KADIS_REVIEW'), rows('TTE_PENDING')]);
      reviewRows = review;
      pendingRows = pending;
      allApplications = [...review, ...pending];

      setupFilterEvents();
      filterApplications();
    } catch (error) {
      notice('Ruang keputusan belum dapat dimuat. Periksa akun dan koneksi data.', true);
      console.error(error);
    }
  }

  boot();
}());
