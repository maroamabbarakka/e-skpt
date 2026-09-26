const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const out = path.join(process.cwd(), 'artifacts', 'portal-redesign');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const captures = [
    ['beranda-desktop.png', 'index.html', { width: 1440, height: 1000 }],
    ['beranda-mobile.png', 'index.html', { width: 390, height: 844 }],
    ['layanan-desktop.png', 'layanan.html', { width: 1440, height: 1000 }],
    ['data-informasi-desktop.png', 'data-informasi.html', { width: 1440, height: 1000 }],
    ['galeri-video-desktop.png', 'galeri-video.html', { width: 1440, height: 1000 }],
    ['informasi-desktop.png', 'informasi.html', { width: 1440, height: 1000 }]
  ];
  for (const [file, pagePath, viewport] of captures) {
    const page = await browser.newPage({ viewport });
    await page.goto(`http://127.0.0.1:8765/${pagePath}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(out, file), fullPage: true });
    await page.close();
    console.log(`PASS ${file}`);
  }
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
