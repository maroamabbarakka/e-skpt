(function () {
  'use strict';

  let currentPage = 1;
  let currentCursor = null;
  const cursorHistory = [];
  let currentHasMore = false;

  const message = document.getElementById('adminMessage');
  const workspace = document.getElementById('adminWorkspace');
  const rows = document.getElementById('intakeRows');
  const nextButton = document.getElementById('nextButton');
  const previousButton = document.getElementById('previousButton');

  function escapeHtml(value) {
    return String(value ?? '—').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  function setMessage(text, isError) {
    message.hidden = false;
    message.className = isError ? 'admin-error' : 'admin-message';
    message.textContent = text;
  }

  function friendlyError(error) {
    const raw = String(error?.message || error || '');
    if (/permission|insufficient permissions/i.test(raw)) return 'Akun Anda berhasil masuk, tetapi ruang kerja untuk role ini belum tersedia.';
    if (/Firebase|configured|konfigurasi/i.test(raw)) return 'Layanan sedang disiapkan. Silakan coba lagi beberapa saat kemudian.';
    return raw.replace(/Missing or insufficient permissions\.?/i, 'Akses ke data ini belum tersedia untuk akun Anda.');
  }

  function renderRoleWorkspace(profile) {
    const isMarket = profile.role === 'MARKET_HEAD';
    workspace.innerHTML = `<div class="role-dashboard"><article class="role-panel"><h2>${isMarket ? 'Verifikasi pasar' : 'Review dan approval'}</h2><p>${isMarket ? 'Periksa klaim kios, los, atau lapak sesuai pasar yang ditugaskan kepada Anda.' : 'Periksa pengajuan SKPT, perubahan material, dan keputusan yang menunggu kewenangan Kadis.'}</p><a class="button primary" href="${isMarket ? 'market-verification.html' : 'kadis-approval.html'}">Buka ruang kerja →</a></article><article class="role-panel"><h2>Profil dan keamanan</h2><p>Perbarui password dan informasi profil akun melalui halaman profil.</p><a class="button secondary" href="profil.html">Buka profil →</a></article><article class="role-panel"><h2>Petunjuk tugas</h2><p>${isMarket ? 'Data yang Anda ubah akan disimpan bersama alasan dan jejak audit.' : 'Setiap keputusan approval harus berdasarkan perbandingan data pemohon dan hasil verifikasi.'}</p></article></div>`;
    workspace.querySelector('.role-dashboard')?.insertAdjacentHTML('beforeend', `<article class="role-panel"><h2>Pengesahan tahunan</h2><p>${isMarket ? 'Catat pemeriksaan faktual SKPT aktif tanpa mengubah masa berlakunya.' : 'Tinjau hasil pemeriksaan tahunan dan catat keputusan administrasi.'}</p><a class="button secondary" href="annual-validation.html">Buka pengesahan →</a></article>`);
    workspace.querySelector('.role-dashboard')?.insertAdjacentHTML('beforeend', `<article class="role-panel"><h2>Perubahan pemegang unit</h2><p>${isMarket ? 'Ajukan pelepasan atau pengalihan berdasarkan pemeriksaan faktual.' : 'Putuskan pelepasan atau pengalihan tanpa mengubah identitas permanen unit.'}</p><a class="button secondary" href="occupancy-change.html">Buka perubahan unit →</a></article>`);
    workspace.hidden = false;
    message.hidden = true;
  }

  function render(list) {
    document.getElementById('kpiSubmitted').textContent = list.length;
    document.getElementById('kpiMarket').textContent = list.filter(item => item.hasMarketUnit === true).length;
    document.getElementById('kpiSkpt').textContent = list.filter(item => item.applySkpt === true).length;
    document.getElementById('kpiPage').textContent = currentPage;
    rows.innerHTML = list.map(item => {
      const submittedAt = item.submittedAt?.toDate
        ? item.submittedAt.toDate().toLocaleString('id-ID') : '—';
      return `<tr>
        <td data-label="Registrasi">${escapeHtml(item.registrationCode)}</td>
        <td data-label="Nama">${escapeHtml(item.identity?.name)}</td>
        <td data-label="Wilayah">${escapeHtml(item.identity?.district)} / ${escapeHtml(item.identity?.village)}</td>
        <td data-label="Pasar">${item.hasMarketUnit === true ? 'Ya' : 'Tidak'}</td>
        <td data-label="SKPT">${item.applySkpt === true ? 'Ya' : 'Tidak'}</td>
        <td data-label="Waktu">${escapeHtml(submittedAt)}</td>
        <td data-label="Tindakan"><div class="table-actions"><a class="button primary" href="admin-intake-review.html?id=${encodeURIComponent(item.id)}">Review</a><a class="button secondary" href="photo-editor.html?intake=${encodeURIComponent(item.id)}">Olah foto</a></div></td>
      </tr>`;
    }).join('') || '<tr><td colspan="7">Tidak ada intake pada halaman ini.</td></tr>';
    nextButton.disabled = !currentHasMore;
    previousButton.disabled = currentPage === 1;
  }

  async function load(cursor) {
    setMessage('Memuat antrean…', false);
    try {
      if (!window.EPASAR_FIREBASE_READY) {
        throw new Error('Firebase/Auth belum dikonfigurasi. Akses admin dinonaktifkan.');
      }
      const result = await window.EPASAR_ADMIN_INTAKE.page(cursor);
      currentCursor = result.last || null;
      currentHasMore = result.hasMore;
      render(result.rows);
      workspace.hidden = false;
      message.hidden = true;
    } catch (error) {
      workspace.hidden = true;
      setMessage(friendlyError(error), true);
    }
  }

  document.getElementById('refreshButton').addEventListener('click', () => {
    currentPage = 1;
    currentCursor = null;
    cursorHistory.length = 0;
    load(null);
  });

  nextButton.addEventListener('click', () => {
    if (!currentHasMore || !currentCursor) return;
    cursorHistory.push(currentCursor);
    currentPage += 1;
    load(currentCursor);
  });

  previousButton.addEventListener('click', () => {
    if (currentPage === 1) return;
    currentPage -= 1;
    const previousCursor = currentPage === 1 ? null : cursorHistory[currentPage - 2];
    cursorHistory.splice(currentPage - 1);
    load(previousCursor);
  });

  document.getElementById('logoutButton').addEventListener('click', async () => { await window.EPASAR_AUTH.signOut(); location.href = 'login.html'; });
  (async function boot() {
    try {
      if (window.EPASAR_FIREBASE_INIT) window.EPASAR_FIREBASE_INIT();
      const profile = await window.EPASAR_AUTH.requireStaff(['SUPER_ADMIN','DISPERINDAG_ADMIN','TRADE_ADMIN','MARKET_ADMIN','MARKET_HEAD','KADIS','TECH_ADMIN']);
      window.EPASAR_INTERNAL_UI?.setProfile(profile);
      if (profile.role === 'MARKET_HEAD' || profile.role === 'KADIS') renderRoleWorkspace(profile);
      else load(null);
    } catch (error) {
      workspace.hidden = true;
      setMessage(`${friendlyError(error)} Mengalihkan ke halaman login…`, true);
      setTimeout(() => { location.href = 'login.html'; }, 900);
    }
  }());
}());
