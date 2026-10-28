/**
 * PINRANG ADMINISTRATIVE OVERLAY (RESMI BIG & DISPERINDAG ESDM PINRANG)
 * Menggunakan dataset spasial resmi Badan Informasi Geospasial (BIG) & Kebijakan Satu Peta
 * Standar identik dengan: https://disperindagesdm-pinrang.web.app/peta-gis
 * 
 * Meliputi:
 * 1. Batas 12 Kecamatan Resmi Kabupaten Pinrang
 * 2. Batas 109 Desa & Kelurahan Resmi se-Kabupaten Pinrang
 * 3. Pewarnaan tematik konsisten, tooltip interaktif, dan kontrol layer Leaflet
 */
(function (root) {
  'use strict';

  const DATA_PATH_KECAMATAN = 'assets/data/pinrang_kecamatan_official.geojson';
  const DATA_PATH_DESA = 'assets/data/pinrang_desa_kelurahan_official.geojson';

  // Palet warna resmi tematik 12 Kecamatan (Standar Disperindag ESDM Pinrang)
  const PALETTE = [
    '#2563EB', '#059669', '#D97706', '#7C3AED', 
    '#DC2626', '#0891B2', '#DB2777', '#65A30D', 
    '#EA580C', '#4F46E5', '#0D9488', '#9333EA'
  ];

  function nameOf(feature, isVillage) {
    const p = feature.properties || {};
    return p[isVillage ? 'WADMKD' : 'WADMKC'] || p.NAMOBJ || 'Wilayah';
  }

  function districtOf(feature) {
    const p = feature.properties || {};
    return p.WADMKC || p.KECAMATAN || '-';
  }

  function hash(text) {
    return Array.from(String(text || '')).reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0, 7);
  }

  function colorFor(text) {
    return PALETTE[hash(text) % PALETTE.length];
  }

  let districtLayerInstance = null;
  let villageLayerInstance = null;

  async function addTo(map, options) {
    options = options || {};
    if (!map || !root.L) return null;

    try {
      const [resKec, resDesa] = await Promise.all([
        fetch(DATA_PATH_KECAMATAN),
        fetch(DATA_PATH_DESA)
      ]);

      if (!resKec.ok || !resDesa.ok) {
        console.warn('Dataset batas administrasi resmi tidak dapat dimuat');
        return null;
      }

      const [kecData, desaData] = await Promise.all([resKec.json(), resDesa.json()]);

      // 1. LAYER KECAMATAN RESMI (12 Kecamatan)
      const districtLayer = L.geoJSON(kecData, {
        pane: options.districtPane || 'overlayPane',
        style: function (feature) {
          const name = nameOf(feature, false);
          const color = colorFor(name);
          return {
            color: color,
            weight: 2.2,
            opacity: 0.92,
            dashArray: '4, 4',
            fillColor: color,
            fillOpacity: 0.14
          };
        },
        onEachFeature: function (feature, layer) {
          const name = nameOf(feature, false);
          const luas = feature.properties.LUASWH ? `${Number(feature.properties.LUASWH).toLocaleString('id-ID')} km²` : '';

          const tooltipHtml = `
            <div style="font-family:'Plus Jakarta Sans',sans-serif; padding:5px 9px; font-size:0.84rem; font-weight:700; color:#0f172a; line-height:1.35;">
              🏛️ Kecamatan ${name}
              ${luas ? `<div style="font-size:0.72rem; color:#475569; font-weight:500; margin-top:2px;">Luas Wilayah: ${luas}</div>` : ''}
              <div style="font-size:0.68rem; color:#2563eb; font-weight:600; margin-top:2px;">Batas Resmi BIG (Kemendagri)</div>
            </div>
          `;
          layer.bindTooltip(tooltipHtml, { sticky: true, className: 'sisp-district-tooltip' });

          layer.on({
            mouseover: function (e) {
              const target = e.target;
              target.setStyle({ weight: 3.5, fillOpacity: 0.28 });
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                target.bringToFront();
              }
            },
            mouseout: function (e) {
              districtLayer.resetStyle(e.target);
            },
            click: function () {
              const districtSelect = document.getElementById('sispFilterDistrict');
              if (districtSelect) {
                districtSelect.value = name;
                districtSelect.dispatchEvent(new Event('change'));
              }
            }
          });
        }
      }).addTo(map);

      // 2. LAYER DESA / KELURAHAN RESMI (109 Desa & Kelurahan)
      const villageLayer = L.geoJSON(desaData, {
        pane: options.villagePane || 'overlayPane',
        style: function (feature) {
          const district = districtOf(feature);
          const baseColor = colorFor(district);
          return {
            color: baseColor,
            weight: 1.1,
            opacity: 0.75,
            fillColor: colorFor(`${district}:${nameOf(feature, true)}`),
            fillOpacity: 0.08
          };
        },
        onEachFeature: function (feature, layer) {
          const villageName = nameOf(feature, true);
          const distName = districtOf(feature);

          const tooltipHtml = `
            <div style="font-family:'Plus Jakarta Sans',sans-serif; padding:4px 8px; font-size:0.8rem; font-weight:700; color:#0f172a; line-height:1.3;">
              🏡 ${villageName}
              <div style="font-size:0.72rem; color:#475569; font-weight:500;">Kecamatan ${distName}</div>
            </div>
          `;
          layer.bindTooltip(tooltipHtml, { sticky: true });

          layer.on({
            mouseover: function (e) {
              e.target.setStyle({ weight: 2.2, fillOpacity: 0.22 });
            },
            mouseout: function (e) {
              villageLayer.resetStyle(e.target);
            }
          });
        }
      });

      // Sinkronisasi otomatis batas desa saat zoom in
      const syncVillages = () => {
        if (map.getZoom() >= 12) {
          if (!map.hasLayer(villageLayer)) villageLayer.addTo(map);
        } else {
          if (map.hasLayer(villageLayer) && !options.alwaysShowVillages) {
            map.removeLayer(villageLayer);
          }
        }
      };
      map.on('zoomend', syncVillages);

      // Layer Control Switcher (Batas Kecamatan & Desa)
      const overlays = {
        '🏛️ Batas 12 Kecamatan (Resmi BIG)': districtLayer,
        '🏡 Batas Desa & Kelurahan (Resmi BIG)': villageLayer
      };
      L.control.layers(null, overlays, {
        position: 'topright',
        collapsed: true
      }).addTo(map);

      districtLayerInstance = districtLayer;
      villageLayerInstance = villageLayer;

      return {
        districtLayer,
        villageLayer,
        bounds: districtLayer.getBounds()
      };
    } catch (err) {
      console.error('Gagal menginisialisasi PinrangAdministrativeOverlay:', err);
      return null;
    }
  }

  // Fungsi helper untuk mendapatkan instance layer aktif
  function getLayers() {
    return {
      districtLayer: districtLayerInstance,
      villageLayer: villageLayerInstance
    };
  }

  root.PinrangAdministrativeOverlay = {
    addTo,
    getLayers,
    colorFor,
    palette: PALETTE.slice()
  };
})(window);
