// GPS sensor series use the same corrected absolute clock as the map.
(()=>{
 const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
 const section=document.createElement('details');section.id='ride-charts';section.open=true;
 const heading=document.createElement('summary');heading.textContent='Elevation, speed & heart rate · elapsed GPS time';section.append(heading);
 document.querySelector('.ride-live-stage').after(section);
 const make=(tag,attrs={},text)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!=null)e.textContent=text;return e;};
 const plots=[['ele','Elevation','m','#54d4a4'],['speed','Speed (GPS-derived)','km/h','#74baff'],['hr','Heart rate','bpm','#ff8d9a']].map(([key,label,unit,color])=>{const row=document.createElement('div'),title=document.createElement('div'),svg=make('svg',{viewBox:'0 0 1000 110',preserveAspectRatio:'none',role:'img','aria-label':label+' over elapsed GPS time'});row.className='ride-chart';title.className='ride-chart-value';row.append(title,svg);section.append(row);return {key,label,unit,color,title,svg};});
 let previous=null,oldGap=null,start=0,end=0;
 const elapsed=ms=>{const s=Math.max(0,Math.floor(ms/1000));return Math.floor(s/3600)+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
 const x=t=>55+930*(t-start)/Math.max(1,end-start);
 function rebuild(points,gap){start=points[0]?.time??0;end=points.at(-1)?.time??0;
  for(const plot of plots){const {svg,key,color}=plot;svg.replaceChildren();let low=Infinity,high=-Infinity;for(const p of points)if(Number.isFinite(p[key])){low=Math.min(low,p[key]);high=Math.max(high,p[key]);}
   if(low===Infinity){svg.append(make('text',{x:55,y:48,fill:'#a9bbc3'},points.length?'No '+plot.label.toLowerCase()+' data in this GPX':'Load a GPX activity'));plot.cursor=null;continue;}
   if(low===high){low-=1;high+=1;}const y=v=>80-65*(v-low)/(high-low);
   for(const v of [low,high]){svg.append(make('line',{x1:55,x2:985,y1:y(v),y2:y(v),stroke:'#344b53'}));svg.append(make('text',{x:49,y:y(v)+4,'text-anchor':'end',fill:'#a9bbc3'},v.toFixed(0)));}
   for(let i=0;i<=4;i++){const t=start+(end-start)*i/4;svg.append(make('text',{x:x(t),y:103,'text-anchor':i===0?'start':i===4?'end':'middle',fill:'#a9bbc3'},elapsed(t-start)));}
   let d='',last=null;for(const p of points){if(!Number.isFinite(p[key])){last=null;continue;}const connected=last&&last.group===p.group&&p.time-last.time<=gap*1000;d+=(connected?'L':'M')+x(p.time).toFixed(2)+','+y(p[key]).toFixed(2);last=p;}
   svg.append(make('path',{d,fill:'none',stroke:color,'stroke-width':1.5,'vector-effect':'non-scaling-stroke'}));plot.cursor=make('line',{y1:10,y2:83,stroke:'#fff','stroke-width':1.5,'vector-effect':'non-scaling-stroke'});svg.append(plot.cursor);
  }
 }
 window.updateRideCharts=({points,t,position,gap})=>{
  if(points!==previous||gap!==oldGap){previous=points;oldGap=gap;rebuild(points,gap);}
  for(const plot of plots){const value=position?.[plot.key];plot.title.textContent=plot.label+': '+(Number.isFinite(value)?value.toFixed(plot.key==='hr'?0:1)+' '+plot.unit:'—')+(Number.isFinite(t)&&points.length?' · '+elapsed(t-start)+' since GPS start':'');if(plot.cursor){const visible=Number.isFinite(t)&&t>=start&&t<=end;plot.cursor.style.display=visible?'':'none';if(visible){plot.cursor.setAttribute('x1',x(t));plot.cursor.setAttribute('x2',x(t));}}}
 };
 window.rideNavigate.refresh();
})();
