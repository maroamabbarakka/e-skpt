(function () {
  'use strict';
  const E = window.EPASAR, V = window.EPASAR_VALIDATORS;
  const form = document.getElementById('traderForm');
  const steps = [...document.querySelectorAll('.form-step')];
  const error = document.getElementById('formError');
  const titles = ['Identitas Pedagang', 'Data Usaha', 'Lokasi & Unit Pasar', 'Dokumen & e-SKPT', 'Periksa Data'];
  let step = 1, submitting = false, hasDraft = false;
  let createdIntake = null, submissionMediaQueue = null;
  const uploadedMediaKeys = new Set();
  let openSkptLegalDocument = () => {};
  const safe = value => String(value ?? '—').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  function base() {
    const out = {};
    new FormData(form).forEach((value, key) => { if (!(value instanceof File)) out[key] = value; });
    if (out.birthDate) out.birthDate = V.formatDateId(out.birthDate);
    if (out.district === 'Luar Kabupaten Pinrang' && !out.village) {
      out.village = 'Luar Kabupaten Pinrang';
    }
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
      else if (field.name === 'birthDate' && !V.isValidDateId(value)) message = 'Format tanggal lahir harus dd/mm/yyyy (contoh: 17/08/1990) dengan tanggal yang sah.';
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
        if (field.type === 'checkbox') {
          if (key === 'skptAck') return;
          field.checked = Boolean(value);
        } else if (key === 'birthDate') {
          field.value = V.formatDateId(value);
          const helper = document.getElementById('nativeDatePickerHelper');
          if (helper && V.isValidDateId(field.value)) helper.value = V.toIsoDate(field.value);
        } else {
          field.value = value;
        }
      });
      if (draft.district) {
        syncIdentityVillage(false);
        if (draft.district === 'Luar Kabupaten Pinrang') {
          form.elements.village.value = 'Luar Kabupaten Pinrang';
        } else if (E.villagesByDistrict(draft.district).includes(draft.village)) {
          form.elements.village.value = draft.village;
        }
      }
      window.EPASAR_MULTI.restore(draft.businessDrafts);
      document.getElementById('draftNotice').hidden = false;
    } catch (_) {}
  }
  function validateIdentityInline() {
    const nik = form.elements.nik, phone = form.elements.phone, birthDate = form.elements.birthDate;
    const nikMessage = document.querySelector('[data-validation-for="nik"]');
    const phoneMessage = document.querySelector('[data-validation-for="phone"]');
    const birthDateMessage = document.querySelector('[data-validation-for="birthDate"]');
    if (nik && nik.value) {
      const valid = V.nik(nik.value);
      nik.setAttribute('aria-invalid', String(!valid));
      if (nikMessage) {
        nikMessage.textContent = valid ? '✓ Format NIK sesuai.' : 'NIK harus terdiri dari 16 digit angka.';
        nikMessage.className = `field-message ${valid ? 'is-valid' : 'is-error'}`;
      }
    }
    if (phone && phone.value) {
      const valid = V.phone(phone.value);
      phone.setAttribute('aria-invalid', String(!valid));
      if (phoneMessage) {
        phoneMessage.textContent = valid ? '✓ Nomor dapat digunakan.' : 'Nomor WhatsApp terlalu pendek atau belum valid.';
        phoneMessage.className = `field-message ${valid ? 'is-valid' : 'is-error'}`;
      }
    }
    if (birthDate && birthDate.value) {
      const val = birthDate.value.trim();
      const valid = V.isValidDateId(val);
      birthDate.setAttribute('aria-invalid', String(!valid));
      if (birthDateMessage) {
        if (valid) {
          birthDateMessage.textContent = '✓ Format tanggal lahir sesuai (dd/mm/yyyy).';
          birthDateMessage.className = 'field-message is-valid';
        } else if (val.length === 10) {
          birthDateMessage.textContent = 'Tanggal lahir tidak valid. Gunakan format dd/mm/yyyy (contoh: 17/08/1990).';
          birthDateMessage.className = 'field-message is-error';
        } else {
          birthDateMessage.textContent = 'Format: hh/bb/tttt (contoh: 17/08/1990)';
          birthDateMessage.className = 'field-message';
        }
      }
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
      showError('Persetujuan pengajuan e-SKPT belum lengkap. Buka dan baca dokumen persyaratan sampai akhir, kemudian berikan persetujuan eksplisit.');
      const readButton = document.getElementById('openSkptLegalModal');
      readButton?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      requestAnimationFrame(() => readButton?.focus({ preventScroll: true }));
      return false;
    }
    if (step === 4 && !window.EPASAR_MEDIA_BUFFER?.IDENTITY_KTP) message = 'Foto atau pindai KTP belum ditambahkan. KTP diperlukan untuk pencocokan identitas pada seluruh pendataan pedagang.';
    else if (step === 4 && data.applySkpt && !window.EPASAR_MEDIA_BUFFER?.PROFILE) message = 'Foto penjual/selfie belum ditambahkan. Dokumen ini wajib untuk pengajuan e-SKPT.';
    else if (step === 4 && data.applySkpt && !window.EPASAR_MEDIA_BUFFER?.EVIDENCE) message = 'Foto dagangan atau kegiatan usaha belum ditambahkan. Dokumen ini wajib untuk pengajuan e-SKPT.';
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
    const media = window.EPASAR_MEDIA_BUFFER || {};
    const status = value => value ? '✓ Siap' : 'Belum ditambahkan';
    const businesses = data.businessDrafts.map((business, index) => `<article class="review-card"><button type="button" data-edit-step="2">Ubah</button><h3>Usaha ${index + 1}</h3><p><b>${safe(business.name || business.category)}</b><br>${safe(business.type)} · ${safe(business.category)}<br>${business.locations.length} lokasi · Perkiraan omzet Rp ${Number(business.monthlyRevenue || 0).toLocaleString('id-ID')}</p></article>`).join('');
    const skptDocuments = applications.length
      ? `<br>Foto penjual/selfie: ${status(media.PROFILE)}<br>Foto dagangan/usaha: ${status(media.EVIDENCE)}`
      : '<br>Dokumen khusus e-SKPT: Tidak diperlukan';
    document.getElementById('review').innerHTML = `<article class="review-card"><button type="button" data-edit-step="1">Ubah</button><h3>Identitas</h3><p><b>${safe(data.name)}</b><br>NIK ${safe(data.nik).slice(0,2)}••••••••${safe(data.nik).slice(-2)}<br>${safe(data.phone)} · ${safe(data.address)}</p></article>${businesses}<article class="review-card"><button type="button" data-edit-step="3">Ubah</button><h3>Unit Pasar</h3><p>${places.length ? places.map(place => `${safe(place.marketName)} · ${safe(place.unitType)} ${safe(place.unitNumber)}`).join('<br>') : 'Tidak ada tempat pasar.'}${places.length ? '<br><span class="claim-badge">KLAIM AWAL · Perlu verifikasi petugas</span>' : ''}</p></article><article class="review-card"><button type="button" data-edit-step="4">Ubah</button><h3>Dokumen Identitas & e-SKPT</h3><p>KTP: ${status(media.IDENTITY_KTP)}<br>KK: ${media.IDENTITY_KK ? '✓ Ditambahkan' : 'Opsional—tidak ditambahkan'}<br>e-SKPT: ${applications.length ? `${applications.length} permohonan akan dibuat` : 'Tidak diajukan'}${skptDocuments}</p></article>`;
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
    if (submitting || (!createdIntake && !validate())) return;
    if (window.epasarAuth?.currentUser) {
      showError('Anda sedang masuk sebagai petugas. Keluar dari akun petugas atau buka formulir melalui jendela privat sebelum mengirim pendataan. Data yang sudah diisi tetap tersimpan.');
      return;
    }
    submitting = true; const button = document.getElementById('nextButton'); button.disabled = true; button.textContent = createdIntake ? 'Melanjutkan unggahan…' : 'Mengirim…';
    let currentMediaKey = '';
    try {
      if (!window.EPASAR_FIREBASE_READY) throw new Error('Pendataan belum terkirim. Periksa koneksi lalu coba lagi. Data Anda tetap tersimpan di halaman ini.');
      if (!createdIntake) {
        const data = base();
        const allowedMedia = data.applySkpt ? ['IDENTITY_KTP', 'IDENTITY_KK', 'PROFILE', 'EVIDENCE'] : ['IDENTITY_KTP', 'IDENTITY_KK'];
        submissionMediaQueue = allowedMedia.map(key => [key, window.EPASAR_MEDIA_BUFFER?.[key]]).filter(([, media]) => Boolean(media));
        createdIntake = await window.EPASAR_INTAKE.submit(data);
        form.querySelectorAll('input,select,textarea').forEach(control => { control.disabled = true; });
        form.querySelectorAll('button').forEach(control => { if (control.id !== 'nextButton') control.disabled = true; });
      }
      for (const [key, media] of submissionMediaQueue || []) {
        if (uploadedMediaKeys.has(key)) continue;
        currentMediaKey = key;
        await window.EPASAR_INTAKE.submitMedia(media, createdIntake);
        uploadedMediaKeys.add(key);
      }
      form.hidden = true; document.querySelector('.stepper').hidden = true; document.querySelector('.registration-shell .page-header').hidden = true;
      document.getElementById('successPanel').hidden = false;
      document.getElementById('registrationCode').textContent = createdIntake.registrationCode;
      document.getElementById('privateToken').textContent = createdIntake.publicToken;
      document.getElementById('statusLink').href = `epasar-status.html?registration=${encodeURIComponent(createdIntake.registrationCode)}&token=${encodeURIComponent(createdIntake.publicToken)}`;
      const cardLink = document.getElementById('directCardLink');
      if (cardLink) {
        cardLink.href = `trader-card.html?token=${encodeURIComponent(createdIntake.publicToken)}`;
        cardLink.hidden = false;
      }
      sessionStorage.removeItem(E.DRAFT_KEY);
    } catch (exception) {
      console.error('[e-PASAR] Pengiriman pendataan gagal.', exception);
      if (createdIntake) {
        const mediaNames = { IDENTITY_KTP: 'KTP', IDENTITY_KK: 'KK', PROFILE: 'foto penjual/selfie', EVIDENCE: 'foto dagangan/usaha' };
        showError(`Pendataan utama sudah tercatat dengan nomor ${createdIntake.registrationCode}, tetapi ${mediaNames[currentMediaKey] || 'salah satu lampiran'} belum berhasil diunggah. Tekan tombol di bawah untuk melanjutkan unggahan ke pendaftaran yang sama. Jangan mengisi atau mengirim formulir baru.`);
        button.textContent = 'Lanjutkan unggah lampiran';
      } else {
        showError(friendlySubmitError(exception));
        button.textContent = 'Kirim Pendataan';
      }
      button.disabled = false; submitting = false;
    }
  }
  document.getElementById('nextButton').addEventListener('click', () => { if (step === E.STEPS) submit(); else if (validate()) { step += 1; save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  document.getElementById('backButton').addEventListener('click', () => { if (step > 1) { step -= 1; clearError(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  document.getElementById('helpButton').addEventListener('click', () => { const panel = document.getElementById('helpPanel'); panel.hidden = false; document.getElementById('helpButton').setAttribute('aria-expanded', 'true'); });
  document.getElementById('closeHelp').addEventListener('click', () => { document.getElementById('helpPanel').hidden = true; document.getElementById('helpButton').setAttribute('aria-expanded', 'false'); });
  document.getElementById('discardDraft').addEventListener('click', () => { sessionStorage.removeItem(E.DRAFT_KEY); location.reload(); });
  document.getElementById('toggleToken').addEventListener('click', event => { const token = document.getElementById('privateToken'); token.classList.toggle('is-masked'); event.currentTarget.textContent = token.classList.contains('is-masked') ? 'Tampilkan' : 'Sembunyikan'; });
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', () => copy(button.dataset.copy)));
  const identityDistrict = document.getElementById('identityDistrict');
  const identityVillage = document.getElementById('identityVillage');
  identityDistrict.innerHTML = '<option value="">Pilih kecamatan</option>' + E.DISTRICTS.map(name => `<option value="${safe(name)}">${safe(name)}</option>`).join('') + '<option value="Luar Kabupaten Pinrang">Luar Kabupaten Pinrang</option>';
  const syncIdentityVillage = preserve => {
    const isOut = identityDistrict.value === 'Luar Kabupaten Pinrang';
    if (isOut) {
      identityVillage.innerHTML = '<option value="Luar Kabupaten Pinrang" selected>— Tidak Ada Pilihan (Luar Kabupaten) —</option>';
      identityVillage.disabled = true;
      identityVillage.removeAttribute('required');
      identityVillage.classList.remove('is-invalid');
      const err = identityVillage.parentElement?.querySelector('.field-error');
      if (err) err.remove();
      return;
    }
    identityVillage.setAttribute('required', 'required');
    const selected = preserve ? identityVillage.value : '';
    const villages = E.villagesByDistrict(identityDistrict.value);
    identityVillage.innerHTML = `<option value="">${villages.length ? 'Pilih desa/kelurahan' : 'Pilih kecamatan terlebih dahulu'}</option>` + villages.map(name => `<option value="${safe(name)}">${safe(name)}</option>`).join('');
    identityVillage.disabled = !villages.length;
    if (preserve && villages.includes(selected)) identityVillage.value = selected;
  };
  identityDistrict.addEventListener('change', () => { syncIdentityVillage(false); save(); });
  function initBirthDatePicker() {
    const birthInput = document.getElementById('birthDateInput');
    const btnPicker = document.getElementById('btnBirthDatePicker');
    const helperPicker = document.getElementById('nativeDatePickerHelper');
    if (!birthInput) return;

    let isDeleting = false;
    birthInput.addEventListener('keydown', e => {
      isDeleting = (e.key === 'Backspace' || e.key === 'Delete');
    });

    birthInput.addEventListener('input', () => {
      let val = birthInput.value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        birthInput.value = V.formatDateId(val);
        if (helperPicker) helperPicker.value = val;
        validateIdentityInline();
        save();
        return;
      }

      if (!isDeleting) {
        const digits = val.replace(/\D/g, '').slice(0, 8);
        let masked = '';
        if (digits.length > 4) {
          masked = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
        } else if (digits.length > 2) {
          masked = `${digits.slice(0, 2)}/${digits.slice(2)}`;
        } else {
          masked = digits;
        }
        if (masked !== val) {
          birthInput.value = masked;
        }
      }

      if (helperPicker && V.isValidDateId(birthInput.value)) {
        helperPicker.value = V.toIsoDate(birthInput.value);
      }
      validateIdentityInline();
    });

    if (btnPicker && helperPicker) {
      btnPicker.addEventListener('click', () => {
        if (V.isValidDateId(birthInput.value)) {
          helperPicker.value = V.toIsoDate(birthInput.value);
        }
        if (typeof helperPicker.showPicker === 'function') {
          try {
            helperPicker.showPicker();
          } catch (_) {
            helperPicker.focus();
            helperPicker.click();
          }
        } else {
          helperPicker.focus();
          helperPicker.click();
        }
      });

      helperPicker.addEventListener('change', () => {
        if (helperPicker.value) {
          birthInput.value = V.formatDateId(helperPicker.value);
          birthInput.classList.remove('is-invalid');
          birthInput.removeAttribute('aria-invalid');
          const host = birthInput.closest('label') || birthInput.parentElement;
          host?.querySelector('.field-error')?.remove();
          validateIdentityInline();
          save();
        }
      });
    }
  }

  function initSkptLegalConsent() {
    const api = window.EPASAR_SKPT_LEGAL_APPENDIX;
    const modal = document.getElementById('skptLegalModal');
    const openButton = document.getElementById('openSkptLegalModal');
    const closeButton = document.getElementById('closeSkptLegalModal');
    const cancelButton = document.getElementById('cancelSkptLegalModal');
    const acceptButton = document.getElementById('acceptSkptLegalDocument');
    const scrollArea = document.getElementById('skptLegalScroll');
    const content = document.getElementById('skptLegalContent');
    const progressBar = document.getElementById('skptLegalProgressBar');
    const progressPercent = document.getElementById('skptLegalProgressPercent');
    const progressText = document.getElementById('skptLegalProgressText');
    const consentHint = document.getElementById('skptLegalConsentHint');
    const status = document.getElementById('skptLegalStatus');
    const acknowledgement = form.elements.skptAck;
    if (!api || !modal || !openButton || !acknowledgement) return;

    let loaded = false;
    let reachedEnd = false;
    let previouslyFocused = null;

    const updateProgress = () => {
      const maximum = Math.max(1, scrollArea.scrollHeight - scrollArea.clientHeight);
      const percent = Math.min(100, Math.round((scrollArea.scrollTop / maximum) * 100));
      const atEnd = scrollArea.scrollTop + scrollArea.clientHeight >= scrollArea.scrollHeight - 12;
      if (atEnd) reachedEnd = true;
      progressBar.style.width = `${reachedEnd ? 100 : percent}%`;
      progressPercent.textContent = `${reachedEnd ? 100 : percent}%`;
      progressText.textContent = reachedEnd ? 'Dokumen telah dibaca sampai akhir' : 'Baca dokumen sampai selesai';
      acceptButton.disabled = !reachedEnd;
      consentHint.textContent = reachedEnd
        ? 'Anda telah mencapai akhir dokumen. Berikan persetujuan jika seluruh ketentuan telah dipahami.'
        : 'Tombol persetujuan aktif setelah dokumen dibaca sampai bagian akhir.';
    };

    const close = () => {
      modal.hidden = true;
      document.body.classList.remove('has-legal-modal');
      previouslyFocused?.focus();
    };

    openSkptLegalDocument = async () => {
      previouslyFocused = document.activeElement;
      modal.hidden = false;
      document.body.classList.add('has-legal-modal');
      closeButton.focus();
      if (!loaded) {
        try {
          const documentData = await api.load();
          content.innerHTML = api.renderFull(documentData);
          loaded = true;
        } catch (exception) {
          content.innerHTML = `<p class="field-message is-error">${safe(exception.message || 'Dokumen persyaratan gagal dimuat. Muat ulang halaman dan coba kembali.')}</p>`;
          acceptButton.disabled = true;
        }
      }
      scrollArea.scrollTop = acknowledgement.checked ? scrollArea.scrollHeight : 0;
      requestAnimationFrame(updateProgress);
    };

    openButton.addEventListener('click', openSkptLegalDocument);
    closeButton.addEventListener('click', close);
    cancelButton.addEventListener('click', close);
    scrollArea.addEventListener('scroll', updateProgress, { passive: true });
    acceptButton.addEventListener('click', () => {
      if (!reachedEnd) return;
      acknowledgement.disabled = false;
      acknowledgement.checked = true;
      acknowledgement.classList.remove('is-invalid');
      acknowledgement.removeAttribute('aria-invalid');
      acknowledgement.closest('label')?.querySelector('.field-error')?.remove();
      status.textContent = 'Sudah dibaca dan disetujui';
      status.className = 'legal-read-status is-complete';
      clearError();
      save();
      close();
    });
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') {
        const focusable = [...modal.querySelectorAll('button:not([disabled]), [tabindex="0"]')].filter(element => element.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  }

  form.addEventListener('input', event => {
    const field = event.target;
    if (field.matches('input, select, textarea')) {
      field.classList.remove('is-invalid');
      field.removeAttribute('aria-invalid');
      const host = field.closest('label') || field.parentElement;
      host?.querySelector('.field-error')?.remove();
    }
    if (field.name === 'nik' || field.name === 'phone' || field.name === 'birthDate') validateIdentityInline();
    save();
  });
  document.addEventListener('epasar:entities-changed', save);
  initBirthDatePicker(); initSkptLegalConsent(); restore(); syncIdentityVillage(true); render();
  form.dataset.ready = 'true';
}());
