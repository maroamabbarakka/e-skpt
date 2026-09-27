(function () {
  'use strict';

  function database() {
    if (!window.db) throw new Error('Firebase belum dikonfigurasi.');
    return window.db;
  }

  function token() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function registrationCode() {
    return `REG-PIN-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  function payload(data) {
    const businesses = Array.isArray(data.businessDrafts) ? data.businessDrafts.slice(0, 5).map(business => ({
      draftId: String(business.id || ''), name: String(business.name || '').trim(), type: String(business.type || '').trim(), group: String(business.group || '').trim(), category: String(business.category || '').trim(), monthlyRevenue: Number(business.monthlyRevenue || 0), workerCount: Number(business.workerCount || 0), expense: String(business.expense || '').trim(),
      locations: (business.locations || []).slice(0, 5).map(location => ({ draftId: String(location.id || ''), type: String(location.type || 'GENERAL'), district: String(location.district || '').trim(), village: String(location.village || '').trim(), address: String(location.address || '').trim(), marketPlaces: (location.marketPlaces || []).slice(0, 5).map(place => {
        const market = window.EPASAR.marketById(place.marketId);
        if (!market) throw new Error('Pasar yang dipilih tidak tersedia pada master pasar. Pilih ulang nama pasar.');
        return { draftId: String(place.id || ''), marketId: market.id, marketName: market.name, unitType: String(place.unitType || '').toUpperCase(), unitNumber: String(place.unitNumber || '').trim(), block: String(place.block || '').trim(), floor: String(place.floor || '').trim(), areaM2: place.areaM2 === '' || place.areaM2 == null ? null : Number(place.areaM2), locationHint: String(place.locationHint || '').trim(), applySkpt: Boolean(place.applySkpt) };
      }) }))
    })) : [];
    const identityDistrict = String(data.district || '').trim();
    const identityVillage = String(data.village || '').trim();
    if (!window.EPASAR.DISTRICTS.includes(identityDistrict) || !window.EPASAR.villagesByDistrict(identityDistrict).includes(identityVillage)) throw new Error('Kecamatan atau desa/kelurahan identitas tidak sesuai master wilayah. Pilih ulang dari daftar.');
    for (const business of businesses) for (const location of business.locations) {
      if (!window.EPASAR.DISTRICTS.includes(location.district) || !window.EPASAR.villagesByDistrict(location.district).includes(location.village)) throw new Error('Kecamatan atau desa/kelurahan lokasi usaha tidak sesuai master wilayah. Pilih ulang dari daftar.');
    }
    const places = businesses.flatMap(b => b.locations.flatMap(l => l.marketPlaces));
    const maxMarketPlaces = Number(window.EPASAR.MAX_MARKET_PLACES || 25);
    if (places.length > maxMarketPlaces) throw new Error(`Maksimal ${maxMarketPlaces} tempat pasar dalam satu pendaftaran. Pisahkan data tambahan ke proses penambahan lokasi.`);
    const applySkpt = places.some(place => place.applySkpt);
    const basicAcceptance = Boolean(data.truthAck && data.verificationAck);
    const completeAcceptance = Boolean(basicAcceptance && (!applySkpt || data.skptAck));
    const statementText = applySkpt
      ? 'Pemohon menyatakan data benar, menyetujui verifikasi, bersedia menaati kewajiban Pedagang Pasar Rakyat, memahami pelindungan data, dan memahami bahwa SKPT berlaku dua tahun serta bukan bukti kepemilikan.'
      : 'Pemohon menyatakan data pendataan benar, dapat dipertanggungjawabkan, dan menyetujui pemeriksaan data oleh petugas yang berwenang.';
    return {
      registrationCode: registrationCode(),
      submittedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      status: 'SUBMITTED',
      identity: {
        name: String(data.name || '').trim(), phone: String(data.phone || '').trim(),
        district: identityDistrict, village: identityVillage,
        address: String(data.address || '').trim(), birthPlace: String(data.birthPlace || '').trim(), birthDate: String(data.birthDate || '').trim(),
        religion: String(data.religion || '').trim(), citizenship: String(data.citizenship || '').trim(), nik: String(data.nik || '').replace(/\s/g, '')
      },
      businessDrafts: businesses,
      marketDraft: places[0] || {},
      hasMarketUnit: places.length > 0, applySkpt,
      requirementsAcceptance: { version: window.EPASAR.REQUIREMENTS_VERSION, accepted: completeAcceptance, acceptedAt: window.firebase.firestore.FieldValue.serverTimestamp(), itemCodes: ['DATA_VERIFICATION','SEPARATE_APPLICATION_PER_PLACE','TWO_YEAR_VALIDITY','NOT_PROOF_OF_OWNERSHIP','SAME_LOCATION_LIMIT_REVIEW'] },
      statementAccepted: completeAcceptance,
      statement: { version: 'SKPT-STATEMENT-V3-PERDA6-2024', type: applySkpt ? 'PERNYATAAN_ELEKTRONIK_SKPT' : 'PERNYATAAN_ELEKTRONIK_PENDATAAN', text: statementText, accepted: completeAcceptance, acceptanceMethod: 'AFFIRMATIVE_CHECKBOX', acceptedAt: window.firebase.firestore.FieldValue.serverTimestamp() },
      source: 'PUBLIC_FORM', schemaVersion: 2, publicToken: token()
    };
  }

  async function submit(data) {
    const document = payload(data);
    const reference = database().collection('trader_intake').doc();
    const statusReference = database().collection('public_status').doc(document.publicToken);
    const batch = database().batch();
    batch.set(reference, document);
    batch.set(statusReference, { intakeId: reference.id, publicToken: document.publicToken, registrationCode: document.registrationCode, status: 'SUBMITTED', publicStatus: true, displayName: document.identity.name, traderId: '', businessType: '', marketName: '', marketRoutes: [], statementVersion: document.statement.version, statementAcceptedAt: document.statement.acceptedAt, photoMediaToken: '', reviewMessage: '', correctionSections: [], canResubmit: false, environment: 'UAT', isDemo: true, schemaVersion: 2, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
    await batch.commit();
    return { intakeId: reference.id, registrationCode: document.registrationCode, publicToken: document.publicToken };
  }

  async function submitMedia(result, intake) {
    if (!result || !result.dataBase64 || !intake?.intakeId || !intake.publicToken) throw new Error('Media atau intake belum siap.');
    const media = window.EPASAR_MEDIA.buildMediaRecord(result, {
      ownerType: 'TRADER_INTAKE', ownerId: intake.intakeId, mediaType: result.mediaType || 'PROFILE'
    });
    media.createdAt = window.firebase.firestore.FieldValue.serverTimestamp();
    media.publicToken = intake.publicToken;
    await database().collection('trader_media').add(media);
  }

  window.EPASAR_INTAKE = { submit, submitMedia, payload };
}());
