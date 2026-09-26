const { chromium } = require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  const page=await browser.newPage();
  page.on('console',message=>console.log(`BROWSER ${message.type()}: ${message.text()}`));
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({url:'http://127.0.0.1:8765/js/epasar/background-remove.js'});
  const result=await page.evaluate(async()=>{
    const image=new Image();image.src='/assets/uat/pedagang-contoh-3x4.jpg';await image.decode();
    const canvas=await window.EPASAR_BACKGROUND.remove(image,{threshold:.5,maxSide:800});
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let transparent=0,opaque=0;for(let index=3;index<pixels.length;index+=4){if(pixels[index]<16)transparent++;if(pixels[index]>239)opaque++}
    const blob=await window.EPASAR_BACKGROUND.webp(canvas,.75);
    return {width:canvas.width,height:canvas.height,bytes:blob.size,transparent,opaque,total:pixels.length/4};
  });
  if(!result.transparent||!result.opaque||result.bytes>55000)throw new Error(`Hasil segmentasi tidak memenuhi batas: ${JSON.stringify(result)}`);
  console.log(`PASS background removal: ${JSON.stringify(result)}`);await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
