(function(){
  'use strict';
  const rawName = (location.pathname.split('/').pop() || 'admin-epasar.html').split('?')[0].split('#')[0];
  const path = (!rawName || rawName === '') ? 'admin-epasar.html' : (rawName.endsWith('.html') ? rawName : rawName + '.html');
  const pageMap={
    'admin-epasar.html':['Dashboard','Utama'],
    'database-pedagang.html':['Database Pedagang','Data & Laporan'],
    'admin-intake-review.html':['Review Pendaftaran','Pendataan'],
    'photo-editor.html':['Pengolah Foto','Pendataan'],
    'market-verification.html':['Verifikasi Unit','Pasar'],
    'kadis-approval.html':['Persetujuan SKPT','e-SKPT'],
    'annual-validation.html':['Pengesahan Tahunan','e-SKPT'],
    'occupancy-change.html':['Perubahan Pemegang','Pasar'],
    'admin-akun.html':['Kelola Akun','Sistem'],
    'profil.html':['Profil & Keamanan','Sistem']
  };
  if(!pageMap[path])return;
  const icons={home:'<path d="M3 11 12 3l9 8v9h-6v-6H9v6H3z"/>',inbox:'<path d="M4 5h16v14H4zM4 14h5l2 2h2l2-2h5"/>',market:'<path d="M4 9h16l-2-5H6zM6 9v11h12V9M9 20v-6h6v6"/>',doc:'<path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h5"/>',calendar:'<path d="M4 6h16v14H4zM8 3v6M16 3v6M4 10h16"/>',swap:'<path d="m7 7 3-3m-3 3 3 3M17 17l-3 3m3-3-3-3M8 7h9v5M16 17H7v-5"/>',users:'<path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21c.6-4.3 2.8-7 7-7s6.4 2.7 7 7M17 8a3 3 0 0 1 0 6M18 15c2.4.4 3.7 2.4 4 5"/>',profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-5 3.3-7 8-7s7.2 2 8 7"/>'};
  const menu=[
    ['UTAMA','admin-epasar.html','Dashboard','home',['ALL']],
    ['DATA & LAPORAN','database-pedagang.html','Database Pedagang','users',['SUPER_ADMIN','DISPERINDAG_ADMIN','TRADE_ADMIN','MARKET_ADMIN','MARKET_HEAD','KADIS','TECH_ADMIN']],
    ['PENDATAAN','admin-epasar.html#pendaftaran','Pendaftaran Masuk','inbox',['SUPER_ADMIN','DISPERINDAG_ADMIN','TRADE_ADMIN','MARKET_ADMIN']],
    ['', 'admin-intake-review.html','Review Pendaftaran','inbox',['SUPER_ADMIN','DISPERINDAG_ADMIN','TRADE_ADMIN','MARKET_ADMIN']],
    ['PASAR','market-verification.html','Verifikasi Unit','market',['SUPER_ADMIN','MARKET_HEAD']],
    ['', 'occupancy-change.html','Perubahan Pemegang','swap',['SUPER_ADMIN','MARKET_HEAD','KADIS']],
    ['e-SKPT','kadis-approval.html','Persetujuan','doc',['SUPER_ADMIN','KADIS']],
    ['', 'annual-validation.html','Pengesahan Tahunan','calendar',['SUPER_ADMIN','DISPERINDAG_ADMIN','TRADE_ADMIN','MARKET_ADMIN','MARKET_HEAD','KADIS','TECH_ADMIN']],
    ['SISTEM','admin-akun.html','Kelola Akun','users',['SUPER_ADMIN']],
    ['', 'profil.html','Profil & Keamanan','profile',['ALL']]
  ];
  const main=document.querySelector('main');if(!main)return;
  document.body.classList.add('internal-app');
  const layout=document.createElement('div');layout.className='internal-layout';
  const sidebar=document.createElement('aside');sidebar.className='internal-sidebar';sidebar.setAttribute('aria-label','Navigasi ruang kerja');
  sidebar.innerHTML='<a class="internal-brand" href="admin-epasar.html"><img src="logo_pinrang_opt.png" alt="Logo Kabupaten Pinrang"><span><b>e-PASAR</b><small>Administrasi Pedagang<br>Kabupaten Pinrang</small></span></a><nav class="internal-nav" id="internalNav"><div class="internal-nav-group">MEMUAT MENU</div></nav><div class="internal-sidebar-foot"><small>Ruang kerja aktif</small><strong id="sidebarRole">Memeriksa kewenangan…</strong></div>';
  const stage=document.createElement('div');stage.className='internal-stage';
  const top=document.createElement('header');top.className='internal-topbar';top.innerHTML='<div class="internal-topbar-left"><button class="internal-menu" type="button" aria-label="Buka navigasi" aria-expanded="false">☰</button><div class="internal-crumb"><a href="admin-epasar.html">Dashboard</a> / '+pageMap[path][1]+' / <b>'+pageMap[path][0]+'</b></div></div><div class="internal-user"><div class="internal-user-copy"><b id="shellUserName">Memeriksa akun…</b><small id="shellUserRole">Ruang kerja internal</small></div><span class="internal-avatar" id="shellAvatar">EP</span><div class="internal-user-menu"><a class="internal-icon-button" href="profil.html" aria-label="Profil akun">⚙</a><button class="internal-icon-button" id="shellLogout" type="button" aria-label="Keluar">↪</button></div></div>';
  const content=document.createElement('div');content.className='internal-content';
  main.parentNode.insertBefore(layout,main);content.appendChild(main);stage.append(top,content);layout.append(sidebar,stage);
  const scrim=document.createElement('button');scrim.className='internal-scrim';scrim.type='button';scrim.setAttribute('aria-label','Tutup navigasi');layout.appendChild(scrim);
  const modal=document.createElement('div');modal.className='internal-modal';modal.hidden=true;modal.innerHTML='<div class="internal-modal-card" role="dialog" aria-modal="true" aria-labelledby="internalModalTitle"><span class="internal-modal-icon">✓</span><h2 id="internalModalTitle">Konfirmasi tindakan</h2><p id="internalModalText"></p><div class="form-actions"><button class="button secondary" data-modal="cancel" type="button">Batal</button><button class="button primary" data-modal="confirm" type="button">Ya, Lanjutkan</button></div></div>';document.body.appendChild(modal);
  const toggle=top.querySelector('.internal-menu');const close=()=>{layout.classList.remove('nav-open');toggle.setAttribute('aria-expanded','false')};toggle.addEventListener('click',()=>{const open=layout.classList.toggle('nav-open');toggle.setAttribute('aria-expanded',String(open))});scrim.addEventListener('click',close);window.addEventListener('resize',()=>{if(innerWidth>760)close()});
  const roleLabels={SUPER_ADMIN:'Super Admin',DISPERINDAG_ADMIN:'Admin Disperindag',TRADE_ADMIN:'Admin Perdagangan',MARKET_ADMIN:'Admin Pasar',MARKET_HEAD:'Kepala Pasar',KADIS:'Kepala Dinas',TECH_ADMIN:'Admin Teknis'};
  function draw(profile){
    const role=profile?.role||'';let last='';const nav=document.getElementById('internalNav');nav.innerHTML='';
    menu.filter(row=>row[4].includes('ALL')||row[4].includes(role)).forEach(row=>{if(row[0]&&row[0]!==last){const group=document.createElement('div');group.className='internal-nav-group';group.textContent=row[0];nav.appendChild(group);last=row[0]}const a=document.createElement('a');a.href=row[1];a.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24">'+icons[row[3]]+'</svg><span>'+row[2]+'</span>';if(row[1].split('#')[0]===path)a.classList.add('active');nav.appendChild(a)});
    const name=profile.displayName||profile.position||roleLabels[role]||'Petugas';const label=roleLabels[role]||role;document.getElementById('shellUserName').textContent=name;document.getElementById('shellUserRole').textContent=label;document.getElementById('sidebarRole').textContent=label;document.getElementById('shellAvatar').textContent=name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'EP';
  }
  const timer=setInterval(()=>{if(window.EPASAR_CURRENT_PROFILE){clearInterval(timer);draw(window.EPASAR_CURRENT_PROFILE)}},100);setTimeout(()=>clearInterval(timer),15000);
  document.getElementById('shellLogout').addEventListener('click',async()=>{try{if(window.EPASAR_AUTH)await window.EPASAR_AUTH.signOut()}finally{location.href='login.html'}});
  function confirmAction(options={}){return new Promise(resolve=>{modal.querySelector('h2').textContent=options.title||'Konfirmasi tindakan';modal.querySelector('p').innerHTML=options.message||'Pastikan data sudah benar sebelum melanjutkan.';modal.querySelector('[data-modal="confirm"]').textContent=options.confirmText||'Ya, Lanjutkan';modal.hidden=false;const done=value=>{modal.hidden=true;modal.onclick=null;resolve(value)};modal.onclick=event=>{if(event.target===modal||event.target.closest('[data-modal="cancel"]'))done(false);if(event.target.closest('[data-modal="confirm"]'))done(true)}})}
  window.EPASAR_INTERNAL_UI={setProfile:draw,closeNavigation:close,confirm:confirmAction};
})();
