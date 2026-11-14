// Shared geometry for interest-aware zoom. Works without map-provider label access.
(function(root){
 const earth=6371000,rad=Math.PI/180;
 function distance(a,b){return Math.hypot((b.lon-a.lon)*rad*Math.cos((a.lat+b.lat)*rad/2),(b.lat-a.lat)*rad)*earth;}
 function segmentDistance(p,a,b){const scale=rad*earth,x=(b.lon-a.lon)*Math.cos(p.lat*rad)*scale,y=(b.lat-a.lat)*scale,px=(p.lon-a.lon)*Math.cos(p.lat*rad)*scale,py=(p.lat-a.lat)*scale,k=Math.max(0,Math.min(1,(px*x+py*y)/(x*x+y*y||1)));return Math.hypot(px-k*x,py-k*y);}
 function simplify(points,step=80){const out=[];for(const p of points)if(!out.length||p.group!==out.at(-1).group||distance(p,out.at(-1))>=step)out.push(p);if(points.length&&out.at(-1)!==points.at(-1))out.push(points.at(-1));return out;}
 function turns(points,gap=60){const sampled=simplify(points),features=[];for(let i=1;i<sampled.length-1;i++){const a=sampled[i-1],b=sampled[i],c=sampled[i+1];if(a.group!==b.group||b.group!==c.group||b.time-a.time>gap*1000||c.time-b.time>gap*1000)continue;const heading=(p,q)=>Math.atan2((q.lon-p.lon)*Math.cos(p.lat*rad),q.lat-p.lat)/rad;const angle=Math.abs(((heading(b,c)-heading(a,b)+540)%360)-180);if(angle>=30&&(!features.length||distance(b,features.at(-1))>120))features.push({...b,id:'turn/'+i,kind:'turn',name:'Route turn '+Math.round(angle)+' degrees'});}return features;}
 function plan(position,route,features,{target=8,maxRadius=5000,corridor=500,gap=60}={}){
  if(!position)return {features:[],radius:maxRadius};const segments=[];for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i];if(Math.min(distance(position,a),distance(position,b))<maxRadius+1000&&a.group===b.group&&(!Number.isFinite(a.time)||!Number.isFinite(b.time)||b.time-a.time<=gap*1000))segments.push([a,b]);}
  const selected=features.map(f=>({...f,distance:distance(position,f)})).filter(f=>f.distance<=maxRadius&&segments.some(([a,b])=>segmentDistance(f,a,b)<=corridor)).sort((a,b)=>a.distance-b.distance).slice(0,target);
  return {features:selected,radius:selected.length>=target?Math.max(150,selected.at(-1).distance*1.25):maxRadius};
 }
 function zoomForRadius(lat,radius,width,height,renderer){const circumference=2*Math.PI*earth*Math.cos(lat*rad),span=renderer==='cesium'?circumference/(radius*4):Math.min(width,height)*circumference/((renderer==='gl'?1024:512)*radius*1.3);return Math.max(3,Math.min(18,Math.log2(Math.max(1,span))));}
 const api={distance,segmentDistance,simplify,turns,plan,zoomForRadius};if(typeof module!=='undefined')module.exports=api;else root.RideInterest=api;
})(globalThis);
