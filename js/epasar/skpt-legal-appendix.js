(function () {
  'use strict';

  const DOCUMENT_URL = 'assets/SKPT_Lampiran_Profesional.md';
  const DOCUMENT_VERSION = 'SKPT-LAMPIRAN-PERDA6-2024-V1';
  let cachedDocument = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function parseFrontMatter(source) {
    const normalized = String(source || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
    const metadata = {};
    if (match) {
      match[1].split('\n').forEach(line => {
        const pair = line.match(/^([a-z_]+):\s*["']?(.*?)["']?\s*$/i);
        if (pair) metadata[pair[1]] = pair[2];
      });
    }
    return { metadata, body: match ? normalized.slice(match[0].length) : normalized };
  }

  function inline(value) {
    return escapeHtml(value)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  function isTableDivider(line) {
    return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line);
  }

  function tableCells(line) {
    return line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
  }

  function markdownToHtml(markdown) {
    const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
    const output = [];
    for (let index = 0; index < lines.length;) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }
      if (/^---\s*$/.test(line)) { output.push('<hr>'); index += 1; continue; }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        const level = Math.min(4, heading[1].length + 1);
        output.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        index += 1;
        continue;
      }
      if (line.includes('|') && lines[index + 1] && isTableDivider(lines[index + 1])) {
        const headings = tableCells(line);
        index += 2;
        const rows = [];
        while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
          rows.push(tableCells(lines[index]));
          index += 1;
        }
        output.push(`<div class="legal-table-wrap"><table><thead><tr>${headings.map(cell => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }
      if (/^>\s?/.test(line)) {
        const quote = [];
        while (index < lines.length && (/^>\s?/.test(lines[index]) || !lines[index].trim())) {
          if (/^>\s?/.test(lines[index])) quote.push(lines[index].replace(/^>\s?/, ''));
          else if (quote.length && quote[quote.length - 1] !== '') quote.push('');
          index += 1;
        }
        output.push(`<blockquote>${quote.map(item => item ? `<p>${inline(item).replace(/\s{2}$/, '')}</p>` : '').join('')}</blockquote>`);
        continue;
      }
      const paragraph = [line.trim()];
      index += 1;
      while (index < lines.length && lines[index].trim() && !/^(#{1,4})\s+|^>\s?|^---\s*$/.test(lines[index]) && !(lines[index].includes('|') && lines[index + 1] && isTableDivider(lines[index + 1]))) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      output.push(`<p>${inline(paragraph.join(' '))}</p>`);
    }
    return output.join('');
  }

  async function load() {
    if (cachedDocument) return cachedDocument;
    const response = await fetch(DOCUMENT_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Dokumen persyaratan e-SKPT tidak dapat dimuat.');
    const source = await response.text();
    const parsed = parseFrontMatter(source);
    cachedDocument = { ...parsed, source, version: DOCUMENT_VERSION, url: DOCUMENT_URL };
    return cachedDocument;
  }

  function renderFull(documentData) {
    return `<div class="legal-document-content">${markdownToHtml(documentData.body)}</div>`;
  }

  function appendixChunks(body) {
    // Halaman kedua dimulai pada bagian baru agar pasal tidak terbelah dan
    // kedua halaman tetap memiliki ruang kaki dokumen yang aman untuk dicetak.
    const markers = ['## Bagian Keempat '];
    const points = markers.map(marker => body.indexOf(marker)).filter(point => point > 0).sort((a, b) => a - b);
    const boundaries = [0, ...points, body.length];
    return boundaries.slice(0, -1).map((start, index) => body.slice(start, boundaries[index + 1]).trim()).filter(Boolean);
  }

  function renderAppendixPages(container, documentData, context = {}) {
    if (!container) return;
    const chunks = appendixChunks(documentData.body);
    const total = chunks.length;
    container.innerHTML = chunks.map((chunk, index) => `<article class="official-document skpt-appendix-page" aria-label="Lampiran SKPT, halaman ${index + 1} dari ${total}">
      <header class="appendix-running-header"><img src="logo_pinrang_opt.png" alt="Lambang Kabupaten Pinrang"><div class="appendix-running-title"><span>LAMPIRAN SURAT KETERANGAN PEMAKAIAN TEMPAT</span><strong>Ketentuan Terkait SKPT &middot; Peraturan Daerah Kabupaten Pinrang Nomor 6 Tahun 2024</strong></div><span class="appendix-page-number" aria-label="Halaman ${index + 1} dari ${total}">${index + 1} / ${total}</span></header>
      <div class="appendix-meta"><span>Lampiran SKPT Nomor: <b>${escapeHtml(context.number || '-')}</b></span><span>Peraturan Daerah Kabupaten Pinrang Nomor 6 Tahun 2024</span></div>
      <section class="skpt-appendix-content">${markdownToHtml(chunk)}</section>
      <footer class="appendix-footer"><span>Peraturan Daerah Kabupaten Pinrang Nomor 6 Tahun 2024 tentang Pengelolaan Pasar Rakyat</span><span>Halaman lampiran ${index + 1} dari ${total}</span></footer>
    </article>`).join('');
  }

  window.EPASAR_SKPT_LEGAL_APPENDIX = {
    DOCUMENT_URL,
    DOCUMENT_VERSION,
    load,
    renderFull,
    renderAppendixPages,
    markdownToHtml
  };
}());
