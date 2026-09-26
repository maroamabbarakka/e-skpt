(function(){'use strict';
  // Konfigurasi harus disediakan oleh pemilik melalui runtime/local note.
  // Tidak ada project ID, API key, atau credential yang ditanam di repository.
  function init(){
    const cfg=window.EPASAR_FIREBASE_CONFIG;
    if(!cfg||!cfg.projectId){console.info('[e-PASAR] Firebase belum dikonfigurasi. Mode UI lokal aktif.');return false}
    if(typeof firebase==='undefined'||typeof firebase.initializeApp!=='function'){console.warn('[e-PASAR] Firebase SDK belum dimuat.');return false}
    if(!firebase.apps.length)firebase.initializeApp(cfg);
    window.db=firebase.firestore();window.epasarAuth=typeof firebase.auth==='function'?firebase.auth():null;window.EPASAR_FIREBASE_READY=true;return true;
  }
  window.EPASAR_FIREBASE_READY=false;window.EPASAR_FIREBASE_INIT=init;
  init();
})();
