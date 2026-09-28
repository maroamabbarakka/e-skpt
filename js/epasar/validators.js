(function(){
  'use strict';
  function text(v,max){return typeof v==='string'&&v.trim().length>0&&v.trim().length<=max}
  function nik(v){return /^\d{16}$/.test(String(v||'').replace(/\s/g,''))}
  function phone(v){return /^[0-9+()\-\s]{8,20}$/.test(String(v||''))}
  function required(fields){return fields.every(([v,max])=>text(v,max))}

  function isValidDateId(v){
    if(!v||typeof v!=='string')return false;
    const s=v.trim();
    let d,m,y;
    const mId=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(mId){
      d=parseInt(mId[1],10);
      m=parseInt(mId[2],10);
      y=parseInt(mId[3],10);
    }else{
      const mIso=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if(mIso){
        y=parseInt(mIso[1],10);
        m=parseInt(mIso[2],10);
        d=parseInt(mIso[3],10);
      }else{
        return false;
      }
    }
    const currentYear=new Date().getFullYear();
    if(y<1900||y>currentYear)return false;
    if(m<1||m>12)return false;
    const daysInMonth=new Date(y,m,0).getDate();
    return d>=1&&d<=daysInMonth;
  }

  function formatDateId(v){
    if(!v)return '';
    const s=String(v).trim();
    if(/^\d{2}\/\d{2}\/\d{4}$/.test(s))return s;
    const mIso=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(mIso)return `${mIso[3]}/${mIso[2]}/${mIso[1]}`;
    return s;
  }

  function toIsoDate(v){
    if(!v)return '';
    const s=String(v).trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const mId=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(mId)return `${mId[3]}-${mId[2]}-${mId[1]}`;
    return s;
  }

  window.EPASAR_VALIDATORS={
    text,nik,phone,required,
    isValidDateId,formatDateId,toIsoDate,
    normalizePhone(v){let s=String(v||'').replace(/[^\d+]/g,'');if(s.startsWith('0'))s='+62'+s.slice(1);return s}
  };
})();

