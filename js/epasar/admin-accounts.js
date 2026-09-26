(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const message = $('accountMessage'), workspace = $('accountWorkspace'), list = $('accountList'), form = $('accountForm');
  let actor = null;
  const esc = value => String(value ?? '?').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const roleLabel = role => ({SUPER_ADMIN:'Super Admin',DISPERINDAG_ADMIN:'Admin Disperindag',TRADE_ADMIN:'Admin Perdagangan',MARKET_ADMIN:'Admin Pasar',MARKET_HEAD:'Kepala Pasar',KADIS:'Kepala Dinas',TECH_ADMIN:'Admin Teknis'}[role] || role || 'Petugas');
  const marketOptions = $('marketIdOptions');
  const editor = $('accountEditor');
  const openEditor = () => { editor?.classList.add('open'); editor?.setAttribute('aria-hidden', 'false'); };
  const closeEditor = () => { editor?.classList.remove('open'); editor?.setAttribute('aria-hidden', 'true'); };
  $('openAccountEditor')?.addEventListener('click', () => { clear(); openEditor(); });
  $('closeAccountEditor')?.addEventListener('click', closeEditor);
  $('accountEditorScrim')?.addEventListener('click', closeEditor);
  if (marketOptions && window.EPASAR?.MARKETS) marketOptions.innerHTML = window.EPASAR.MARKETS.map(market => `<option value="${market.id}">${esc(market.name)}</option>`).join('');

  function setMessage(text, error) { message.textContent = text; message.className = error ? 'admin-error' : 'admin-message'; }
  function clear() { form.reset(); $('uid').value = ''; $('newAccountFields').hidden = false; $('formTitle').textContent = 'Akun Baru'; }
  function fill(data) {
    $('uid').value = data.uid; $('newAccountFields').hidden = true; $('username').value = data.username || '';
    $('displayName').value = data.displayName || ''; $('position').value = data.position || '';
    $('role').value = data.role || 'DISPERINDAG_ADMIN'; $('marketIds').value = (data.marketIds || []).join(',');
    $('status').value = data.status || 'ACTIVE'; $('phone').value = data.phone || ''; $('formTitle').textContent = 'Edit Profil';
    openEditor();
  }
  async function load() {
    const snapshot = await window.db.collection('users').orderBy('displayName').get(); list.innerHTML = '';
    if (snapshot.empty) { list.textContent = 'Belum ada profil.'; return; }
    snapshot.forEach(docSnapshot => {
      const data = { uid: docSnapshot.id, ...docSnapshot.data() }, row = document.createElement('div');
      row.className = 'account-row'; row.innerHTML = `<div><b>${esc(data.displayName || data.position)}</b><span>${esc(roleLabel(data.role))}${data.username ? ` ? ${esc(data.username)}` : ''}${data.marketIds?.length ? ` ? ${esc(data.marketIds.join(', '))}` : ''}</span></div><span class="status-badge ${data.status === 'ACTIVE' ? 'status-verified' : 'status-waiting'}">${data.status === 'ACTIVE' ? 'AKTIF' : 'NONAKTIF'}</span>`;
      row.addEventListener('click', () => fill(data)); list.appendChild(row);
    });
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); $('accountError').textContent = '';
    try {
      const uid = $('uid').value.trim();
      const input = { uid, username: $('username').value, email: $('email').value, password: $('initialPassword').value, displayName: $('displayName').value, position: $('position').value, role: $('role').value, marketIds: $('marketIds').value.split(',').map(value => value.trim()).filter(Boolean), status: $('status').value, phone: $('phone').value };
      if (uid) await window.EPASAR_ACCOUNT.save(uid, input); else await window.EPASAR_ACCOUNT.provision(input);
      setMessage(uid ? 'Profil dan kewenangan berhasil diperbarui.' : 'Akun Auth dan profil petugas berhasil dibuat.', false); clear(); closeEditor(); await load();
    } catch (error) { $('accountError').textContent = error.message || 'Akun belum berhasil disimpan.'; }
  });
  $('clearForm').addEventListener('click', clear);
  (async () => {
    try { window.EPASAR_FIREBASE_INIT(); actor = await window.EPASAR_AUTH.requireStaff(['SUPER_ADMIN']); window.EPASAR_CURRENT_PROFILE = actor; window.EPASAR_INTERNAL_UI?.setProfile(actor); workspace.hidden = false; message.hidden = true; await load(); }
    catch (error) { setMessage('Akses akun tidak dapat diperiksa. Mengalihkan ke halaman masuk?', true); setTimeout(() => { location.href = 'login.html'; }, 900); }
  })();
}());
