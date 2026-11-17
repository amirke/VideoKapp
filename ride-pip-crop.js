(function(root){
 const sides=['left','top','right','bottom'];
 function normalize(value={}){const c={};for(const k of sides){c[k]=Number(value?.[k]??0);if(!Number.isFinite(c[k])||c[k]<0||c[k]>80)throw Error('Crop edges must be between 0% and 80%.');}if(c.left+c.right>90||c.top+c.bottom>90)throw Error('Keep at least 10% of the image.');return c;}
 function geometry(value,w,h){const c=normalize(value);const x=Math.floor(w*c.left/100/2)*2,y=Math.floor(h*c.top/100/2)*2;return {x,y,w:Math.max(2,Math.min(w-x,Math.floor(w*(1-(c.left+c.right)/100)/2)*2)),h:Math.max(2,Math.min(h-y,Math.floor(h*(1-(c.top+c.bottom)/100)/2)*2))};}
 function attach(host,target,onChange){let crop=normalize();const panel=document.createElement('details');panel.className='ride-crop';const summary=document.createElement('summary');summary.textContent='Crop edges (%)';panel.append(summary);const row=document.createElement('div');row.className='ride-crop-fields';panel.append(row);const inputs={};const status=document.createElement('span');status.className='ride-crop-status';
 const apply=()=>{target.style.clipPath=`inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)`;for(const k of sides)inputs[k].value=crop[k];onChange?.(crop);};
 for(const k of sides){const label=document.createElement('label'),input=document.createElement('input');input.id=(target.id||host.id||'ride-map')+'-crop-'+k;input.type='number';input.min=0;input.max=80;input.step=1;input.value=0;input.setAttribute('aria-label','Crop '+k);label.append(document.createTextNode(k[0].toUpperCase()+k.slice(1)+' '),input);row.append(label);inputs[k]=input;input.onchange=()=>{try{crop=normalize(Object.fromEntries(sides.map(k=>[k,inputs[k].value])));status.textContent='';apply();}catch(e){status.textContent=e.message;apply();}};}
 const reset=document.createElement('button');reset.id=(target.id||host.id||'ride-map')+'-crop-reset';reset.type='button';reset.textContent='Reset crop';reset.onclick=()=>{crop=normalize();status.textContent='';apply();};panel.append(reset,status);host.append(panel);
 return {get:()=>({...crop}),set:value=>{try{crop=normalize(value);status.textContent='';apply();}catch(e){status.textContent=e.message;}}};
 }
 const api={normalize,geometry,attach};if(typeof module!=='undefined')module.exports=api;else root.RidePipCrop=api;
})(globalThis);
