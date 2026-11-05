/* Presence and position only. Inference runs in a worker so the voice/UI stay responsive. */
(() => {
  window.BeybooFaceDetector={async create(){
    const worker=new Worker('/face-detector-worker.js');
    let closed=false,sequence=0,readyResolve,readyReject,timeout;
    const pending=new Map();
    function close(reason='Face detector stopped'){if(closed)return;closed=true;clearTimeout(timeout);worker.terminate();readyReject?.(Error(reason));for(const p of pending.values())p.reject(Error('Face detector stopped'));pending.clear();}
    const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;timeout=setTimeout(()=>{close();},20000);});
    worker.onmessage=({data})=>{
      if(data.type==='ready'){clearTimeout(timeout);readyResolve();readyReject=null;return;}
      const p=pending.get(data.id);
      if(data.type==='error'){if(p){pending.delete(data.id);p.reject(Error('Detection unavailable'));}else close(data.detail);return;}
      if(data.type==='result'&&p){pending.delete(data.id);p.resolve({detections:data.detections});}
    };
    worker.onerror=()=>close();worker.postMessage({type:'init'});
    await ready;
    return {close,detectForVideo(canvas){
      if(closed)return Promise.reject(Error('Face detector stopped'));
      const id=++sequence,pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({type:'detect',id,width:canvas.width,height:canvas.height,pixels:pixels.buffer},[pixels.buffer]);});
    }};
  }};
})();
