(function () {
  'use strict';
  const E = window.EPASAR, V = window.EPASAR_VALIDATORS;
  const form = document.getElementById('traderForm');
  const steps = [...document.querySelectorAll('.form-step')];
  const error = document.getElementById('formError');
  const titles = ['Identitas Pedagang', 'Data Usaha', 'Lokasi & Unit Pasar', 'Dokumen & e-SKPT', 'Periksa Data'];
  let step = 1, submitting = false, hasDraft = false;
  const safe = value => String(value ?? '—').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  function base() {
    const out = {};
    new FormData(form).forEach((value, key) => { if (!(value instanceof File)) out[key] = value; });
    out.businessDrafts = window.EPASAR_MULTI.collect();
    out.hasMarketUnit = window.EPASAR_MULTI.places().length > 0;
    out.applySkpt = window.EPASAR_MULTI.places().some(place => place.applySkpt);
    return out;
  }
  function showError(message) { error.textContent = message; error.hidden = !message; return false; }
  function clearError() { showError(''); }
  function friendlySubmitError(exception) {
    const code = String(exception?.code || '');
    const detail = String(exception?.message || '');
    if (code === 'permission-denied' || /missing or insufficient permissions/i.test(detail)) {
      if (window.epasarAuth?.currentUser) return 'Anda sedang masuk sebagai petugas. Keluar dari akun petugas atau buka formulir melalui jendela privat, lalu kirim kembali. Data yang sudah diisi tetap tersimpan.';
      return 'Pendataan belum dapat dikirim karena akses layanan belum tersedia. Muat ulang halaman lalu coba kembali. Data yang sudah diisi tetap tersimpan.';
    }
    if (code === 'unavailable' || code === 'network-request-failed' || /network|offline|koneksi/i.test(detail)) return 'Koneksi ke layanan terputus. Data Anda masih tersimpan. Periksa jaringan lalu coba lagi.';
    if (code === 'resource-exhausted') return 'Layanan sedang menerima banyak permintaan. Tunggu beberapa saat lalu coba kembali.';
    if (code === 'invalid-argument') return 'Beberapa data belum sesuai. Periksa kembali bagian yang ditandai lalu coba lagi.';
    return 'Pendataan belum berhasil dikirim. Data Anda masih tersimpan di halaman ini. Silakan coba kembali.';
  }
  function labelFor(field) {
    const label = field.closest('label');
    return (field.dataset.label || (label && label.childNodes[0] && label.childNodes[0].textContent) || field.name || 'Bagian ini').replace(/\s+/g, ' ').trim();
  }
  function clearFieldErrors(scope = form) {
    scope.querySelectorAll('.is-invalid').forEach(field => { field.classList.remove('is-invalid'); field.removeAttribute('aria-invalid'); });
    scope.querySelectorAll('.field-error').forEach(message => message.remove());
    scope.querySelectorAll('.unit-type-picker.is-invalid').forEach(picker => picker.classList.remove('is-invalid'));
  }
  function markInvalid(field, message) {
    if (!field) return;
    field.classList.add('is-invalid');
    field.setAttribute('aria-invalid', 'true');
    const host = field.closest('label') || field.parentElement;
    if (host && !host.querySelector('.field-error')) {
      const helper = document.createElement('small');
      helper.className = 'field-message is-error field-error';
      helper.textContent = message;
      host.appendChild(helper);
    }
  }
  function visible(field) {
    return !field.disabled && field.type !== 'hidden' && field.closest('[hidden]') === null && field.getClientRects().length > 0;
  }
  function validateVisibleFields(scope) {
    const failures = [];
    scope.querySelectorAll('input[required], select[required], textarea[required]').forEach(field => {
      if (!visible(field)) return;
      const value = String(field.value || '').trim();
      let message = '';
      if (field.type === 'checkbox') { if (!field.checked) message = `Centang persetujuan untuk ${labelFor(field).replace(/^Saya /, '').toLowerCase()}.`; }
      else if (!value) message = `${labelFor(field)} belum diisi.`;
      else if (field.name === 'nik' && !V.nik(value)) message = 'NIK harus terdiri dari 16 digit angka.';
      else if (field.name === 'phone' && !V.phone(value)) message = 'Masukkan nomor WhatsApp/HP yang benar, misalnya 0812xxxxxxx.';
      else if (field.type === 'number' && !field.validity.valid) message = `${labelFor(field)} belum sesuai batas angka yang diperbolehkan.`;
      if (message) { markInvalid(field, message); failures.push({ field, message }); }
    });
    return failures;
  }
  function showFailures(failures, fallback) {
    if (!failures.length) return false;
    const first = failures[0];
    const summary = step === 1 ? 'Lengkapi seluruh data identitas sebelum melanjutkan.' : (fallback || 'Masih ada data yang perlu diperbaiki.');
    showError(`${summary} ${first.message}`);
    requestAnimationFrame(() => first.field.focus({ preventScroll: true }));
    first.field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }
  function requireField(field, message) {
    if (!field || String(field.value || '').trim()) return false;
    markInvalid(field, message);
    showError(`Lengkapi atau perbaiki bagian yang ditandai. ${message}`);
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    requestAnimationFrame(() => field.focus({ preventScroll: true }));
    return true;
  }
  function save() { try { sessionStorage.setItem(E.DRAFT_KEY, JSON.stringify(base())); } catch (_) {} }
  function restore() {
    try {
      const draft = JSON.parse(sessionStorage.getItem(E.DRAFT_KEY) || 'null');
      if (!draft) return;
      hasDraft = true;
      Object.entries(draft).forEach(([key, value]) => {
        const field = form.elements[key];
        if (!field || field.type === 'file' || Array.isArray(value)) return;
        if (field.type === 'checkbox') field.checked = Boolean(value); else field.value = value;
      });
      window.EPASAR_MULTI.restore(draft.businessDrafts);
      document.getElementById('draftNotice').hidden = false;
    } catch (_) {}
  }
  function validateIdentityInline() {
    const nik = form.elements.nik, phone = form.elements.phone;
    const nikMessage = document.querySelector('[data-validation-for="nik"]');
    const phoneMessage = document.querySelector('[data-validation-for="phone"]');
    if (nik.value) {
      const valid = V.nik(nik.value);
      nik.setAttribute('aria-invalid', String(!valid));
      nikMessage.textContent = valid ? '✓ Format NIK sesuai.' : 'NIK harus terdiri dari 16 digit angka.';
      nikMessage.className = `field-message ${valid ? 'is-valid' : 'is-error'}`;
    }
    if (phone.value) {
      const valid = V.phone(phone.value);
      phone.setAttribute('aria-invalid', String(!valid));
      phoneMessage.textContent = valid ? '✓ Nomor dapat digunakan.' : 'Nomor WhatsApp terlalu pendek atau belum valid.';
      phoneMessage.className = `field-message ${valid ? 'is-valid' : 'is-error'}`;
    }
  }
  function validate() {
    const data = base(), current = steps.find(section => Number(section.dataset.step) === step);
    clearFieldErrors(current);
    const failures = validateVisibleFields(current);
    if (showFailures(failures, 'Lengkapi atau perbaiki bagian yang ditandai.')) return false;
    let message = '';
    if (step === 2 || step === 3) message = window.EPASAR_MULTI.validate(step);
    if (step === 4 && data.applySkpt && requireField(form.elements.religion, 'Pilih agama untuk pengajuan e-SKPT.')) return false;
    if (step === 4 && data.applySkpt && requireField(form.elements.citizenship, 'Isi kewarganegaraan untuk pengajuan e-SKPT.')) return false;
    if (step === 4 && data.applySkpt && !data.skptAck) {
      const acknowledgement = form.elements.skptAck;
      markInvalid(acknowledgement, 'Centang persetujuan persyaratan pengajuan e-SKPT setelah membacanya.');
      return showFailures([{ field: acknowledgement, message: 'Centang persetujuan persyaratan pengajuan e-SKPT setelah membacanya.' }], 'Persetujuan pengajuan e-SKPT belum lengkap.');
    }
    if (step === 4 && data.applySkpt && !window.EPASAR_MEDIA_BUFFER?.PROFILE) message = 'Foto penjual belum ditambahkan. Ambil foto atau pilih dari galeri untuk melanjutkan pengajuan e-SKPT.';
    else if (step === 4 && data.applySkpt && !window.EPASAR_MEDIA_BUFFER?.IDENTITY_KTP) message = 'Foto atau pindai KTP belum ditambahkan. Dokumen ini diperlukan hanya untuk pengajuan e-SKPT.';
    if (message) {
      if (step === 3) {
        const picker = [...current.querySelectorAll('.unit-type-picker')].find(item => !item.querySelector('select').value);
        if (picker) {
          picker.classList.add('is-invalid');
          const firstOption = picker.querySelector('button');
          firstOption?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          requestAnimationFrame(() => firstOption?.focus({ preventScroll: true }));
        }
      }
      showError(message);
      const invalid = current.querySelector('select:invalid, input:invalid, textarea:invalid') || current.querySelector('input, select, textarea');
      if (invalid) invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    if (step === 1) validateIdentityInline();
    clearError();
    return true;
  }
  function renderReview() {
    const data = base(), places = window.EPASAR_MULTI.places(), applications = places.filter(place => place.applySkpt);
    const businesses = data.businessDrafts.map((business, index) => `<article class="review-card"><button type="button" data-edit-step="2">Ubah</button><h3>Usaha ${index + 1}</h3><p><b>${safe(business.name || business.category)}</b><br>${safe(business.type)} · ${safe(business.category)}<br>${business.locations.length} lokasi · Perkiraan omzet Rp ${Number(business.monthlyRevenue || 0).toLocaleString('id-ID')}</p></article>`).join('');
    document.getElementById('review').innerHTML = `<article class="review-card"><button type="button" data-edit-step="1">Ubah</button><h3>Identitas</h3><p><b>${safe(data.name)}</b><br>NIK ${safe(data.nik).slice(0,2)}••••••••${safe(data.nik).slice(-2)}<br>${safe(data.phone)} · ${safe(data.address)}</p></article>${businesses}<article class="review-card"><button type="button" data-edit-step="3">Ubah</button><h3>Unit Pasar</h3><p>${places.length ? places.map(place => `${safe(place.marketName)} · ${safe(place.unitType)} ${safe(place.unitNumber)}`).join('<br>') : 'Tidak ada tempat pasar.'}${places.length ? '<br><span class="claim-badge">KLAIM AWAL · Perlu verifikasi petugas</span>' : ''}</p></article><article class="review-card"><button type="button" data-edit-step="4">Ubah</button><h3>Dokumen & e-SKPT</h3><p>Foto penjual: ${window.EPASAR_MEDIA_BUFFER?.PROFILE ? '✓ Siap' : 'Belum ditambahkan'}<br>e-SKPT: ${applications.length ? `${applications.length} permohonan akan dibuat` : 'Belum diajukan'}</p></article>`;
    document.querySelectorAll('[data-edit-step]').forEach(button => button.addEventListener('click', () => { step = Number(button.dataset.editStep); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  }
  function render() {
    steps.forEach(section => section.classList.toggle('is-active', Number(section.dataset.step) === step));
    document.querySelectorAll('[data-step-indicator]').forEach(item => { const value = Number(item.dataset.stepIndicator); item.classList.toggle('is-current', value === step); item.classList.toggle('is-complete', value < step); });
    document.getElementById('backButton').hidden = step === 1;
    document.getElementById('nextButton').textContent = step === E.STEPS ? 'Kirim Pendataan' : 'Lanjut';
    document.getElementById('stepLabel').textContent = `Langkah ${step} dari ${E.STEPS}`;
    document.getElementById('mobileStepTitle').textContent = titles[step - 1];
    document.getElementById('progressPercent').textContent = `${step * 20}%`;
    document.getElementById('progressBar').style.width = `${step * 20}%`;
    window.EPASAR_MULTI.render();
    if (step === 5) renderReview();
  }
  async function copy(id) {
    const value = document.getElementById(id).textContent;
    try { await navigator.clipboard.writeText(value); const button = document.querySelector(`[data-copy="${id}"]`); button.textContent = 'Tersalin ✓'; setTimeout(() => { button.textContent = id === 'registrationCode' ? 'Salin nomor' : 'Salin token'; }, 1600); } catch (_) {}
  }
  async function submit() {
    if (submitting || !validate()) return;
    if (window.epasarAuth?.currentUser) {
      showError('Anda sedang masuk sebagai petugas. Keluar dari akun petugas atau buka formulir melalui jendela privat sebelum mengirim pendataan. Data yang sudah diisi tetap tersimpan.');
      return;
    }
    submitting = true; const button = document.getElementById('nextButton'); button.disabled = true; button.textContent = 'Mengirim…';
    let created = null;
    try {
      if (!window.EPASAR_FIREBASE_READY) throw new Error('Pendataan belum terkirim. Periksa koneksi lalu coba lagi. Data Anda tetap tersimpan di halaman ini.');
      created = await window.EPASAR_INTAKE.submit(base());
      for (const key of Object.keys(window.EPASAR_MEDIA_BUFFER || {})) await window.EPASAR_INTAKE.submitMedia(window.EPASAR_MEDIA_BUFFER[key], created);
      form.hidden = true; document.querySelector('.stepper').hidden = true; document.querySelector('.registration-shell .page-header').hidden = true;
      document.getElementById('successPanel').hidden = false;
      document.getElementById('registrationCode').textContent = created.registrationCode;
      document.getElementById('privateToken').textContent = created.publicToken;
      document.getElementById('statusLink').href = `epasar-status.html?registration=${encodeURIComponent(created.registrationCode)}&token=${encodeURIComponent(created.publicToken)}`;
      sessionStorage.removeItem(E.DRAFT_KEY);
    } catch (exception) {
      console.error('[e-PASAR] Pengiriman pendataan gagal.', exception);
      showError(created ? `Pendataan utama tercatat dengan nomor ${created.registrationCode}, tetapi lampiran belum lengkap. Jangan kirim ulang; hubungi petugas.` : friendlySubmitError(exception));
      button.disabled = false; button.textContent = 'Kirim Pendataan'; submitting = false;
    }
  }
  document.getElementById('nextButton').addEventListener('click', () => { if (step === E.STEPS) submit(); else if (validate()) { step += 1; save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  document.getElementById('backButton').addEventListener('click', () => { if (step > 1) { step -= 1; clearError(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  document.getElementById('helpButton').addEventListener('click', () => { const panel = document.getElementById('helpPanel'); panel.hidden = false; document.getElementById('helpButton').setAttribute('aria-expanded', 'true'); });
  document.getElementById('closeHelp').addEventListener('click', () => { document.getElementById('helpPanel').hidden = true; document.getElementById('helpButton').setAttribute('aria-expanded', 'false'); });
  document.getElementById('discardDraft').addEventListener('click', () => { sessionStorage.removeItem(E.DRAFT_KEY); location.reload(); });
  document.getElementById('toggleToken').addEventListener('click', event => { const token = document.getElementById('privateToken'); token.classList.toggle('is-masked'); event.currentTarget.textContent = token.classList.contains('is-masked') ? 'Tampilkan' : 'Sembunyikan'; });
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', () => copy(button.dataset.copy)));
  form.addEventListener('input', event => {
    const field = event.target;
    if (field.name === 'nik' || field.name === 'phone') validateIdentityInline();
    if (field.matches('input, select, textarea')) {
      field.classList.remove('is-invalid');
      field.removeAttribute('aria-invalid');
      const host = field.closest('label') || field.parentElement;
      host?.querySelector('.field-error')?.remove();
    }
    save();
  });
  document.addEventListener('epasar:entities-changed', save);
  restore(); render();
}());
