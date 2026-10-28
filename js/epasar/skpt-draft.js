(function () {
  'use strict';
  const esc = value => String(value ?? '—').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const applicationId = new URLSearchParams(location.search).get('id') || '', paper = document.getElementById('paper');
  async function load() {
    try {
      await window.EPASAR_AUTH.requireStaff(['KADIS']);
      if (!/^[A-Za-z0-9_-]{5,160}$/.test(applicationId)) throw new Error('ID permohonan tidak valid.');
      const snapshot = await window.db.collection('skpt_applications').doc(applicationId).get();
      if (!snapshot.exists) throw new Error('Permohonan tidak ditemukan.');
      const application = { id: snapshot.id, ...snapshot.data() };
      if (application.status !== 'TTE_PENDING' || !application.draftNumber || !application.numberReservationId) throw new Error('Nomor draft resmi belum direservasi.');
      if (application.uptdApproval?.decision !== 'APPROVED') throw new Error('Persetujuan Kepala UPTD belum lengkap.');
      const claimSnapshot = await window.db.collection('market_claims').doc(application.claimId).get();
      if (!claimSnapshot.exists || claimSnapshot.data().verificationStatus !== 'VERIFIED') throw new Error('Verifikasi faktual pasar tidak lagi valid.');
      const claim = claimSnapshot.data(), verified = claim.verified || {}, applicant = application.applicantSnapshot || {}, generated = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
      paper.innerHTML = `<div class="watermark">DRAFT — BELUM SAH</div><header class="header"><h2>PEMERINTAH KABUPATEN PINRANG</h2><h2>DINAS PERINDUSTRIAN, PERDAGANGAN, ENERGI DAN SUMBER DAYA MINERAL</h2><p>SURAT KETERANGAN PEMAKAIAN TEMPAT</p></header><div class="warning">DRAFT — BELUM DITANDATANGANI ELEKTRONIK — TIDAK SAH SEBAGAI SKPT</div><h2 style="text-align:center">SURAT KETERANGAN PEMAKAIAN TEMPAT (SKPT)</h2><p style="text-align:center">Nomor reservasi: <strong>${esc(application.draftNumber)}</strong></p><table class="rows"><tbody><tr><td>Nama Pedagang</td><td>: ${esc(applicant.displayName)}</td></tr><tr><td>Jenis Usaha</td><td>: ${esc(applicant.businessName || applicant.businessType)}</td></tr><tr><td>Pasar</td><td>: ${esc(window.EPASAR.marketById(application.marketId)?.name || application.marketId)}</td></tr><tr><td>Jenis Tempat</td><td>: ${esc(verified.unitType || claim.claimedUnitType)}</td></tr><tr><td>Nomor Unit</td><td>: ${esc(verified.unitNumber || claim.claimedUnitNumber)}</td></tr><tr><td>Blok/Lantai</td><td>: ${esc(verified.block || claim.claimedBlock)} / ${esc(verified.floor || claim.claimedFloor)}</td></tr><tr><td>ID Permohonan</td><td>: ${esc(application.id)}</td></tr></tbody></table><p>Dokumen ini hanya menjadi bahan proses TTE melalui sistem resmi. Dokumen sah diterbitkan setelah PDF hasil TTE disimpan, hash diverifikasi, dan penerbitan final dicatat.</p><div class="sign">Pinrang, _____________<br>Kepala Dinas<br><br><br><br><strong>(Tanda Tangan Elektronik Resmi)</strong></div><footer class="footer">DRAFT — BELUM SAH · Application ${esc(application.id)} · Dibuat ${esc(generated)}</footer>`;
      document.getElementById('print').disabled = false;
    } catch (error) { paper.innerHTML = `<div class="watermark">DRAFT — BELUM SAH</div><p>${esc(error.message || 'Draft tidak dapat dibuka.')}</p>`; }
  }
  document.getElementById('print').addEventListener('click', () => window.print()); load();
}());
