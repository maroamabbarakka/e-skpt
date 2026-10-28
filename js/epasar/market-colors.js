(function (window) {
  'use strict';

  const MARKET_COLORS = Object.freeze({
    'MKT-001': '#2563EB',
    'MKT-002': '#EA580C',
    'MKT-003': '#16A34A',
    'MKT-004': '#7C3AED',
    'MKT-005': '#DC2626',
    'MKT-006': '#0891B2',
    'MKT-007': '#D97706',
    'MKT-008': '#DB2777',
    'MKT-009': '#0F766E',
    'MKT-010': '#4338CA',
    'MKT-011': '#65A30D'
  });

  const MARKET_NAMES = Object.freeze({
    'MKT-001': ['bungi'],
    'MKT-002': ['cempa'],
    'MKT-003': ['kampung jaya', 'kampoeng djaja'],
    'MKT-004': ['kariango'],
    'MKT-005': ['langnga'],
    'MKT-006': ['lanrisang', 'jampue'],
    'MKT-007': ['leppangang'],
    'MKT-008': ['marawi'],
    'MKT-009': ['pekkabata'],
    'MKT-010': ['sentral pinrang', 'pasar sentral'],
    'MKT-011': ['teppo', 'benteng']
  });

  function normalizeId(value) {
    const match = String(value || '').toUpperCase().match(/MKT[-_ ]?(\d{1,3})/);
    return match ? `MKT-${String(Number(match[1])).padStart(3, '0')}` : '';
  }

  function marketId(value, name) {
    const canonical = normalizeId(value);
    if (MARKET_COLORS[canonical]) return canonical;
    const text = `${value || ''} ${name || ''}`.toLowerCase();
    return Object.keys(MARKET_NAMES).find(id => MARKET_NAMES[id].some(alias => text.includes(alias))) || '';
  }

  function mix(hex, target, weight) {
    const source = hex.replace('#', '');
    const result = [0, 2, 4].map((offset, index) => {
      const channel = parseInt(source.slice(offset, offset + 2), 16);
      return Math.round(channel + (target[index] - channel) * weight).toString(16).padStart(2, '0');
    });
    return `#${result.join('')}`.toUpperCase();
  }

  function rgb(hex) {
    const value = hex.replace('#', '');
    return `${parseInt(value.slice(0,2),16)}, ${parseInt(value.slice(2,4),16)}, ${parseInt(value.slice(4,6),16)}`;
  }

  function palette(value, name) {
    const id = marketId(value, name);
    const primary = MARKET_COLORS[id] || '#174F83';
    return { id: id || 'DEFAULT', primary, dark: mix(primary, [8, 22, 42], .55), light: mix(primary, [255, 255, 255], .88), rgb: rgb(primary) };
  }

  let guillocheSourcePromise = null;
  function applyDecorativeFrame(element, colors) {
    if (!element?.classList?.contains('skpt-document') || typeof fetch !== 'function') return;
    guillocheSourcePromise ||= fetch('assets/guilloche-border.svg').then(response => response.ok ? response.text() : '').catch(() => '');
    guillocheSourcePromise.then(source => {
      if (!source || !element.isConnected) return;
      const themedSvg = source
        .replaceAll('#195aa7', colors.primary)
        .replaceAll('#4b8ac8', mix(colors.primary, [255, 255, 255], .34))
        .replaceAll('#78a8d5', mix(colors.primary, [255, 255, 255], .62));
      element.style.setProperty('--market-frame-image', `url("data:image/svg+xml,${encodeURIComponent(themedSvg)}")`);
    });
  }

  function apply(element, value, name) {
    if (!element) return palette(value, name);
    const colors = palette(value, name);
    element.dataset.marketId = colors.id;
    element.style.setProperty('--market-color', colors.primary);
    element.style.setProperty('--market-color-dark', colors.dark);
    element.style.setProperty('--market-color-light', colors.light);
    element.style.setProperty('--market-color-rgb', colors.rgb);
    applyDecorativeFrame(element, colors);
    return colors;
  }

  function style(value, name) {
    const colors = palette(value, name);
    return `--market-color:${colors.primary};--market-color-dark:${colors.dark};--market-color-light:${colors.light};--market-color-rgb:${colors.rgb}`;
  }

  function decorate(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-market-id], [data-market-name]').forEach(element => {
      apply(element, element.dataset.marketId, element.dataset.marketName || element.textContent);
    });
  }

  function observe() {
    if (!document.body || window.__EPASAR_MARKET_OBSERVER__) return;
    decorate(document);
    const observer = new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.matches?.('[data-market-id], [data-market-name]')) {
        apply(node, node.dataset.marketId, node.dataset.marketName || node.textContent);
      }
      decorate(node);
    })));
    observer.observe(document.body, { childList: true, subtree: true });
    window.__EPASAR_MARKET_OBSERVER__ = observer;
  }

  window.EPASAR_MARKET_COLORS = MARKET_COLORS;
  window.EPASAR_MARKET_THEME = Object.freeze({ marketId, palette, apply, style, decorate });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();
})(window);
