(function () {
  'use strict';

  const f = document.getElementById('statusForm');
  const e = document.getElementById('statusError');
  const r = document.getElementById('statusResult');
  const panel = document.getElementById('correctionPanel');
  const cf = document.getElementById('correctionForm');
  const section = document.getElementById('correctionSection');
  const route = document.getElementById('marketRoute');
  const routeWrap = document.getElementById('marketRouteWrap');

  let current = null;
  let privateToken = '';

  const labels = {
    SUBMITTED: 'Pendaftaran Diterima (Menunggu Verifikasi Administrasi)',
    ADMIN_REVIEW: 'Pemeriksaan Berkas oleh Petugas Disperindag',
    MARKET_VERIFICATION: 'Menunggu Verifikasi Faktual Kepala Pasar',
    MARKET_VERIFIED: 'Fisik Unit Terverifikasi',
    UPTD_REVIEW: 'Menunggu Pemeriksaan Kepala UPTD',
    KADIS_REVIEW: 'Menunggu Keputusan Kepala Dinas',
    TTE_PENDING: 'Menunggu Pengesahan Dokumen',
    TTE_UPLOADING: 'PDF TTE Sedang Disinkronkan',
    TTE_UPLOADED: 'PDF TTE Menunggu Penerbitan Final',
    TTE_REJECTED: 'PDF TTE Perlu Diganti',
    ISSUED: 'SKPT Telah Diterbitkan & Sah',
    CORRECTION_REQUIRED: 'Perlu Perbaikan / Klarifikasi Berkas',
    REJECTED: 'Pendaftaran Ditolak',
    REGISTERED: 'Pendataan Selesai (Non-Pasar)'
  };

  function esc(val) {
    return String(val ?? '—').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function statusResult(data) {
    clear(r);
    const isIssued = data.status === 'ISSUED';
    const statusText = labels[data.status] || String(data.status || 'Status Terdaftar');

    let badgeClass = 'status-processing';
    if (isIssued) badgeClass = 'status-verified';
    else if (data.status === 'CORRECTION_REQUIRED') badgeClass = 'status-warning';
    else if (data.status === 'REJECTED') badgeClass = 'status-rejected';

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; gap:8px; flex-wrap:wrap;">
        <span class="status-badge ${badgeClass}" style="font-size:0.78rem; padding:5px 12px; border-radius:99px;">${esc(statusText)}</span>
        <small style="color:#64748b; font-weight:700;">No. Reg: ${esc(data.registrationCode || data.number)}</small>
      </div>
      <h2 style="margin:4px 0 10px; color:#0f172a; font-size:1.35rem;">${esc(data.displayName || 'Pedagang Terdaftar')}</h2>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; margin-bottom:14px; font-size:0.88rem; color:#334155; line-height:1.6;">
        <div><strong>Tempat Usaha:</strong> ${esc(data.marketName || 'Pasar Rakyat')} · ${esc(data.claimedUnitType || 'Unit')} ${esc(data.claimedUnitNumber || '')}</div>
        ${data.businessType ? `<div><strong>Jenis Usaha:</strong> ${esc(data.businessType)}</div>` : ''}
        ${data.validUntil ? `<div><strong>Masa Berlaku:</strong> sampai ${new Date(data.validUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>` : ''}
      </div>
    `;

    if (data.reviewMessage) {
      html += `<div class="notice" style="margin-bottom:14px; font-size:0.88rem;">${esc(data.reviewMessage)}</div>`;
    }

    if (Array.isArray(data.correctionSections) && data.correctionSections.length) {
      html += `<p style="color:#b42318; font-weight:700; font-size:0.85rem; margin-bottom:12px;">Bagian berkas yang perlu diperbaiki: ${esc(data.correctionSections.join(', '))}</p>`;
    }

    const isNonMarketTrader = data.status === 'REGISTERED' ||
      data.isNonMarket === true ||
      /mandiri|non-pasar|umum/i.test(data.marketName || '') ||
      (!data.claimedUnitNumber && (!data.marketRoutes || data.marketRoutes.length === 0));

    // Tombol Kartu Pelaku Usaha Mandiri jika Non-Pasar
    if (isNonMarketTrader && (data.publicToken || privateToken)) {
      const cardToken = encodeURIComponent(data.publicToken || privateToken);
      html += `
        <div style="margin-top:18px; padding:16px; background:linear-gradient(135deg, #eff6ff 0%, #ecfdf5 100%); border:1px solid #bbf7d0; border-radius:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <strong style="color:#0f5132; font-size:0.95rem; display:block;">🪪 Kartu Pelaku Usaha Perdagangan Mandiri Siap Diterbitkan</strong>
              <small style="color:#475569;">Kartu identitas resmi e-PASAR dengan gradasi tema Disperindag Pinrang.</small>
            </div>
            <a class="button primary" href="trader-card.html?token=${cardToken}" target="_blank" style="background:linear-gradient(135deg, #0735ce 0%, #0b66ed 45%, #109618 100%); border:none; text-decoration:none; display:inline-flex; align-items:center; gap:8px; font-size:0.86rem; padding:0 20px; min-height:44px; font-weight:700; border-radius:10px; box-shadow:0 4px 14px rgba(7,53,206,0.25);">
              Buka & Cetak Kartu Digital →
            </a>
          </div>
        </div>
      `;
    }

    // Jika sudah terbit (ISSUED), berikan tombol unduh PDF dan cek verifikasi resmi
    if (isIssued && (data.verificationToken || data.number)) {
      const tokenParam = encodeURIComponent(data.verificationToken || '');
      html += `
        <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
          <a class="button primary" href="skpt-pdf.html?token=${tokenParam}" target="_blank" style="text-decoration:none; display:inline-flex; align-items:center; gap:8px; font-size:0.85rem; padding:0 18px; min-height:44px;">
            <svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
            Buka Dokumen e-SKPT Resmi (PDF)
          </a>
          <a class="button secondary" href="trader-card.html?token=${tokenParam}" target="_blank" style="text-decoration:none; display:inline-flex; align-items:center; gap:8px; font-size:0.85rem; padding:0 16px; min-height:44px;">
            🪪 Kartu Pedagang
          </a>
          <a class="button secondary" href="verifikasi-skpt.html?token=${tokenParam}" target="_blank" style="text-decoration:none; display:inline-flex; align-items:center; gap:8px; font-size:0.85rem; padding:0 16px; min-height:44px;">
            <svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            Verifikasi Keabsahan Publik
          </a>
        </div>
      `;
    }

    r.innerHTML = html;
  }

  function routes(rows) {
    if (!route) return;
    clear(route);
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Pilih tempat pasar';
    route.appendChild(empty);
    (rows || []).forEach(row => {
      const option = document.createElement('option');
      option.value = `${String(row.marketId || '')}|${String(row.claimId || '')}`;
      option.textContent = String(row.label || 'Tempat pasar');
      route.appendChild(option);
    });
  }

  function restrictSections(allowed) {
    if (!section) return;
    [...section.options].forEach(option => {
      if (!option.value) return;
      option.hidden = Array.isArray(allowed) && allowed.length && !allowed.includes(option.dataset.adminSection);
    });
  }

  function friendly(err) {
    const detail = String(err?.message || '');
    if (/permission|insufficient/i.test(detail)) {
      return 'Status tidak dapat dibuka. Pastikan Nomor Registrasi dan Token Akses Pribadi dimasukkan dengan benar sesuai data pendaftaran Anda.';
    }
    return detail || 'Layanan status belum dapat diakses. Silakan periksa koneksi dan coba beberapa saat lagi.';
  }

  if (f) {
    f.addEventListener('submit', async ev => {
      ev.preventDefault();
      const submitBtn = f.querySelector('button[type="submit"]');
      const regInput = document.getElementById('registrationCode');
      const tokenInput = document.getElementById('publicToken');

      if (e) {
        e.hidden = true;
        e.textContent = '';
      }
      if (r) r.hidden = true;
      if (panel) panel.hidden = true;

      const codeVal = (regInput?.value || '').trim();
      const tokenVal = (tokenInput?.value || '').trim();

      if (!codeVal && !tokenVal) {
        if (e) {
          e.hidden = false;
          e.textContent = 'Silakan masukkan Nomor Registrasi Pendaftaran dan Token Akses Pribadi Anda.';
        }
        regInput?.focus();
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Memeriksa Status…';
      }

      try {
        privateToken = tokenVal;
        current = await window.EPASAR_STATUS.lookup(codeVal, tokenVal);
        statusResult(current);
        if (r) {
          r.hidden = false;
          r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        routes(current.marketRoutes);
        restrictSections(current.correctionSections);
        if (panel) {
          panel.hidden = current.status !== 'CORRECTION_REQUIRED' || current.canResubmit !== true;
        }
      } catch (err) {
        console.error('[status-ui] lookup error:', err);
        if (e) {
          e.hidden = false;
          e.textContent = friendly(err);
          e.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Periksa Status Sekarang';
        }
      }
    });
  }

  if (section) {
    section.onchange = () => {
      if (routeWrap) {
        routeWrap.hidden = section.value !== 'marketUnit' || route.options.length <= 1;
      }
    };
  }

  if (cf) {
    cf.addEventListener('submit', async ev => {
      ev.preventDefault();
      const m = document.getElementById('correctionMessage');
      if (m) m.textContent = '';
      try {
        if (current?.status !== 'CORRECTION_REQUIRED') {
          throw new Error('Pendaftaran ini tidak sedang menunggu perbaikan.');
        }
        const parts = (route?.value || '').split('|');
        const out = await window.EPASAR_CORRECTION.submit({
          registrationCode: current.registrationCode,
          accessToken: privateToken,
          section: section.value,
          value: document.getElementById('correctionValue').value,
          reason: document.getElementById('correctionReason').value,
          marketId: parts[0] || '',
          claimId: parts[1] || ''
        });
        if (m) {
          m.hidden = false;
          m.style.color = '#126b37';
          m.textContent = `Jawaban perbaikan ${out.requestId} berhasil dikirim dan akan diperiksa oleh petugas admin.`;
        }
        cf.reset();
        if (routeWrap) routeWrap.hidden = true;
      } catch (err) {
        if (m) {
          m.hidden = false;
          m.style.color = '';
          m.textContent = friendly(err);
        }
      }
    });
  }
}());
