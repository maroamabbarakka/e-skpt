(function () {
  'use strict';

  const menuButton = document.getElementById('sdMenu');
  const navigation = document.getElementById('sdNav');

  if (menuButton && navigation) {
    const setMenuState = (open) => {
      navigation.classList.toggle('open', open);
      menuButton.classList.toggle('is-open', open);
      document.body.classList.toggle('mobile-nav-open', open && window.innerWidth <= 700);
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.querySelector('.sr-only').textContent = open ? 'Tutup menu utama' : 'Buka menu utama';
    };
    menuButton.addEventListener('click', () => {
      setMenuState(!navigation.classList.contains('open'));
    });
    navigation.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        setMenuState(false);
      }
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.sd-header')) setMenuState(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && navigation.classList.contains('open')) {
        setMenuState(false);
        menuButton.focus();
      }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 700) setMenuState(false);
    });
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rotatingText = document.getElementById('heroRotatingText');
  if (rotatingText) {
    const words = ['e-SKPT', 'e-Pasar', 'Mudah', 'Cepat', 'Transparan'];
    const marker = rotatingText.closest('.hero-rotator');
    let wordIndex = 0;
    const measureMarker = (word) => {
      if (!marker) return;
      const probe = document.createElement('span');
      probe.className = 'hero-rotator-probe';
      probe.textContent = word;
      marker.appendChild(probe);
      const style = window.getComputedStyle(marker);
      const horizontalSpace = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
        + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
      marker.style.width = `${Math.ceil(probe.getBoundingClientRect().width + horizontalSpace)}px`;
      probe.remove();
    };
    const showWord = (word) => {
      measureMarker(word);
      rotatingText.textContent = word;
    };
    const prepareMarker = () => measureMarker(words[wordIndex]);
    if (document.fonts?.ready) document.fonts.ready.then(prepareMarker);
    else prepareMarker();
    window.addEventListener('resize', prepareMarker, { passive: true });
    window.setInterval(() => {
      if (reducedMotion) {
        wordIndex = (wordIndex + 1) % words.length;
        showWord(words[wordIndex]);
        return;
      }
      rotatingText.classList.remove('is-entering');
      rotatingText.classList.add('is-leaving');
      window.setTimeout(() => {
        wordIndex = (wordIndex + 1) % words.length;
        showWord(words[wordIndex]);
        rotatingText.classList.remove('is-leaving');
        rotatingText.classList.add('is-entering');
      }, 220);
    }, 2600);
  }

  const videos = Array.from(document.querySelectorAll('.video-card video'));
  videos.forEach((video) => video.addEventListener('play', () => {
    videos.forEach((other) => { if (other !== video && !other.paused) other.pause(); });
  }));

  const numberFormat = new Intl.NumberFormat('id-ID');
  const categoryNames = {
    FOOD_PROCESSING: 'Makanan & Minuman', TRADE: 'Perdagangan', CRAFT: 'Kerajinan',
    INDUSTRY: 'Industri', UMKM: 'UMKM', EKRAF_KRIYA: 'Kriya', OTHER: 'Lainnya'
  };
  const escapeText = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const statsElements = Array.from(document.querySelectorAll('[data-stat]'));
  const statsStatus = document.getElementById('statsStatus');
  const statsUpdated = document.getElementById('statsUpdated');
  const categoryBars = document.getElementById('categoryBars');
  const coverageBar = document.getElementById('marketCoverageBar');
  document.querySelectorAll('.stats-kpi').forEach((card) => card.classList.add('is-loading'));

  function timestampDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  function setStats(data) {
    statsElements.forEach((element) => {
      const value = Number(data[element.dataset.stat]);
      element.textContent = Number.isFinite(value) ? numberFormat.format(value) : '0';
    });
    document.querySelectorAll('.stats-kpi').forEach((card) => card.classList.remove('is-loading'));
    const categories = Array.isArray(data.topCategories) ? data.topCategories.slice(0, 5) : [];
    const maximum = Math.max(1, ...categories.map((item) => Number(item.count) || 0));
    categoryBars.innerHTML = categories.length ? categories.map((item) => {
      const count = Math.max(0, Number(item.count) || 0);
      const label = categoryNames[item.label] || String(item.label || 'Lainnya');
      const width = Math.max(3, Math.round(count / maximum * 100));
      return `<div class="category-row"><span>${escapeText(label)}</span><span class="category-track"><i style="width:${width}%"></i></span><strong>${numberFormat.format(count)}</strong></div>`;
    }).join('') : '<p class="stats-empty">Belum ada kategori yang dapat ditampilkan.</p>';
    const total = Math.max(0, Number(data.marketTraders) || 0) + Math.max(0, Number(data.nonMarketTraders) || 0);
    coverageBar.style.width = `${total ? Math.round((Number(data.marketTraders) || 0) / total * 100) : 0}%`;
    const updated = timestampDate(data.updatedAt);
    statsUpdated.textContent = updated
      ? `Diperbarui ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Makassar' }).format(updated)} WITA`
      : 'Waktu pembaruan belum tersedia';
    statsStatus.textContent = '';
  }
  let stopStats = null;
  function statsFailure() {
    document.querySelectorAll('.stats-kpi').forEach((card) => card.classList.remove('is-loading'));
    statsElements.forEach((element) => { element.textContent = '—'; });
    categoryBars.innerHTML = '<p class="stats-empty">Data kategori sementara tidak tersedia.</p>';
    statsUpdated.textContent = 'Pembaruan data belum tersedia';
    statsStatus.innerHTML = '<span class="stats-error">Data sementara tidak tersedia. <button class="stats-retry" type="button">Coba lagi</button></span>';
  }
  async function loadStats() {
    if (!window.db) {
      statsStatus.innerHTML = 'Data sementara tidak tersedia. <button class="stats-retry" type="button">Coba lagi</button>';
      return;
    }
    statsStatus.textContent = 'Memuat statistik terbaru…';
    try {
      if (stopStats) stopStats();
      stopStats = window.db.collection('public_stats').doc('summary').onSnapshot(snapshot => {
        if (!snapshot.exists) return statsFailure();
        setStats(snapshot.data());
      }, statsFailure);
    } catch (_) {
      statsFailure();
    }
  }
  if (statsStatus) {
    statsStatus.addEventListener('click', (event) => { if (event.target.closest('.stats-retry')) loadStats(); });
    loadStats();
  }

  const rows = {
    pedagang: [
      ['Satu identitas pedagang', 'Beragam usaha dan lokasi', 'Dalam pendataan'],
      ['Klasifikasi usaha', 'Perdagangan, industri, kerajinan', 'Multi-label'],
      ['Data pribadi', 'NIK dan lampiran terbatas', 'Dilindungi']
    ],
    pasar: [
      ['Identitas unit pasar', 'Kios, los, lapak, dan pelataran', 'Diverifikasi petugas'],
      ['Pemegang unit', 'Riwayat penggunaan tercatat', 'Terkendali'],
      ['Klaim pedagang', 'Dibandingkan kondisi lapangan', 'Perlu verifikasi']
    ],
    skpt: [
      ['Masa berlaku', 'Dua tahun sejak diterbitkan', 'Tercatat'],
      ['Pengesahan tahunan', 'Dilakukan secara digital', 'Wajib'],
      ['Verifikasi dokumen', 'Melalui QR dan halaman publik', 'Tersedia']
    ]
  };

  const tableBody = document.getElementById('portalDataRows');
  document.querySelectorAll('.sd-tabs button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.sd-tabs button').forEach((item) => {
        item.classList.toggle('selected', item === button);
        item.setAttribute('aria-selected', String(item === button));
      });
      const values = rows[button.dataset.table];
      if (!tableBody || !values) return;
      tableBody.innerHTML = values.map((row) => `<tr>${row.map((value) => `<td>${value}</td>`).join('')}</tr>`).join('');
    });
  });

  const form = document.getElementById('portalSearch');
  const input = document.getElementById('portalSearchInput');
  if (form && input) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const query = input.value.trim().toLocaleLowerCase('id-ID');
      const target = query
        ? Array.from(document.querySelectorAll('[data-search]')).find((item) => item.dataset.search.toLocaleLowerCase('id-ID').includes(query))
        : null;
      (target || document.getElementById('layanan'))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (target) {
        target.classList.add('search-highlight');
        window.setTimeout(() => target.classList.remove('search-highlight'), 1400);
      }
    });
  }

  const revealTargets = document.querySelectorAll('.sd-video-section, .sd-section, .sd-apps, .public-stats, .sd-summary, .sd-news');
  if ('IntersectionObserver' in window && !reducedMotion) {
    revealTargets.forEach((item) => item.classList.add('section-reveal'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealTargets.forEach((item) => observer.observe(item));
  }

  const top = document.createElement('button');
  top.className = 'sd-float';
  top.type = 'button';
  top.setAttribute('aria-label', 'Kembali ke atas');
  top.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 14 6-6 6 6"></path></svg>';
  document.body.appendChild(top);
  window.addEventListener('scroll', () => top.classList.toggle('visible', window.scrollY > 500), { passive: true });
  top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // Muat konfigurasi dinamis frontpage (Full Custom)
  async function loadDynamicFrontpage() {
    try {
      let settings = null;
      if (window.EPASAR_CONFIG_SERVICE) {
        settings = await window.EPASAR_CONFIG_SERVICE.getSettings();
      } else if (window.db) {
        const snap = await window.db.collection('app_settings').doc('general').get();
        if (snap.exists) settings = snap.data();
      }
      if (!settings) return;
      const fp = settings.frontpage || {};
      if (fp.heroTitle) {
        const heroEl = document.getElementById('portalHeroHeadline');
        if (heroEl) heroEl.innerHTML = fp.heroTitle;
      }
      if (fp.announcement) {
        const ticker = document.getElementById('portalTickerText');
        if (ticker) ticker.textContent = fp.announcement;
      }
    } catch (_) {}
  }
  loadDynamicFrontpage();
}());
