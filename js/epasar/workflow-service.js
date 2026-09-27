(function () {
  'use strict';
  const db = () => { if (!window.db) throw new Error('Layanan data belum siap.'); return window.db; };
  const stamp = () => window.firebase.firestore.FieldValue.serverTimestamp();
  const clean = (v, n = 300) => String(v || '').trim().slice(0, n);
  const marketDirectoryId = (marketId, traderId) => `${clean(marketId,100)}__${clean(traderId,100)}`.replaceAll('/', '_');
  function publicCategory(value) {
    const code = clean(value || 'OTHER',80).toUpperCase().replace(/\s+/g,'_');
    if (['MAKANAN_DAN_MINUMAN','MAKANAN_&_MINUMAN','KULINER','FOOD_PROCESSING'].includes(code)) return 'FOOD_PROCESSING';
    if (['PERDAGANGAN','DAGANG','TRADE'].includes(code)) return 'TRADE';
    if (['KERAJINAN','KRIYA','CRAFT','EKRAF_KRIYA'].includes(code)) return 'CRAFT';
    return code || 'OTHER';
  }
  async function incrementIssuedStatistic() {
    const reference = db().collection('public_stats').doc('summary');
    try {
      await db().runTransaction(async transaction => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists) return;
        transaction.update(reference, { totalIssuedSkpt: window.firebase.firestore.FieldValue.increment(1), updatedAt: stamp() });
      });
    } catch (error) {
      console.warn('[e-PASAR] Statistik penerbitan belum diperbarui; jalankan refresh agregat.', error?.message || error);
    }
  }
  async function profileMedia(intakeId) {
    if (!intakeId) return null;
    const snapshot = await db().collection('trader_media').where('ownerId','==',intakeId).where('mediaType','==','PROFILE').limit(5).get();
    let selected = null;
    snapshot.forEach((document) => {
      const data = document.data();
      if (!selected && data.ownerType === 'TRADER_INTAKE' && data.mediaType === 'PROFILE' && data.status === 'PENDING') selected = { id: document.id, ...data };
    });
    return selected;
  }
  function publicMedia(source, token, mediaType) {
    if (!source) return null;
    return { ownerType: 'PUBLIC_DOCUMENT', ownerId: token, mediaType, mime: source.mime, width: source.width, height: source.height, binaryBytes: source.binaryBytes, base64Bytes: source.base64Bytes, dataBase64: source.dataBase64, status: 'PUBLIC', schemaVersion: 2, sourceMediaId: source.id, publishedAt: stamp() };
  }
  async function createCaseV2(intake, actor) {
    const businesses = Array.isArray(intake.businessDrafts) ? intake.businessDrafts : [];
    const places = businesses.flatMap((business, businessIndex) => (business.locations || []).flatMap((location, locationIndex) => (location.marketPlaces || []).map(place => ({ business, businessIndex, location, locationIndex, place }))));
    const maxMarketPlaces = Number(window.EPASAR?.MAX_MARKET_PLACES || 25);
    if (!businesses.length || businesses.some(b => !(b.locations || []).length)) throw new Error('Struktur usaha atau lokasi belum lengkap.');
    if (places.length > maxMarketPlaces) throw new Error(`Pendaftaran memuat ${places.length} tempat pasar, melebihi batas aman ${maxMarketPlaces}. Pisahkan lokasi tambahan sebelum membentuk data.`);
    if (places.some(x => !window.EPASAR?.marketById(x.place.marketId))) throw new Error('Setiap tempat pasar wajib menggunakan ID dari master pasar resmi.');
    places.forEach(row => {
      const market = window.EPASAR.marketById(row.place.marketId);
      row.place.marketId = market.id;
      row.place.marketName = market.name;
    });
    const nikBytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(intake.identity.nik))); const nikHash=[...new Uint8Array(nikBytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
    const nikRef=db().collection('nik_registry').doc(nikHash),traderRef=db().collection('traders').doc(),traderId=`PDG-PIN-${String(new Date().getFullYear()).slice(-2)}-${Math.random().toString(36).slice(2,8).toUpperCase()}`,createdAt=stamp();
    const profile=await profileMedia(intake.id),photoMediaToken=profile?(crypto.randomUUID?crypto.randomUUID().replaceAll('-',''):Math.random().toString(36).slice(2)+Date.now()):'';
    const businessRefs=businesses.map(()=>db().collection('businesses').doc()); const locationRefs=businesses.map(b=>(b.locations||[]).map(()=>db().collection('business_locations').doc()));
    const classificationRefs=businesses.map(()=>db().collection('business_classifications').doc());
    const caseRows=places.map(row=>({...row,claimRef:db().collection('market_claims').doc(),appRef:row.place.applySkpt?db().collection('skpt_applications').doc():null}));
    const directoryMarkets=[...new Set(caseRows.map(row=>row.place.marketId))];
    const sameMarketCounts={};caseRows.filter(x=>x.appRef).forEach(x=>{sameMarketCounts[x.place.marketId]=(sameMarketCounts[x.place.marketId]||0)+1});
    await db().runTransaction(async transaction=>{const statsRef=db().collection('public_stats').doc('summary');const [current,registry,statsSnapshot]=await Promise.all([transaction.get(db().collection('trader_intake').doc(intake.id)),transaction.get(nikRef),transaction.get(statsRef)]);if(registry.exists)throw new Error('NIK sudah terdaftar. Gunakan proses penambahan usaha/lokasi pada data pedagang yang sudah ada.');if(!current.exists||!['SUBMITTED','CORRECTION_REQUIRED'].includes(current.data().status)||current.data().traderId)throw new Error('Pendaftaran telah diproses petugas lain.');
      transaction.set(traderRef,{traderId,intakeId:intake.id,displayName:clean(intake.identity.name,120),status:'ACTIVE',source:'PUBLIC_INTAKE',schemaVersion:2,createdAt});transaction.set(db().collection('trader_private').doc(traderRef.id),{traderId,nik:String(intake.identity.nik),birthPlace:clean(intake.identity.birthPlace,80),birthDate:clean(intake.identity.birthDate,20),religion:clean(intake.identity.religion,50),citizenship:clean(intake.identity.citizenship,60),phone:clean(intake.identity.phone,20),address:clean(intake.identity.address,300),accessClass:'RESTRICTED',schemaVersion:2,createdAt});transaction.set(nikRef,{traderId,traderDocumentId:traderRef.id,nikHash,createdAt,schemaVersion:2});directoryMarkets.forEach(marketId=>transaction.set(db().collection('market_trader_directory').doc(marketDirectoryId(marketId,traderId)),{marketId,traderId,displayName:clean(intake.identity.name,120),status:'ACTIVE',source:'PUBLIC_INTAKE',schemaVersion:1,createdAt,updatedAt:createdAt}));
      businesses.forEach((b,bi)=>{transaction.set(businessRefs[bi],{businessId:businessRefs[bi].id,traderId,name:clean(b.name,120),type:clean(b.type,80),group:clean(b.group,100),category:clean(b.category,120),monthlyRevenue:Number(b.monthlyRevenue||0),workerCount:Number(b.workerCount||0),expense:clean(b.expense,160),status:'CLAIMED',sourceDraftId:clean(b.draftId||b.id,80),schemaVersion:2,createdAt});transaction.set(classificationRefs[bi],{classificationId:classificationRefs[bi].id,traderId,businessId:businessRefs[bi].id,code:publicCategory(b.category||b.type),source:'PUBLIC_INTAKE',status:'CLAIMED',verifiedBy:null,verifiedAt:null,note:'Klasifikasi awal dari pendataan; menunggu pemeriksaan petugas.',schemaVersion:2,createdAt});(b.locations||[]).forEach((l,li)=>transaction.set(locationRefs[bi][li],{locationId:locationRefs[bi][li].id,businessId:businessRefs[bi].id,traderId,locationType:l.type==='MARKET'?'MARKET':'GENERAL',district:clean(l.district,60),village:clean(l.village,80),address:clean(l.address,300),sourceDraftId:clean(l.draftId||l.id,80),schemaVersion:2,createdAt}))});
      caseRows.forEach(row=>{const p=row.place,businessId=businessRefs[row.businessIndex].id,locationId=locationRefs[row.businessIndex][row.locationIndex].id;transaction.set(row.claimRef,{traderId,traderDisplayName:clean(intake.identity.name,120),businessId,locationId,marketId:clean(p.marketId,100),marketName:clean(p.marketName,120),claimedUnitType:clean(p.unitType,20).toUpperCase(),claimedUnitNumber:clean(p.unitNumber,50),claimedBlock:clean(p.block,30),claimedFloor:clean(p.floor,20),claimedAreaM2:p.areaM2==null?null:Number(p.areaM2),locationHint:clean(p.locationHint),verificationStatus:'UNVERIFIED',applicationId:row.appRef?row.appRef.id:'',sourcePlaceDraftId:clean(p.draftId||p.id,80),schemaVersion:2,createdAt});if(row.appRef)transaction.set(row.appRef,{applicationId:row.appRef.id,traderId,businessId,locationId,claimId:row.claimRef.id,marketId:clean(p.marketId,100),status:'MARKET_VERIFICATION',validatorRoute:{type:'MARKET_ID',marketId:clean(p.marketId,100)},complianceReview:{sameMarketApplicationCount:sameMarketCounts[p.marketId],requiresLimitReview:sameMarketCounts[p.marketId]>2,legalReference:'PERDA_PINRANG_6_2024_PASAL_27'},statementAccepted:true,statementSnapshot:intake.statement||null,requirementsSnapshot:intake.requirementsAcceptance||null,applicantSnapshot:{displayName:clean(intake.identity.name,120),address:clean(intake.identity.address,300),businessType:clean(row.business.type||row.business.category,120),businessName:clean(row.business.name,120),marketName:clean(p.marketName,120),claimedUnitType:clean(p.unitType,20),claimedUnitNumber:clean(p.unitNumber,50),claimedAreaM2:p.areaM2==null?null:Number(p.areaM2)},sourceIntakeId:intake.id,publicToken:intake.publicToken,photoMediaToken,schemaVersion:2,submittedAt:createdAt})});
      const applications=caseRows.filter(x=>x.appRef).map(x=>x.appRef.id),claims=caseRows.map(x=>x.claimRef.id),status=caseRows.length?'MARKET_VERIFICATION':'REGISTERED';transaction.update(db().collection('trader_intake').doc(intake.id),{status,traderId,workflow:{claimIds:claims,applicationIds:applications},processedBy:actor.uid,updatedAt:createdAt});transaction.set(db().collection('public_status').doc(intake.publicToken),{intakeId:intake.id,publicToken:intake.publicToken,registrationCode:intake.registrationCode,status,publicStatus:true,displayName:clean(intake.identity.name,120),traderId,businessType:businesses.length===1?clean(businesses[0].type||businesses[0].category,120):`${businesses.length} usaha`,marketName:places.length===1?clean(places[0].place.marketName,120):`${places.length} tempat pasar`,marketRoutes:caseRows.map(x=>({marketId:clean(x.place.marketId,100),claimId:x.claimRef.id,label:`${clean(x.place.marketName,80)} - ${clean(x.place.unitType,20)} ${clean(x.place.unitNumber,30)}`})),statementVersion:intake.statement?.version||'',statementAcceptedAt:intake.statement?.acceptedAt||new Date().toISOString(),photoMediaToken,reviewMessage:'',correctionSections:[],canResubmit:false,environment:'UAT',isDemo:true,schemaVersion:2,updatedAt:createdAt});
      if(statsSnapshot.exists){const stats=statsSnapshot.data(),categoryCounts=new Map((stats.topCategories||[]).map(item=>[item.label,Number(item.count||0)]));businesses.forEach(b=>{const label=publicCategory(b.category||b.type);categoryCounts.set(label,(categoryCounts.get(label)||0)+1)});transaction.update(statsRef,{totalTraders:Number(stats.totalTraders||0)+1,totalBusinesses:Number(stats.totalBusinesses||0)+businesses.length,totalLocations:Number(stats.totalLocations||0)+locationRefs.reduce((sum,rows)=>sum+rows.length,0),totalCategories:categoryCounts.size,marketTraders:Number(stats.marketTraders||0)+(places.length?1:0),nonMarketTraders:Number(stats.nonMarketTraders||0)+(places.length?0:1),topCategories:[...categoryCounts.entries()].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count).slice(0,5),updatedAt:stamp()});}
    });
    const cardMedia=publicMedia(profile,photoMediaToken,'PROFILE_PUBLIC');if(cardMedia)await db().collection('trader_media').doc(photoMediaToken).set(cardMedia);return{traderId,claimIds:caseRows.map(x=>x.claimRef.id),applicationIds:caseRows.filter(x=>x.appRef).map(x=>x.appRef.id),status:caseRows.length?'MARKET_VERIFICATION':'REGISTERED'};
  }
  async function createCase(intake, input, actor) {
    if (!['SUPER_ADMIN','DISPERINDAG_ADMIN','MARKET_ADMIN','TRADE_ADMIN'].includes(actor.role)) throw new Error('Akun ini tidak dapat membuat berkas kerja.');
    if (Number(intake?.schemaVersion||1) >= 2) return createCaseV2(intake, actor);
    if (!intake?.id || !['SUBMITTED','CORRECTION_REQUIRED'].includes(intake.status) || intake.traderId) throw new Error('Pendaftaran ini sudah diproses atau statusnya tidak sesuai.');
    if (!intake.publicToken || !intake.registrationCode || !/^\d{16}$/.test(String(intake.identity?.nik || ''))) throw new Error('Data identitas atau token pendaftaran tidak lengkap.');
    const hasMarket = intake.hasMarketUnit === true;
    const applySkpt = hasMarket && intake.applySkpt === true;
    const market = {...(intake.marketDraft || {}),...(input || {})};
    const officialMarket = hasMarket ? window.EPASAR.marketById(market.marketId) : null;
    if (hasMarket && (!officialMarket || !clean(market.unitType,20) || !clean(market.unitNumber,50))) throw new Error('Pasar harus dipilih dari master pasar resmi serta jenis dan nomor unit wajib diperiksa.');
    if (officialMarket) { market.marketId = officialMarket.id; market.marketName = officialMarket.name; }
    const nikBytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(intake.identity.nik)));
    const nikHash = [...new Uint8Array(nikBytes)].map(value=>value.toString(16).padStart(2,'0')).join('');
    const nikRef = db().collection('nik_registry').doc(nikHash);
    const ref = db().collection('traders').doc();
    const traderId = `PDG-PIN-${String(new Date().getFullYear()).slice(-2)}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const profile = await profileMedia(intake.id);
    const photoMediaToken = profile ? (crypto.randomUUID ? crypto.randomUUID().replaceAll('-','') : Math.random().toString(36).slice(2) + Date.now()) : '';
    const draft = Array.isArray(intake.businessDrafts) ? (intake.businessDrafts[0] || {}) : {};
    const businessRef=db().collection('businesses').doc(),locationRef=db().collection('business_locations').doc(),classificationRef=db().collection('business_classifications').doc();
    const claimRef=hasMarket?db().collection('market_claims').doc():null,appRef=applySkpt?db().collection('skpt_applications').doc():null;
    const directoryRef=hasMarket?db().collection('market_trader_directory').doc(marketDirectoryId(clean(market.marketId||market.marketName,100),traderId)):null;
    const createdAt=stamp();
    const nextStatus=hasMarket?'MARKET_VERIFICATION':'REGISTERED';
    const cardMedia = publicMedia(profile, photoMediaToken, 'PROFILE_PUBLIC');
    await db().runTransaction(async transaction => {
      const statsRef = db().collection('public_stats').doc('summary');
      const [registrySnapshot, intakeSnapshot, statsSnapshot] = await Promise.all([transaction.get(nikRef), transaction.get(db().collection('trader_intake').doc(intake.id)), transaction.get(statsRef)]);
      if (registrySnapshot.exists) throw new Error('NIK sudah terdaftar. Periksa kemungkinan data ganda sebelum melanjutkan.');
      if (!intakeSnapshot.exists || !['SUBMITTED','CORRECTION_REQUIRED'].includes(intakeSnapshot.data().status) || intakeSnapshot.data().traderId) throw new Error('Pendaftaran ini telah diproses petugas lain atau statusnya berubah. Muat ulang antrean.');
      transaction.set(ref,{traderId,intakeId:intake.id,displayName:clean(intake.identity?.name,120),status:'ACTIVE',source:'PUBLIC_INTAKE',schemaVersion:1,createdAt});
      transaction.set(db().collection('trader_private').doc(ref.id),{traderId,nik:String(intake.identity.nik),birthPlace:clean(intake.identity.birthPlace,80),birthDate:clean(intake.identity.birthDate,20),religion:clean(intake.identity.religion,50),citizenship:clean(intake.identity.citizenship,60),phone:clean(intake.identity.phone,20),address:clean(intake.identity.address,300),accessClass:'RESTRICTED',schemaVersion:1,createdAt});
      transaction.set(nikRef,{traderId,traderDocumentId:ref.id,nikHash,createdAt,schemaVersion:1});
      if(directoryRef)transaction.set(directoryRef,{marketId:clean(market.marketId||market.marketName,100),traderId,displayName:clean(intake.identity?.name,120),status:'ACTIVE',source:'PUBLIC_INTAKE',schemaVersion:1,createdAt,updatedAt:createdAt});
      transaction.set(businessRef,{businessId:businessRef.id,traderId,name:clean(draft.name,120),type:clean(draft.type,80),group:clean(draft.group,100),category:clean(draft.category,120),monthlyRevenue:Number(draft.monthlyRevenue||0),workerCount:Number(draft.workerCount||0),status:'CLAIMED',schemaVersion:1,createdAt});
      transaction.set(locationRef,{locationId:locationRef.id,businessId:businessRef.id,traderId,locationType:hasMarket?'MARKET_UNIT':'GENERAL',marketName:hasMarket?clean(market.marketName,120):'',district:clean(draft.district,60),village:clean(draft.village,80),address:clean(draft.address,300),schemaVersion:1,createdAt});
      transaction.set(classificationRef,{traderId,businessId:businessRef.id,code:'TRADE',source:'PUBLIC_INTAKE',status:'CLAIMED',verifiedBy:null,verifiedAt:null,note:'Klasifikasi awal; menunggu verifikasi petugas',schemaVersion:1,createdAt});
      if(claimRef)transaction.set(claimRef,{traderId,traderDisplayName:clean(intake.identity?.name,120),marketId:clean(market.marketId||market.marketName,100),marketName:clean(market.marketName,120),claimedUnitType:clean(market.unitType,20).toUpperCase(),claimedUnitNumber:clean(market.unitNumber,50),claimedBlock:clean(market.block,30),claimedFloor:clean(market.floor,20),claimedAreaM2:market.areaM2?Number(market.areaM2):null,locationHint:clean(market.locationHint),verificationStatus:'UNVERIFIED',applicationId:appRef?appRef.id:'',schemaVersion:1,createdAt});
      if(appRef)transaction.set(appRef,{applicationId:appRef.id,traderId,claimId:claimRef.id,marketId:clean(market.marketId||market.marketName,100),status:'MARKET_VERIFICATION',statementAccepted:true,statementSnapshot:intake.statement||null,applicantSnapshot:{displayName:clean(intake.identity?.name,120),address:clean(intake.identity?.address,300),businessType:clean(draft.type||draft.category,120),businessName:clean(draft.name,120),marketName:clean(market.marketName,120),claimedUnitType:clean(market.unitType,20).toUpperCase(),claimedUnitNumber:clean(market.unitNumber,50),claimedAreaM2:market.areaM2?Number(market.areaM2):null},sourceIntakeId:intake.id,publicToken:intake.publicToken,photoMediaToken,schemaVersion:1,submittedAt:createdAt});
      transaction.update(db().collection('trader_intake').doc(intake.id),{status:nextStatus,traderId,workflow:{claimId:claimRef?claimRef.id:'',applicationId:appRef?appRef.id:''},processedBy:actor.uid,updatedAt:createdAt});
      transaction.set(db().collection('public_status').doc(intake.publicToken),{intakeId:intake.id,publicToken:intake.publicToken,registrationCode:intake.registrationCode,status:nextStatus,publicStatus:true,displayName:clean(intake.identity?.name,120),traderId,businessType:clean(draft.type||draft.category,120),marketName:hasMarket?clean(market.marketName,120):'',marketRoutes:[],statementVersion:intake.statement?.version||'SKPT-STATEMENT-V3-PERDA6-2024',statementAcceptedAt:intake.statement?.acceptedAt||new Date().toISOString(),photoMediaToken,reviewMessage:'',correctionSections:[],canResubmit:false,environment:'UAT',isDemo:true,schemaVersion:1,updatedAt:createdAt});
      if(cardMedia)transaction.set(db().collection('trader_media').doc(photoMediaToken),cardMedia);
      if (statsSnapshot.exists) {
        const stats = statsSnapshot.data();
        const category = publicCategory(draft.category || draft.type || draft.group);
        const topCategories = Array.isArray(stats.topCategories) ? stats.topCategories.map(item => ({ label: clean(item.label,80), count: Number(item.count || 0) })) : [];
        const categoryIndex = topCategories.findIndex(item => item.label === category);
        const newVisibleCategory = categoryIndex < 0 && topCategories.length < 5;
        if (categoryIndex >= 0) topCategories[categoryIndex].count += 1;
        else if (topCategories.length < 5) topCategories.push({ label: category, count: 1 });
        else {
          const otherIndex = topCategories.findIndex(item => item.label === 'OTHER');
          if (otherIndex >= 0) topCategories[otherIndex].count += 1;
          else topCategories[4] = { label: 'OTHER', count: Number(topCategories[4]?.count || 0) + 1 };
        }
        topCategories.sort((a,b) => b.count - a.count);
        transaction.update(statsRef, {
          totalTraders: Number(stats.totalTraders || 0) + 1,
          totalBusinesses: Number(stats.totalBusinesses || 0) + 1,
          totalLocations: Number(stats.totalLocations || 0) + 1,
          totalCategories: Number(stats.totalCategories || 0) + (newVisibleCategory ? 1 : 0),
          marketTraders: Number(stats.marketTraders || 0) + (hasMarket ? 1 : 0),
          nonMarketTraders: Number(stats.nonMarketTraders || 0) + (hasMarket ? 0 : 1),
          topCategories: topCategories.slice(0,5), updatedAt: stamp()
        });
      }
    });
    return {traderId,claimId:claimRef?claimRef.id:null,applicationId:appRef?appRef.id:null,status:nextStatus};
  }
  async function verifyClaim(claim, values, actor) {
    if (actor.role !== 'MARKET_HEAD') throw new Error('Hanya Kepala Pasar yang dapat memverifikasi unit.');
    if (!claim?.id || !claim?.traderId || !claim?.marketId) throw new Error('Identitas klaim tidak lengkap. Muat ulang halaman sebelum memverifikasi.');
    if (claim.verificationStatus !== 'UNVERIFIED') throw new Error('Hanya klaim baru berstatus UNVERIFIED yang dapat diverifikasi. Data lama harus diperiksa oleh admin.');
    if (!(actor.marketIds || []).includes(claim.marketId)) throw new Error('Klaim ini tidak termasuk pasar yang ditugaskan kepada akun Anda.');
    const unitType = clean(values.unitType,20).toUpperCase();
    const unitNumber = clean(values.unitNumber,50);
    const reason = clean(values.reason,500);
    if (!['KIOS','LOS','LAPAK','PELATARAN'].includes(unitType) || !unitNumber || !reason) throw new Error('Jenis unit, nomor unit, dan alasan verifikasi wajib diisi dengan benar.');
    const unitIdentity = `${clean(claim.marketId,100).toUpperCase()}|${unitType}|${unitNumber.toUpperCase().replace(/\s+/g,'')}`;
    const unitDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(unitIdentity));
    const unitId = `UNT-${[...new Uint8Array(unitDigest)].slice(0,12).map(value=>value.toString(16).padStart(2,'0')).join('').toUpperCase()}`;
    const unitRef = db().collection('market_units').doc(unitId);
    const occupancyRef = db().collection('market_occupancies').doc();
    const recordRef = db().collection('verification_records').doc();
    const notificationRef = db().collection('notifications').doc();
    const now = new Date().toISOString();
    let result = null;
    await db().runTransaction(async transaction => {
      const claimRef = db().collection('market_claims').doc(claim.id);
      const applicationRef = claim.applicationId ? db().collection('skpt_applications').doc(claim.applicationId) : null;
      const [unitSnapshot, claimSnapshot, applicationSnapshot] = await Promise.all([
        transaction.get(unitRef),
        transaction.get(claimRef),
        applicationRef ? transaction.get(applicationRef) : Promise.resolve(null)
      ]);
      if (!claimSnapshot.exists) throw new Error('Klaim tidak ditemukan. Muat ulang halaman.');
      const currentClaim = claimSnapshot.data();
      if (currentClaim.verificationStatus !== 'UNVERIFIED') throw new Error('Klaim telah diproses petugas lain atau memerlukan pemeriksaan data lama. Muat ulang halaman.');
      if (currentClaim.marketId !== claim.marketId || currentClaim.traderId !== claim.traderId || (currentClaim.applicationId || '') !== (claim.applicationId || '')) throw new Error('Relasi klaim berubah sejak halaman dimuat. Muat ulang sebelum melanjutkan.');
      const before = { marketId: currentClaim.marketId, unitNumber: currentClaim.claimedUnitNumber, block: currentClaim.claimedBlock, floor: currentClaim.claimedFloor, areaM2: currentClaim.claimedAreaM2, unitType: currentClaim.claimedUnitType };
      const application = applicationSnapshot?.exists ? applicationSnapshot.data() : null;
      if (applicationRef && !application) throw new Error('Aplikasi SKPT terkait tidak ditemukan. Hubungi admin untuk rekonsiliasi data.');
      if (application && (application.claimId !== claim.id || application.traderId !== claim.traderId || application.marketId !== claim.marketId)) throw new Error('Relasi klaim dan aplikasi SKPT tidak konsisten. Hubungi admin.');
      if (application && application.status !== 'MARKET_VERIFICATION') throw new Error(`Aplikasi SKPT sudah berada pada status ${application.status || 'tidak diketahui'}. Muat ulang halaman.`);
      const existingUnit = unitSnapshot.exists ? unitSnapshot.data() : null;
      const occupiedByOther = Boolean(existingUnit?.currentTraderId && existingUnit.currentTraderId !== claim.traderId);
      const conflict = Boolean(values.conflict || occupiedByOther);
      const after = { marketId: claim.marketId, unitId, unitNumber, block: clean(values.block,30), floor: clean(values.floor,20), areaM2: values.areaM2 ? Number(values.areaM2) : null, unitType, actualUser: clean(values.actualUser,120), conflict };
      const qrUnitToken = existingUnit?.qrUnitToken || (crypto.randomUUID ? crypto.randomUUID().replaceAll('-','') : Math.random().toString(36).slice(2) + Date.now());
      if (!unitSnapshot.exists) transaction.set(unitRef,{unitId,marketId:claim.marketId,unitType,unitNumber,block:after.block,floor:after.floor,areaM2:after.areaM2,qrUnitToken,status:conflict?'AVAILABLE':'OCCUPIED',currentTraderId:conflict?'':claim.traderId,currentOccupancyId:conflict?'':occupancyRef.id,schemaVersion:1,createdAt:stamp(),updatedAt:stamp()});
      else if (!conflict && !existingUnit.currentTraderId) transaction.update(unitRef,{block:after.block,floor:after.floor,areaM2:after.areaM2,status:'OCCUPIED',currentTraderId:claim.traderId,currentOccupancyId:occupancyRef.id,updatedAt:stamp()});
      if (!conflict && !existingUnit?.currentTraderId) transaction.set(occupancyRef,{occupancyId:occupancyRef.id,marketUnitId:unitId,marketId:claim.marketId,traderId:claim.traderId,claimId:claim.id,status:'ACTIVE',startedAt:stamp(),endedAt:null,createdBy:actor.uid,schemaVersion:1});
      transaction.set(db().collection('public_market_units').doc(qrUnitToken),{verificationToken:qrUnitToken,unitId,marketId:claim.marketId,marketName:window.EPASAR?.marketById(claim.marketId)?.name||claim.marketName||claim.marketId,unitType,unitNumber,block:after.block,floor:after.floor,areaM2:after.areaM2,status:conflict?'PERLU_PEMERIKSAAN':'TERVERIFIKASI',publicStatus:true,schemaVersion:1,updatedAt:stamp()},{merge:true});
      const material=before.unitNumber!==after.unitNumber||before.block!==after.block||before.floor!==after.floor||Number(before.areaM2||0)!==Number(after.areaM2||0)||before.unitType!==after.unitType||conflict;
      transaction.update(claimRef,{verified:after,verificationStatus:conflict?'CONFLICT':'VERIFIED',marketUnitId:unitId,updatedAt:stamp()});
      transaction.set(recordRef,{claimId:claim.id,marketId:claim.marketId,marketUnitId:unitId,before,after,reason:occupiedByOther?'Unit sudah tercatat aktif pada pedagang lain. '+reason:reason,actorUid:actor.uid,actorRole:actor.role,status:conflict?'CONFLICT':'MARKET_VERIFIED',createdAt:stamp()});
      if(applicationRef){const priorHistory=Array.isArray(application.statusHistory)?application.statusHistory:[];transaction.update(applicationRef,{status:conflict?'CONFLICT':'KADIS_REVIEW',marketUnitId:unitId,verificationRecordId:recordRef.id,statusHistory:[...priorHistory,{from:'MARKET_VERIFICATION',to:conflict?'CONFLICT':'MARKET_VERIFIED',actorUid:actor.uid,actorRole:actor.role,at:now},...(conflict?[]:[{from:'MARKET_VERIFIED',to:'KADIS_REVIEW',actorUid:actor.uid,actorRole:actor.role,at:now}])].slice(-50),updatedAt:stamp()});}
      if(material)transaction.set(notificationRef,{type:'MATERIAL_MARKET_CHANGE',recipientRole:'KADIS',marketId:claim.marketId,claimId:claim.id,applicationId:claim.applicationId||'',verificationRecordId:recordRef.id,summary:conflict?'Konflik unit ditemukan':`Data unit berubah dari ${clean(before.unitNumber,50)||'-'} menjadi ${after.unitNumber||'-'}`,reason:occupiedByOther?'Unit sudah tercatat aktif pada pedagang lain.':reason,actorUid:actor.uid,actorRole:actor.role,status:'UNREAD',createdAt:stamp()});
      result = { unitId, conflict, occupiedByOther, qrUnitToken };
    });
    return result;
  }
  async function approveForTte(application,input,actor){
    if(!['KADIS','SUPER_ADMIN'].includes(actor.role))throw new Error('Persetujuan final hanya dapat dilakukan Kadis.');
    if(application.status!=='KADIS_REVIEW')throw new Error('Berkas tidak berada pada tahap review Kadis.');
    const note=clean(input?.note,500);if(!note)throw new Error('Catatan keputusan Kadis wajib diisi.');
    const now=new Date().toISOString(),history=Array.isArray(application.statusHistory)?application.statusHistory:[];
    await db().collection('skpt_applications').doc(application.id).update({status:'TTE_PENDING',approval:{decision:'APPROVED',note,actorUid:actor.uid,actorRole:actor.role,approvedAt:stamp()},statusHistory:[...history,{from:'KADIS_REVIEW',to:'APPROVED',actorUid:actor.uid,actorRole:actor.role,at:now},{from:'APPROVED',to:'TTE_PENDING',actorUid:actor.uid,actorRole:actor.role,at:now}],updatedAt:stamp()});
    return{status:'TTE_PENDING'};
  }
  async function rejectByKadis(application,input,actor){
    if(!['KADIS','SUPER_ADMIN'].includes(actor.role))throw new Error('Penolakan final hanya dapat dilakukan Kadis.');
    if(application.status!=='KADIS_REVIEW')throw new Error('Berkas tidak berada pada tahap review Kadis.');
    const note=clean(input?.note,500);if(!note)throw new Error('Catatan alasan penolakan Kadis wajib diisi.');
    const now=new Date().toISOString(),history=Array.isArray(application.statusHistory)?application.statusHistory:[];
    const batch = db().batch();
    batch.update(db().collection('skpt_applications').doc(application.id),{status:'REJECTED',approval:{decision:'REJECTED',note,actorUid:actor.uid,actorRole:actor.role,approvedAt:stamp()},statusHistory:[...history,{from:'KADIS_REVIEW',to:'REJECTED',actorUid:actor.uid,actorRole:actor.role,at:now}],updatedAt:stamp()});
    if (application.publicToken) {
      batch.update(db().collection('public_status').doc(application.publicToken),{status:'REJECTED',reviewMessage:note});
    }
    await batch.commit();
    return{status:'REJECTED'};
  }
  async function issue(application, input, actor) {
    if (!['KADIS','SUPER_ADMIN'].includes(actor.role)) throw new Error('Penerbitan final hanya dapat dilakukan Kadis.');
    if (application.status !== 'TTE_PENDING') throw new Error('Berkas harus disetujui dan berada pada tahap menunggu pengesahan.');
    if (!clean(input.reference,300)) throw new Error('Referensi registrasi atau hasil pengesahan resmi wajib diisi.');
    const verificationToken = crypto.randomUUID ? crypto.randomUUID().replaceAll('-','') : Math.random().toString(36).slice(2) + Date.now();
    const number = clean(input.number, 80) || `SKPT-PIN-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const issueDate = new Date(); const valid = new Date(issueDate); valid.setFullYear(valid.getFullYear()+2);
    const claimSnap = await db().collection('market_claims').doc(application.claimId).get();
    const claim = claimSnap.exists ? claimSnap.data() : {};
    const verified = claim.verified || {};
    const source = application.applicantSnapshot || {};
    const signatory = { name: 'MUHAMMAD YUSUF NUR, S.STP', nip: '19800326 200003 1 001', rank: 'Pembina Tk. I', position: 'Kepala Dinas Perindustrian, Perdagangan, Energi dan Sumber Daya Mineral Kabupaten Pinrang', authority: 'a.n. BUPATI PINRANG' };
    const marketUnitId = clean(application.marketUnitId || verified.unitId || claim.marketUnitId,100);
    if (!marketUnitId) throw new Error('Identitas unit pasar hasil verifikasi belum tersedia. Berkas harus dikembalikan ke tahap verifikasi pasar.');
    const documentSnapshot = { displayName: clean(input.displayName || source.displayName,120), address: clean(source.address,300), businessType: clean(source.businessType || source.businessName,120), marketName: clean(source.marketName || application.marketId,120), marketId: clean(application.marketId,100), unitType: clean(verified.unitType || source.claimedUnitType || claim.claimedUnitType,20), unitNumber: clean(verified.unitNumber || source.claimedUnitNumber || claim.claimedUnitNumber,50), block: clean(verified.block || claim.claimedBlock,30), floor: clean(verified.floor || claim.claimedFloor,20), areaM2: Number(verified.areaM2 ?? source.claimedAreaM2 ?? claim.claimedAreaM2 ?? 0) || null };
    const docRef = db().collection('skpt_documents').doc();
    const profile = application.photoMediaToken ? null : await profileMedia(application.sourceIntakeId);
    const photoMediaToken = application.photoMediaToken || (profile ? (crypto.randomUUID ? crypto.randomUUID().replaceAll('-','') : Math.random().toString(36).slice(2) + Date.now()) : '');
    const environment = 'UAT', isDemo = true, tteStatus = 'UAT_SIMULATED';
    const canonical = JSON.stringify({ number, traderId: application.traderId, claimId: application.claimId, applicationId: application.id, issueDate: issueDate.toISOString(), validUntil: valid.toISOString(), documentSnapshot, signatory, photoMediaToken, statementVersion: application.statementSnapshot?.version || 'SKPT-STATEMENT-V3-PERDA6-2024', environment, isDemo, tteStatus });
    const hashSource = canonical;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashSource));
    const documentHash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2,'0')).join('');
    const annualValidations = [{ year: issueDate.getFullYear(), status: 'INITIAL_ISSUE', validatedAt: issueDate.toISOString(), reference: clean(input.reference,100) }, { year: issueDate.getFullYear()+1, status: 'DUE', validatedAt: null, reference: '' }];
    const history=Array.isArray(application.statusHistory)?application.statusHistory:[];
    const skptMedia = publicMedia(profile, photoMediaToken, 'PROFILE_PUBLIC');
    const publicationBatch = db().batch();
    publicationBatch.set(docRef,{ skptId: docRef.id, applicationId: application.id, number, traderId: application.traderId, marketUnitId, issueDate: issueDate.toISOString(), validUntil: valid.toISOString(), status: 'ISSUED', tteStatus, documentHash, hashAlgorithm: 'SHA-256', hashScope: 'CANONICAL_DOCUMENT_SNAPSHOT', documentSnapshot, signatory, annualValidations, photoMediaToken, legalBasisVersion: 'PINRANG-SKPT-PERDA6-2024-V1', statementVersion: application.statementSnapshot?.version || 'SKPT-STATEMENT-V3-PERDA6-2024', officialReference: clean(input.reference,300), verificationToken, environment, isDemo, schemaVersion: 3, issuedBy: actor.uid, issuedAt: stamp() });
    publicationBatch.update(db().collection('skpt_applications').doc(application.id),{ status: 'ISSUED', skptDocumentId: docRef.id, statusHistory:[...history,{from:'TTE_PENDING',to:'ISSUED',actorUid:actor.uid,actorRole:actor.role,at:new Date().toISOString()}], updatedAt: stamp() });
    publicationBatch.set(db().collection('public_skpt_verification').doc(verificationToken),{ verificationToken, documentId: docRef.id, applicationId: application.id, number, displayName: documentSnapshot.displayName, status: 'ISSUED', traderId: application.traderId, marketUnitId, issueDate: issueDate.toISOString(), validUntil: valid.toISOString(), documentHash, hashAlgorithm: 'SHA-256', hashScope: 'CANONICAL_DOCUMENT_SNAPSHOT', tteStatus, officialReference: clean(input.reference,300), documentSnapshot, signatory, annualValidations, photoMediaToken, legalBasisVersion: 'PINRANG-SKPT-PERDA6-2024-V1', environment, isDemo, schemaVersion: 3 });
    if (application.publicToken) publicationBatch.update(db().collection('public_status').doc(application.publicToken),{status:'ISSUED'});
    if (skptMedia) publicationBatch.set(db().collection('trader_media').doc(photoMediaToken),skptMedia);
    await publicationBatch.commit();
    await incrementIssuedStatistic();
    return { documentId: docRef.id, verificationToken, number, photoPublished: Boolean(photoMediaToken) };
  }
  window.EPASAR_WORKFLOW = { createCase, verifyClaim, approveForTte, rejectByKadis, issue };
}());
