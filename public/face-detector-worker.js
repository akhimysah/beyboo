/* Local inference worker. Receives pixels only from this page; no uploads. */
importScripts('/vendor/face-api/face-api.min.js');
// The detector accepts Tensor3D input; DOM image/video inputs are never used in this worker.
class UnsupportedDOMInput {}
faceapi.env.setEnv({Canvas:self.OffscreenCanvas||UnsupportedDOMInput,CanvasRenderingContext2D:self.OffscreenCanvasRenderingContext2D||UnsupportedDOMInput,Image:UnsupportedDOMInput,Video:UnsupportedDOMInput,ImageData:self.ImageData||UnsupportedDOMInput,fetch:self.fetch.bind(self),createCanvasElement:()=>new OffscreenCanvas(1,1),createImageElement:()=>{throw Error('DOM images are unavailable in the detector worker');},readFile:()=>{throw Error('Filesystem unavailable');}});
let ready=false;
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      await faceapi.tf.setBackend('cpu');
      await faceapi.nets.tinyFaceDetector.loadFromUri('/vendor/face-api');
      ready=true;self.postMessage({type:'ready'});return;
    }
    if(data.type!=='detect'||!ready)return;
    const rgba=new Uint8ClampedArray(data.pixels),rgb=new Float32Array(data.width*data.height*3);
    for(let i=0,j=0;i<rgba.length;i+=4){rgb[j++]=rgba[i];rgb[j++]=rgba[i+1];rgb[j++]=rgba[i+2];}
    const input=faceapi.tf.tensor3d(rgb,[data.height,data.width,3]);
    try{
      const faces=await faceapi.detectAllFaces(input,new faceapi.TinyFaceDetectorOptions({inputSize:224,scoreThreshold:.6}));
      self.postMessage({type:'result',id:data.id,detections:faces.map(face=>({boundingBox:{originX:face.box.x,originY:face.box.y,width:face.box.width,height:face.box.height}}))});
    }finally{input.dispose();}
  }catch(error){self.postMessage({type:'error',id:data.id,detail:error.message});}
};
