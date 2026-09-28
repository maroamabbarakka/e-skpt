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
  const formatDateId = v => {
    if (!v) return '';
    const s = String(v).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return s;
  };

  function notice(text, error) {
    message.hidden = false;
    message.className = error ? 'admin-error' : 'admin-message';
    message.textContent = text;
  }

  function summary(target, items) {
    target.innerHTML = items.map(([label, value]) => `<div class="summary-item"><small>${esc(label)}</small><strong>${esc(value || '—')}</strong></div>`).join('');
  }

  const mediaLabel = type => ({ PROFILE: 'Foto pedagang', EVIDENCE: 'Foto usaha', LOCATION: 'Foto lokasi', IDENTITY_KTP: 'KTP (terbatas)', IDENTITY_KK: 'KK (terbatas)' })[type] || type;

  function renderBusinessDetails(businesses) {
    const root = document.getElementById('businessDetails');
    let invalidMarketCount = 0;
    root.innerHTML = businesses.map((business, businessIndex) => {
      const locations = Array.isArray(business.locations) ? business.locations : [];
      return `<article class="business-review-card"><header><div><span>USAHA ${businessIndex + 1}</span><h3>${esc(business.name || business.category || 'Nama usaha belum diisi')}</h3></div><strong>${esc(business.type || 'Jenis belum tersedia')}</strong></header><div class="business-facts"><div><small>Kelompok/kategori</small><b>${esc([business.group, business.category].filter(Boolean).join(' · ') || '—')}</b></div><div><small>Omzet per bulan</small><b>Rp ${Number(business.monthlyRevenue || 0).toLocaleString('id-ID')}</b></div><div><small>Tenaga kerja</small><b>${esc(business.workerCount ?? '—')}</b></div><div><small>Pengeluaran utama</small><b>${esc(business.expense || '—')}</b></div></div>${locations.map((location, locationIndex) => {
        const places = Array.isArray(location.marketPlaces) ? location.marketPlaces : [];
        return `<section class="location-review"><h4>Lokasi ${locationIndex + 1} · ${location.type === 'MARKET' ? 'Pasar' : 'Umum/non-pasar'}</h4><p><b>${esc(location.village || '—')}, ${esc(location.district || '—')}</b><br>${esc(location.address || 'Alamat belum tersedia')}</p>${places.length ? `<div class="place-review-list">${places.map((place, placeIndex) => {
          const market = window.EPASAR.marketById(place.marketId);
          if (!market) invalidMarketCount += 1;
          return `<article class="place-review-card ${market ? '' : 'invalid'}"><div class="place-number">${placeIndex + 1}</div><div><small>Pasar tujuan</small><strong>${esc(market?.name || place.marketName || 'Pasar tidak valid')}</strong><span>${esc(place.marketId || 'ID pasar kosong')}</span></div><div><small>Tempat diklaim</small><strong>${esc(place.unitType || 'Jenis belum diisi')} ${esc(place.unitNumber || 'Nomor belum diisi')}</strong><span>Blok ${esc(place.block || '—')} · Lantai ${esc(place.floor || '—')} · Luas ${esc(place.areaM2 ?? '—')} m²</span></div><div><small>Petunjuk lokasi</small><strong>${esc(place.locationHint || 'Tidak ada petunjuk')}</strong><span class="${place.applySkpt ? 'skpt-yes' : ''}">${place.applySkpt ? 'AJUKAN SKPT' : 'PENDATAAN SAJA'}</span></div></article>`;
        }).join('')}</div>` : '<p class="review-empty">Lokasi ini tidak mempunyai klaim tempat pasar.</p>'}</section>`;
      }).join('') || '<p class="review-empty">Usaha ini tidak mempunyai data lokasi.</p>'}</article>`;
    }).join('') || '<p class="review-empty">Tidak ada rincian usaha.</p>';
    return invalidMarketCount;
  }

  async function renderMedia(intakeId) {
    const root = document.getElementById('mediaGallery');
    const snapshot = await db.collection('trader_media').where('ownerId', '==', intakeId).limit(20).get();
    const media = snapshot.docs.map(document => ({ id: document.id, ...document.data() })).filter(item => item.dataBase64 && item.mime === 'image/webp');
    root.innerHTML = media.map(item => `<figure><button type="button"><img src="data:${esc(item.mime)};base64,${item.dataBase64}" alt="${esc(mediaLabel(item.mediaType))}"></button><figcaption><strong>${esc(mediaLabel(item.mediaType))}</strong><span>${esc(item.width)}×${esc(item.height)} · ${Math.round(Number(item.binaryBytes || 0) / 1024)} KB</span></figcaption></figure>`).join('') || '<p class="review-empty">Tidak ada foto atau dokumen yang tersimpan pada pendaftaran ini.</p>';
    root.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      const dialog = document.createElement('dialog');
      dialog.className = 'admin-media-dialog';
      dialog.innerHTML = `<button type="button" aria-label="Tutup">×</button>${button.innerHTML}`;
      document.body.appendChild(dialog);
      dialog.querySelector('button').addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => dialog.remove());
      dialog.showModal();
    }));
  }

  async function renderCorrections() {
    const root = document.getElementById('correctionHistory');
    const rows = await window.EPASAR_INTAKE_REVIEW.corrections(intake.registrationCode);
    root.hidden = !rows.length;
    root.innerHTML = rows.length ? `<h3>Jawaban/koreksi dari pedagang</h3>${rows.map(row => `<article><strong>${esc(row.section)}</strong><p>${esc(row.value)}</p><small>Alasan: ${esc(row.reason)} · Status ${esc(row.status)}</small></article>`).join('')}` : '';
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
      const officialMarket = document.getElementById('officialMarket');
      officialMarket.innerHTML = '<option value="">Pilih pasar dari master</option>' + window.EPASAR.MARKETS.map(item => `<option value="${esc(item.id)}">${esc(item.name)} — ${esc(item.id)}</option>`).join('');
      officialMarket.addEventListener('change', () => { form.elements.marketName.value = window.EPASAR.marketById(officialMarket.value)?.name || ''; });

      summary(document.getElementById('identitySummary'), [
        ['Nama', identity.name], ['NIK', maskNik(identity.nik)],
        ['Tempat/Tanggal lahir', [identity.birthPlace, formatDateId(identity.birthDate)].filter(Boolean).join(', ')],
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
      const invalidMarketCount = renderBusinessDetails(businessRows);
      await renderCorrections();
      await renderMedia(intake.id).catch(error => {
        console.error(error);
        document.getElementById('mediaGallery').innerHTML = '<p class="review-empty">Lampiran tidak dapat dimuat. Jangan proses sebelum akses lampiran diperiksa.</p>';
        button.disabled = true;
      });

      const isV2 = Number(intake.schemaVersion || 1) >= 2;
      marketSection.hidden = !intake.hasMarketUnit || isV2;
      marketSection.querySelectorAll('input,select,textarea').forEach(element => {
        element.disabled = !intake.hasMarketUnit || isV2;
      });
      if (intake.hasMarketUnit && !isV2) {
        for (const name of ['marketName', 'marketId', 'unitType', 'unitNumber', 'block', 'floor', 'areaM2', 'locationHint']) {
          if (form.elements[name]) form.elements[name].value = market[name] ?? '';
        }
        officialMarket.dispatchEvent(new Event('change'));
      }

      document.getElementById('branchSummary').textContent = Number(intake.schemaVersion || 1) >= 2
        ? `${businessRows.length} usaha, ${businessRows.reduce((sum,row)=>sum+(row.locations||[]).length,0)} lokasi, ${allPlaces.length} tempat pasar, dan ${allPlaces.filter(row=>row.applySkpt).length} permohonan SKPT akan dibentuk serta dirutekan berdasarkan marketId.`
        : intake.hasMarketUnit
        ? (intake.applySkpt
          ? 'Data pedagang, klaim pasar, dan pengajuan SKPT akan dibentuk. Berkas diteruskan ke Kepala Pasar.'
          : 'Data pedagang dan klaim pasar akan dibentuk tanpa pengajuan SKPT. Klaim tetap diteruskan untuk verifikasi faktual.')
        : 'Data pedagang non-pasar akan dibentuk dan pendataan selesai tanpa SKPT.';
      document.getElementById('photoLink').href = `photo-editor.html?intake=${encodeURIComponent(intakeId)}`;

      if (!['SUBMITTED', 'CORRECTION_REQUIRED'].includes(intake.status) || intake.traderId) {
        button.disabled = true;
        document.getElementById('confirmReview').disabled = true;
        form.hidden = false;
        notice(`Pendaftaran ini sudah diproses dengan status ${intake.status || 'tidak diketahui'}.`, true);
      } else {
        form.hidden = false;
        if (invalidMarketCount) {
          button.disabled = true;
          document.getElementById('confirmReview').disabled = true;
          notice(`${invalidMarketCount} klaim memakai pasar yang tidak cocok dengan master pasar. Data tidak dapat diproses sebelum diperbaiki.`, true);
        } else message.hidden = true;
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

  async function decide(action) {
    if (!intake) return;
    const reason = document.getElementById('decisionReason').value.trim();
    const sections = [...document.getElementById('decisionSections').selectedOptions].map(option => option.value);
    const label = action === 'REJECTED' ? 'menolak pendaftaran' : 'mengembalikan data untuk diperbaiki';
    if (reason.length < 10 || !sections.length) return notice('Pilih bagian bermasalah dan tuliskan alasan yang spesifik minimal 10 karakter.', true);
    const accepted = await window.EPASAR_INTERNAL_UI.confirm({ title: action === 'REJECTED' ? 'Tolak pendaftaran?' : 'Kembalikan kepada pedagang?', message: `Anda akan ${label}. Alasan ini akan terlihat pada halaman status pedagang.`, confirmText: action === 'REJECTED' ? 'Ya, Tolak' : 'Ya, Kembalikan' });
    if (!accepted) return;
    const controls = [document.getElementById('returnIntake'), document.getElementById('rejectIntake'), button];
    controls.forEach(control => { control.disabled = true; });
    try {
      const result = await window.EPASAR_INTAKE_REVIEW.decide(intake, profile, { action, reason, sections });
      notice(result.status === 'REJECTED' ? 'Pendaftaran ditolak. Alasan sudah tersedia pada halaman status pedagang.' : 'Pendaftaran dikembalikan. Pedagang dapat melihat alasan dan mengirim jawaban koreksi melalui halaman status.');
      setTimeout(() => { location.href = 'admin-epasar.html'; }, 1500);
    } catch (error) {
      notice(error.message || 'Keputusan belum dapat disimpan.', true);
      controls.forEach(control => { control.disabled = false; });
    }
  }
  document.getElementById('returnIntake').addEventListener('click', () => decide('CORRECTION_REQUIRED'));
  document.getElementById('rejectIntake').addEventListener('click', () => decide('REJECTED'));

  boot();
}());
