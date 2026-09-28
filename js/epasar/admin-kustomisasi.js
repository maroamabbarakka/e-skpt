/**
 * admin-kustomisasi.js
 * Logika Pengaturan Kustomisasi Penuh (Full Custom) untuk Super Admin & Kadis
 * e-PASAR Kabupaten Pinrang
 */
(function () {
  'use strict';

  let currentProfile = null;
  let currentSettings = null;

  function notice(text, error = false) {
    const el = document.getElementById('customNotice');
    if (!el) return;
    el.textContent = text;
    el.className = error ? 'admin-message admin-error' : 'admin-message';
    el.hidden = !text;
    if (text) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function setStatus(text, isSaving = false) {
    const bar = document.getElementById('customStatusBar');
    if (!bar) return;
    bar.innerHTML = isSaving
      ? `<span style="color:#2563eb;">⏳</span> <span>${text}</span>`
      : `<span style="color:#16a34a;">✓</span> <span>${text}</span>`;
  }

  // TAB SWITCHER
  function setupTabs() {
    const tabs = document.querySelectorAll('.custom-tab-btn');
    const panes = document.querySelectorAll('.custom-tab-pane');

    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => {
          p.classList.remove('active');
          p.style.display = 'none';
        });

        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        const targetPane = document.getElementById(targetId);
        if (targetPane) {
          targetPane.classList.add('active');
          targetPane.style.display = 'block';
        }
      });
    });
  }

  // LIVE CARD PREVIEW
  function setupLiveCardPreview() {
    const cardEl = document.getElementById('liveCard');
    const swatches = document.querySelectorAll('.theme-swatch');
    const themeInput = document.getElementById('cardThemeValue');

    swatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        swatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');

        const theme = swatch.getAttribute('data-theme');
        themeInput.value = theme;
        cardEl.className = `live-trader-card theme-${theme}`;
      });
    });

    const titleInput = document.getElementById('cardHeaderTitle');
    const prevTitle = document.getElementById('prevCardTitle');
    if (titleInput && prevTitle) {
      titleInput.addEventListener('input', () => {
        prevTitle.textContent = titleInput.value || 'KARTU IDENTITAS PEDAGANG RESMI';
      });
    }

    const subInput = document.getElementById('cardHeaderSubtitle');
    const prevSub = document.getElementById('prevCardSubtitle');
    if (subInput && prevSub) {
      subInput.addEventListener('input', () => {
        prevSub.textContent = subInput.value || 'PEMERINTAH KABUPATEN PINRANG';
      });
    }

    const agencyInput = document.getElementById('cardAgencyName');
    const prevAgency = document.getElementById('prevAgencyName');
    if (agencyInput && prevAgency) {
      agencyInput.addEventListener('input', () => {
        prevAgency.textContent = agencyInput.value || 'DINAS PERINDAG ESDM PINRANG';
      });
    }

    const photoCheck = document.getElementById('cardShowPhoto');
    const prevPhoto = document.getElementById('prevPhotoBox');
    if (photoCheck && prevPhoto) {
      photoCheck.addEventListener('change', () => {
        prevPhoto.style.display = photoCheck.checked ? 'flex' : 'none';
      });
    }

    const qrCheck = document.getElementById('cardShowQr');
    const prevQr = document.getElementById('prevQrBox');
    if (qrCheck && prevQr) {
      qrCheck.addEventListener('change', () => {
        prevQr.style.display = qrCheck.checked ? 'flex' : 'none';
      });
    }
  }

  let currentManualSignatureImage = null;

  // SETUP MODE TTE & MANUAL SIGNATURE UPLOAD
  function setupManualSignatureHandlers() {
    const tteSelect = document.getElementById('tteMode');
    const wrap = document.getElementById('manualSignatureWrap');
    const input = document.getElementById('manualSignatureInput');
    const btnPick = document.getElementById('btnPickSignature');
    const btnRemove = document.getElementById('btnRemoveSignature');
    const statusText = document.getElementById('signatureFileStatus');
    const previewBox = document.getElementById('signaturePreviewBox');
    const previewImg = document.getElementById('signaturePreviewImg');

    const updateVisibility = () => {
      const isManual = tteSelect.value === 'MANUAL_UPLOAD';
      if (wrap) wrap.style.display = isManual ? 'block' : 'none';
    };

    tteSelect?.addEventListener('change', updateVisibility);
    updateVisibility();

    btnPick?.addEventListener('click', () => input?.click());

    input?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('Mohon pilih berkas gambar (PNG atau JPG).');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const rawData = event.target.result;
        // Resize / Kompres gambar via canvas agar ringan di Firestore
        const img = new Image();
        img.onload = () => {
          const maxW = 500;
          let w = img.width;
          let h = img.height;
          if (w > maxW) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          currentManualSignatureImage = canvas.toDataURL('image/png', 0.9);

          if (previewImg) previewImg.src = currentManualSignatureImage;
          if (previewBox) previewBox.style.display = 'inline-flex';
          if (btnRemove) btnRemove.style.display = 'inline-flex';
          if (statusText) statusText.textContent = `✓ Berkas "${file.name}" siap disimpan`;
          notice('Berkas tanda tangan/stempel Kadis berhasil dimuat. Jangan lupa tekan "Simpan Pengaturan Sistem".');
        };
        img.src = rawData;
      };
      reader.readAsDataURL(file);
    });

    btnRemove?.addEventListener('click', () => {
      currentManualSignatureImage = null;
      if (input) input.value = '';
      if (previewBox) previewBox.style.display = 'none';
      if (btnRemove) btnRemove.style.display = 'none';
      if (statusText) statusText.textContent = 'Belum ada gambar yang diunggah';
      notice('Gambar tanda tangan manual telah dihapus.');
    });
  }

  // 11 PASAR RESMI SESUAI KEPUTUSAN DAERAH KABUPATEN PINRANG
  const OFFICIAL_11_MARKETS = [
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

  const DAYS_LIST = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];
  const DAY_LABELS = {
    SENIN: 'Senin', SELASA: 'Selasa', RABU: 'Rabu', KAMIS: 'Kamis',
    JUMAT: 'Jumat', SABTU: 'Sabtu', MINGGU: 'Minggu'
  };

  // JADWAL OPERASIONAL 11 PASAR RESMI (CHECKLIST TERSTRUKTUR)
  function renderMarketRows(marketsSchedule) {
    const tbody = document.getElementById('marketScheduleRows');
    if (!tbody) return;

    tbody.innerHTML = '';
    const schedMap = marketsSchedule || {};

    OFFICIAL_11_MARKETS.forEach((m, idx) => {
      const tr = document.createElement('tr');
      const raw = schedMap[m.id] || schedMap[m.id.toLowerCase()] || {};

      let isDaily = false;
      let activeDays = [];

      if (typeof raw === 'object' && raw !== null) {
        isDaily = Boolean(raw.isDaily);
        activeDays = Array.isArray(raw.activeDays) ? raw.activeDays : [];
      } else if (typeof raw === 'string') {
        const lower = raw.toLowerCase();
        isDaily = lower.includes('harian') || lower.includes('setiap hari');
        DAYS_LIST.forEach(d => {
          if (lower.includes(DAY_LABELS[d].toLowerCase())) activeDays.push(d);
        });
      }

      // Default jika kosong: MKT-010 adalah harian, yang lain default hari tertentu
      if (m.id === 'MKT-010' && activeDays.length === 0) {
        isDaily = true;
        activeDays = [...DAYS_LIST];
      } else if (activeDays.length === 0) {
        activeDays = ['RABU', 'SABTU'];
      }

      tr.dataset.marketId = m.id;
      tr.dataset.marketName = m.name;

      tr.innerHTML = `
        <td style="text-align:center; font-weight:700; color:#64748b;">${idx + 1}</td>
        <td>
          <span style="font-family:monospace; font-weight:800; color:#0369a1; background:#e0f2fe; padding:2px 7px; border-radius:6px; font-size:0.75rem;">${m.id}</span>
        </td>
        <td>
          <b style="font-size:0.85rem; color:#1e293b;">${escapeHtml(m.name)}</b>
        </td>
        <td>
          <div class="market-type-toggle">
            <label>
              <input type="radio" name="mkt_type_${m.id}" value="daily" ${isDaily ? 'checked' : ''} class="radio-mkt-type">
              Pasar Harian (Setiap Hari)
            </label>
            <label style="margin-left: 12px;">
              <input type="radio" name="mkt_type_${m.id}" value="custom" ${!isDaily ? 'checked' : ''} class="radio-mkt-type">
              Hari Tertentu (Checklist)
            </label>
          </div>
          <div class="market-days-grid" style="${isDaily ? 'display:none;' : 'display:flex;'}">
            ${DAYS_LIST.map(d => {
              const isChecked = activeDays.includes(d);
              return `
                <label class="day-chip-label">
                  <input type="checkbox" value="${d}" class="chk-day" ${isChecked ? 'checked' : ''}>
                  ${DAY_LABELS[d]}
                </label>
              `;
            }).join('')}
          </div>
        </td>
        <td>
          <span class="schedule-badge ${isDaily ? 'is-daily' : ''}">
            🗓️ ${formatScheduleSummary(isDaily, activeDays)}
          </span>
        </td>
      `;

      // Event listener radio tipe pasar
      const radios = tr.querySelectorAll('.radio-mkt-type');
      const daysGrid = tr.querySelector('.market-days-grid');
      const badge = tr.querySelector('.schedule-badge');

      const updateRowBadge = () => {
        const currentDaily = tr.querySelector(`input[name="mkt_type_${m.id}"]:checked`)?.value === 'daily';
        daysGrid.style.display = currentDaily ? 'none' : 'flex';
        
        let currentDays = [];
        if (currentDaily) {
          currentDays = [...DAYS_LIST];
        } else {
          tr.querySelectorAll('.chk-day:checked').forEach(c => currentDays.push(c.value));
        }

        badge.className = `schedule-badge ${currentDaily ? 'is-daily' : ''}`;
        badge.textContent = `🗓️ ${formatScheduleSummary(currentDaily, currentDays)}`;
      };

      radios.forEach(r => r.addEventListener('change', updateRowBadge));
      tr.querySelectorAll('.chk-day').forEach(c => c.addEventListener('change', updateRowBadge));

      tbody.appendChild(tr);
    });
  }

  function formatScheduleSummary(isDaily, activeDays) {
    if (isDaily) return 'Pasar Harian (Setiap Hari) · 7 Hari / Minggu';
    if (!activeDays || activeDays.length === 0) return 'Belum ditentukan hari pasar';
    const dayNames = activeDays.map(d => DAY_LABELS[d] || d);
    return `Pasar Mingguan (${dayNames.join(' & ')}) · ${activeDays.length} Hari / Minggu`;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ISI FORM DENGAN NILAI DARI SETTINGS
  function populateForm(settings) {
    currentSettings = settings;

    // 1. Kadis & TTE
    const sig = settings.signatory || {};
    document.getElementById('kadisName').value = sig.name || '';
    document.getElementById('kadisNip').value = sig.nip || '';
    document.getElementById('kadisRank').value = sig.rank || '';
    document.getElementById('kadisPosition').value = sig.position || '';
    document.getElementById('kadisAuthority').value = sig.authority || '';
    document.getElementById('tteMode').value = sig.tteMode || 'UAT_SIMULATED';
    document.getElementById('tteNotice').value = sig.tteNotice || '';

    // Handle Manual Signature Image
    currentManualSignatureImage = sig.manualSignatureImage || null;
    const previewBox = document.getElementById('signaturePreviewBox');
    const previewImg = document.getElementById('signaturePreviewImg');
    const btnRemove = document.getElementById('btnRemoveSignature');
    const statusText = document.getElementById('signatureFileStatus');

    if (currentManualSignatureImage && previewImg && previewBox) {
      previewImg.src = currentManualSignatureImage;
      previewBox.style.display = 'inline-flex';
      if (btnRemove) btnRemove.style.display = 'inline-flex';
      if (statusText) statusText.textContent = '✓ Gambar tanda tangan/stempel tersimpan aktif';
    } else {
      if (previewBox) previewBox.style.display = 'none';
      if (btnRemove) btnRemove.style.display = 'none';
      if (statusText) statusText.textContent = 'Belum ada gambar yang diunggah';
    }

    const tteSelect = document.getElementById('tteMode');
    const wrap = document.getElementById('manualSignatureWrap');
    if (wrap) wrap.style.display = (tteSelect?.value === 'MANUAL_UPLOAD') ? 'block' : 'none';

    // 2. Card Design
    const card = settings.cardDesign || {};
    const theme = card.theme || 'navy';
    document.getElementById('cardThemeValue').value = theme;
    document.getElementById('cardHeaderTitle').value = card.headerTitle || 'KARTU IDENTITAS PEDAGANG RESMI';
    document.getElementById('cardHeaderSubtitle').value = card.headerSubtitle || 'PEMERINTAH KABUPATEN PINRANG';
    document.getElementById('cardAgencyName').value = card.agencyName || 'DINAS PERINDAG ESDM PINRANG';
    document.getElementById('cardShowPhoto').checked = card.showPhoto !== false;
    document.getElementById('cardShowQr').checked = card.showQr !== false;
    document.getElementById('cardShowNik').checked = card.showNik !== false;
    document.getElementById('cardShowExpiry').checked = card.showExpiry !== false;

    // Update Live Card
    const liveCard = document.getElementById('liveCard');
    liveCard.className = `live-trader-card theme-${theme}`;
    document.getElementById('prevCardTitle').textContent = card.headerTitle || 'KARTU IDENTITAS PEDAGANG RESMI';
    document.getElementById('prevCardSubtitle').textContent = card.headerSubtitle || 'PEMERINTAH KABUPATEN PINRANG';
    document.getElementById('prevAgencyName').textContent = card.agencyName || 'DINAS PERINDAG ESDM PINRANG';
    document.getElementById('prevPhotoBox').style.display = card.showPhoto !== false ? 'flex' : 'none';
    document.getElementById('prevQrBox').style.display = card.showQr !== false ? 'flex' : 'none';

    document.querySelectorAll('.theme-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.getAttribute('data-theme') === theme);
    });

    // 3. Frontpage
    const fp = settings.frontpage || {};
    document.getElementById('frontHeroTitle').value = fp.heroTitle || '';
    document.getElementById('frontHeroSubtitle').value = fp.heroSubtitle || '';
    document.getElementById('frontAnnouncement').value = fp.announcement || '';
    document.getElementById('frontWaHelpdesk').value = fp.helpdeskWa || '';
    document.getElementById('frontContactEmail').value = fp.contactEmail || '';
    document.getElementById('frontServiceHours').value = fp.serviceHours || '';
    document.getElementById('frontOfficeAddress').value = fp.officeAddress || '';

    // 4. Markets Schedule 11 Pasar Resmi
    renderMarketRows(settings.marketsSchedule || {});

    // 5. Legal Basis
    const leg = settings.legalBasis || {};
    document.getElementById('legalPerdaMarket').value = leg.perdaMarket || '';
    document.getElementById('legalPerdaTax').value = leg.perdaTax || '';
    document.getElementById('legalValidityYears').value = leg.validityYears || 2;
  }
  // AMBIL PAYLOAD DARI FORM
  function extractFormPayload() {
    // Kumpulkan tabel 11 pasar resmi
    const marketsMap = {};
    const rows = document.querySelectorAll('#marketScheduleRows tr');
    rows.forEach(r => {
      const mId = r.dataset.marketId;
      const mName = r.dataset.marketName;
      if (!mId) return;

      const isDaily = r.querySelector(`input[name="mkt_type_${mId}"]:checked`)?.value === 'daily';
      let activeDays = [];
      if (isDaily) {
        activeDays = [...DAYS_LIST];
      } else {
        r.querySelectorAll('.chk-day:checked').forEach(c => activeDays.push(c.value));
      }

      const scheduleText = formatScheduleSummary(isDaily, activeDays);

      marketsMap[mId] = {
        marketId: mId,
        marketName: mName,
        isDaily,
        activeDays,
        daysCount: isDaily ? 7 : (activeDays.length || 1),
        scheduleText
      };
    });

    return {
      signatory: {
        name: document.getElementById('kadisName').value.trim(),
        nip: document.getElementById('kadisNip').value.trim(),
        rank: document.getElementById('kadisRank').value.trim(),
        position: document.getElementById('kadisPosition').value.trim(),
        authority: document.getElementById('kadisAuthority').value.trim(),
        tteMode: document.getElementById('tteMode').value,
        manualSignatureImage: currentManualSignatureImage || null,
        tteNotice: document.getElementById('tteNotice').value.trim()
      },
      cardDesign: {
        theme: document.getElementById('cardThemeValue').value,
        headerTitle: document.getElementById('cardHeaderTitle').value.trim(),
        headerSubtitle: document.getElementById('cardHeaderSubtitle').value.trim(),
        agencyName: document.getElementById('cardAgencyName').value.trim(),
        showPhoto: document.getElementById('cardShowPhoto').checked,
        showQr: document.getElementById('cardShowQr').checked,
        showNik: document.getElementById('cardShowNik').checked,
        showExpiry: document.getElementById('cardShowExpiry').checked
      },
      frontpage: {
        heroTitle: document.getElementById('frontHeroTitle').value.trim(),
        heroSubtitle: document.getElementById('frontHeroSubtitle').value.trim(),
        announcement: document.getElementById('frontAnnouncement').value.trim(),
        helpdeskWa: document.getElementById('frontWaHelpdesk').value.trim(),
        contactEmail: document.getElementById('frontContactEmail').value.trim(),
        serviceHours: document.getElementById('frontServiceHours').value.trim(),
        officeAddress: document.getElementById('frontOfficeAddress').value.trim()
      },
      marketsSchedule: marketsMap,
      legalBasis: {
        perdaMarket: document.getElementById('legalPerdaMarket').value.trim(),
        perdaTax: document.getElementById('legalPerdaTax').value.trim(),
        validityYears: Number(document.getElementById('legalValidityYears').value) || 2
      }
    };
  }

  // SIMPAN PENGATURAN
  async function saveConfig() {
    notice('');
    const btnSave = document.getElementById('btnSaveConfig');
    const btnSaveTop = document.getElementById('btnSaveConfigTop');
    if (btnSave) btnSave.disabled = true;
    if (btnSaveTop) btnSaveTop.disabled = true;
    setStatus('Menyimpan seluruh konfigurasi dinamis ke basis data cloud…', true);

    try {
      const payload = extractFormPayload();
      await window.EPASAR_CONFIG_SERVICE.saveSettings(payload, currentProfile);

      notice('Konfigurasi kustom sistem berhasil disimpan secara terpusat! Seluruh dokumen SKPT, kartu pedagang, frontpage, dan jadwal pasar langsung diperbarui secara realtime.');
      setStatus('Konfigurasi berhasil disimpan dan aktif secara seketika.');
    } catch (err) {
      console.error('Gagal menyimpan konfigurasi kustom:', err);
      notice('Gagal menyimpan konfigurasi: ' + err.message, true);
      setStatus('Terjadi kesalahan saat menyimpan.', false);
    } finally {
      if (btnSave) btnSave.disabled = false;
      if (btnSaveTop) btnSaveTop.disabled = false;
    }
  }

  // INISIALISASI
  async function init() {
    try {
      window.EPASAR_FIREBASE_INIT();
      currentProfile = await window.EPASAR_AUTH.requireStaff(['SUPER_ADMIN', 'KADIS']);
      window.EPASAR_INTERNAL_UI?.setProfile(currentProfile);

      setupTabs();
      setupLiveCardPreview();
      setupManualSignatureHandlers();

      document.getElementById('btnAddMarketRow')?.addEventListener('click', addMarketRow);
      document.getElementById('btnReloadConfig')?.addEventListener('click', async () => {
        const s = await window.EPASAR_CONFIG_SERVICE.getSettings(true);
        populateForm(s);
        notice('Konfigurasi berhasil dimuat ulang.');
      });
      document.getElementById('btnResetDefault')?.addEventListener('click', () => {
        if (confirm('Kembalikan seluruh parameter formulir ke nilai standar awal dinas?')) {
          populateForm(window.EPASAR_CONFIG_SERVICE.DEFAULT_SETTINGS);
          notice('Formulir direset ke pengaturan default dinas. Tekan "Simpan Pengaturan Sistem" untuk menerapkannya ke basis data.');
        }
      });

      document.getElementById('customForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveConfig();
      });
      document.getElementById('btnSaveConfigTop')?.addEventListener('click', () => {
        saveConfig();
      });

      // Muat konfigurasi
      const settings = await window.EPASAR_CONFIG_SERVICE.getSettings(true);
      populateForm(settings);
      setStatus('Konfigurasi aktif siap disesuaikan.');
    } catch (err) {
      console.error('Inisialisasi kustomisasi gagal:', err);
      notice('Akses ditolak atau sesi tidak valid: ' + err.message, true);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
