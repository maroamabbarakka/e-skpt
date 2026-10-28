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

  const oneLine = (value, fallback = '-') => String(value || fallback).replace(/\s+/g, ' ').trim();

  function dateId(value) {
    if (!value) return '-';
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  function fitOneLine(element) {
    if (!element) return;
    const minPt = Number(element.dataset.minPt || 6.5);
    let sizePx = Number.parseFloat(getComputedStyle(element).fontSize);
    const minPx = minPt * (96 / 72);
    while (element.scrollWidth > element.clientWidth + 1 && sizePx > minPx) {
      sizePx = Math.max(minPx, sizePx - 0.25);
      element.style.fontSize = `${sizePx}px`;
    }
    const overflow = element.scrollWidth > element.clientWidth + 1;
    element.classList.toggle('card-text-overflow', overflow);
    if (overflow) element.title = 'Teks terlalu panjang untuk dicetak utuh. Ringkas data sebelum penerbitan.';
  }

  function fitCardText() {
    card.querySelectorAll('[data-fit-one-line]').forEach(fitOneLine);
  }

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
          businessName: snapDoc.businessName || raw.businessName || '',
          businessType: snapDoc.businessType || raw.businessType || 'Usaha Pasar',
          marketId: snapDoc.marketId || raw.marketId || '',
          marketName: snapDoc.marketName || 'Pasar Rakyat Pinrang',
          unitType: snapDoc.unitType || 'Unit',
          unitNumber: snapDoc.unitNumber || '',
          publicId: raw.traderId || '',
          traderId: raw.traderId || '',
          photoMediaToken: raw.photoMediaToken || '',
          photoUrl: raw.photoUrl || '',
          registrationCode: raw.number || raw.applicationId || '',
          validUntil: raw.validUntil || snapDoc.validUntil || null,
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
        const isNonMarket = raw.isNonMarket === true ||
          raw.locationType === 'GENERAL' ||
          raw.status === 'REGISTERED' ||
          !raw.marketName ||
          /mandiri|non-pasar|luar pasar|umum/i.test(raw.marketName) ||
          (!raw.claimedUnitNumber && (!raw.marketRoutes || raw.marketRoutes.length === 0));

        return {
          displayName: raw.displayName || 'Pelaku Usaha',
          businessName: raw.businessName || '',
          businessType: raw.businessType || (isNonMarket ? 'Pelaku Usaha Mandiri' : 'Usaha Pasar'),
          marketId: isNonMarket ? '' : (raw.marketId || raw.marketRoutes?.[0]?.marketId || ''),
          marketName: isNonMarket ? 'Usaha Mandiri Non-Pasar' : (raw.marketName || 'Pasar Rakyat Pinrang'),
          unitType: isNonMarket ? '' : 'Unit',
          unitNumber: isNonMarket ? '' : (raw.claimedUnitNumber || ''),
          publicId: raw.traderId || raw.registrationCode || '',
          traderId: raw.traderId || '',
          photoMediaToken: raw.photoMediaToken || '',
          photoUrl: raw.photoUrl || '',
          registrationCode: raw.registrationCode || '',
          validUntil: raw.validUntil || null,
          isDemo: raw.isDemo === true || raw.environment === 'UAT',
          environment: raw.environment || 'UAT',
          isNonMarket,
          status: raw.status || ''
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
              businessName: snapDoc.businessName || raw.businessName || '',
              businessType: snapDoc.businessType || raw.businessType || 'Usaha Pasar',
              marketId: snapDoc.marketId || raw.marketId || '',
              marketName: snapDoc.marketName || 'Pasar Rakyat Pinrang',
              unitType: snapDoc.unitType || 'Unit',
              unitNumber: snapDoc.unitNumber || '',
              publicId: raw.traderId || '',
              traderId: raw.traderId || '',
              photoMediaToken: raw.photoMediaToken || '',
              registrationCode: raw.number || '',
              validUntil: raw.validUntil || snapDoc.validUntil || null,
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
              businessName: snapDoc.businessName || raw.businessName || '',
              businessType: snapDoc.businessType || raw.businessType || 'Usaha Pasar',
              marketId: snapDoc.marketId || raw.marketId || '',
              marketName: snapDoc.marketName || 'Pasar Rakyat Pinrang',
              unitType: snapDoc.unitType || 'Unit',
              unitNumber: snapDoc.unitNumber || '',
              publicId: raw.traderId || '',
              traderId: raw.traderId || '',
              photoMediaToken: raw.photoMediaToken || '',
              registrationCode: raw.number || '',
              validUntil: raw.validUntil || snapDoc.validUntil || null,
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
              businessName: snapDoc.businessName || raw.businessName || '',
              businessType: snapDoc.businessType || raw.businessType || 'Usaha Pasar',
              marketId: snapDoc.marketId || raw.marketId || '',
              marketName: snapDoc.marketName || 'Pasar Rakyat Pinrang',
              unitType: snapDoc.unitType || 'Unit',
              unitNumber: snapDoc.unitNumber || '',
              publicId: raw.traderId || '',
              traderId: raw.traderId || '',
              photoMediaToken: raw.photoMediaToken || '',
              registrationCode: raw.number || '',
              validUntil: raw.validUntil || snapDoc.validUntil || null,
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
              businessName: t.businessName || '',
              businessType: t.businessType || 'Usaha Pasar',
              marketId: t.marketId || '',
              marketName: t.marketName || 'Pasar Rakyat Pinrang',
              unitType: t.unitType || 'Unit',
              unitNumber: t.unitNumber || '',
              publicId: t.traderId || t.id || '',
              traderId: t.traderId || t.id || '',
              photoMediaToken: t.photoMediaToken || '',
              registrationCode: t.registrationCode || '',
              validUntil: t.validUntil || null,
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

      // Cek apakah data pedagang bertipe Non-Pasar Rakyat
      const isNonMarket = d.isNonMarket === true ||
        d.locationType === 'GENERAL' ||
        d.status === 'REGISTERED' ||
        d.marketId === 'MKT-NON' ||
        (!d.marketId && (!d.marketName || /mandiri|non-pasar|luar pasar|umum/i.test(d.marketName))) ||
        (!d.unitNumber && !d.unitType && (!d.marketName || /mandiri|non-pasar|umum/i.test(d.marketName)));

      const cardCfg = appSettings?.cardDesign || {};
      const cardTitle = isNonMarket
        ? 'KARTU PELAKU USAHA MANDIRI'
        : (cardCfg.headerTitle || 'KARTU IDENTITAS PEDAGANG');
      const cardSubtitle = isNonMarket
        ? 'Pemerintah Kabupaten Pinrang · e-PASAR'
        : (cardCfg.headerSubtitle || 'Pemerintah Kabupaten Pinrang');
      const cardTheme = cardCfg.theme || 'navy';
      const showPhoto = cardCfg.showPhoto !== false;
      const showQr = cardCfg.showQr !== false;

      const isTraining = d.isDemo === true || ['UAT', 'INTERNAL_UAT', 'TEST', 'TRAINING', 'DEMO'].includes(String(d.environment || '').toUpperCase()) || token.startsWith('uat-');
      message.hidden = true;
      card.hidden = false;

      card.classList.toggle('card-non-market', isNonMarket);

      let primaryColor = '#123F7C';
      if (isNonMarket) {
        // Terapkan gradasi biru dan hijau menyerupai warna tema beranda portal e-PASAR
        card.style.background = 'linear-gradient(135deg, #0735ce 0%, #0b66ed 44%, #109618 100%)';
        primaryColor = '#0735ce';
      } else {
        const marketPalette = window.EPASAR_MARKET_THEME
          ? window.EPASAR_MARKET_THEME.apply(card, d.marketId, d.marketName)
          : { primary: '#123F7C' };
        primaryColor = marketPalette.dark || marketPalette.primary || '#123F7C';

        // Styling tema dinamis jika bukan pasar khusus
        const themeColors = {
          navy: 'linear-gradient(135deg, #094eb8 0%, #032b69 100%)',
          emerald: 'linear-gradient(135deg, #059669 0%, #064e3b 100%)',
          gold: 'linear-gradient(135deg, #d97706 0%, #78350f 100%)',
          dark: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)'
        };
        if (!d.marketId && !window.EPASAR_MARKET_THEME?.marketId('', d.marketName) && themeColors[cardTheme]) {
          card.style.background = themeColors[cardTheme];
        }
      }

      const photoUrl = showPhoto ? await publicPhoto(d.photoMediaToken, d.photoUrl || (isTraining ? 'assets/uat/pedagang-contoh-transparan.png' : '')) : '';
      card.classList.toggle('has-photo', Boolean(photoUrl));

      const photoBlock = (showPhoto && photoUrl) ? `<img class="card-photo" src="${esc(photoUrl)}" alt="Foto pedagang">` : '';
      const qrBlock = showQr ? '<div id="cardQr" class="card-qr branded-qr"></div>' : '';

      const marketText = isNonMarket
        ? oneLine(d.address || d.district ? `📍 ${d.address || d.district}` : 'Usaha Mandiri Non-Pasar')
        : oneLine(d.marketName, 'Pasar Rakyat Pinrang');
      const unitText = isNonMarket
        ? 'TIPE: NON-PASAR RAKYAT'
        : ((d.unitType || d.unitNumber) ? `${oneLine(d.unitType, 'UNIT').toUpperCase()} ${oneLine(d.unitNumber, '-')}` : '');
      const businessText = oneLine(d.businessName || d.businessType, isNonMarket ? 'Pelaku Usaha Mandiri' : 'Usaha Pasar');
      const validUntilText = dateId(d.validUntil);
      const issuerText = isNonMarket
        ? 'Diterbitkan oleh DINAS PERINDAG-ESDM Kabupaten Pinrang melalui <strong>e-PASAR</strong>'
        : 'Diterbitkan oleh DINAS PERINDAG-ESDM Kabupaten Pinrang melalui <strong>e-SKPT</strong>';

      card.innerHTML = `${isTraining ? '<img class="card-uat-stamp" src="assets/stamp-uat.png" alt="Uji coba, bukan kartu resmi">' : ''}<div class="card-brand"><img src="logo_pinrang_opt.png" alt="Logo Kabupaten Pinrang"><div><b data-fit-one-line data-min-pt="7.5">${esc(oneLine(cardTitle))}</b><small data-fit-one-line data-min-pt="5">${esc(oneLine(cardSubtitle))}</small></div></div><div class="card-name"><h1 data-fit-one-line data-min-pt="8">${esc(oneLine(d.displayName, 'Pelaku Usaha').toLocaleUpperCase('id-ID'))}</h1></div>${photoBlock}<div class="card-person ${unitText ? 'has-unit' : 'no-unit'}"><p class="card-business" data-fit-one-line data-min-pt="6.5">${esc(businessText)}</p><p class="card-market" data-fit-one-line data-min-pt="6.1">${esc(marketText)}</p>${unitText ? `<p class="card-unit" data-fit-one-line data-min-pt="6.1">${esc(unitText)}</p>` : ''}<p class="card-code" data-fit-one-line data-min-pt="6.2">${esc(oneLine(publicNumber(d)))}</p><p class="card-valid-until" data-fit-one-line data-min-pt="5.2">Berlaku s.d.: ${esc(validUntilText)}</p></div>${qrBlock}<div class="card-issuer">${issuerText}</div>`;

      fitCardText();
      requestAnimationFrame(fitCardText);

      if (showQr && window.QRCode) {
        const qrTargetUrl = `${location.origin}/epasar-status.html?token=${encodeURIComponent(token)}&code=${encodeURIComponent(d.registrationCode || '')}`;
        new window.QRCode(document.getElementById('cardQr'), {
          text: qrTargetUrl,
          width: 128,
          height: 128,
          colorDark: primaryColor,
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
