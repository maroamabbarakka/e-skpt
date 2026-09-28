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

  // JADWAL OPERASIONAL PASAR (TABEL DINAMIS)
  function renderMarketRows(marketsSchedule) {
    const tbody = document.getElementById('marketScheduleRows');
    if (!tbody) return;

    tbody.innerHTML = '';
    const entries = Object.entries(marketsSchedule || {});

    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:18px; color:#888;">Belum ada jadwal pasar. Klik "+ Tambah Unit Pasar" untuk menambahkan.</td></tr>';
      return;
    }

    entries.forEach(([marketId, schedule]) => {
      const tr = document.createElement('tr');

      const marketObj = window.EPASAR?.marketById(marketId);
      const defaultName = marketObj?.name || formatMarketName(marketId);

      tr.innerHTML = `
        <td>
          <input type="text" class="mkt-id-input" value="${escapeHtml(marketId)}" style="width:100%; font-family:monospace; font-size:0.78rem; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px;">
        </td>
        <td>
          <input type="text" class="mkt-name-input" value="${escapeHtml(defaultName)}" style="width:100%; font-size:0.82rem; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px;">
        </td>
        <td>
          <input type="text" class="mkt-sched-input" value="${escapeHtml(schedule)}" style="width:100%; font-size:0.82rem; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px;" placeholder="Contoh: Pasar Harian (Setiap Hari) atau Rabu & Sabtu">
        </td>
        <td style="text-align:center;">
          <button type="button" class="btn-action-icon btn-remove-mkt" title="Hapus jadwal pasar">🗑️</button>
        </td>
      `;

      tr.querySelector('.btn-remove-mkt').addEventListener('click', () => {
        tr.remove();
      });

      tbody.appendChild(tr);
    });
  }

  function addMarketRow() {
    const tbody = document.getElementById('marketScheduleRows');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="text" class="mkt-id-input" value="pasar-baru-${Date.now().toString().slice(-4)}" style="width:100%; font-family:monospace; font-size:0.78rem; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px;">
      </td>
      <td>
        <input type="text" class="mkt-name-input" value="Pasar Rakyat Baru" style="width:100%; font-size:0.82rem; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px;">
      </td>
      <td>
        <input type="text" class="mkt-sched-input" value="Pasar Mingguan (Senin & Kamis)" style="width:100%; font-size:0.82rem; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px;">
      </td>
      <td style="text-align:center;">
        <button type="button" class="btn-action-icon btn-remove-mkt" title="Hapus jadwal pasar">🗑️</button>
      </td>
    `;

    tr.querySelector('.btn-remove-mkt').addEventListener('click', () => {
      tr.remove();
    });

    tbody.appendChild(tr);
    tr.querySelector('.mkt-name-input').focus();
  }

  function formatMarketName(id) {
    if (!id) return 'Unit Pasar';
    return id.replace(/^pasar-/, 'Pasar Rakyat ').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

    // 4. Markets Schedule
    renderMarketRows(settings.marketsSchedule || {});

    // 5. Legal Basis
    const leg = settings.legalBasis || {};
    document.getElementById('legalPerdaMarket').value = leg.perdaMarket || '';
    document.getElementById('legalPerdaTax').value = leg.perdaTax || '';
    document.getElementById('legalValidityYears').value = leg.validityYears || 2;
  }

  // AMBIL PAYLOAD DARI FORM
  function extractFormPayload() {
    // Kumpulkan tabel pasar
    const marketsMap = {};
    const rows = document.querySelectorAll('#marketScheduleRows tr');
    rows.forEach(r => {
      const id = r.querySelector('.mkt-id-input')?.value.trim();
      const sched = r.querySelector('.mkt-sched-input')?.value.trim();
      if (id && sched) {
        marketsMap[id] = sched;
      }
    });

    return {
      signatory: {
        name: document.getElementById('kadisName').value.trim(),
        nip: document.getElementById('kadisNip').value.trim(),
        rank: document.getElementById('kadisRank').value.trim(),
        position: document.getElementById('kadisPosition').value.trim(),
        authority: document.getElementById('kadisAuthority').value.trim(),
        tteMode: document.getElementById('tteMode').value,
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
