(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const intakeId = params.get('id');
  const message = document.getElementById('reviewMessage');
  const form = document.getElementById('reviewForm');
  const marketSection = document.getElementById('marketReview');
  const button = document.getElementById('processIntake');
  let intake = null;
  let profile = null;

  const esc = value => String(value ?? '—').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const maskNik = value => String(value || '').replace(/^(\d{6})\d{6}(\d{4})$/, '$1••••••$2');

  function notice(text, error) {
    message.hidden = false;
    message.className = error ? 'admin-error' : 'admin-message';
    message.textContent = text;
  }

  function summary(target, items) {
    target.innerHTML = items.map(([label, value]) => `<div class="summary-item"><small>${esc(label)}</small><strong>${esc(value || '—')}</strong></div>`).join('');
  }

  async function boot() {
    try {
      profile = await window.EPASAR_AUTH.requireStaff(['SUPER_ADMIN', 'DISPERINDAG_ADMIN', 'TRADE_ADMIN', 'MARKET_ADMIN']);
      window.EPASAR_INTERNAL_UI?.setProfile(profile);
      if (!intakeId) throw new Error('ID pendaftaran tidak tersedia.');
      const snapshot = await db.collection('trader_intake').doc(intakeId).get();
      if (!snapshot.exists) throw new Error('Pendaftaran tidak ditemukan.');
      intake = { id: snapshot.id, ...snapshot.data() };
      const identity = intake.identity || {};
      const businessRows = Array.isArray(intake.businessDrafts) ? intake.businessDrafts : [];
      const business = businessRows[0] || {};
      const allPlaces = businessRows.flatMap(row => (row.locations || []).flatMap(location => location.marketPlaces || []));
      const market = intake.marketDraft || {};

      summary(document.getElementById('identitySummary'), [
        ['Nama', identity.name], ['NIK', maskNik(identity.nik)],
        ['Tempat/Tanggal lahir', [identity.birthPlace, identity.birthDate].filter(Boolean).join(', ')],
        ['WhatsApp', identity.phone], ['Wilayah', [identity.village, identity.district].filter(Boolean).join(', ')],
        ['Alamat', identity.address]
      ]);
      summary(document.getElementById('businessSummary'), [
        ['Nama usaha', business.name], ['Jenis usaha', business.type],
        ['Kelompok/Kategori', [business.group, business.category].filter(Boolean).join(' · ')],
        ['Lokasi usaha', [business.address, business.village, business.district].filter(Boolean).join(', ')],
        ['Jumlah tenaga kerja', business.workerCount],
        ['Perkiraan omzet', business.monthlyRevenue ? `Rp ${Number(business.monthlyRevenue).toLocaleString('id-ID')}` : 'Belum diisi']
      ]);

      if (Number(intake.schemaVersion || 1) >= 2) summary(document.getElementById('businessSummary'), [
        ['Jumlah usaha', businessRows.length],
        ['Daftar usaha', businessRows.map((row,index) => `${index+1}. ${row.name || row.category} (${row.type})`).join(' | ')],
        ['Jumlah lokasi', businessRows.reduce((sum,row) => sum + (row.locations || []).length, 0)],
        ['Tempat pasar', allPlaces.length],
        ['Permohonan SKPT', allPlaces.filter(row => row.applySkpt).length],
        ['Total perkiraan omzet', `Rp ${businessRows.reduce((sum,row)=>sum+Number(row.monthlyRevenue||0),0).toLocaleString('id-ID')}`]
      ]);

      marketSection.hidden = !intake.hasMarketUnit || Number(intake.schemaVersion || 1) >= 2;
      marketSection.querySelectorAll('input,select,textarea').forEach(element => {
        element.disabled = !intake.hasMarketUnit;
      });
      if (intake.hasMarketUnit) {
        for (const name of ['marketName', 'marketId', 'unitType', 'unitNumber', 'block', 'floor', 'areaM2', 'locationHint']) {
          if (form.elements[name]) form.elements[name].value = market[name] ?? '';
        }
      }

      document.getElementById('branchSummary').textContent = Number(intake.schemaVersion || 1) >= 2
        ? `${businessRows.length} usaha, ${businessRows.reduce((sum,row)=>sum+(row.locations||[]).length,0)} lokasi, ${allPlaces.length} tempat pasar, dan ${allPlaces.filter(row=>row.applySkpt).length} permohonan SKPT akan dibentuk serta dirutekan berdasarkan marketId.`
        : intake.hasMarketUnit
        ? (intake.applySkpt
          ? 'Data pedagang, klaim pasar, dan pengajuan SKPT akan dibentuk. Berkas diteruskan ke Kepala Pasar.'
          : 'Data pedagang dan klaim pasar akan dibentuk tanpa pengajuan SKPT. Klaim tetap diteruskan untuk verifikasi faktual.')
        : 'Data pedagang non-pasar akan dibentuk dan pendataan selesai tanpa SKPT.';
      document.getElementById('photoLink').href = `photo-editor.html?intake=${encodeURIComponent(intakeId)}`;

      if (intake.status !== 'SUBMITTED' || intake.traderId) {
        button.disabled = true;
        document.getElementById('confirmReview').disabled = true;
        form.hidden = false;
        notice(`Pendaftaran ini sudah diproses dengan status ${intake.status || 'tidak diketahui'}.`, true);
      } else {
        form.hidden = false;
        message.hidden = true;
      }
    } catch (error) {
      notice(error.message || 'Pendaftaran belum dapat dimuat.', true);
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!intake || button.disabled) return;
    if (!document.getElementById('confirmReview').checked) {
      notice('Centang konfirmasi setelah seluruh data diperiksa.', true);
      return;
    }
    button.disabled = true;
    button.textContent = 'Memproses…';
    notice('Membentuk data induk dan memeriksa duplikasi NIK…');
    try {
      const values = Object.fromEntries(new FormData(form));
      const result = await window.EPASAR_WORKFLOW.createCase(intake, values, profile);
      notice(`Data pedagang berhasil dibentuk dengan ID ${result.traderId}. Status: ${result.status}.`);
      form.querySelectorAll('input,select,textarea,button').forEach(element => { element.disabled = true; });
      setTimeout(() => { location.href = 'admin-epasar.html'; }, 1600);
    } catch (error) {
      notice(error.message || 'Pendaftaran belum dapat diproses.', true);
      button.disabled = false;
      button.textContent = 'Bentuk data pedagang';
    }
  });

  boot();
}());
