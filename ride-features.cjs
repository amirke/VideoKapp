// Read-only, bounded OpenStreetMap feature lookup. Never sends video or activity files.
const cache=new Map();let controller=null,lastRequest=0;
function cancel(){controller?.abort();}
function parseFeatures(data){
 if(data.remark)throw Error('Map details incomplete: '+String(data.remark).slice(0,180));
 const features=[],junctions=new Map();
 for(const e of data.elements||[]){
  const tags=e.tags||{},p=e.center||e;
  if(!tags.highway&&Number.isFinite(p.lat)&&Number.isFinite(p.lon))features.push({id:e.type+'/'+e.id,lat:p.lat,lon:p.lon,kind:'poi',name:tags.name||tags.tourism||tags.historic||tags.amenity||tags.place||'Point of interest'});
  if(tags.highway&&Array.isArray(e.nodes)&&Array.isArray(e.geometry))e.nodes.forEach((id,i)=>{const p=e.geometry[i];if(!p)return;let node=junctions.get(id);if(!node){node={id:'junction/'+id,lat:p.lat,lon:p.lon,kind:'junction',name:'Road junction',neighbors:new Set()};junctions.set(id,node);}if(i)node.neighbors.add(e.nodes[i-1]);if(i+1<e.nodes.length)node.neighbors.add(e.nodes[i+1]);});
 }
 for(const p of junctions.values())if(p.neighbors.size>=3){delete p.neighbors;features.push(p);}
 return features;
}
async function lookup({lat,lon,radius=5000},{fetchImpl=fetch,now=Date.now()}={}){
 if(!Number.isFinite(lat)||Math.abs(lat)>85||!Number.isFinite(lon)||Math.abs(lon)>180||!Number.isFinite(radius)||radius<500||radius>10000)throw Error('Invalid map detail area.');
 const key=[lat.toFixed(2),lon.toFixed(2),Math.round(radius)].join('/');const hit=cache.get(key);if(hit&&now-hit.at<3600000)return {...hit.value,cached:true};
 if(controller)throw Error('Map details are already loading.');if(now-lastRequest<45000)throw Error('Map detail service cooldown. Try again shortly.');lastRequest=now;controller=new AbortController();
 try {const around=`(around:${Math.round(radius)},${lat.toFixed(5)},${lon.toFixed(5)})`,query=`[out:json][timeout:20];(nwr["tourism"~"viewpoint|attraction|museum|camp_site|picnic_site"]${around};nwr["historic"]${around};nwr["amenity"~"fuel|restaurant|cafe|drinking_water|toilets"]${around};node["place"~"city|town|village|hamlet"]${around};);out center;way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track)(_link)?$"]${around};out geom;`;
 const response=await fetchImpl('https://overpass.private.coffee/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'VideoKapp/3.10 (local GPS map detail lookup)'},body:new URLSearchParams({data:query}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])});if(!response.ok)throw Error('Map detail service HTTP '+response.status);
 const chunks=[];let bytes=0;for await(const chunk of response.body){bytes+=chunk.length;if(bytes>8000000)throw Error('Map details exceed 8 MB. Choose a smaller search radius.');chunks.push(Buffer.from(chunk));}
 const features=parseFeatures(JSON.parse(Buffer.concat(chunks).toString('utf8')));if(features.length>20000)throw Error('Too many map features. Choose a smaller radius.');const value={lat,lon,radius,features,source:'OpenStreetMap / Overpass',complete:true};cache.set(key,{at:now,value});if(cache.size>12)cache.delete(cache.keys().next().value);return value;
 }finally{controller=null;}
}
module.exports={lookup,cancel,parseFeatures};

