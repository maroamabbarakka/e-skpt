(function(){
  'use strict';
  const LIBRARY='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm';
  const WASM='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
  const MODEL=()=>`${location.origin}/assets/models/selfie_segmenter_float16_2023-05-07.tflite`;
  let segmenterPromise=null;
  function task(){
    if(!segmenterPromise) segmenterPromise=import(LIBRARY).then(async module=>{
      const vision=await module.FilesetResolver.forVisionTasks(WASM);
      return module.ImageSegmenter.createFromOptions(vision,{baseOptions:{modelAssetPath:MODEL(),delegate:'CPU'},runningMode:'IMAGE',outputCategoryMask:false,outputConfidenceMasks:true});
    }).catch(error=>{segmenterPromise=null;throw error});
    return segmenterPromise;
  }
  function smoothstep(low,high,value){const x=Math.max(0,Math.min(1,(value-low)/(high-low)));return x*x*(3-2*x)}
  async function remove(image,options){
    options=options||{};
    const maxSide=Number(options.maxSide||800),scale=Math.min(1,maxSide/image.naturalWidth,maxSide/image.naturalHeight),width=Math.max(1,Math.round(image.naturalWidth*scale)),height=Math.max(1,Math.round(image.naturalHeight*scale));
    const segmenter=await task(),result=segmenter.segment(image),masks=result.confidenceMasks||[];
    if(!masks.length)throw new Error('Model tidak menghasilkan mask manusia yang diperlukan.');
    // SelfieSegmenter terbaru mengembalikan satu confidence mask foreground;
    // model dua-kanal menempatkan kelas orang pada indeks 1.
    const mask=masks.length>1?masks[1]:masks[0],values=mask.getAsFloat32Array(),mw=mask.width,mh=mask.height;
    const maskCanvas=document.createElement('canvas');maskCanvas.width=mw;maskCanvas.height=mh;
    const maskContext=maskCanvas.getContext('2d'),maskImage=maskContext.createImageData(mw,mh),threshold=Math.max(.25,Math.min(.75,Number(options.threshold||.5)));
    for(let i=0;i<values.length;i++){const alpha=Math.round(255*smoothstep(threshold-.18,threshold+.18,values[i]));const p=i*4;maskImage.data[p]=255;maskImage.data[p+1]=255;maskImage.data[p+2]=255;maskImage.data[p+3]=alpha}
    maskContext.putImageData(maskImage,0,0);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');context.drawImage(image,0,0,width,height);context.globalCompositeOperation='destination-in';context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(maskCanvas,0,0,width,height);context.globalCompositeOperation='source-over';
    masks.forEach(item=>item.close());if(result.categoryMask)result.categoryMask.close();
    return canvas;
  }
  function webp(canvas,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Hasil foto transparan gagal dibuat.')),'image/webp',quality||.82))}
  window.EPASAR_BACKGROUND={remove,webp,model:{library:LIBRARY,model:MODEL()}};
}());
