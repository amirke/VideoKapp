// SPDX-License-Identifier: GPL-2.0-only
(function(root){
 const valid=p=>Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lon)&&Math.abs(p.lon)<=180;
 const child=(el,n)=>Array.from(el.getElementsByTagNameNS('*',n))[0]?.textContent;
 function xml(text,Parser){const doc=new Parser().parseFromString(text,'text/xml');if(doc.getElementsByTagName('parsererror').length||/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('Invalid or unsupported XML file.');return doc;}
 function parseXML(text,Parser){const d=xml(text,Parser),points=[];const num=(e,n)=>{const t=child(e,n);return t==null?null:Number(t);};
  for(const [group,seg]of Array.from(d.getElementsByTagNameNS('*','trkseg')).entries())for(const p of seg.getElementsByTagNameNS('*','trkpt'))points.push({lat:p.hasAttribute('lat')?Number(p.getAttribute('lat')):NaN,lon:p.hasAttribute('lon')?Number(p.getAttribute('lon')):NaN,time:Date.parse(child(p,'time')),ele:num(p,'ele'),hr:num(p,'hr'),group});
  if(!points.length)for(const [group,track]of Array.from(d.getElementsByTagNameNS('*','Track')).entries()){const times=Array.from(track.getElementsByTagNameNS('*','when'),n=>Date.parse(n.textContent));Array.from(track.getElementsByTagNameNS('*','coord')).forEach((n,i)=>{const [lon,lat,ele]=n.textContent.trim().split(/\s+/).map(Number);points.push({lon,lat,ele,time:times[i],group});});}
  if(!points.length)for(const [group,line]of Array.from(d.getElementsByTagNameNS('*','LineString')).entries()){const c=child(line,'coordinates')||'';for(const v of c.trim().split(/\s+/)){const [lon,lat,ele]=v.split(',').map(Number);points.push({lon,lat,ele,time:null,group});}}
  return normalize(points);
 }
 function normalize(points){const p=points.filter(valid);if(p.length<2||p.length>250000)throw Error('Route must contain 2–250,000 valid GPS points.');let distance=0;for(let i=0;i<p.length;i++){if(i&&p[i].group===p[i-1].group)distance+=meters(p[i-1],p[i]);p[i].distance=distance;if(i&&p[i].group===p[i-1].group&&Number.isFinite(p[i].time)&&Number.isFinite(p[i-1].time)){const dt=(p[i].time-p[i-1].time)/1000;if(dt>0&&dt<=60)p[i].speed=meters(p[i-1],p[i])/dt*3.6;}}return p;}
 function meters(a,b){const r=Math.PI/180,x=(b.lon-a.lon)*r*Math.cos((a.lat+b.lat)*r/2),y=(b.lat-a.lat)*r;return Math.hypot(x,y)*6371000;}
 function realAt(log,seconds){const s=log?.segments.find(s=>seconds>=s.start&&seconds<s.end);return !s||s.utcStart===null?null:s.utcStart+(seconds-s.start)*s.rate*1000;}
 function videoAt(log,time){return (log?.segments||[]).filter(s=>s.utcStart!==null&&time>=s.utcStart&&time<s.utcStart+(s.end-s.start)*s.rate*1000).map(s=>s.start+(time-s.utcStart)/1000/s.rate);}
 function position(points,time,gap=60){if(!Number.isFinite(time)||!points.length||time<points[0].time||time>points.at(-1).time)return null;let lo=0,hi=points.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(points[m].time<=time)lo=m;else hi=m-1;}const a=points[lo],b=points[lo+1];if(!b||time===a.time)return {...a};if(b.time-a.time>gap*1000||a.group!==b.group)return null;const k=(time-a.time)/(b.time-a.time),p={time};for(const n of ['lat','lon','ele','hr','distance'])p[n]=Number.isFinite(a[n])&&Number.isFinite(b[n])?a[n]+(b[n]-a[n])*k:null;p.speed=meters(a,b)/((b.time-a.time)/1000)*3.6;return p;}
 const api={parseXML,normalize,meters,realAt,videoAt,position};if(typeof module!=='undefined')module.exports=api;else root.RideData=api;
})(globalThis);
