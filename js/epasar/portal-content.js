(function () {
  'use strict';
  const main = document.querySelector('main');
  if (!main) return;
  const section = document.createElement('section');
  section.className = 'portal-section portal-data-block';
  section.innerHTML = '<div class="section-heading"><div><p class="eyebrow">DATA & INFORMASI PEDAGANG</p><h2>Gambaran data e-PASAR Pinrang</h2></div><p>Ringkasan informasi yang membantu melihat perkembangan pendataan secara cepat.</p></div><div class="data-cards"><article><span>Pedagang pasar</span><strong>Terdata</strong><small>Menunggu pembaruan berkala</small></article><article><span>Unit usaha</span><strong>Kios · Los · Lapak · Pelataran</strong><small>Verifikasi berdasarkan pasar</small></article><article><span>Klasifikasi</span><strong>Multi-label</strong><small>Perdagangan, industri, kerajinan</small></article></div><div class="publication-strip"><div><p class="eyebrow">PUBLIKASI & INFORMASI</p><h3>Informasi terbaru e-PASAR</h3></div><a class="text-link" href="#informasi">Lihat semua <b>→</b></a></div><div class="publication-grid"><a href="epasar.html"><span class="pub-tag">PANDUAN</span><b>Cara mendaftarkan usaha</b><small>Langkah singkat pendataan pedagang.</small></a><a href="verifikasi-skpt.html"><span class="pub-tag">LAYANAN</span><b>Mengenal e-SKPT</b><small>Informasi pengajuan dan verifikasi.</small></a><a href="epasar-status.html"><span class="pub-tag">BANTUAN</span><b>Cek status pendataan</b><small>Pantau proses dengan kode registrasi.</small></a></div>';
  const anchor = document.querySelector('.portal-section[id="informasi"]');
  anchor ? main.insertBefore(section, anchor) : main.appendChild(section);
}());
