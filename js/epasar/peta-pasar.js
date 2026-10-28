/**
 * CONTROLLER PETA GEOSPASIAL SEBARAN SARANA PASAR & TITIK USAHA (SISP PINRANG)
 * Menampilkan:
 * 1. Batas administrasi 12 kecamatan se-Kabupaten Pinrang & batas kabupaten BIG/OSM
 * 2. 11 Pasar Rakyat resmi dengan foto asli, kapasitas unit & jumlah pedagang terdaftar
 * 3. Sebaran titik pelaku usaha mandiri / di luar pasar (UMKM, kuliner, keliling, dsb.)
 * 4. Interaksi popup & slide-over detail pasar dengan panduan arah Google Maps
 */
(function () {
  'use strict';

  let map = null;
  let regencyLayer = null;
  let districtsLayer = null;
  let marketsLayer = null;
  let nonMarketsLayer = null;

  let allMarkets = [];
  let allNonMarkets = [];
  let currentFilterDistrict = 'all';
  let currentFilterType = 'all';
  let marketLegend = null;

  function marketPalette(id, name) {
    return window.EPASAR_MARKET_THEME?.palette(id, name) || { id, primary: '#174F83', dark: '#0f365c', rgb: '23, 79, 131' };
  }

  function marketStyle(id, name) {
    return window.EPASAR_MARKET_THEME?.style(id, name) || '--market-color:#174F83;--market-color-dark:#0f365c;--market-color-rgb:23,79,131';
  }

  // Data jumlah pedagang aktif per pasar (sinkron dengan database e-PASAR)
  const MARKET_TRADERS_COUNT = {
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

  // Basemap Tile Layers
  const tileOSM = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap kontributor'
  });

  const tileEsriTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '&copy; Esri, HERE, Garmin, Intermap'
  });

  const tileSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '&copy; Esri World Imagery'
  });

  // Inisialisasi Peta
  async function initMap() {
    const mapContainer = document.getElementById('sispMap');
    if (!mapContainer) return;

    // Titik pusat Kabupaten Pinrang
    map = L.map('sispMap', {
      center: [-3.78, 119.64],
      zoom: 10,
      zoomControl: true,
      layers: [tileOSM]
    });

    // Basemap Switcher Control
    const baseMaps = {
      '🗺️ Peta Jalan (OSM)': tileOSM,
      '🏔️ Topografi (Esri)': tileEsriTopo,
      '🛰️ Satelit (Imagery)': tileSatellite
    };
    L.control.layers(baseMaps, null, { position: 'bottomleft' }).addTo(map);

    // Layer Groups
    marketsLayer = L.layerGroup().addTo(map);
    nonMarketsLayer = L.layerGroup().addTo(map);

    // 1. Muat Batas Kabupaten & Batas Resmi 12 Kecamatan serta 109 Desa/Kelurahan (BIG)
    await Promise.all([loadRegencyBoundary(), loadAdministrativeOverlay()]);

    // 2. Muat Titik Pasar & Titik Pelaku Usaha Luar Pasar
    await Promise.all([loadMarkets(), loadNonMarketTraders()]);

    // 3. Pasang Filter Listener
    setupMapControls();

    // 4. Sinkronkan Statistik Mengambang
    syncFloatingStats();
  }

  // 1a. Memuat Batas Kabupaten Pinrang (MultiPolygon BIG / OSM)
  async function loadRegencyBoundary() {
    try {
      const response = await fetch('assets/data/pinrang_regency.geojson');
      if (!response.ok) return;
      const geoData = await response.json();

      regencyLayer = L.geoJSON(geoData, {
        style: {
          color: '#0f172a',
          weight: 2.8,
          opacity: 0.9,
          fillColor: '#3b82f6',
          fillOpacity: 0.02
        }
      }).addTo(map);

      // Fit bounds agar seluruh kabupaten Pinrang terlihat pas
      map.fitBounds(regencyLayer.getBounds(), { padding: [25, 25] });
    } catch (err) {
      console.warn('Gagal memuat batas kabupaten Pinrang:', err);
    }
  }

  let villagesLayer = null;

  // 1b. Memuat Batas Resmi 12 Kecamatan & 109 Desa/Kelurahan (Standar BIG)
  async function loadAdministrativeOverlay() {
    if (window.PinrangAdministrativeOverlay && window.PinrangAdministrativeOverlay.addTo) {
      try {
        const res = await window.PinrangAdministrativeOverlay.addTo(map, {
          collapsed: false,
          villageMinZoom: 12
        });
        if (res) {
          districtsLayer = res.districtLayer;
          villagesLayer = res.villageLayer;
        }
      } catch (err) {
        console.warn('Gagal memuat PinrangAdministrativeOverlay:', err);
      }
    }
  }

  // 2a. Memuat Data Titik 11 Pasar Rakyat
  async function loadMarkets() {
    try {
      const response = await fetch('assets/data/markets_geo.json');
      if (!response.ok) return;
      allMarkets = await response.json();
      renderMarketMarkers();
      renderAvatarStack();
      renderMarketLegend();
    } catch (err) {
      console.error('Gagal memuat koordinat pasar:', err);
    }
  }

  // 2b. Memuat Data Sebaran Pelaku Usaha di Luar Pasar (Mandiri & UMKM)
  async function loadNonMarketTraders() {
    try {
      const response = await fetch('assets/data/non_market_traders_geo.json');
      if (!response.ok) return;
      allNonMarkets = await response.json();
      renderNonMarketMarkers();
    } catch (err) {
      console.warn('Gagal memuat titik usaha luar pasar:', err);
    }
  }

  // Render Marker 11 Pasar Rakyat Resmi
  function renderMarketMarkers() {
    if (!marketsLayer) return;
    marketsLayer.clearLayers();

    // Jika filter memilih hanya luar pasar, sembunyikan pasar
    if (currentFilterType === 'luar_pasar') return;

    const filtered = allMarkets.filter(m => {
      const matchDistrict = currentFilterDistrict === 'all' || m.district.toLowerCase() === currentFilterDistrict.toLowerCase();
      let matchType = true;
      if (currentFilterType === 'harian') {
        matchType = m.schedule.toLowerCase().includes('harian');
      } else if (currentFilterType === 'mingguan') {
        matchType = m.schedule.toLowerCase().includes('mingguan');
      }
      return matchDistrict && matchType;
    });

    filtered.forEach(market => {
      const { lat, lng } = market.coordinates;
      const tradersCount = MARKET_TRADERS_COUNT[market.id] || 0;
      const isDaily = market.schedule.toLowerCase().includes('harian');
      const colors = marketPalette(market.id, market.name);

      // Custom Clean HTML Marker Pin (Bentuk Pin Tetesan Air / Pin Modern)
      const customIcon = L.divIcon({
        className: 'sisp-custom-marker-wrap',
        html: `
          <div class="sisp-pin is-market" data-market-id="${market.id}" style="${marketStyle(market.id, market.name)}" title="${market.name} · ${colors.primary}">
            <div class="sisp-pin-body">
              <span class="sisp-pin-icon">🏛️</span>
            </div>
            <div class="sisp-pin-badge" title="${tradersCount} Pedagang Aktif">${tradersCount}</div>
            <div class="sisp-pin-tip"></div>
          </div>
        `,
        iconSize: [38, 46],
        iconAnchor: [19, 44],
        popupAnchor: [0, -42]
      });

      const marker = L.marker([lat, lng], { icon: customIcon, zIndexOffset: 100 });

      // Popup Elegan
      const pct = Math.round((tradersCount / (market.unitCapacity || 100)) * 100);
      const popupHtml = `
        <div class="sisp-popup-card" data-market-id="${market.id}" style="${marketStyle(market.id, market.name)}">
          <div class="sisp-popup-banner">
            <img class="sisp-popup-img" src="${market.photo}" alt="${market.name}" onerror="this.src='favicon.png'">
            <span class="sisp-popup-tag">${market.id} · ${isDaily ? 'PASAR HARIAN' : 'PASAR MINGGUAN'}</span>
          </div>
          <div class="sisp-popup-content">
            <h4>${market.name}</h4>
            <p class="sisp-popup-sub">Kec. ${market.district} · ${market.schedule}</p>
            <div class="sisp-popup-stats">
              <div>
                <small>Pedagang Aktif</small>
                <strong>${tradersCount} Orang</strong>
              </div>
              <div>
                <small>Kapasitas Unit</small>
                <strong>${market.unitCapacity ? market.unitCapacity + ' Unit' : '—'}</strong>
              </div>
              <div>
                <small>Okupansi</small>
                <strong style="color:${pct > 0 ? '#16a34a' : '#64748b'}">${pct > 0 ? pct + '%' : '—'}</strong>
              </div>
            </div>
            <button type="button" class="sisp-popup-btn" onclick="window.openMarketSidebar('${market.id}')">
              Lihat Detail Sarana &amp; Rute →
            </button>
          </div>
        </div>
      `;
      marker.bindPopup(popupHtml, { maxWidth: 280, className: 'sisp-leaflet-popup' });

      marker.on('click', () => {
        openMarketSidebar(market.id);
      });

      marketsLayer.addLayer(marker);
    });
  }

  function renderMarketLegend() {
    if (!map || marketLegend || !allMarkets.length) return;
    marketLegend = L.control({ position: 'bottomright' });
    marketLegend.onAdd = function () {
      const container = L.DomUtil.create('div', 'sisp-market-legend');
      container.setAttribute('aria-label', 'Legenda warna identitas pasar');
      container.innerHTML = `<strong>Identitas Pasar</strong><div class="sisp-market-legend-grid">${allMarkets.map(market => {
        const colors = marketPalette(market.id, market.name);
        return `<button type="button" data-market-id="${market.id}" style="${marketStyle(market.id, market.name)}" onclick="window.openMarketSidebar('${market.id}')" title="Buka ${market.name}"><i></i><span>${market.name.replace(/^Pasar Rakyat\s+/i, '')}</span><small>${colors.primary}</small></button>`;
      }).join('')}</div>`;
      L.DomEvent.disableClickPropagation(container);
      return container;
    };
    marketLegend.addTo(map);
  }

  // Render Marker Pelaku Usaha di Luar Pasar (Mandiri & UMKM)
  function renderNonMarketMarkers() {
    if (!nonMarketsLayer) return;
    nonMarketsLayer.clearLayers();

    // Tampilkan jika tipe 'all' atau 'luar_pasar'
    if (currentFilterType !== 'all' && currentFilterType !== 'luar_pasar') return;

    const filtered = allNonMarkets.filter(item => {
      return currentFilterDistrict === 'all' || item.district.toLowerCase() === currentFilterDistrict.toLowerCase();
    });

    filtered.forEach(item => {
      const { lat, lng } = item.coordinates;

      const nonMarketIcon = L.divIcon({
        className: 'sisp-custom-marker-wrap',
        html: `
          <div class="sisp-pin is-nonmarket" title="${item.name}">
            <div class="sisp-pin-body">
              <span class="sisp-pin-icon">${item.icon || '🏠'}</span>
            </div>
            <div class="sisp-pin-tip"></div>
          </div>
        `,
        iconSize: [32, 40],
        iconAnchor: [16, 38],
        popupAnchor: [0, -36]
      });

      const marker = L.marker([lat, lng], { icon: nonMarketIcon, zIndexOffset: 50 });

      const popupHtml = `
        <div class="sisp-popup-card">
          <div class="sisp-popup-content" style="padding:14px;">
            <span style="display:inline-block; font-size:0.68rem; font-weight:800; color:#059669; background:#d1fae5; padding:2px 8px; border-radius:99px; margin-bottom:6px;">
              PELAKU USAHA DI LUAR PASAR
            </span>
            <h4 style="margin:0 0 4px; font-size:0.95rem; color:#0f172a;">${item.name}</h4>
            <p style="margin:0 0 8px; font-size:0.8rem; color:#64748b;">${item.address}, Kec. ${item.district}</p>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; font-size:0.78rem;">
              <div><strong>Kategori:</strong> ${item.category}</div>
              <div><strong>Jenis Usaha:</strong> ${item.businessType}</div>
            </div>
          </div>
        </div>
      `;
      marker.bindPopup(popupHtml, { maxWidth: 260, className: 'sisp-leaflet-popup' });
      nonMarketsLayer.addLayer(marker);
    });
  }

  // Render Avatar Stack pada Floating Badge
  function renderAvatarStack() {
    const stackEl = document.getElementById('sispAvatarStack');
    if (!stackEl || !allMarkets.length) return;

    const sample = allMarkets.slice(0, 4);
    stackEl.innerHTML = sample.map(m => `
      <div class="sisp-avatar" title="${m.name}">
        <img src="${m.photo}" alt="${m.name}" onerror="this.src='favicon.png'">
      </div>
    `).join('');
  }

  // Buka Sidebar Detail Sarana Pasar (Slide-Over Kanan)
  window.openMarketSidebar = function (marketId) {
    const market = allMarkets.find(m => m.id === marketId);
    if (!market) return;

    const sidebar = document.getElementById('sispSidebar');
    if (!sidebar) return;
    window.EPASAR_MARKET_THEME?.apply(sidebar, market.id, market.name);

    const tradersCount = MARKET_TRADERS_COUNT[market.id] || 0;

    const photoEl = document.getElementById('sidebarPhoto');
    if (photoEl) {
      photoEl.src = market.photo;
      photoEl.onerror = () => { photoEl.src = 'favicon.png'; };
    }

    document.getElementById('sidebarTitle').textContent = market.name;
    document.getElementById('sidebarDistrict').textContent = `ID: ${market.id} · Kec. ${market.district}`;
    document.getElementById('sidebarAddress').textContent = market.address;
    document.getElementById('sidebarSchedule').textContent = market.schedule;
    document.getElementById('sidebarKios').textContent = `${market.kios ?? 0} Unit`;
    document.getElementById('sidebarLos').textContent = `${market.los ?? 0} Unit`;
    document.getElementById('sidebarLapak').textContent = `${market.lapak ?? 0} Unit`;
    document.getElementById('sidebarCoords').textContent = `${market.coordinates.lat}, ${market.coordinates.lng}`;

    // Update jumlah pedagang di sidebar
    let traderInfoEl = document.getElementById('sidebarTradersCount');
    if (!traderInfoEl) {
      const container = document.querySelector('.sisp-info-list');
      if (container) {
        traderInfoEl = document.createElement('div');
        traderInfoEl.id = 'sidebarTradersCount';
        traderInfoEl.className = 'sisp-info-item';
        traderInfoEl.innerHTML = `
          <span class="sisp-info-icon">👥</span>
          <span id="sidebarTradersText"><strong>${tradersCount} Pedagang Terdaftar Aktif</strong></span>
        `;
        container.prepend(traderInfoEl);
      }
    } else {
      document.getElementById('sidebarTradersText').innerHTML = `<strong>${tradersCount} Pedagang Terdaftar Aktif</strong>`;
    }

    // Link Google Maps
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${market.coordinates.lat},${market.coordinates.lng}`;
    const routeBtn = document.getElementById('sidebarRouteBtn');
    if (routeBtn) routeBtn.href = gmapsUrl;

    // Zoom ke titik pasar
    if (map) {
      map.flyTo([market.coordinates.lat, market.coordinates.lng], 14, { duration: 1.2 });
    }

    sidebar.classList.add('open');
  };

  // Tutup Sidebar
  window.closeMarketSidebar = function () {
    const sidebar = document.getElementById('sispSidebar');
    if (sidebar) sidebar.classList.remove('open');
  };

  // Setup Kontrol Filter Peta
  function setupMapControls() {
    const districtSelect = document.getElementById('sispFilterDistrict');
    const resetBtn = document.getElementById('sispBtnResetMap');
    const tagBtns = document.querySelectorAll('.sisp-tag-btn');

    if (districtSelect) {
      districtSelect.addEventListener('change', (e) => {
        currentFilterDistrict = e.target.value;
        renderMarketMarkers();
        renderNonMarketMarkers();
        zoomToFiltered();
      });
    }

    tagBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tagBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilterType = btn.dataset.type;
        renderMarketMarkers();
        renderNonMarketMarkers();
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        currentFilterDistrict = 'all';
        currentFilterType = 'all';
        if (districtSelect) districtSelect.value = 'all';
        tagBtns.forEach((b, idx) => b.classList.toggle('active', idx === 0));
        renderMarketMarkers();
        renderNonMarketMarkers();
        if (regencyLayer) {
          map.fitBounds(regencyLayer.getBounds(), { padding: [25, 25] });
        }
      });
    }
  }

  // Zoom Menyesuaikan Filter
  function zoomToFiltered() {
    if (!map || currentFilterDistrict === 'all') {
      if (regencyLayer) map.fitBounds(regencyLayer.getBounds(), { padding: [25, 25] });
      return;
    }

    // 1. Zoom ke poligon batas resmi kecamatan BIG jika tersedia
    if (districtsLayer) {
      let targetLayer = null;
      districtsLayer.eachLayer(layer => {
        const p = layer.feature && layer.feature.properties;
        const name = (p && (p.WADMKC || p.NAMOBJ || p.district)) || '';
        const cleanName = name.toLowerCase().replace(/^(kecamatan|kec\.)\s*/i, '').trim();
        const cleanFilter = currentFilterDistrict.toLowerCase().replace(/^(kecamatan|kec\.)\s*/i, '').trim();
        if (cleanName === cleanFilter) {
          targetLayer = layer;
        }
      });

      if (targetLayer) {
        map.fitBounds(targetLayer.getBounds(), { padding: [35, 35] });
        targetLayer.setStyle({ weight: 3.8, fillOpacity: 0.28 });
        return;
      }
    }

    // 2. Fallback berdasarkan sebaran titik pasar
    const filtered = allMarkets.filter(m => m.district.toLowerCase() === currentFilterDistrict.toLowerCase());
    if (filtered.length > 0) {
      const group = L.featureGroup(filtered.map(m => L.marker([m.coordinates.lat, m.coordinates.lng])));
      map.fitBounds(group.getBounds(), { maxZoom: 13, padding: [40, 40] });
    }
  }

  // Sinkronisasi Statistik Mengambang
  function syncFloatingStats() {
    const textEl = document.getElementById('sispStatsText');
    if (!textEl) return;

    if (!window.db) {
      setTimeout(syncFloatingStats, 500);
      return;
    }

    window.db.collection('public_stats').doc('summary').onSnapshot(snap => {
      if (snap.exists) {
        const d = snap.data();
        const total = Number(d.totalTraders) || 46;
        const market = Number(d.marketTraders) || 45;
        const nonMarket = Number(d.nonMarketTraders) || 1;
        textEl.innerHTML = `<strong>11 Pasar Rakyat</strong> · ${total} Pedagang Terdata (${market} di Pasar, ${nonMarket} di Luar Pasar)`;
      } else {
        textEl.innerHTML = `<strong>11 Pasar Rakyat</strong> · 46 Pedagang Terdata (45 di Pasar, 1 di Luar Pasar)`;
      }
    }, () => {
      textEl.innerHTML = `<strong>11 Pasar Rakyat</strong> · 46 Pedagang Terdata (45 di Pasar, 1 di Luar Pasar)`;
    });
  }

  // DOM Loaded
  document.addEventListener('DOMContentLoaded', () => {
    initMap();
  });

})();
