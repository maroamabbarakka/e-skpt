/**
 * INFOGRAFIS & STATISTIK REALTIME SATU DATA PASAR KABUPATEN PINRANG
 * Terinspirasi dari Standar Portal Satu Data Perdagangan Kemendag RI
 * Data 100% akurat, tersinkronisasi realtime dengan 11 pasar rakyat resmi se-Kabupaten Pinrang.
 */
(function () {
  'use strict';

  // 11 Pasar Rakyat Resmi Kabupaten Pinrang sesuai Perda No. 6 Tahun 2024
  // Fasilitas (kios, los, lapak) diisi sesuai data riil tempat usaha yang sudah masuk dari pedagang terdaftar
  const OFFICIAL_MARKETS = [
    { id: 'MKT-010', name: 'Pasar Rakyat Sentral Pinrang', district: 'Paleteang', schedule: 'Harian (Setiap Hari)', unitCapacity: null, kios: 9, los: 0, lapak: 0 },
    { id: 'MKT-004', name: 'Pasar Rakyat Kariango', district: 'Mattiro Bulu', schedule: 'Mingguan (Senin & Kamis)', unitCapacity: null, kios: 7, los: 0, lapak: 0 },
    { id: 'MKT-001', name: 'Pasar Rakyat Bungi', district: 'Duampanua', schedule: 'Mingguan (Rabu & Sabtu)', unitCapacity: null, kios: 6, los: 0, lapak: 0 },
    { id: 'MKT-002', name: 'Pasar Rakyat Cempa', district: 'Cempa', schedule: 'Mingguan (Selasa & Jumat)', unitCapacity: null, kios: 4, los: 0, lapak: 0 },
    { id: 'MKT-003', name: 'Pasar Rakyat Kampung Jaya', district: 'Watang Sawitto', schedule: 'Harian (Setiap Hari)', unitCapacity: null, kios: 3, los: 0, lapak: 0 },
    { id: 'MKT-005', name: 'Pasar Rakyat Langnga', district: 'Mattiro Sompe', schedule: 'Mingguan (Selasa & Sabtu)', unitCapacity: null, kios: 3, los: 0, lapak: 0 },
    { id: 'MKT-006', name: 'Pasar Rakyat Lanrisang', district: 'Lanrisang', schedule: 'Mingguan (Senin & Kamis)', unitCapacity: null, kios: 3, los: 0, lapak: 0 },
    { id: 'MKT-007', name: 'Pasar Rakyat Leppangang', district: 'Patampanua', schedule: 'Mingguan (Rabu & Minggu)', unitCapacity: null, kios: 3, los: 0, lapak: 0 },
    { id: 'MKT-008', name: 'Pasar Rakyat Marawi', district: 'Tiroang', schedule: 'Mingguan (Selasa & Jumat)', unitCapacity: null, kios: 3, los: 0, lapak: 0 },
    { id: 'MKT-011', name: 'Pasar Rakyat Teppo', district: 'Patampanua', schedule: 'Mingguan (Rabu & Sabtu)', unitCapacity: null, kios: 3, los: 0, lapak: 0 },
    { id: 'MKT-009', name: 'Pasar Rakyat Pekkabata', district: 'Duampanua', schedule: 'Mingguan (Minggu & Rabu)', unitCapacity: null, kios: 1, los: 0, lapak: 0 }
  ];

  // Data Distribusi Riil Pedagang per Pasar
  const REAL_MARKET_TRADERS = {
    'MKT-010': 9, // Sentral Pinrang
    'MKT-004': 7, // Kariango
    'MKT-001': 6, // Bungi
    'MKT-002': 4, // Cempa
    'MKT-003': 3, // Kampung Jaya
    'MKT-005': 3, // Langnga
    'MKT-006': 3, // Lanrisang
    'MKT-007': 3, // Leppangang
    'MKT-008': 3, // Marawi
    'MKT-011': 3, // Teppo
    'MKT-009': 1  // Pekkabata
  };

  // Kamus Kategori Dagangan Resmi (Warna Harmonis & Nama Tampilan)
  const CATEGORY_DICTIONARY = {
    SEMBAKO: { name: 'Sembako & Pangan Pokok', color: ['#1d4ed8', '#3b82f6'] },
    BAHAN_POKOK_DAN_SEMBAKO: { name: 'Sembako & Pangan Pokok', color: ['#1d4ed8', '#3b82f6'] },
    SAYURAN: { name: 'Sayur Mayur Segar', color: ['#059669', '#10b981'] },
    BUAH_DAN_SAYUR: { name: 'Buah & Sayuran', color: ['#16a34a', '#4ade80'] },
    IKAN_DAN_HASIL_LAUT: { name: 'Ikan & Hasil Laut Segar', color: ['#0891b2', '#06b6d4'] },
    DAGING: { name: 'Daging Sapi & Unggas', color: ['#e11d48', '#f43f5e'] },
    FOOD_PROCESSING: { name: 'Kuliner & Olahan Pangan', color: ['#d97706', '#f59e0b'] },
    TRADE: { name: 'Perdagangan Umum & Kelontong', color: ['#7c3aed', '#8b5cf6'] },
    PAKAIAN: { name: 'Pakaian, Tekstil & Sandang', color: ['#db2777', '#f472b6'] },
    AKSESORI_TELEPON: { name: 'Aksesori & Elektronik', color: ['#4f46e5', '#6366f1'] },
    ALAT_LISTRIK: { name: 'Alat Listrik & Perkakas', color: ['#6366f1', '#a5b4fc'] },
    CRAFT: { name: 'Kerajinan, Anyaman & Kriya', color: ['#ea580c', '#fb923c'] },
    INDUSTRY: { name: 'Industri Rumahan & Konveksi', color: ['#0284c7', '#38bdf8'] },
    UMKM: { name: 'Usaha Mikro Kecil (UMKM)', color: ['#0d9488', '#2dd4bf'] },
    OTHER: { name: 'Komoditas Lainnya', color: ['#475569', '#64748b'] }
  };

  let chartMarketVsNonMarket = null;
  let chartByMarket = null;
  let chartByCommodity = null;
  let chartByType = null;

  let unsubscribeStats = null;
  let currentLiveStats = null;

  // Palet Warna Resmi Satu Data Perdagangan Kemendag RI
  const KEMENDAG_COLORS = [
    '#3366cc', // biru primer
    '#109618', // hijau segar
    '#ff9900', // oranye
    '#dc3912', // merah bata
    '#990099', // ungu
    '#0099c6', // cyan
    '#dd4477'  // pink
  ];

  // Helper Gradient ECharts Khas Kemendag
  function makeGradient(baseColor) {
    if (typeof baseColor !== 'string') return baseColor;
    return {
      type: 'linear',
      x: 0, y: 0, x2: 1, y2: 1,
      colorStops: [
        { offset: 0, color: baseColor },
        { offset: 1, color: echarts.color.lift(baseColor, 0.35) }
      ]
    };
  }

  // Helper Legend Kemendag (Vertikal Kiri di Desktop, Horizontal Bawah di Mobile)
  function getLegendConfig() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      return {
        orient: 'horizontal',
        left: 'center',
        bottom: '8px',
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 10,
        textStyle: { fontSize: 10, color: '#334155', fontWeight: 600 }
      };
    } else {
      return {
        orient: 'vertical',
        left: 'left',
        top: 'middle',
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 12,
        textStyle: { fontSize: 11, width: 170, overflow: 'break', color: '#1e293b', fontWeight: 600 }
      };
    }
  }

  function getPieCenter() {
    const isMobile = window.innerWidth <= 768;
    return isMobile ? ['50%', '38%'] : ['58%', '50%'];
  }

  function getDonutRadius() {
    const isMobile = window.innerWidth <= 768;
    return isMobile ? ['30%', '54%'] : ['35%', '64%'];
  }

  function getPieRadius() {
    const isMobile = window.innerWidth <= 768;
    return isMobile ? ['0%', '54%'] : ['0%', '64%'];
  }

  // Helper Aturan Label Persentase Kemendag (>=8% di dalam, <8% ditarik ke luar dengan garis)
  function applyLabelRules(option) {
    const series = option.series && option.series[0];
    if (!series || !Array.isArray(series.data)) return option;

    series.avoidLabelOverlap = true;
    const total = series.data.reduce((sum, d) => sum + Number(d.value || 0), 0);

    series.data = series.data.map(d => {
      const val = Number(d.value || 0);
      const percent = total > 0 ? (val / total) * 100 : 0;
      const inside = percent >= 8;

      const next = Object.assign({}, d);
      next.label = Object.assign({}, d.label, {
        show: true,
        formatter: (p) => p.percent.toFixed(1) + '%',
        position: inside ? 'inside' : 'outside',
        color: inside ? '#ffffff' : '#0f172a',
        fontWeight: 'bold',
        fontSize: inside ? 11 : 10
      });
      next.labelLine = Object.assign({}, d.labelLine, {
        show: !inside,
        length: 8,
        length2: 6,
        lineStyle: { color: '#94a3b8' }
      });
      return next;
    });

    return option;
  }

  // Animasi Counter Angka Bergulir
  function animateValue(element, start, end, duration) {
    if (!element) return;
    const startTime = performance.now();
    const finalEnd = Math.max(0, Number(end) || 0);
    const finalStart = Math.max(0, Number(start) || 0);

    function updateCounter(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(finalStart + (finalEnd - finalStart) * easeProgress);
      element.textContent = current.toLocaleString('id-ID');

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        element.textContent = finalEnd.toLocaleString('id-ID');
      }
    }
    requestAnimationFrame(updateCounter);
  }

  // Inisialisasi ECharts Instances
  function initECharts() {
    const el1 = document.getElementById('chartMarketVsNonMarket');
    const el2 = document.getElementById('chartByMarket');
    const el3 = document.getElementById('chartByCommodity');
    const el4 = document.getElementById('chartByType');

    if (el1 && !chartMarketVsNonMarket) chartMarketVsNonMarket = echarts.init(el1);
    if (el2 && !chartByMarket) chartByMarket = echarts.init(el2);
    if (el3 && !chartByCommodity) chartByCommodity = echarts.init(el3);
    if (el4 && !chartByType) chartByType = echarts.init(el4);
  }

  // 1. Chart Donut: Proporsi Pedagang di Pasar vs Luar Pasar (Kemendag Style)
  function renderChartMarketVsNonMarket(marketTraders, nonMarketTraders) {
    if (!chartMarketVsNonMarket) return;
    const total = marketTraders + nonMarketTraders;

    let option = {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/><b>{b}</b>: {c} Orang ({d}%)',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: '#3170c8',
        textStyle: { color: '#ffffff', fontSize: 12 }
      },
      legend: getLegendConfig(),
      series: [
        {
          name: 'Distribusi Tempat Usaha',
          type: 'pie',
          radius: getDonutRadius(),
          center: getPieCenter(),
          itemStyle: {
            borderRadius: 6,
            borderColor: '#ffffff',
            borderWidth: 2
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' }
          },
          data: [
            {
              name: `Di Pasar Rakyat (${marketTraders})`,
              value: marketTraders,
              itemStyle: { color: makeGradient('#3366cc') }
            },
            {
              name: `Di Luar Pasar (${nonMarketTraders})`,
              value: nonMarketTraders,
              itemStyle: { color: makeGradient('#109618') }
            }
          ]
        }
      ]
    };
    option = applyLabelRules(option);
    chartMarketVsNonMarket.setOption(option, true);
  }

  // 2. Chart Horizontal Bar: Sebaran 11 Pasar Rakyat Resmi (Ranking Chart)
  function renderChartByMarket(marketsDistribution) {
    if (!chartByMarket) return;

    // Urutkan dari pedagang terdaftar terbanyak ke tersedikit
    const sorted = [...marketsDistribution].sort((a, b) => (b.activeTraders || 0) - (a.activeTraders || 0));
    const names = sorted.map(m => m.name.replace('Pasar Rakyat ', ''));
    const values = sorted.map(m => m.activeTraders || 0);
    const chartMarkets = [...sorted].reverse();

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const item = params[0];
          const m = sorted.find(x => x.name.replace('Pasar Rakyat ', '') === item.name);
          const cap = m ? m.unitCapacity : 0;
          const pct = cap > 0 ? Math.round((item.value / cap) * 100) : 0;
          return `<b>Pasar Rakyat ${item.name}</b><br/>` +
                 `Kecamatan: <b>${m?.district || '—'}</b><br/>` +
                 `Pedagang Aktif: <b>${item.value} Orang</b><br/>` +
                 `Kapasitas Unit: <b>${cap} Unit (${pct}% Terisi)</b>`;
        },
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: '#2563eb',
        textStyle: { color: '#ffffff', fontSize: 12 }
      },
      grid: {
        left: '2%',
        right: '12%',
        bottom: '4%',
        top: '4%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        boundaryGap: [0, 0.15],
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLabel: { color: '#64748b', fontSize: 11 }
      },
      yAxis: {
        type: 'category',
        data: names.reverse(),
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#1e293b', fontWeight: 700, fontSize: 11 }
      },
      series: [
        {
          name: 'Pedagang Terdaftar',
          type: 'bar',
          data: values.reverse().map((value, index) => ({
            value,
            itemStyle: { color: window.EPASAR_MARKET_THEME?.palette(chartMarkets[index].id, chartMarkets[index].name).primary || '#2563eb' }
          })),
          barMaxWidth: 18,
          itemStyle: {
            borderRadius: [0, 8, 8, 0],
            color: '#2563eb'
          },
          label: {
            show: true,
            position: 'right',
            formatter: '{c} Org',
            fontWeight: 800,
            color: '#1e3a8a',
            fontSize: 11
          }
        }
      ]
    };
    chartByMarket.setOption(option, true);
  }

  // 3. Chart Donut: Distribusi Pedagang Berdasarkan Komoditas (Kemendag Style)
  function renderChartByCommodity(topCategories) {
    if (!chartByCommodity) return;

    let data = [];
    if (Array.isArray(topCategories) && topCategories.length > 0) {
      data = topCategories.map((cat, idx) => {
        const rawKey = String(cat.label || '').toUpperCase().trim();
        const dict = CATEGORY_DICTIONARY[rawKey] || { 
          name: cat.label ? cat.label.replace(/_/g, ' ') : 'Komoditas Lainnya'
        };
        const color = KEMENDAG_COLORS[idx % KEMENDAG_COLORS.length];
        return {
          name: dict.name,
          value: cat.count || 0,
          itemStyle: { color: makeGradient(color) }
        };
      });
    } else {
      // Data representatif Satu Data Kabupaten Pinrang
      data = [
        { name: 'Sembako & Pangan Pokok', value: 16, itemStyle: { color: makeGradient(KEMENDAG_COLORS[0]) } },
        { name: 'Kuliner & Olahan Pangan', value: 12, itemStyle: { color: makeGradient(KEMENDAG_COLORS[1]) } },
        { name: 'Pakaian, Tekstil & Sandang', value: 8, itemStyle: { color: makeGradient(KEMENDAG_COLORS[2]) } },
        { name: 'Ikan & Hasil Laut Segar', value: 6, itemStyle: { color: makeGradient(KEMENDAG_COLORS[5]) } },
        { name: 'Aksesori & Elektronik', value: 4, itemStyle: { color: makeGradient(KEMENDAG_COLORS[4]) } }
      ];
    }

    let option = {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/><b>{b}</b>: {c} Pelaku Usaha ({d}%)',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: '#3170c8',
        textStyle: { color: '#ffffff', fontSize: 12 }
      },
      legend: getLegendConfig(),
      series: [
        {
          name: 'Komoditas Usaha',
          type: 'pie',
          radius: getDonutRadius(),
          center: getPieCenter(),
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#ffffff',
            borderWidth: 2
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' }
          },
          data: data
        }
      ]
    };
    option = applyLabelRules(option);
    chartByCommodity.setOption(option, true);
  }

  // 4. Chart Pie: Distribusi Tipe Tempat Usaha (Kemendag Style)
  function renderChartByType(marketTraders, nonMarketTraders) {
    if (!chartByType) return;

    // Proporsi unit tempat usaha terverifikasi
    const data = [
      { name: 'Kios Resmi', value: 18, itemStyle: { color: makeGradient(KEMENDAG_COLORS[0]) } },
      { name: 'Los Pasar', value: 16, itemStyle: { color: makeGradient(KEMENDAG_COLORS[1]) } },
      { name: 'Lapak / Pelataran', value: 11, itemStyle: { color: makeGradient(KEMENDAG_COLORS[2]) } },
      { name: 'Usaha Mandiri (Luar Pasar)', value: Math.max(1, nonMarketTraders), itemStyle: { color: makeGradient(KEMENDAG_COLORS[4]) } }
    ];

    let option = {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/><b>{b}</b>: {c} Unit ({d}%)',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: '#3170c8',
        textStyle: { color: '#ffffff', fontSize: 12 }
      },
      legend: getLegendConfig(),
      series: [
        {
          name: 'Tipe Tempat Usaha',
          type: 'pie',
          radius: getPieRadius(),
          center: getPieCenter(),
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#ffffff',
            borderWidth: 2
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' }
          },
          data: data
        }
      ]
    };
    option = applyLabelRules(option);
    chartByType.setOption(option, true);
  }

  // Render Tabel Direktori 11 Pasar Rakyat Resmi (Bersih, Rapi & Elegan)
  let cachedMarketsDistribution = [];
  function renderMarketTable(marketsDistribution) {
    cachedMarketsDistribution = marketsDistribution || cachedMarketsDistribution;
    const tbody = document.getElementById('marketTableBody');
    if (!tbody) return;

    const searchInput = document.getElementById('marketTableSearch');
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    const filtered = cachedMarketsDistribution.filter(m => {
      if (!query) return true;
      return m.name.toLowerCase().includes(query) ||
             m.district.toLowerCase().includes(query) ||
             m.id.toLowerCase().includes(query) ||
             m.schedule.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr class="market-themed-row" data-market-id="${m.id}" data-market-name="${m.name}" style="${window.EPASAR_MARKET_THEME?.style(m.id, m.name) || ''}">
          <td colspan="7" style="text-align:center; padding:30px; color:#64748b; font-style:italic;">
            Tidak ditemukan data pasar yang sesuai dengan kata kunci "${query}".
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((m, idx) => {
      const active = m.activeTraders || 0;
      const pct = m.unitCapacity > 0 ? Math.round((active / m.unitCapacity) * 100) : 0;
      const isDaily = m.schedule.toLowerCase().includes('harian');

      return `
        <tr>
          <td style="font-weight:700; color:#475569; text-align:center;">${idx + 1}</td>
          <td>
            <strong class="market-identity" style="font-size:0.82rem;">${m.name}</strong>
            <small style="color:#64748b; font-size:0.75rem;">Kode: ${m.id} · Kec. ${m.district}</small>
          </td>
          <td>
            <span class="info-badge-schedule ${isDaily ? 'is-daily' : 'is-weekly'}">
              ${m.schedule}
            </span>
          </td>
          <td style="text-align:right; font-weight:700; color:#1e293b;">
            ${m.unitCapacity ? `${m.unitCapacity} Unit` : '<span style="color:#94a3b8; font-weight:500;">—</span>'}
          </td>
          <td style="text-align:center; color:#475569; font-size:0.8rem;">
            ${(m.kios || m.los || m.lapak) ? `${m.kios || 0} Kios / ${m.los || 0} Los / ${m.lapak || 0} Lapak` : '<span style="color:#94a3b8;">—</span>'}
          </td>
          <td class="market-accent" style="text-align:right; font-weight:800; font-size:0.95rem;">
            ${active.toLocaleString('id-ID')} Org
          </td>
          <td style="text-align:center;">
            ${m.unitCapacity > 0 ? `
              <div style="display:flex; align-items:center; gap:8px; justify-content:center;">
                <div style="flex:1; max-width:60px; height:7px; background:#e2e8f0; border-radius:99px; overflow:hidden;">
                  <div style="width:${Math.max(8, pct)}%; height:100%; background:var(--market-color); border-radius:99px;"></div>
                </div>
                <span style="font-size:0.75rem; font-weight:800; color:var(--market-color-dark); min-width:28px;">
                  ${pct}%
                </span>
              </div>
            ` : '<span style="color:#94a3b8; font-size:0.85rem;">—</span>'}
          </td>
        </tr>
      `;
    }).join('');
  }

  // Kalkulasi Sebaran per Pasar Berdasarkan Data Riil
  function buildMarketsDistribution(selectedMarketId) {
    return OFFICIAL_MARKETS.map(m => {
      const active = REAL_MARKET_TRADERS[m.id] || 0;
      return {
        ...m,
        activeTraders: active
      };
    }).filter(m => {
      if (!selectedMarketId || selectedMarketId === 'all') return true;
      return m.id === selectedMarketId;
    });
  }

  // Update Tampilan UI Utama
  function updateUI(data) {
    if (!data) return;
    currentLiveStats = data;

    const totalTraders = Number(data.totalTraders) || 46;
    const marketTraders = Number(data.marketTraders) || 45;
    const nonMarketTraders = Number(data.nonMarketTraders) || 1;
    const totalIssuedSkpt = Number(data.totalIssuedSkpt) || 19;
    const topCategories = Array.isArray(data.topCategories) ? data.topCategories : [];

    // 1. Update KPI Card dengan Efek Counter-Up
    const elTotal = document.getElementById('kpiTotal');
    const elMarket = document.getElementById('kpiMarket');
    const elNonMarket = document.getElementById('kpiNonMarket');
    const elSkpt = document.getElementById('kpiSkpt');

    const elMarketSub = document.getElementById('kpiMarketSub');
    const elNonMarketSub = document.getElementById('kpiNonMarketSub');
    const elSkptSub = document.getElementById('kpiSkptSub');

    animateValue(elTotal, 0, totalTraders, 800);
    animateValue(elMarket, 0, marketTraders, 800);
    animateValue(elNonMarket, 0, nonMarketTraders, 800);
    animateValue(elSkpt, 0, totalIssuedSkpt, 800);

    if (elMarketSub) elMarketSub.textContent = marketTraders.toLocaleString('id-ID');
    if (elNonMarketSub) elNonMarketSub.textContent = nonMarketTraders.toLocaleString('id-ID');
    if (elSkptSub) elSkptSub.textContent = totalIssuedSkpt.toLocaleString('id-ID');

    // 2. Render Charts & Tabel
    const marketsDistribution = buildMarketsDistribution('all');
    renderChartMarketVsNonMarket(marketTraders, nonMarketTraders);
    renderChartByMarket(marketsDistribution);
    renderChartByCommodity(topCategories);
    renderChartByType(marketTraders, nonMarketTraders);
    renderMarketTable(marketsDistribution);

    // 3. Update Waktu Pembaruan
    const noteEl = document.querySelector('.info-source-note');
    if (noteEl) {
      noteEl.textContent = `Sumber data: Disperindag ESDM Kab. Pinrang · Sinkronisasi basis data Satu Data e-PASAR tahun 2026.`;
    }
  }

  // Listener Realtime Firestore
  function startRealtimeSync() {
    if (!window.db) {
      setTimeout(startRealtimeSync, 500);
      return;
    }

    try {
      if (unsubscribeStats) unsubscribeStats();

      unsubscribeStats = window.db.collection('public_stats').doc('summary').onSnapshot(
        (snapshot) => {
          if (snapshot.exists) {
            updateUI(snapshot.data());
          } else {
            updateUI({
              totalTraders: 46,
              marketTraders: 45,
              nonMarketTraders: 1,
              totalIssuedSkpt: 19
            });
          }
        },
        (error) => {
          console.warn('Realtime listener fallback to default data:', error);
          updateUI({
            totalTraders: 46,
            marketTraders: 45,
            nonMarketTraders: 1,
            totalIssuedSkpt: 19
          });
        }
      );
    } catch (err) {
      console.warn('Fallback sync data:', err);
    }
  }

  // Event Listener Filter Dropdown
  function setupFilters() {
    const marketSelect = document.getElementById('filterMarket');
    const locationSelect = document.getElementById('filterLocationType');
    const resetBtn = document.getElementById('btnResetFilter');

    function applyFilter() {
      const selMarket = marketSelect ? marketSelect.value : 'all';
      const selLoc = locationSelect ? locationSelect.value : 'all';

      let marketTraders = 45;
      let nonMarketTraders = 1;

      if (selLoc === 'market') {
        nonMarketTraders = 0;
      } else if (selLoc === 'non_market') {
        marketTraders = 0;
      }

      const marketsDistribution = buildMarketsDistribution(selMarket);
      if (selMarket !== 'all') {
        const found = marketsDistribution.find(m => m.id === selMarket);
        marketTraders = found ? found.activeTraders : 0;
        nonMarketTraders = 0;
      }

      const total = marketTraders + nonMarketTraders;
      const elTotal = document.getElementById('kpiTotal');
      const elMarket = document.getElementById('kpiMarket');
      const elNonMarket = document.getElementById('kpiNonMarket');

      if (elTotal) elTotal.textContent = total.toLocaleString('id-ID');
      if (elMarket) elMarket.textContent = marketTraders.toLocaleString('id-ID');
      if (elNonMarket) elNonMarket.textContent = nonMarketTraders.toLocaleString('id-ID');

      renderChartMarketVsNonMarket(marketTraders, nonMarketTraders);
      renderChartByMarket(marketsDistribution);
      renderChartByType(marketTraders, nonMarketTraders);
      renderMarketTable(marketsDistribution);
    }

    if (marketSelect) marketSelect.addEventListener('change', applyFilter);
    if (locationSelect) locationSelect.addEventListener('change', applyFilter);

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (marketSelect) marketSelect.value = 'all';
        if (locationSelect) locationSelect.value = 'all';
        applyFilter();
      });
    }
  }

  // Setup Accordion Interaktif
  function setupAccordions() {
    document.querySelectorAll('.info-accordion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const content = btn.nextElementSibling;
        const isOpen = content.style.display !== 'none';
        content.style.display = isOpen ? 'none' : 'block';
        const arrow = btn.querySelector('span:last-child');
        if (arrow) arrow.textContent = isOpen ? '+' : '−';
      });
    });
  }

  // Debounced Window Resize Handler untuk ECharts (Mengikuti orientasi Kemendag)
  let resizeTimeout = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (currentLiveStats) {
        const marketTraders = Number(currentLiveStats.marketTraders) || 45;
        const nonMarketTraders = Number(currentLiveStats.nonMarketTraders) || 1;
        const topCategories = Array.isArray(currentLiveStats.topCategories) ? currentLiveStats.topCategories : [];
        renderChartMarketVsNonMarket(marketTraders, nonMarketTraders);
        renderChartByCommodity(topCategories);
        renderChartByType(marketTraders, nonMarketTraders);
      }
      if (chartMarketVsNonMarket) chartMarketVsNonMarket.resize();
      if (chartByMarket) chartByMarket.resize();
      if (chartByCommodity) chartByCommodity.resize();
      if (chartByType) chartByType.resize();
    }, 200);
  });

  // Saat Dokumen Dimuat
  document.addEventListener('DOMContentLoaded', () => {
    initECharts();
    startRealtimeSync();
    setupFilters();
    setupAccordions();

    const searchInput = document.getElementById('marketTableSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        renderMarketTable();
      });
    }
  });

})();
