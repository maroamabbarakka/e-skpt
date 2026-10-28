(function () {
  'use strict';

  const ROLES = ['SUPER_ADMIN', 'DISPERINDAG_ADMIN', 'TRADE_ADMIN', 'MARKET_ADMIN', 'MARKET_HEAD', 'UPTD_HEAD', 'KADIS', 'TECH_ADMIN'];

  function clean(value, max) { return String(value || '').trim().slice(0, max); }

  function profilePayload(input, existing) {
    const role = clean(input.role, 30).toUpperCase();
    const status = clean(input.status || 'ACTIVE', 20).toUpperCase();
    if (!ROLES.includes(role)) throw new Error('Role akun tidak valid.');
    if (!['ACTIVE', 'INACTIVE'].includes(status)) throw new Error('Status akun tidak valid.');
    if (!input.uid) throw new Error('UID Firebase wajib tersedia.');
    const scopedRole = ['MARKET_HEAD', 'MARKET_ADMIN', 'UPTD_HEAD'].includes(role);
    if (scopedRole && !Array.isArray(input.marketIds)) throw new Error('Daftar penugasan pasar wajib diisi.');
    const marketIds = scopedRole ? [...new Set(input.marketIds.map(value => window.EPASAR?.canonicalMarketId(value)).filter(Boolean))] : [];
    if (scopedRole && !marketIds.length) throw new Error('Pilih minimal satu pasar dari master pasar untuk role ini.');
    if (role === 'UPTD_HEAD') {
      const regions = new Set(marketIds.map(value => window.EPASAR?.marketRegion(value)).filter(Boolean));
      if (regions.size !== 1) throw new Error('Kepala UPTD hanya dapat ditugaskan pada pasar dalam satu wilayah yang sama.');
    }
    return {
      uid: String(input.uid),
      username: clean(input.username, 60).toLowerCase(),
      displayName: clean(input.displayName, 120),
      position: clean(input.position, 120),
      role,
      marketIds,
      marketDirectoryScoped: scopedRole,
      status,
      phone: clean(input.phone, 30),
      photoMediaId: existing?.photoMediaId || null,
      schemaVersion: 1,
      createdAt: existing?.createdAt || (window.firebase?.firestore?.FieldValue?.serverTimestamp ? window.firebase.firestore.FieldValue.serverTimestamp() : new Date()),
      updatedAt: window.firebase?.firestore?.FieldValue?.serverTimestamp ? window.firebase.firestore.FieldValue.serverTimestamp() : new Date()
    };
  }

  function canEdit(actor, target) {
    if (!actor || actor.role !== 'SUPER_ADMIN') return false;
    if (target?.role === 'SUPER_ADMIN' && target.uid !== actor.uid) return false;
    return true;
  }

  async function save(uid, input, existing) {
    if (!window.db) throw new Error('Firestore belum siap.');
    const actor = window.EPASAR_CURRENT_PROFILE;
    if (!canEdit(actor, existing || { uid })) throw new Error('Hanya Super Admin yang dapat mengelola akun.');
    const payload = profilePayload({ ...input, uid }, existing);
    const batch = window.db.batch();
    const profileReference = window.db.collection('users').doc(uid);
    batch.set(profileReference, payload, { merge: true });
    if (payload.username) batch.set(window.db.collection('login_aliases').doc(payload.username), {
      uid,
      status: payload.status,
      updatedAt: window.firebase?.firestore?.FieldValue?.serverTimestamp ? window.firebase.firestore.FieldValue.serverTimestamp() : new Date()
    }, { merge: true });
    await batch.commit();
    const savedSnapshot = await profileReference.get({ source: 'server' });
    if (!savedSnapshot.exists) throw new Error('Profil tidak ditemukan setelah penyimpanan. Muat ulang dan coba kembali.');
    const saved = savedSnapshot.data();
    const expectedMarkets = [...payload.marketIds].sort();
    const actualMarkets = Array.isArray(saved.marketIds) ? [...saved.marketIds].sort() : [];
    if (saved.status !== payload.status || saved.role !== payload.role || JSON.stringify(actualMarkets) !== JSON.stringify(expectedMarkets)) {
      throw new Error('Verifikasi penyimpanan gagal: status atau cakupan pasar di server belum sesuai.');
    }
    return { ...saved, uid };
  }

  async function provision(input) {
    const actor = window.EPASAR_CURRENT_PROFILE;
    if (!canEdit(actor, null)) throw new Error('Hanya Super Admin yang dapat membuat akun petugas.');
    const username = clean(input.username, 60).toLowerCase();
    const usernameEmail = username ? `${username}@eskpt.id` : '';
    const email = clean(input.email || usernameEmail, 120).toLowerCase();
    const password = String(input.password || '');
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Isi email akun yang valid.');
    if (username && email !== usernameEmail) throw new Error(`Agar login username berfungsi, gunakan email ${usernameEmail}.`);
    if (password.length < 8) throw new Error('Password awal minimal 8 karakter.');
    let secondary = firebase.apps.find(app => app.name === 'epasarAccountProvisioning');
    if (!secondary) secondary = firebase.initializeApp(window.EPASAR_FIREBASE_CONFIG, 'epasarAccountProvisioning');
    let credential;
    try { credential = await secondary.auth().createUserWithEmailAndPassword(email, password); }
    catch (error) {
      if (error.code === 'auth/email-already-in-use') throw new Error('Email akun sudah digunakan. Cari profil yang ada atau gunakan email lain.');
      if (error.code === 'auth/weak-password') throw new Error('Password awal terlalu lemah. Gunakan minimal 8 karakter.');
      throw new Error('Akun Firebase belum berhasil dibuat. Periksa email, password, dan koneksi lalu coba lagi.');
    }
    try { return await save(credential.user.uid, { ...input, uid: credential.user.uid, username }, null); }
    finally { await secondary.auth().signOut(); }
  }

  window.EPASAR_ACCOUNT = { ROLES, profilePayload, canEdit, save, provision };
}());
