(function () {
  'use strict';
  const root = document.getElementById('document');
  const token = new URLSearchParams(location.search).get('token');
  const esc = (v) => String(v ?? '-').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateId = (v) => v ? new Date(v).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '-';
  const list = (items) => `<ol>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
  // Pasal 21, Pasal 22, dan Pasal 27 Perda Kabupaten Pinrang Nomor 6 Tahun 2024.
  const rights = ['Menggunakan tempat dasaran sesuai dengan haknya;','Melakukan transaksi jual beli barang/jasa yang tidak dilarang berdasarkan peraturan perundang-undangan;','Memperoleh perlindungan hukum berdasarkan peraturan perundang-undangan yang berlaku.'];
  const duties = ['Membayar retribusi pelayanan pasar tepat waktu berdasarkan Peraturan Daerah yang mengatur tentang retribusi daerah;','Menjaga ketertiban, keamanan, kebersihan, dan keindahan lingkungan;','Mengatur dan meletakkan barang dagangan dengan rapi, tidak melebihi batas tempat dasaran yang menjadi haknya, serta tidak membahayakan keselamatan umum;','Menaati semua ketentuan peraturan yang telah ditetapkan.'];
  const prohibitions = ['Memiliki SKPT lebih dari 2 (dua) dalam satu lokasi;','Mengalihkan SKPT kepada orang lain untuk digunakan sebagai pemakaian kios dan/atau los yang sah tanpa izin Kepala Dinas;','Mengotori halaman, kios, bangunan, peralatan, serta barang inventaris Pasar Rakyat;','Masuk ke dalam Pasar Rakyat dalam keadaan menderita luka yang tidak terpelihara atau penyakit menular yang berbahaya.'];
  async function publicPhoto(mediaToken, fallback) {
    if (!mediaToken) return fallback;
    try {
      const media = await window.db.collection('trader_media').doc(mediaToken).get();
      if (!media.exists) return fallback;
      const value = media.data();
      if (value.ownerType !== 'PUBLIC_DOCUMENT' || value.ownerId !== mediaToken || value.mediaType !== 'PROFILE_PUBLIC' || value.status !== 'PUBLIC' || value.mime !== 'image/webp' || !value.dataBase64) return fallback;
      return `data:${value.mime};base64,${value.dataBase64}`;
    } catch (_) { return fallback; }
  }

  async function fetchDocumentData(targetToken) {
    if (!targetToken) return null;
    // 1. Coba baca dari public_skpt_verification
    try {
      const snap = await window.db.collection('public_skpt_verification').doc(targetToken).get();
      if (snap.exists && snap.data() && snap.data().status === 'ISSUED') {
        return snap.data();
      }
    } catch (_) {}

    // 2. Jika staf sedang login, coba ambil langsung dari skpt_documents
    try {
      const auth = window.firebase?.auth ? window.firebase.auth() : null;
      if (auth && !auth.currentUser) {
        await new Promise((resolve) => {
          const unsub = auth.onAuthStateChanged(() => { unsub(); resolve(); });
          setTimeout(resolve, 800);
        });
      }

      if (auth && auth.currentUser) {
        try {
          const docSnap = await window.db.collection('skpt_documents').doc(targetToken).get();
          if (docSnap.exists && docSnap.data() && docSnap.data().status === 'ISSUED') {
            return docSnap.data();
          }
        } catch (_) {}

        try {
          const qSnap = await window.db.collection('skpt_documents').where('verificationToken', '==', targetToken).limit(1).get();
          if (!qSnap.empty) {
            return qSnap.docs[0].data();
          }
        } catch (_) {}

        try {
          const qApp = await window.db.collection('skpt_documents').where('applicationId', '==', targetToken).limit(1).get();
          if (!qApp.empty) {
            return qApp.docs[0].data();
          }
        } catch (_) {}
      }
    } catch (_) {}

    // 3. Jika targetToken adalah publicToken pemohon, coba baca dari public_status
    try {
      const statusSnap = await window.db.collection('public_status').doc(targetToken).get();
      if (statusSnap.exists) {
        const ps = statusSnap.data();
        const traderId = ps.traderId;
        const auth = window.firebase?.auth ? window.firebase.auth() : null;
        if (traderId && auth && auth.currentUser) {
          const qTrd = await window.db.collection('skpt_documents').where('traderId', '==', traderId).limit(1).get();
          if (!qTrd.empty) {
            return qTrd.docs[0].data();
          }
        }
      }
    } catch (_) {}

    return null;
  }

  async function boot() {
    const params = new URLSearchParams(location.search);
    const activeToken = params.get('token') || params.get('verificationToken') || params.get('publicToken') || params.get('id');
    if (!activeToken) { root.innerHTML = '<p class="document-error">Token dokumen tidak tersedia.</p>'; return; }
    try {
      const d = await fetchDocumentData(activeToken);
      if (!d || d.status !== 'ISSUED') { root.innerHTML = '<p class="document-error">Dokumen SKPT tidak ditemukan atau belum diterbitkan oleh Kepala Dinas.</p>'; return; }
      const actualToken = d.verificationToken || activeToken;
      const dHash = d.documentHash || '-';
      const s = d.documentSnapshot || {};

      // Ambil konfigurasi dinamis sistem jika tersedia
      let appSettings = null;
      try {
        if (window.EPASAR_CONFIG_SERVICE) {
          appSettings = await window.EPASAR_CONFIG_SERVICE.getSettings();
        } else if (window.db) {
          const cfgSnap = await window.db.collection('app_settings').doc('general').get();
          if (cfgSnap.exists) appSettings = cfgSnap.data();
        }
      } catch (_) {}

      const configSigner = appSettings?.signatory || {};
      const signer = {
        name: configSigner.name || d.signatory?.name || 'MUHAMMAD YUSUF NUR, S.STP',
        nip: configSigner.nip || d.signatory?.nip || '19800326 200003 1 001',
        rank: configSigner.rank || d.signatory?.rank || 'Pembina Tk. I',
        position: configSigner.position || d.signatory?.position || 'Kepala Dinas Perindustrian, Perdagangan, Energi dan Sumber Daya Mineral Kabupaten Pinrang',
        authority: configSigner.authority || d.signatory?.authority || 'a.n. BUPATI PINRANG'
      };

      const officeAddress = appSettings?.frontpage?.officeAddress || 'Jalan Bintang No. 1 · Telp/Faks. (0421) 921215 · Pinrang 91212';
      const perdaMarket = appSettings?.legalBasis?.perdaMarket || 'Peraturan Daerah Kabupaten Pinrang Nomor 6 Tahun 2024 tentang Pengelolaan Pasar Rakyat.';
      const perdaTax = appSettings?.legalBasis?.perdaTax || 'Peraturan Daerah Kabupaten Pinrang Nomor 1 Tahun 2024 tentang Pajak Daerah dan Retribusi Daerah.';

      const issueYear = new Date(d.issueDate).getFullYear();
      const number = String(d.number || '-');
      const verificationUrl = `${location.origin}/verifikasi-skpt.html?token=${encodeURIComponent(actualToken)}`;
      const tteLabel = d.tteStatus === 'SIGNED' ? 'DITANDATANGANI ELEKTRONIK' : d.tteStatus === 'UAT_SIMULATED' ? 'UJI COBA · TTE SIMULASI' : d.tteStatus === 'NOT_INTEGRATED' ? 'PERSETUJUAN KADIS TERCATAT · TTE BELUM TERINTEGRASI' : d.tteStatus === 'REGISTERED_MANUAL' ? 'TERDAFTAR · PENGESAHAN MANUAL' : 'MENUNGGU PENGESAHAN';
      const isTrainingDocument = d.isDemo === true || ['TEST','INTERNAL_UAT','TRAINING','DEMO'].includes(String(d.environment || '').toUpperCase());
      const dummyTte = isTrainingDocument ? `<div class="dummy-tte" aria-label="QR simulasi tanda tangan elektronik Kepala Dinas"><div id="dummyTteQr" class="dummy-tte-qr branded-qr"></div><div class="dummy-tte-copy"><strong>SIMULASI TTE</strong><span>${esc(signer.name)}</span><small>Kepala Dinas · Dokumen latihan</small><small>Ref. ${esc(d.officialReference || actualToken.slice(0,16))}</small></div></div>` : '';
      const annual = Array.isArray(d.annualValidations) ? d.annualValidations : [{year:issueYear,status:'INITIAL_ISSUE'},{year:issueYear+1,status:'DUE'}];
      const annualCell = (item, fallbackYear) => { const labels = {VALIDATED:'DISAHKAN',INITIAL_ISSUE:'PENERBITAN AWAL',DUE:'MENUNGGU PEMERIKSAAN',RETURNED:'DIKEMBALIKAN'}; const status = labels[item?.status] || 'BELUM TERCATAT'; return `<span>Tahun ${esc(item?.year || fallbackYear)}<small class="annual-status ${item?.status === 'DUE' || item?.status === 'RETURNED' ? 'due' : ''}">${status}</small></span>`; };
      const photoUrl = await publicPhoto(d.photoMediaToken, s.photoUrl || (d.isDemo ? 'assets/uat/pedagang-contoh-3x4.jpg' : ''));
      const photoBlock = photoUrl ? `<div class="document-verification-photo"><img class="document-photo" src="${esc(photoUrl)}" alt="Foto pedagang"></div>` : '<div class="document-verification-photo document-photo document-photo-empty">Foto belum tersedia</div>';
      root.innerHTML = `${isTrainingDocument ? '<div class="uat-document-banner"><strong>DOKUMEN UJI COBA</strong><span>Tidak berlaku sebagai dokumen resmi</span></div>' : ''}
        <header class="official-letterhead"><img class="document-crest" src="logo_pinrang_opt.png" alt="Logo Kabupaten Pinrang"><div class="document-agency">PEMERINTAH KABUPATEN PINRANG</div><div class="document-agency document-agency-dept">DINAS PERINDUSTRIAN, PERDAGANGAN,<br>ENERGI DAN SUMBER DAYA MINERAL</div><div class="document-address">${esc(officeAddress)}</div></header>
        <section class="document-title-block"><h1>SURAT KETERANGAN PEMAKAIAN TEMPAT</h1><p>Nomor: ${esc(number)}</p></section>
        <section class="document-body">
          <div class="legal-basis"><b>Dasar:</b>${list([perdaMarket, perdaTax])}</div>
          <div><p>Yang bertanda tangan di bawah ini menerangkan bahwa:</p><dl class="identity-table"><dt>Nama</dt><dd>: ${esc(s.displayName || d.displayName)}</dd><dt>Alamat</dt><dd>: ${esc(s.address)}</dd><dt>Jenis Dagangan</dt><dd>: ${esc(s.businessType)}</dd><dt>Luas Tempat Jualan</dt><dd>: ${s.areaM2 ? `${esc(s.areaM2)} m²` : '-'}</dd></dl></div>
          <p>Diberikan Surat Keterangan Pemakaian Tempat <b>${esc(s.unitType)} ${esc(s.unitNumber)}</b>${s.block ? ` Blok ${esc(s.block)}` : ''}${s.floor ? ` Lantai ${esc(s.floor)}` : ''}, pada <b>${esc(s.marketName || s.marketId)}</b>, dengan ketentuan sebagai berikut:</p>
          <h3>A. Hak Pedagang (Pasal 21):</h3>${list(rights)}
          <h3>B. Kewajiban Pedagang (Pasal 22):</h3>${list(duties)}
          <h3>C. Larangan (Pasal 27 ayat (1)):</h3>${list(prohibitions)}
          <p><b>D.</b> Pelanggaran terhadap Pasal 20, Pasal 22, dan Pasal 27 ayat (1) dapat dikenai sanksi administratif sesuai Pasal 30 Peraturan Daerah Kabupaten Pinrang Nomor 6 Tahun 2024.</p>
          <p><b>E.</b> SKPT berlaku selama 2 (dua) tahun sejak ${dateId(d.issueDate)} sampai dengan ${dateId(d.validUntil)} dan dapat diperpanjang melalui permohonan periode berikutnya sesuai prosedur yang berlaku.</p>
        </section>
        <section class="document-footer-grid"><div class="register-box"><b>CATATAN<br>ADMINISTRASI DIGITAL</b>${annualCell(annual[0],issueYear)}${annualCell(annual[1],issueYear+1)}</div><div class="signature-block"><div>Pinrang, ${dateId(d.issueDate)}</div><div>${esc(signer.authority)}<br>${esc(signer.position)}</div><div class="signature-space">${dummyTte}</div><b><u>${esc(signer.name)}</u></b><br>${esc(signer.rank)}<br>NIP. ${esc(signer.nip)}</div></section>
        <section class="document-verification"><div id="qr" class="document-qr-code branded-qr"></div><div class="document-verification-details"><span class="document-status">${esc(tteLabel)}</span><br><b>Verifikasi dokumen</b><br>Nomor: ${esc(number)}<br><span class="document-hash">SHA-256: ${esc(dHash)}</span><br>Referensi: ${esc(d.officialReference || actualToken.slice(0,16))}<br>Berlaku sampai: ${dateId(d.validUntil)}</div>${photoBlock}</section>
        <p class="document-disclaimer">SKPT ini merupakan keterangan administratif pemakaian tempat usaha dan bukan bukti kepemilikan hak atas tanah atau bangunan. Keaslian dan status dokumen diperiksa melalui QR resmi e-PASAR.</p>`;
      if (window.QRCode) {
        new QRCode(document.getElementById('qr'),{text:verificationUrl,width:160,height:160,colorDark:'#123f7c',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
        const tteQr = document.getElementById('dummyTteQr');
        if (tteQr) new QRCode(tteQr,{text:`${verificationUrl}&proof=tte-demo&ref=${encodeURIComponent(d.officialReference || actualToken.slice(0,16))}`,width:96,height:96,colorDark:'#111111',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
      }
    } catch (error) { console.error(error); root.innerHTML = '<p class="document-error">Dokumen belum dapat dimuat. Periksa koneksi lalu coba kembali.</p>'; }
  }
  boot();
}());
