const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const base = 'https://e-skpt.web.app';
const password = process.env.EPASAR_UAT_PASSWORD;
if (!password) throw new Error('EPASAR_UAT_PASSWORD wajib tersedia.');
const unit = 'UAT-25033756';
const name = 'Pedagang Uji Alur 033756';
const out = path.join(process.cwd(), 'artifacts', 'live-e2e-20260925033756');
const skptNumber = 'SKPT-UAT-20260925033756';
async function shot(page, number, label) { await page.screenshot({ path: path.join(out, `${number}-${label}.png`), fullPage: true }); console.log(`PASS ${number} ${label}`); }
async function login(page, email) { await page.goto(`${base}/login?fresh=${Date.now()}`, { waitUntil: 'domcontentloaded' }); await page.locator('#identifier').fill(email); await page.locator('#password').fill(password); await page.getByRole('button', { name: 'Masuk' }).click(); await page.waitForURL(/admin-epasar/, { timeout: 20000 }); }
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await login(page,'superadmin@eskpt.id');
  const state=await page.evaluate(async unit=>{const q=await db.collection('market_claims').where('claimedUnitNumber','==',unit).limit(1).get();if(q.empty)throw new Error('Klaim UAT tidak ditemukan');const claim={id:q.docs[0].id,...q.docs[0].data()};const appSnap=await db.collection('skpt_applications').doc(claim.applicationId).get();const app={id:appSnap.id,...appSnap.data()};const intakeSnap=await db.collection('trader_intake').doc(app.sourceIntakeId).get();return{claim,app,intake:{id:intakeSnap.id,...intakeSnap.data()}}},unit);
  await page.evaluate(()=>firebase.auth().signOut());
  await login(page,'kepala.pasar-sentral-pinrang@eskpt.id');
  await page.goto(`${base}/market-verification?fresh=${Date.now()}`,{waitUntil:'domcontentloaded'});
  const market=page.locator(`form[data-id="${state.claim.id}"]`);await market.waitFor({timeout:20000});
  await market.locator('[name="actualUser"]').fill(name);await market.locator('[name="reason"]').fill('Nomor, lokasi, dan pengguna aktual sesuai pemeriksaan simulasi UAT internal.');
  await market.getByRole('button',{name:'Simpan verifikasi'}).click();await page.waitForTimeout(4000);
  const marketMessage=await page.locator('#message').innerText();if(!/terverifikasi/i.test(marketMessage))throw new Error(`Verifikasi pasar gagal: ${marketMessage}`);await shot(page,'11','kepala-pasar-berhasil');
  await page.evaluate(()=>firebase.auth().signOut());
  await login(page,'kadis@eskpt.id');
  await page.goto(`${base}/kadis-approval?fresh=${Date.now()}`,{waitUntil:'domcontentloaded'});
  const approval=page.locator(`form[data-action="approve"][data-id="${state.app.id}"]`);await approval.waitFor({timeout:20000});await approval.locator('[name="note"]').fill('Data pemohon dan hasil verifikasi telah dibandingkan untuk UAT internal.');await shot(page,'12','kadis-review');await approval.getByRole('button').click();await page.locator('#message').filter({hasText:'disetujui'}).waitFor({timeout:20000});await shot(page,'13','kadis-persetujuan-tercatat');
  await page.reload({waitUntil:'domcontentloaded'});const issue=page.locator(`form[data-action="issue"][data-id="${state.app.id}"]`);await issue.waitFor({timeout:20000});await issue.locator('[name="displayName"]').fill(name);await issue.locator('[name="number"]').fill(skptNumber);await issue.locator('[name="reference"]').fill('UAT-INTERNAL-20260925033756');await shot(page,'14','kadis-registrasi-penerbitan');await issue.getByRole('button').click();await page.waitForURL(/skpt-pdf.*token=/,{timeout:30000});const verificationToken=new URL(page.url()).searchParams.get('token');await page.waitForTimeout(2500);await shot(page,'15','dokumen-skpt');await page.pdf({path:path.join(out,'SKPT-UAT.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});
  const publicToken=state.intake.publicToken;await page.goto(`${base}/skpt-statement?token=${encodeURIComponent(publicToken)}`,{waitUntil:'networkidle'});await shot(page,'16','surat-pernyataan');await page.pdf({path:path.join(out,'SURAT-PERNYATAAN-UAT.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});await page.goto(`${base}/trader-card?token=${encodeURIComponent(publicToken)}`,{waitUntil:'networkidle'});await shot(page,'17','kartu-pedagang');await page.pdf({path:path.join(out,'KARTU-PEDAGANG-UAT.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});await page.goto(`${base}/verifikasi-skpt?token=${encodeURIComponent(verificationToken)}`,{waitUntil:'networkidle'});await shot(page,'18','verifikasi-publik-skpt');await page.goto(`${base}/epasar-status?token=${encodeURIComponent(publicToken)}&code=${encodeURIComponent(state.intake.registrationCode)}`,{waitUntil:'networkidle'});await shot(page,'19','status-pedagang');
  const report={unit,name,registrationCode:state.intake.registrationCode,intakeId:state.intake.id,traderId:state.claim.traderId,claimId:state.claim.id,applicationId:state.app.id,skptNumber,verificationToken,publicToken,marketMessage,errors};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
