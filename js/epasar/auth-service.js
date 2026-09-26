(function(){
  'use strict';
  const ROLES=['SUPER_ADMIN','DISPERINDAG_ADMIN','TRADE_ADMIN','MARKET_ADMIN','MARKET_HEAD','KADIS','TECH_ADMIN'];
  function auth(){if(!window.epasarAuth)throw new Error('Firebase Authentication belum siap.');return window.epasarAuth}
  function loginEmail(identifier){
    const value=String(identifier||'').trim().toLowerCase();
    if(!value)return'';
    if(value.includes('@'))return value;
    if(!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(value))throw new Error('Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.');
    return`${value}@eskpt.id`;
  }
  function friendlyAuthError(error){
    const code=String(error&&error.code||'');
    if(['auth/invalid-credential','auth/wrong-password','auth/user-not-found','auth/invalid-login-credentials'].includes(code))return new Error('Email/username atau password belum benar. Periksa kembali lalu coba lagi.');
    if(code==='auth/too-many-requests')return new Error('Percobaan masuk terlalu sering. Tunggu beberapa saat lalu coba kembali.');
    if(code==='auth/network-request-failed')return new Error('Koneksi ke layanan akun terputus. Periksa internet lalu coba kembali.');
    if(code==='auth/user-disabled')return new Error('Akun ini sedang dinonaktifkan. Hubungi Super Admin.');
    return new Error('Akun belum dapat masuk saat ini. Silakan coba kembali atau hubungi Super Admin.');
  }
  async function signIn(identifier,password){const email=loginEmail(identifier);if(!email||!password)throw new Error('Email/username dan password wajib diisi.');try{const result=await auth().signInWithEmailAndPassword(email,password);return await loadProfile(result.user)}catch(error){if(error&&error.message&&error.message.startsWith('Akun belum memiliki'))throw error;throw friendlyAuthError(error)}}
  async function loadProfile(user){if(!user||!window.db)throw new Error('Profil akun belum dapat dibaca.');const snap=await window.db.collection('users').doc(user.uid).get();if(!snap.exists)throw new Error('Akun belum memiliki profil jabatan. Hubungi Super Admin.');const profile={uid:user.uid,email:user.email,...snap.data()};if(profile.status!=='ACTIVE'||!ROLES.includes(profile.role))throw new Error('Akun tidak aktif atau role belum ditetapkan.');window.EPASAR_CURRENT_PROFILE=profile;return profile}
  function requireStaff(allowed){return new Promise((resolve,reject)=>{if(!window.epasarAuth)return reject(new Error('Firebase Authentication belum siap.'));const off=window.epasarAuth.onAuthStateChanged(async user=>{off();try{const profile=await loadProfile(user);if(allowed&&!allowed.includes(profile.role))throw new Error('Anda tidak memiliki kewenangan pada halaman ini.');resolve(profile)}catch(error){reject(error)}})})}
  async function signOut(){if(window.epasarAuth)await window.epasarAuth.signOut();window.EPASAR_CURRENT_PROFILE=null}
  window.EPASAR_AUTH={signIn,loadProfile,requireStaff,signOut,loginEmail,ROLES};
}());
