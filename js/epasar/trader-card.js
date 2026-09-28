(function () {
  'use strict';

  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = 'css/document-polish.css';
  document.head.appendChild(style);

  const photoStyle = document.createElement('link');
  photoStyle.rel = 'stylesheet';
  photoStyle.href = 'css/photo-documents.css';
  document.head.appendChild(photoStyle);

  const printStyle = document.createElement('link');
  printStyle.rel = 'stylesheet';
  printStyle.href = 'css/card-print.css';
  document.head.appendChild(printStyle);

  const token = new URLSearchParams(location.search).get('token');
  const message = document.getElementById('message');
  const card = document.getElementById('card');

  const esc = (v) => String(v ?? '-').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const publicNumber = (d) => d.publicId || String(d.traderId || '').replace(/^TRD-/i, 'PDG-').replace(/^uat-trader-(\d+)$/i, (_, n) => `PDG-PIN-26-UAT${String(n).padStart(3, '0')}`);

  async function publicPhoto(mediaToken, fallback) {
    if (!mediaToken) return fallback;
    const firestore = window.db || (window.firebase?.firestore ? window.firebase.firestore() : null);
    if (!firestore) return fallback;
    try {
      const media = await firestore.collection('trader_media').doc(mediaToken).get();
      if (!media.exists) return fallback;
      const value = media.data();
      if (value.mime && value.dataBase64) {
        return `data:${value.mime};base64,${value.dataBase64}`;
      }
      return fallback;
    } catch (_) {
      return fallback;
    }
  }

  async function fetchCardDocument(targetToken) {
    const firestore = window.db || (window.firebase?.firestore ? window.firebase.firestore() : null);
    if (!firestore) return null;

    // 1. Coba baca dari public_skpt_verification (Publik untuk verifikasi SKPT & Kartu)
    try {
      const snap = await firestore.collection('public_skpt_verification').doc(targetToken).get();
      if (snap.exists && snap.data()) {
        const raw = snap.data();
        const snapDoc = raw.documentSnapshot || {};
        return {
          displayName: snapDoc.displayName || raw.displayName || 'Pedagang Pasar',
          businessType: snapDoc.businessType || 'Usaha Pasar',
          marketName: snapDoc.marketName || 'Pasar Rakyat Pinrang',
          unitType: snapDoc.unitType || 'Unit',
          unitNumber: snapDoc.unitNumber || '',
          publicId: raw.traderId || '',
          traderId: raw.traderId || '',
          photoMediaToken: raw.photoMediaToken || '',
          photoUrl: raw.photoUrl || '',
          registrationCode: raw.number || raw.applicationId || '',
          isDemo: raw.isDemo === true || raw.environment === 'UAT',
          environment: raw.environment || 'UAT'
        };
      }
    } catch (_) {}

    // 2. Coba baca dari public_status (Publik dari pendaftaran online pedagang)
    try {
      const snap = await firestore.collection('public_status').doc(targetToken).get();
      if (snap.exists && snap.data()) {
        const raw = snap.data();
        return {
          displayName: raw.displayName || 'Pedagang Pasar',
          businessType: raw.businessType || 'Usaha Pasar',
          marketName: raw.marketName || 'Pasar Rakyat Pinrang',
          unitType: 'Unit',
          unitNumber: '',
          publicId: raw.traderId || '',
          traderId: raw.traderId || '',
          photoMediaToken: raw.photoMediaToken || '',
          photoUrl: raw.photoUrl || '',
          registrationCode: raw.registrationCode || '',
          isDemo: raw.isDemo === true || raw.environment === 'UAT',
          environment: raw.environment || 'UAT'
        };
      }
    } catch (_) {}

    // 3. Jika pengguna adalah staf yang sedang login, coba ambil dari skpt_documents / traders
    try {
      const auth = window.firebase?.auth ? window.firebase.auth() : null;
      if (auth && !auth.currentUser) {
        await new Promise(resolve => {
          const unsub = auth.onAuthStateChanged(() => { unsub(); resolve(); });
          setTimeout(resolve, 800);
        });
      }

      if (auth && auth.currentUser) {
        // Coba dokumen SKPT langsung by ID
        try {
          const docSnap = await firestore.collection('skpt_documents').doc(targetToken).get();
          if (docSnap.exists) {
            const raw = docSnap.data();
            const snapDoc = raw.documentSnapshot || {};
            return {
              displayName: snapDoc.displayName || 'Pedagang Pasar',
              businessType: snapDoc.businessType || 'Usaha Pasar',
              marketName: snapDoc.marketName || 'Pasar Rakyat Pinrang',
              unitType: snapDoc.unitType || 'Unit',
              unitNumber: snapDoc.unitNumber || '',
              publicId: raw.traderId || '',
              traderId: raw.traderId || '',
              photoMediaToken: raw.photoMediaToken || '',
              registrationCode: raw.number || '',
              isDemo: raw.isDemo === true || raw.environment === 'UAT',
              environment: raw.environment || 'UAT'
            };
          }
        } catch (_) {}

        // Query skpt_documents by verificationToken
        try {
          const qSnap = await firestore.collection('skpt_documents').where('verificationToken', '==', targetToken).limit(1).get();
          if (!qSnap.empty) {
            const raw = qSnap.docs[0].data();
            const snapDoc = raw.documentSnapshot || {};
            return {
              displayName: snapDoc.displayName || 'Pedagang Pasar',
              businessType: snapDoc.businessType || 'Usaha Pasar',
              marketName: snapDoc.marketName || 'Pasar Rakyat Pinrang',
              unitType: snapDoc.unitType || 'Unit',
              unitNumber: snapDoc.unitNumber || '',
              publicId: raw.traderId || '',
              traderId: raw.traderId || '',
              photoMediaToken: raw.photoMediaToken || '',
              registrationCode: raw.number || '',
              isDemo: raw.isDemo === true || raw.environment === 'UAT',
              environment: raw.environment || 'UAT'
            };
          }
        } catch (_) {}

        // Query skpt_documents by traderId
        try {
          const qTrd = await firestore.collection('skpt_documents').where('traderId', '==', targetToken).limit(1).get();
          if (!qTrd.empty) {
            const raw = qTrd.docs[0].data();
            const snapDoc = raw.documentSnapshot || {};
            return {
              displayName: snapDoc.displayName || 'Pedagang Pasar',
              businessType: snapDoc.businessType || 'Usaha Pasar',
              marketName: snapDoc.marketName || 'Pasar Rakyat Pinrang',
              unitType: snapDoc.unitType || 'Unit',
              unitNumber: snapDoc.unitNumber || '',
              publicId: raw.traderId || '',
              traderId: raw.traderId || '',
              photoMediaToken: raw.photoMediaToken || '',
              registrationCode: raw.number || '',
              isDemo: raw.isDemo === true || raw.environment === 'UAT',
              environment: raw.environment || 'UAT'
            };
          }
        } catch (_) {}

        // Ambil dari traders collection
        try {
          const trdSnap = await firestore.collection('traders').doc(targetToken).get();
          if (trdSnap.exists) {
            const t = trdSnap.data();
            return {
              displayName: t.displayName || t.name || 'Pedagang Pasar',
              businessType: t.businessType || 'Usaha Pasar',
              marketName: t.marketName || 'Pasar Rakyat Pinrang',
              unitType: t.unitType || 'Unit',
              unitNumber: t.unitNumber || '',
              publicId: t.traderId || t.id || '',
              traderId: t.traderId || t.id || '',
              photoMediaToken: t.photoMediaToken || '',
              registrationCode: t.registrationCode || '',
              isDemo: false,
              environment: 'PROD'
            };
          }
        } catch (_) {}
      }
    } catch (_) {}

    return null;
  }

  async function boot() {
    if (!token) {
      message.textContent = 'Token kartu tidak tersedia.';
      return;
    }

    try {
      const d = await fetchCardDocument(token);
      if (!d) {
        message.textContent = 'Kartu pedagang tidak ditemukan atau tautan verifikasi tidak valid.';
        return;
      }

      // Ambil desain kartu dinamis dari konfigurasi sistem
      let appSettings = null;
      try {
        if (window.EPASAR_CONFIG_SERVICE) {
          appSettings = await window.EPASAR_CONFIG_SERVICE.getSettings();
        } else if (window.db) {
          const snapCfg = await window.db.collection('app_settings').doc('general').get();
          if (snapCfg.exists) appSettings = snapCfg.data();
        }
      } catch (_) {}

      const cardCfg = appSettings?.cardDesign || {};
      const cardTitle = cardCfg.headerTitle || 'KARTU PEDAGANG e-PASAR';
      const cardSubtitle = cardCfg.headerSubtitle || 'Pemerintah Kabupaten Pinrang';
      const cardTheme = cardCfg.theme || 'navy';
      const showPhoto = cardCfg.showPhoto !== false;
      const showQr = cardCfg.showQr !== false;

      const isTraining = d.isDemo === true || ['UAT', 'INTERNAL_UAT', 'TEST', 'TRAINING', 'DEMO'].includes(String(d.environment || '').toUpperCase()) || token.startsWith('uat-');
      message.hidden = true;
      card.hidden = false;

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

      const unitText = (d.unitType && d.unitNumber) ? ` (${esc(d.unitType)} ${esc(d.unitNumber)})` : '';
      const locationText = d.marketName ? ` · ${esc(d.marketName)}${unitText}` : '';

      card.innerHTML = `${isTraining ? '<div class="card-uat-mark">UJI COBA · BUKAN KARTU RESMI</div>' : ''}<div class="card-brand"><img src="logo_pinrang_opt.png" alt="Logo Kabupaten Pinrang"><div><b>${esc(cardTitle)}</b><small>${esc(cardSubtitle)}</small></div></div>${photoBlock}<div class="card-person"><h1>${esc(d.displayName || 'Pedagang')}</h1><p>${esc(d.businessType || 'Pelaku usaha')}${locationText}</p><p class="card-code">${esc(publicNumber(d))}</p></div>${qrBlock}`;

      if (showQr && window.QRCode) {
        const qrTargetUrl = `${location.origin}/epasar-status.html?token=${encodeURIComponent(token)}&code=${encodeURIComponent(d.registrationCode || '')}`;
        new window.QRCode(document.getElementById('cardQr'), {
          text: qrTargetUrl,
          width: 128,
          height: 128,
          colorDark: '#123f7c',
          colorLight: '#fff',
          correctLevel: window.QRCode.CorrectLevel.H
        });
      }
    } catch (error) {
      console.error('[e-PASAR Trader Card Error]', error);
      message.textContent = 'Kartu belum dapat dimuat: ' + (error.message || 'Terjadi kesalahan sistem.');
    }
  }

  boot();
}());
