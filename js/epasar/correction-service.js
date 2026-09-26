(function(){'use strict';
  function token(){const a=new Uint8Array(32);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')}
  async function submit(input){
    if(!window.db)throw new Error('Firebase belum dikonfigurasi.');
    const section=String(input.section||'').trim(),marketId=String(input.marketId||'').trim();
    const d={registrationCode:String(input.registrationCode||'').trim(),accessToken:String(input.accessToken||'').trim(),createdAt:firebase.firestore.FieldValue.serverTimestamp(),status:'PENDING_REVIEW',source:'PUBLIC_FORM',schemaVersion:2,publicToken:token(),section,value:String(input.value||'').trim(),reason:String(input.reason||'').trim(),marketId,claimId:String(input.claimId||'').trim(),routingRoles:section==='marketUnit'?['MARKET_HEAD','DISPERINDAG_ADMIN']:['DISPERINDAG_ADMIN']};
    const ref=window.db.collection('correction_requests').doc();await ref.set(d);return{requestId:ref.id,registrationCode:d.registrationCode};
  }
  window.EPASAR_CORRECTION={submit};
})();
