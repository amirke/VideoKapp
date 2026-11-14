// Rasterizes the existing OpenFreeMap style for renderers/layers that consume image tiles.
// The style is rendered locally; no substitute map provider is used.
(() => {
 const cache = new Map(); let queue = Promise.resolve(), map, host;
 async function render(z,x,y) {
  if (!globalThis.maplibregl) throw Error('OpenFreeMap renderer is not ready. Refresh map.');
  if (!map) {
   host=document.createElement('div');Object.assign(host.style,{position:'fixed',left:'-10000px',top:'0',width:'256px',height:'256px'});document.body.append(host);
   maplibregl.setWorkerUrl(new URL('vendor/maplibre-gl-worker.mjs',document.baseURI).href);
   map=new maplibregl.Map({container:host,style:'https://tiles.openfreemap.org/styles/liberty',interactive:false,attributionControl:false,canvasContextAttributes:{preserveDrawingBuffer:true},fadeDuration:0,renderWorldCopies:false});
  }
  const n=2**z,lon=(x+.5)/n*360-180,lat=Math.atan(Math.sinh(Math.PI*(1-2*(y+.5)/n)))*180/Math.PI;
  await new Promise((resolve,reject)=>{
   const finish=error=>{clearTimeout(timer);map.off('idle',done);map.off('error',fail);error?reject(error):resolve();};
   const done=()=>finish();const fail=e=>finish(e.error||Error('OpenFreeMap tile failed'));
   const timer=setTimeout(()=>finish(Error('OpenFreeMap tile rendering timed out')),20000);
   map.on('idle',done);map.on('error',fail);map.jumpTo({center:[lon,lat],zoom:z-1,pitch:0,bearing:0});map.triggerRepaint();
  });
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;canvas.getContext('2d').drawImage(map.getCanvas(),0,0,256,256);return canvas;
 }
 function tile(z,x,y) {
  const key=`${z}/${x}/${y}`;if(cache.has(key))return cache.get(key);
  const result=queue.then(()=>render(z,x,y));queue=result.catch(()=>{});cache.set(key,result);result.catch(()=>cache.delete(key));
  if(cache.size>256)cache.delete(cache.keys().next().value);return result;
 }
 let registered=false;
 function register(){if(registered)return;if(!globalThis.maplibregl)throw Error('Map renderer is not ready');registered=true;
  maplibregl.addProtocol('ridevector',async params=>{const [z,x,y]=params.url.replace('ridevector://','').split('/').map(Number);const c=await tile(z,x,y);const blob=await new Promise(resolve=>c.toBlob(resolve));return {data:await blob.arrayBuffer()};});
 }
 globalThis.RideVectorTiles={tile,register};
})();
