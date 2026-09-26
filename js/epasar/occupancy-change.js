(function () {
  'use strict';
  const message = document.getElementById('message');
  const escapeHtml = value => String(value ?? '—').replace(/[&<>"']/g, character => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[character]));
  const notify = (text, error = false) => { message.textContent = text; message.className = error ? 'admin-message admin-error' : 'admin-message'; };

  const comparison = (before, after, afterNote) => `<div class="change-comparison"><section><span>SEBELUM</span><strong>${escapeHtml(before)}</strong><small>Pemegang tercatat saat ini</small></section><b aria-hidden="true">→</b><section class="after"><span>SESUDAH</span><strong data-target-label>${escapeHtml(after)}</strong><small>${escapeHtml(afterNote)}</small></section></div>`;

  async function boot() {
    try {
      const profile = await window.EPASAR_AUTH.requireStaff(['MARKET_HEAD','KADIS','SUPER_ADMIN']);
      window.EPASAR_INTERNAL_UI?.setProfile(profile);
      document.getElementById('who').textContent = `${profile.displayName || profile.position || profile.role} · ${profile.role}`;
      if (profile.role === 'MARKET_HEAD') {
        document.getElementById('marketWorkspace').hidden = false;
        const units = await window.EPASAR_OCCUPANCY_CHANGE.listUnits(profile);
        const root = document.getElementById('unitItems');
        root.innerHTML = units.map(unit => `<article class="workflow-item"><span class="status-badge status-processing">PEMERIKSAAN LAPANGAN</span><h2>${escapeHtml(unit.unitType)} ${escapeHtml(unit.unitNumber)}</h2>${comparison(unit.currentTraderId, 'Ditentukan melalui formulir', 'Belum mengubah data resmi')}<form data-unit="${escapeHtml(unit.id)}"><label>Jenis permohonan<select name="action" required><option value="RELEASE">Pelepasan unit</option><option value="TRANSFER">Pengalihan kepada pedagang lain</option></select></label><label>ID pedagang penerima<input name="newTraderId" maxlength="100" placeholder="Diisi hanya untuk pengalihan"></label><label>Hasil pemeriksaan dan alasan<textarea name="reason" maxlength="500" required></textarea></label><p class="notice">Pengajuan ini tidak langsung mengubah pemegang. Kadis/Super Admin harus memeriksa dan memutuskan.</p><button class="button primary" type="submit">Ajukan perubahan</button></form></article>`).join('') || '<div class="empty-state"><strong>Tidak ada unit aktif</strong><span>Belum ada unit pada pasar yang ditugaskan.</span></div>';
        root.querySelectorAll('form').forEach(form => {
          const update = () => { const action=form.elements.action.value,target=form.elements.newTraderId.value.trim();form.closest('.workflow-item').querySelector('[data-target-label]').textContent=action==='RELEASE'?'Tidak ada pemegang':(target||'Pilih pedagang penerima'); };
          form.elements.action.addEventListener('change', update); form.elements.newTraderId.addEventListener('input', update); update();
          form.addEventListener('submit', async event => { event.preventDefault(); try { const unit = units.find(item => item.id === form.dataset.unit); await window.EPASAR_OCCUPANCY_CHANGE.submit(unit, Object.fromEntries(new FormData(form)), profile); notify('Permohonan tercatat dan menunggu keputusan.'); form.closest('.workflow-item').remove(); } catch (error) { notify(error.message, true); } });
        });
      } else {
        document.getElementById('reviewWorkspace').hidden = false;
        const requests = await window.EPASAR_OCCUPANCY_CHANGE.listPending(profile);
        const root = document.getElementById('requestItems');
        root.innerHTML = requests.map(row => `<article class="workflow-item" data-request="${escapeHtml(row.id)}"><span class="status-badge status-waiting">MENUNGGU KEPUTUSAN</span><h2>${row.action === 'TRANSFER' ? 'Pengalihan pemegang' : 'Pelepasan unit'}</h2><p>Unit: <strong>${escapeHtml(row.marketUnitId)}</strong></p>${comparison(row.currentTraderId, row.action === 'TRANSFER' ? row.newTraderId : 'Tidak ada pemegang', row.action === 'TRANSFER' ? 'Calon pemegang baru' : 'Unit dilepaskan')}<p><strong>Alasan perubahan:</strong> ${escapeHtml(row.reason)}</p><label>Catatan keputusan<textarea name="decisionNote" maxlength="500" required></textarea></label><div class="annual-actions"><button class="button secondary" data-decision="REJECTED" type="button">Tolak</button><button class="button primary" data-decision="APPROVED" type="button">Setujui dan proses</button></div></article>`).join('') || '<div class="empty-state"><strong>Tidak ada permohonan</strong><span>Semua perubahan pemegang sudah diproses.</span></div>';
        root.querySelectorAll('[data-decision]').forEach(button => button.addEventListener('click', async () => { const card = button.closest('[data-request]'); const row = requests.find(item => item.id === card.dataset.request); try { await window.EPASAR_OCCUPANCY_CHANGE.decide(row, button.dataset.decision, card.querySelector('[name="decisionNote"]').value, profile); notify(button.dataset.decision === 'APPROVED' ? 'Perubahan pemegang berhasil diproses.' : 'Permohonan ditolak.'); card.remove(); } catch (error) { notify(error.message, true); } }));
      }
      notify('Data perubahan pemegang berhasil dimuat.');
    } catch (error) { notify('Halaman tidak dapat dibuka. Periksa peran akun dan koneksi data.', true); console.error(error); }
  }
  boot();
}());
