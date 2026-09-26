(function () {
  'use strict';
  const content = document.getElementById('statementContent');
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const esc = value => String(value ?? '-').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const dateId = value => value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Makassar' }) : '-';
  const statementItems = version => version === 'SKPT-STATEMENT-V3-PERDA6-2024' ? [
    'Data identitas, usaha, dokumen, dan lokasi yang saya sampaikan benar serta dapat dipertanggungjawabkan.',
    'Saya memberi izin kepada petugas berwenang untuk memeriksa dan memverifikasi data, dokumen, serta unit pasar yang saya ajukan.',
    'Saya memahami nomor kios, los, atau lapak yang saya masukkan merupakan klaim awal sampai diverifikasi oleh petugas berwenang.',
    'Saya bersedia menaati kewajiban Pedagang Pasar Rakyat sebagaimana Pasal 22 Peraturan Daerah Kabupaten Pinrang Nomor 6 Tahun 2024.',
    'Saya memahami larangan pengalihan SKPT tanpa izin Kepala Dinas dan larangan lain dalam Pasal 27 ayat (1).',
    'Saya memahami pelanggaran terhadap Pasal 20, Pasal 22, dan Pasal 27 ayat (1) dapat dikenai sanksi administratif sesuai Pasal 30.',
    'Saya memahami SKPT berlaku 2 (dua) tahun, dapat diperpanjang sesuai prosedur, dan bukan bukti kepemilikan tanah atau bangunan.',
    'Saya memahami data pribadi diproses untuk pendataan, verifikasi, pelayanan SKPT, keamanan, dan audit sesuai kewenangan Pemerintah Kabupaten Pinrang.'
  ] : [
    'Data identitas, usaha, dan lokasi yang saya sampaikan benar serta dapat dipertanggungjawabkan.',
    'Saya memberi izin kepada petugas berwenang untuk melakukan pemeriksaan dan verifikasi faktual terhadap data serta unit pasar yang diajukan.',
    'Saya memahami nomor kios, los, atau lapak yang saya masukkan merupakan klaim awal sampai diverifikasi Kepala Pasar.',
    'Saya bersedia memenuhi kewajiban retribusi, ketertiban, kebersihan, keamanan, dan ketentuan pengelolaan pasar yang berlaku.',
    'Saya tidak akan memindahtangankan, mengalihkan, mengubah, atau menggunakan tempat di luar peruntukannya tanpa persetujuan pejabat berwenang.',
    'Saya memahami keterangan tidak benar dapat mengakibatkan koreksi, penolakan, pembekuan, atau pencabutan SKPT sesuai ketentuan.',
    'Saya memahami SKPT merupakan dokumen administratif pemakaian tempat dan bukan bukti kepemilikan tanah atau bangunan.',
    'Saya memahami data pribadi diproses untuk pendataan, verifikasi, pelayanan SKPT, keamanan, dan audit sesuai kewenangan Pemerintah Kabupaten Pinrang.'
  ];

  async function boot() {
    if (!token) {
      content.className = 'document-body';
      content.innerHTML = '<p class="warning-legal">Dokumen pernyataan harus dibuka melalui tautan registrasi yang sah. Token tidak tersedia.</p>';
      return;
    }
    try {
      const snap = await db.collection('public_status').doc(token).get();
      if (!snap.exists) {
        content.innerHTML = '<p class="document-error">Catatan persetujuan tidak ditemukan.</p>';
        return;
      }
      const data = snap.data();
      const accepted = data.statementAcceptedAt || data.submittedAt || null;
      const version = data.statementVersion || 'SKPT-STATEMENT-V3-PERDA6-2024';
      const checks = statementItems(version).map(item => `<li>${esc(item)}</li>`).join('');
      content.className = 'document-body';
      content.innerHTML = `<p>Saya yang tercatat sebagai pemohon berikut:</p>
        <dl class="identity-table"><dt>Nama</dt><dd>: ${esc(data.displayName)}</dd><dt>ID Pedagang</dt><dd>: ${esc(data.traderId || 'Belum diterbitkan')}</dd><dt>Nomor Registrasi</dt><dd>: ${esc(data.registrationCode)}</dd><dt>Usaha/Pasar</dt><dd>: ${esc(data.businessType || '-')} ${data.marketName ? `· ${esc(data.marketName)}` : ''}</dd></dl>
        <p>dengan sadar, tanpa paksaan, dan setelah membaca ketentuan, memberikan konfirmasi elektronik atas pernyataan berikut:</p>
        <ul class="statement-checks">${checks}</ul>
        <div class="paperless-seal"><strong>PERSETUJUAN ELEKTRONIK TERCATAT</strong><br>Konfirmasi dilakukan melalui pilihan persetujuan pada formulir e-PASAR dan disimpan bersama versi pernyataan serta waktu pencatatan. Aplikasi tidak menggunakan e-meterai dan catatan ini bukan Tanda Tangan Elektronik tersertifikasi.</div>
        <div class="acceptance-grid"><div><b>Versi pernyataan</b>${esc(version)}</div><div><b>Waktu persetujuan</b>${esc(dateId(accepted))} WITA</div><div><b>Metode</b>Checkbox afirmasi pada formulir daring</div><div><b>Status</b>DISETUJUI DAN TERCATAT</div></div>
        <section class="document-verification"><div id="statementQr" class="document-qr-code branded-qr"></div><div><b>Referensi pernyataan</b><br>${esc(data.registrationCode)}<br>Token tidak dicetak penuh untuk melindungi akses dokumen.</div></section>
        <p class="document-disclaimer">Dokumen ini merupakan representasi cetak dari catatan persetujuan elektronik yang tersimpan pada sistem e-PASAR.</p>`;
      if (window.QRCode) new QRCode(document.getElementById('statementQr'), { text: `${location.origin}/epasar-status.html?token=${encodeURIComponent(token)}&code=${encodeURIComponent(data.registrationCode || '')}`, width: 150, height: 150, colorDark: '#123f7c', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.H });
    } catch (error) {
      console.error(error);
      content.innerHTML = '<p class="document-error">Catatan pernyataan belum dapat dimuat. Silakan coba kembali.</p>';
    }
  }
  boot();
}());
