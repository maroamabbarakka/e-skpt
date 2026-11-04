(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const message = $('accountMessage'), workspace = $('accountWorkspace'), list = $('accountList'), form = $('accountForm');
  const roleLabel = role => ({SUPER_ADMIN:'Super Admin',DISPERINDAG_ADMIN:'Admin Disperindag',TRADE_ADMIN:'Admin Perdagangan',MARKET_ADMIN:'Admin Pasar/Wilayah',MARKET_HEAD:'Kepala Pasar',UPTD_HEAD:'Kepala UPTD',KADIS:'Kepala Dinas',TECH_ADMIN:'Admin Teknis'}[role] || role || 'Petugas');
  const groupOrder = ['MARKET_HEAD','UPTD_HEAD','MARKET_ADMIN','DISPERINDAG_ADMIN','TRADE_ADMIN','KADIS','TECH_ADMIN','SUPER_ADMIN'];
  const ROLE_META = Object.freeze({
    SUPER_ADMIN:{scope:'Seluruh sistem',access:'Kelola akun, konfigurasi, data, dan audit sistem.'},
    DISPERINDAG_ADMIN:{scope:'Seluruh kabupaten',access:'Review pendaftaran, master pedagang, dan administrasi lintas pasar.'},
    TRADE_ADMIN:{scope:'Seluruh kabupaten',access:'Administrasi data perdagangan dan pelaporan kabupaten.'},
    MARKET_ADMIN:{scope:'Pasar yang ditugaskan',access:'Administrasi pedagang dan klaim dalam cakupan pasar/wilayah.'},
    MARKET_HEAD:{scope:'Pasar yang ditugaskan',access:'Verifikasi faktual unit, konflik, dan pengesahan tahunan.'},
    UPTD_HEAD:{scope:'Satu wilayah UPTD',access:'Telaah hasil verifikasi sebelum keputusan Kepala Dinas.'},
    KADIS:{scope:'Keputusan kabupaten',access:'Persetujuan, penolakan, TTE, dan finalisasi melalui backend.'},
    TECH_ADMIN:{scope:'Operasional teknis',access:'Pemantauan teknis tanpa keputusan legal SKPT.'}
  });
  const esc = value => String(value ?? '—').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  let actor = null, accounts = [], accountById = new Map();
  const editor = $('accountEditor');
  const openEditor = () => { editor.classList.add('open'); editor.setAttribute('aria-hidden','false'); };
  const closeEditor = () => { editor.classList.remove('open'); editor.setAttribute('aria-hidden','true'); };
  const initials = value => String(value || 'EP').split(/\s+/).slice(0,2).map(word => word[0]).join('').toUpperCase();
  const marketName = id => window.EPASAR?.marketById(id)?.name?.replace('Pasar Rakyat ','') || id;

  function ensureUptdOptions() {
    [['role', 'Kepala UPTD'], ['accountRoleFilter', 'Kepala UPTD']].forEach(([id, label]) => {
      const select = $(id);
      if (!select || [...select.options].some(option => option.value === 'UPTD_HEAD')) return;
      const option = document.createElement('option');
      option.value = 'UPTD_HEAD'; option.textContent = label;
      select.appendChild(option);
    });
  }

  function setMessage(text, error) { message.hidden = false; message.textContent = text; message.className = error ? 'admin-error' : 'admin-message'; }
  function selectedMarkets() { return [...document.querySelectorAll('[name="assignedMarket"]:checked')].map(input => input.value); }
  function renderMarketChecklist(selected = []) {
    $('marketChecklist').innerHTML = (window.EPASAR?.MARKETS || []).map(market => `<label class="market-check"><input type="checkbox" name="assignedMarket" value="${esc(market.id)}" ${selected.includes(market.id) ? 'checked' : ''}><span><b>${esc(market.name.replace('Pasar Rakyat ',''))}</b><small>${esc(market.id)} · ${esc(market.district)}</small></span></label>`).join('');
  }
  function syncMarketSection() { $('marketAssignmentSection').hidden = !['MARKET_HEAD','MARKET_ADMIN','UPTD_HEAD'].includes($('role').value); }
  function clear() { form.reset(); $('uid').value=''; $('newAccountFields').hidden=false; $('formTitle').textContent='Akun Baru'; $('formSubtitle').textContent='Lengkapi identitas dan ruang lingkup tugas.'; renderMarketChecklist([]); syncMarketSection(); $('accountError').textContent=''; }
  function fill(data) {
    $('uid').value=data.uid; $('newAccountFields').hidden=true; $('username').value=data.username||''; $('displayName').value=data.displayName||''; $('position').value=data.position||''; $('role').value=data.role||'DISPERINDAG_ADMIN'; $('status').value=data.status||'ACTIVE'; $('phone').value=data.phone||''; $('formTitle').textContent=data.displayName||'Edit Profil'; $('formSubtitle').textContent=`${roleLabel(data.role)} · ${data.username || data.uid}`; renderMarketChecklist(data.marketIds||[]); syncMarketSection(); $('accountError').textContent=''; openEditor();
  }
  function updateKpis() {
    const heads=accounts.filter(row=>row.role==='MARKET_HEAD'), covered=new Set(heads.filter(row=>row.status==='ACTIVE').flatMap(row=>row.marketIds||[]));
    $('accountTotal').textContent=accounts.length; $('accountActive').textContent=accounts.filter(row=>row.status==='ACTIVE').length; $('accountRoleCount').textContent=`${new Set(accounts.map(row=>row.role).filter(role=>ROLE_META[role])).size}/${Object.keys(ROLE_META).length}`; $('accountMarketHeads').textContent=heads.length; $('accountMarketCoverage').textContent=`${covered.size} dari ${(window.EPASAR?.MARKETS||[]).length} pasar aktif`; $('accountAreaAdmins').textContent=accounts.filter(row=>row.role==='MARKET_ADMIN').length;
  }
  function scopeLabel(row) { const ids=Array.isArray(row.marketIds)?row.marketIds:[]; if(!['MARKET_HEAD','MARKET_ADMIN','UPTD_HEAD'].includes(row.role))return ROLE_META[row.role]?.scope||'Sesuai role'; if(!ids.length)return'BELUM ADA CAKUPAN'; return ids.length===1?`${ids[0]} · ${marketName(ids[0])}`:`${ids.length} pasar · ${ids.join(', ')}`; }
  function renderRoleSummary() { const target=$('accountRoleSummary'); if(!target)return; target.innerHTML=groupOrder.map(role=>{const rows=accounts.filter(row=>row.role===role),active=rows.filter(row=>row.status==='ACTIVE').length,meta=ROLE_META[role];return `<article class="rbac-role-card ${rows.length?'':'empty'}"><header><span class="rbac-role-code">${esc(role)}</span><strong>${esc(roleLabel(role))}</strong></header><div class="rbac-role-count"><b>${rows.length}</b><span>user · ${active} aktif</span></div><p>${esc(meta.access)}</p><small>Cakupan: ${esc(meta.scope)}</small></article>`;}).join(''); }
  function filteredAccounts() {
    const term=$('accountSearch').value.trim().toLowerCase(), role=$('accountRoleFilter').value, status=$('accountStatusFilter').value;
    return accounts.filter(row => (!role||row.role===role)&&(!status||row.status===status)&&(!term||[row.displayName,row.position,row.username,row.role,...(row.marketIds||[]).map(marketName)].some(value=>String(value||'').toLowerCase().includes(term))));
  }
  function render() {
    const visible=filteredAccounts(); $('accountResultCount').textContent=`${visible.length} akun`;
    list.innerHTML=visible.length?`<table class="rbac-user-table"><thead><tr><th>No.</th><th>Nama dan jabatan</th><th>Username</th><th>Password</th><th>Role</th><th>Cakupan akses</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${visible.map((row,index)=>`<tr><td class="row-number">${index+1}</td><td><strong>${esc(row.displayName||'Nama belum diisi')}</strong><small>${esc(row.position||roleLabel(row.role))}</small></td><td><code>${esc(row.username||'BELUM ADA')}</code>${row.username?`<small>${esc(row.username)}@eskpt.id</small>`:'<small>Username login belum tersedia</small>'}</td><td><span class="password-protected">Tidak dapat ditampilkan</span><small>Hash Firebase · reset bila terlupa</small></td><td><strong>${esc(roleLabel(row.role))}</strong><code>${esc(row.role)}</code></td><td><span class="scope-value">${esc(scopeLabel(row))}</span></td><td><span class="staff-status ${row.status==='ACTIVE'?'active':'inactive'}">${row.status==='ACTIVE'?'AKTIF':'NONAKTIF'}</span></td><td><button class="table-edit-button" type="button" data-account="${esc(row.uid)}">Edit</button></td></tr>`).join('')}</tbody></table>`:'<div class="account-empty"><b>Tidak ada akun yang sesuai.</b><p>Ubah pencarian atau filter untuk melihat akun lainnya.</p></div>';
    list.querySelectorAll('[data-account]').forEach(button=>button.addEventListener('click',()=>fill(accountById.get(button.dataset.account))));
  }
  async function load() {
    const snapshot=await window.db.collection('users').orderBy('displayName').get(); accounts=snapshot.docs.map(doc=>({uid:doc.id,...doc.data()})); accountById=new Map(accounts.map(row=>[row.uid,row])); updateKpis(); renderRoleSummary(); render();
  }

  $('openAccountEditor').addEventListener('click',()=>{clear();openEditor();}); $('closeAccountEditor').addEventListener('click',closeEditor); $('accountEditorScrim').addEventListener('click',closeEditor); $('clearForm').addEventListener('click',clear); $('role').addEventListener('change',syncMarketSection);
  ['accountSearch','accountRoleFilter','accountStatusFilter'].forEach(id=>$(id).addEventListener(id==='accountSearch'?'input':'change',render)); $('accountReset').addEventListener('click',()=>{$('accountSearch').value='';$('accountRoleFilter').value='';$('accountStatusFilter').value='';render();});
  form.addEventListener('submit',async event=>{event.preventDefault();$('accountError').textContent='';const submit=form.querySelector('[type="submit"]');submit.disabled=true;try{const uid=$('uid').value.trim(),existing=accountById.get(uid),input={uid,username:uid?(existing?.username||$('username').value):$('username').value,email:$('email').value,password:$('initialPassword').value,displayName:$('displayName').value,position:$('position').value,role:$('role').value,marketIds:selectedMarkets(),status:$('status').value,phone:$('phone').value};const saved=uid?await window.EPASAR_ACCOUNT.save(uid,input,existing):await window.EPASAR_ACCOUNT.provision(input);setMessage(`${uid?'Profil dan kewenangan':'Akun petugas'} berhasil disimpan dan diverifikasi di server${saved.marketIds?.length?` (${saved.marketIds.length} pasar)`:''}.`,false);clear();closeEditor();await load();}catch(error){$('accountError').textContent=`${error.code?`[${error.code}] `:''}${error.message||'Akun belum berhasil disimpan.'}`;}finally{submit.disabled=false;}});
  (async()=>{ensureUptdOptions();try{window.EPASAR_FIREBASE_INIT();actor=await window.EPASAR_AUTH.requireStaff(['SUPER_ADMIN']);window.EPASAR_CURRENT_PROFILE=actor;window.EPASAR_INTERNAL_UI?.setProfile(actor);}catch(error){setMessage('Halaman hanya tersedia untuk Super Admin yang aktif.',true);setTimeout(()=>{location.href='login.html';},1000);return;}workspace.hidden=false;message.hidden=true;renderMarketChecklist([]);syncMarketSection();try{await load();}catch(error){const busy=/quota|resource-exhausted/i.test(String(error?.message||error));setMessage(busy?'Layanan data sedang sibuk. Data akun tetap aman; coba kembali setelah beberapa saat.':'Direktori akun belum dapat dimuat. Periksa koneksi lalu muat ulang halaman.',true);list.innerHTML='<div class="account-empty"><b>Direktori belum tersedia.</b><p>Tidak ada perubahan data yang dilakukan.</p></div>';}})();
}());
