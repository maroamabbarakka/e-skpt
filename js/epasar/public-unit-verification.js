(function () {
  'use strict';
  const root = document.getElementById('unitResult');
  const token = new URLSearchParams(location.search).get('token') || '';
  const add = (tag, text, className = '') => { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; root.appendChild(node); };
  async function boot() {
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) { root.textContent = 'Tautan QR unit tidak lengkap atau tidak sesuai.'; root.className = 'verification-result document-error'; return; }
    try {
      window.EPASAR_FIREBASE_INIT();
      const snapshot = await window.db.collection('public_market_units').doc(token).get();
      if (!snapshot.exists || snapshot.data().publicStatus !== true) throw new Error('NOT_FOUND');
      const unit = snapshot.data(); root.textContent = '';
      add('span', unit.status === 'TERVERIFIKASI' ? 'UNIT TERVERIFIKASI' : 'PERLU PEMERIKSAAN', `status-badge ${unit.status === 'TERVERIFIKASI' ? 'status-verified' : 'status-warning'}`);
      add('h2', `${unit.unitType || 'UNIT'} ${unit.unitNumber || '—'}`);
      add('p', unit.marketName || unit.marketId || 'Pasar tidak tercatat');
      add('p', `Blok ${unit.block || '—'} · Lantai ${unit.floor || '—'}${unit.areaM2 ? ` · ${unit.areaM2} m²` : ''}`);
      add('small', `ID unit: ${unit.unitId || '—'}`);
    } catch (error) { console.error(error); root.textContent = 'Unit pasar tidak ditemukan atau belum dipublikasikan oleh petugas.'; root.className = 'verification-result document-error'; }
  }
  boot();
}());
