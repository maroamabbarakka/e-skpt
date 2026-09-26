const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const out = path.join(process.cwd(), 'artifacts', 'live-e2e-20260925064124');
const publicToken = '6f81f6e33bc6e5b2ab60655da623c0b6b1f85a2a6a4267fee75c2a276229d634';
const verificationToken = '567a62fce7f04fe7ae50a873e3980e43';
const base = process.env.EPASAR_CAPTURE_BASE || 'https://e-skpt.web.app';

async function capture(page, url, image, pdf, readySelector) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator(readySelector).waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(out, image), fullPage: true });
  if (pdf) await page.pdf({ path: path.join(out, pdf), format: 'A4', printBackground: true, preferCSSPageSize: true });
  console.log(`PASS ${image}`);
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await capture(page, `${base}/skpt-pdf?token=${verificationToken}`, '15-dokumen-skpt.png', 'SKPT-UAT.pdf', '#document .official-letterhead');
  await capture(page, `${base}/skpt-statement?token=${publicToken}`, '16-surat-pernyataan.png', 'SURAT-PERNYATAAN-UAT.pdf', '#statementContent.document-body');
  await capture(page, `${base}/trader-card?token=${publicToken}`, '17-kartu-pedagang.png', 'KARTU-PEDAGANG-UAT.pdf', '#card');
  await capture(page, `${base}/verifikasi-skpt?token=${verificationToken}`, '18-verifikasi-publik-skpt.png', null, '#verificationResult');
  await page.goto(`${base}/epasar-status.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#registrationCode').fill('REG-PIN-2026-V3XXDE');
  await page.locator('#publicToken').fill(publicToken);
  await page.getByRole('button', { name: 'Cek Status' }).click();
  await page.locator('#statusResult').waitFor({ state: 'visible', timeout: 30000 });
  await page.screenshot({ path: path.join(out, '19-status-pedagang.png'), fullPage: true });
  console.log('PASS 19-status-pedagang.png');
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
