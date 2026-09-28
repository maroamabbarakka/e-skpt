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

      // Ambil desain kartu dinamis dari konfigurasi sistem
      let appSettings = null;
      try {
        if (window.EPASAR_CONFIG_SERVICE) {
          appSettings = await window.EPASAR_CONFIG_SERVICE.getSettings();
        } else if (window.db) {
          const snapCfg = await db.collection('app_settings').doc('general').get();
          if (snapCfg.exists) appSettings = snapCfg.data();
        }
      } catch (_) {}

      const cardCfg = appSettings?.cardDesign || {};
      const cardTitle = cardCfg.headerTitle || 'KARTU PEDAGANG e-PASAR';
      const cardSubtitle = cardCfg.headerSubtitle || 'Pemerintah Kabupaten Pinrang';
      const cardTheme = cardCfg.theme || 'navy';
      const showPhoto = cardCfg.showPhoto !== false;
      const showQr = cardCfg.showQr !== false;

      const isTraining = d.isDemo === true || ['UAT','INTERNAL_UAT','TEST','TRAINING','DEMO'].includes(String(d.environment || '').toUpperCase()) || token.startsWith('uat-');
      message.hidden = true; card.hidden = false;

      // Styling tema dinamis
      const themeColors = {
        navy: 'linear-gradient(135deg, #094eb8 0%, #032b69 100%)',
        emerald: 'linear-gradient(135deg, #059669 0%, #064e3b 100%)',
        gold: 'linear-gradient(135deg, #d97706 0%, #78350f 100%)',
        dark: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)'
      };
      if (themeColors[cardTheme]) {
        card.style.background = themeColors[cardTheme];
      }

      const photoUrl = showPhoto ? await publicPhoto(d.photoMediaToken, d.photoUrl || (isTraining ? 'assets/uat/pedagang-contoh-transparan.png' : '')) : '';
      card.classList.toggle('has-photo', Boolean(photoUrl));

      const photoBlock = (showPhoto && photoUrl) ? `<img class="card-photo" src="${esc(photoUrl)}" alt="Foto pedagang">` : '';
      const qrBlock = showQr ? '<div id="cardQr" class="card-qr branded-qr"></div>' : '';

      card.innerHTML = `${isTraining ? '<div class="card-uat-mark">UJI COBA · BUKAN KARTU RESMI</div>' : ''}<div class="card-brand"><img src="logo_pinrang_opt.png" alt="Logo Kabupaten Pinrang"><div><b>${esc(cardTitle)}</b><small>${esc(cardSubtitle)}</small></div></div>${photoBlock}<div class="card-person"><h1>${esc(d.displayName || 'Pedagang')}</h1><p>${esc(d.businessType || 'Pelaku usaha')}${d.marketName ? ` · ${esc(d.marketName)}` : ''}</p><p class="card-code">${esc(publicNumber(d))}</p></div>${qrBlock}`;
      if (showQr && window.QRCode) new QRCode(document.getElementById('cardQr'), { text: `${location.origin}/epasar-status.html?token=${encodeURIComponent(token)}&code=${encodeURIComponent(d.registrationCode || '')}`, width:128, height:128, colorDark:'#123f7c', colorLight:'#fff', correctLevel:QRCode.CorrectLevel.H });
    } catch (error) { console.error(error); message.textContent = 'Kartu belum dapat dimuat. Silakan coba kembali.'; }
  }
  boot();
}());
