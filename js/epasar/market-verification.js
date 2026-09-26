(function () {
  'use strict';
  const message = document.getElementById('message');
  const items = document.getElementById('items');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const marketLabel = marketId => { const market = window.EPASAR?.marketById(marketId); return market ? `${market.id} · ${market.name}` : String(marketId || '—'); };
  const notify = (text, error = false) => { message.textContent = text; message.className = error ? 'admin-message admin-error' : 'admin-message'; };

  async function boot() {
    try {
      const profile = await window.EPASAR_AUTH.requireStaff(['MARKET_HEAD']);
      window.EPASAR_INTERNAL_UI?.setProfile(profile);
      document.getElementById('who').textContent = `${profile.displayName || profile.position || 'Kepala Pasar'} · ${(profile.marketIds || []).map(marketLabel).join(', ') || 'pasar yang ditugaskan'}`;
      const marketIds = Array.isArray(profile.marketIds) ? profile.marketIds : [];
      if (!marketIds.length) { notify('Akun belum memiliki pasar yang ditugaskan. Hubungi Super Admin.', true); return; }
      const claims = [];
      for (const marketId of marketIds) {
        const snapshot = await window.db.collection('market_claims').where('marketId', '==', marketId).limit(20).get();
        snapshot.forEach(document => {
          const row = { id: document.id, ...document.data() };
          if (!row.verificationStatus || row.verificationStatus === 'UNVERIFIED' || row.status === 'SUBMITTED') claims.push(row);
        });
      }
      items.innerHTML = claims.map(claim => `<article class="workflow-item verification-card"><header><div><p class="eyebrow">PEMERIKSAAN FAKTUAL</p><h2>${escapeHtml(marketLabel(claim.marketId))}</h2><p>Pedagang: ${escapeHtml(claim.traderId)}</p></div><span class="status-badge status-warning">BELUM DIVERIFIKASI</span></header><form data-id="${escapeHtml(claim.id)}"><div class="verification-layout"><section class="claim-panel"><h3>KLAIM PEDAGANG</h3><div class="claim-value">${escapeHtml(claim.claimedUnitType || claim.unitType || 'Unit')} ${escapeHtml(claim.claimedUnitNumber || claim.submittedUnit || '-')}</div><p>Blok ${escapeHtml(claim.claimedBlock || '-')} · Lantai ${escapeHtml(claim.claimedFloor || '-')}</p><p>Luas ${escapeHtml(claim.claimedAreaM2 || '-')} m²</p><div class="notice">Data ini belum menjadi identitas unit resmi.</div></section><section class="result-panel"><h3>HASIL PEMERIKSAAN</h3><div class="workflow-grid"><label>Jenis unit<select name="unitType" required><option value="KIOS" ${claim.claimedUnitType === 'KIOS' ? 'selected' : ''}>Kios</option><option value="LOS" ${claim.claimedUnitType === 'LOS' ? 'selected' : ''}>Los</option><option value="LAPAK" ${claim.claimedUnitType === 'LAPAK' ? 'selected' : ''}>Lapak</option><option value="PELATARAN" ${claim.claimedUnitType === 'PELATARAN' ? 'selected' : ''}>Pelataran</option></select></label><label>Nomor unit<input name="unitNumber" value="${escapeHtml(claim.claimedUnitNumber || claim.submittedUnit || '')}" required></label><label>Blok<input name="block" value="${escapeHtml(claim.claimedBlock || claim.block || '')}"></label><label>Lantai<input name="floor" value="${escapeHtml(claim.claimedFloor || claim.floor || '')}"></label><label>Luas (m²)<input name="areaM2" value="${escapeHtml(claim.claimedAreaM2 || claim.areaM2 || '')}" type="number" min="0" step="0.01"></label><label>Pengguna aktual<input name="actualUser" maxlength="120"></label></div><label>Alasan hasil pemeriksaan<textarea name="reason" required maxlength="500" placeholder="Contoh: nomor fisik sesuai pemeriksaan lapangan"></textarea></label><label><input name="conflict" type="checkbox"> Ada konflik yang perlu diperiksa ulang</label></section></div><p class="notice">Perubahan disimpan sebagai jejak sebelum dan sesudah. Data awal tidak ditimpa diam-diam.</p><div class="verification-action"><button class="button primary" type="submit">Simpan Verifikasi</button></div></form></article>`).join('') || '<div class="internal-empty"><span>✓</span><b>Tidak ada klaim menunggu pemeriksaan</b><p>Semua klaim terbaru pada pasar Anda sudah diproses.</p></div>';
      document.querySelectorAll('form[data-id]').forEach(form => form.addEventListener('submit', async event => {
        event.preventDefault();
        const claim = claims.find(row => row.id === form.dataset.id);
        try {
          const values = Object.fromEntries(new FormData(form));
          values.conflict = form.elements.conflict.checked;
          const result = await window.EPASAR_WORKFLOW.verifyClaim(claim, values, profile);
          notify(result.conflict ? 'Konflik unit tercatat. Berkas tidak diteruskan untuk persetujuan sampai konflik diselesaikan.' : `Unit ${result.unitId} terverifikasi dan berkas diteruskan untuk review Kadis.`);
          form.closest('.workflow-item').remove();
        } catch (error) { notify(error.message, true); }
      }));
    } catch (error) {
      notify('Ruang kerja Kepala Pasar belum dapat dimuat. Periksa penugasan pasar dan koneksi data.', true);
      console.error(error);
    }
  }
  boot();
}());

