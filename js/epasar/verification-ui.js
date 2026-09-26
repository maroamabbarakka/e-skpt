(function () {
  'use strict';
  const form = document.getElementById('verificationForm');
  const error = document.getElementById('verificationError');
  const result = document.getElementById('verificationResult');
  const tokenInput = document.getElementById('verificationToken');
  const esc = value => String(value ?? '—').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const dateId = value => value ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const statusId = status => ({ ISSUED: 'DITERBITKAN', VALIDATED: 'DISAHKAN', INITIAL_ISSUE: 'PENERBITAN AWAL', DUE: 'MENUNGGU PEMERIKSAAN', RETURNED: 'DIKEMBALIKAN' }[status] || status || '—');

  async function verify() {
    error.textContent = '';
    result.hidden = true;
    try {
      const output = await window.EPASAR_PUBLIC_VERIFICATION.verify(tokenInput.value.trim());
      const annual = Array.isArray(output.annualValidations) ? output.annualValidations : [];
      result.innerHTML = `<h2>SKPT ${esc(statusId(output.status))}</h2><p><b>Nomor:</b> ${esc(output.number)}</p><p><b>Pemegang:</b> ${esc(output.displayName)}</p><p><b>Berlaku:</b> ${dateId(output.issueDate)} sampai ${dateId(output.validUntil)}</p><h3>Catatan administrasi tahunan</h3><div class="review-list">${annual.map(item => `<article class="review-card"><h3>Tahun ${esc(item.year)}</h3><p>${esc(statusId(item.status))}${item.validatedAt ? ` · ${dateId(item.validatedAt)}` : ''}</p></article>`).join('') || '<p>Belum ada catatan tahunan.</p>'}</div><p class="notice">Catatan tahunan tidak memperpanjang tanggal berakhir SKPT.</p>`;
      result.hidden = false;
    } catch (verificationError) { error.textContent = verificationError.message; }
  }

  form.addEventListener('submit', event => { event.preventDefault(); verify(); });
  const queryToken = new URLSearchParams(location.search).get('token');
  if (queryToken) { tokenInput.value = queryToken; verify(); }
}());
