(function () {
  'use strict';
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = 'css/document-polish.css';
  document.head.appendChild(style);
  const photoStyle = document.createElement('link');
  photoStyle.rel = 'stylesheet'; photoStyle.href = 'css/photo-documents.css'; document.head.appendChild(photoStyle);
  const printStyle = document.createElement('link');
  printStyle.rel = 'stylesheet'; printStyle.href = 'css/card-print.css'; document.head.appendChild(printStyle);
  const token = new URLSearchParams(location.search).get('token');
  const message = document.getElementById('message');
  const card = document.getElementById('card');
  const esc = (v) => String(v ?? '-').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const publicNumber = (d) => d.publicId || String(d.traderId || '').replace(/^TRD-/i,'PDG-').replace(/^uat-trader-(\d+)$/i,(_,n)=>`PDG-PIN-26-UAT${String(n).padStart(3,'0')}`);
  async function publicPhoto(mediaToken, fallback) {
    if (!mediaToken) return fallback;
    try {
      const media = await db.collection('trader_media').doc(mediaToken).get();
      if (!media.exists) return fallback;
      const value = media.data();
      if (value.ownerType !== 'PUBLIC_DOCUMENT' || value.ownerId !== mediaToken || value.mediaType !== 'PROFILE_PUBLIC' || value.status !== 'PUBLIC' || value.mime !== 'image/webp' || !value.dataBase64) return fallback;
      return `data:${value.mime};base64,${value.dataBase64}`;
    } catch (_) { return fallback; }
  }
  async function boot() {
    if (!token) { message.textContent = 'Token kartu tidak tersedia.'; return; }
    try {
      const snap = await db.collection('public_status').doc(token).get();
      if (!snap.exists) { message.textContent = 'Kartu tidak ditemukan.'; return; }
      const d = snap.data();
      const isTraining = d.isDemo === true || ['UAT','INTERNAL_UAT','TEST','TRAINING','DEMO'].includes(String(d.environment || '').toUpperCase()) || token.startsWith('uat-');
      message.hidden = true; card.hidden = false;
      const photoUrl = await publicPhoto(d.photoMediaToken, d.photoUrl || (isTraining ? 'assets/uat/pedagang-contoh-transparan.png' : ''));
      card.classList.toggle('has-photo',Boolean(photoUrl));
      card.innerHTML = `${isTraining ? '<div class="card-uat-mark">UJI COBA · BUKAN KARTU RESMI</div>' : ''}<div class="card-brand"><img src="logo_pinrang_opt.png" alt="Logo Kabupaten Pinrang"><div><b>KARTU PEDAGANG e-PASAR</b><small>Pemerintah Kabupaten Pinrang</small></div></div>${photoUrl?`<img class="card-photo" src="${esc(photoUrl)}" alt="Foto pedagang">`:''}<div class="card-person"><h1>${esc(d.displayName || 'Pedagang')}</h1><p>${esc(d.businessType || 'Pelaku usaha')}${d.marketName ? ` · ${esc(d.marketName)}` : ''}</p><p class="card-code">${esc(publicNumber(d))}</p></div><div id="cardQr" class="card-qr branded-qr"></div>`;
      if (window.QRCode) new QRCode(document.getElementById('cardQr'), { text: `${location.origin}/epasar-status.html?token=${encodeURIComponent(token)}&code=${encodeURIComponent(d.registrationCode || '')}`, width:128, height:128, colorDark:'#123f7c', colorLight:'#fff', correctLevel:QRCode.CorrectLevel.H });
    } catch (error) { console.error(error); message.textContent = 'Kartu belum dapat dimuat. Silakan coba kembali.'; }
  }
  boot();
}());
