(function(){'use strict';
  const TYPES=['STORE','STREET_VENDOR','MARKET','HOME','MOBILE','ONLINE','OTHER'];
  function clean(value,max){return String(value||'').trim().slice(0,max)}
  function businessPayload(input,traderId){const type=String(input.type||'OTHER').toUpperCase();if(!traderId)throw new Error('traderId wajib tersedia setelah master terbentuk.');if(!TYPES.includes(type))throw new Error('Tipe lokasi usaha tidak dikenal.');return{traderId,name:clean(input.name,120),category:clean(input.category,120),status:'ACTIVE',schemaVersion:1,createdAt:'SERVER_TIMESTAMP',updatedAt:'SERVER_TIMESTAMP'}}
  function locationPayload(input,businessId){if(!businessId)throw new Error('businessId wajib tersedia.');const type=String(input.type||'OTHER').toUpperCase();if(!TYPES.includes(type))throw new Error('Tipe lokasi tidak dikenal.');return{businessId,type,address:clean(input.address,300),district:clean(input.district,60),village:clean(input.village,80),locationHint:clean(input.locationHint,300),schemaVersion:1,createdAt:'SERVER_TIMESTAMP'}}
  function classificationPayload(input,traderId){const allowed=['TRADE','INDUSTRY','CRAFT','DEKRANASDA_CANDIDATE','UMKM','EKRAF_KRIYA','FOOD_PROCESSING'];if(!traderId||!allowed.includes(input.code))throw new Error('Klasifikasi atau traderId tidak valid.');return{traderId,code:input.code,source:input.source||'ADMIN_REVIEW',status:'CLAIMED',verifiedBy:null,verifiedAt:null,note:clean(input.note,500),schemaVersion:1,createdAt:'SERVER_TIMESTAMP'}}
  window.EPASAR_BUSINESS={types:TYPES,businessPayload,locationPayload,classificationPayload};
})();
