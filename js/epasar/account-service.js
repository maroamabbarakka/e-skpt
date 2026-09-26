(function () {
  'use strict';

  const ROLES = ['SUPER_ADMIN', 'DISPERINDAG_ADMIN', 'TRADE_ADMIN', 'MARKET_ADMIN', 'MARKET_HEAD', 'KADIS', 'TECH_ADMIN'];

  function clean(value, max) { return String(value || '').trim().slice(0, max); }

  function profilePayload(input, existing) {
    const role = clean(input.role, 30).toUpperCase();
    const status = clean(input.status || 'ACTIVE', 20).toUpperCase();
    if (!ROLES.includes(role)) throw new Error('Role akun tidak valid.');
    if (!['ACTIVE', 'INACTIVE'].includes(status)) throw new Error('Status akun tidak valid.');
    if (!input.uid) throw new Error('UID Firebase wajib tersedia.');
    if (role === 'MARKET_HEAD' && !Array.isArray(input.marketIds)) throw new Error('Daftar penugasan pasar wajib diisi.');
    const marketIds = role === 'MARKET_HEAD' ? [...new Set(input.marketIds.map(value => window.EPASAR?.canonicalMarketId(value)).filter(Boolean))] : [];
    if (role === 'MARKET_HEAD' && !marketIds.length) throw new Error('Pilih minimal satu pasar dari master pasar untuk Kepala Pasar.');
    return {
      uid: String(input.uid),
      username: clean(input.username, 60).toLowerCase(),
      displayName: clean(input.displayName, 120),
      position: clean(input.position, 120),
      role,
      marketIds,
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
    await window.db.collection('users').doc(uid).set(payload, { merge: false });
    if (payload.username) await window.db.collection('login_aliases').doc(payload.username).set({ uid, status: payload.status, updatedAt: window.firebase?.firestore?.FieldValue?.serverTimestamp ? window.firebase.firestore.FieldValue.serverTimestamp() : new Date() });
    return payload;
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
