// Rasterizes the existing OpenFreeMap style for renderers/layers that consume image tiles.
// The style is rendered locally; no substitute map provider is used.
(() => {
 const styles=new Map();
 function labelStyle(name='liberty'){if(!['liberty','bright'].includes(name))throw Error('Unknown label style');if(!styles.has(name)){const task=fetch('https://tiles.openfreemap.org/styles/'+name,{signal:AbortSignal.timeout(15000)}).then(async r=>{if(!r.ok)throw Error('Labels HTTP '+r.status);const style=await r.json();style.layers=style.layers.filter(l=>l.type==='symbol'&&l.layout?.['text-field']).map(l=>{const layout=Object.fromEntries(Object.entries(l.layout).filter(([k])=>!k.startsWith('icon-')));if(JSON.stringify(layout['text-field']).includes('name'))layout['text-field']=['coalesce',['get','name:he'],['get','name_he'],['get','name'],layout['text-field']];layout['text-rotation-alignment']='viewport';layout['text-pitch-alignment']='viewport';return {...l,layout,paint:{...l.paint,'text-color':'#ffffff','text-halo-color':'#203040','text-halo-width':1.5}};});delete style.sprite;return style;});styles.set(name,task);task.catch(()=>styles.delete(name));}return styles.get(name);}
 const cache = new Map(); let queue = Promise.resolve(), maps=new Map();
 async function render(z,x,y,labels=false) {
  let map=maps.get(labels),host;
  if (!globalThis.maplibregl) throw Error('OpenFreeMap renderer is not ready. Refresh map.');
  if (!map) {
   host=document.createElement('div');Object.assign(host.style,{position:'fixed',left:'-10000px',top:'0',width:'256px',height:'256px'});document.body.append(host);
   maplibregl.setWorkerUrl(new URL('vendor/maplibre-gl-worker.mjs',document.baseURI).href);
   let style=labels?await labelStyle(labels==='bright'?'bright':'liberty'):'https://tiles.openfreemap.org/styles/liberty';
   map=new maplibregl.Map({container:host,style,interactive:false,attributionControl:false,canvasContextAttributes:{preserveDrawingBuffer:true},fadeDuration:0,renderWorldCopies:false});maps.set(labels,map);
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
 function tile(z,x,y,labels=false) {
  const key=`${labels}/${z}/${x}/${y}`;if(cache.has(key))return cache.get(key);
  const result=queue.then(()=>render(z,x,y,labels));queue=result.catch(()=>{});cache.set(key,result);result.catch(()=>cache.delete(key));
  if(cache.size>256)cache.delete(cache.keys().next().value);return result;
 }
 let registered=false;
 function register(){if(registered)return;if(!globalThis.maplibregl)throw Error('Map renderer is not ready');registered=true;
  maplibregl.addProtocol('ridevector',async params=>{const parts=params.url.replace('ridevector://','').split('/'),labels=parts[0]==='labels'||parts[0]==='bright-labels'?(parts[0]==='bright-labels'?'bright':true):false;if(labels)parts.shift();const [z,x,y]=parts.map(Number);const c=await tile(z,x,y,labels);const blob=await new Promise(resolve=>c.toBlob(resolve));return {data:await blob.arrayBuffer()};});
 }
 globalThis.RideVectorTiles={tile,register,labelStyle};
})();
