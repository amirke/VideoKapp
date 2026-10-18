// SPDX-License-Identifier: GPL-2.0-only
(()=>{const $=id=>document.getElementById(id);let files=[],video=null,destination=null;
 function sort(){const key=$('order-log-sort').value;if(key==='manual')return;files.sort((a,b)=>key==='name'?a.name.localeCompare(b.name):((a[key]??Infinity)-(b[key]??Infinity)||a.name.localeCompare(b.name)));}
 function render(){
  $('order-log-video-path').textContent=video?.path||'No existing merged video selected.';$('order-log-path').textContent=destination||'The LOG will be saved beside the selected video.';
  $('order-log-rows').replaceChildren();let cursor=0;for(const [i,f]of files.entries()){const row=document.createElement('tr');for(const t of [i+1,f.name,`${cursor.toFixed(2)}–${(cursor+f.duration).toFixed(2)} s`,Number.isFinite(f.recorded)?new Date(f.recorded).toLocaleString('en-GB',{timeZone:$('ride-zone').value==='local'?undefined:$('ride-zone').value==='utc'?'UTC':$('ride-zone').value}):'Unknown recording time']){const td=document.createElement('td');td.textContent=t;row.append(td);}cursor+=f.duration;const td=document.createElement('td');for(const [text,label,fn]of [['↑','Move clip up',()=>move(i,-1)],['↓','Move clip down',()=>move(i,1)],['×','Remove clip',()=>{files.splice(i,1);changed();}]]){const b=document.createElement('button');b.textContent=text;b.setAttribute('aria-label',label+' '+f.name);b.disabled=busy||(text==='↑'&&i===0)||(text==='↓'&&i===files.length-1);b.onclick=fn;td.append(b);}row.append(td);$('order-log-rows').append(row);}
  $('order-log-total').textContent=`${files.length} original clips · Total ${cursor.toFixed(2)} seconds`+(video?` · Existing video ${video.duration.toFixed(2)} seconds`:'');
  $('order-log-create').disabled=busy||!video||!files.length||!$('order-log-approved').checked;
 }
 function changed(){ $('order-log-approved').checked=false;render();}
 function move(i,delta){if(i+delta<0||i+delta>=files.length)return;[files[i],files[i+delta]]=[files[i+delta],files[i]];$('order-log-sort').value='manual';changed();}
 async function act(fn,add=false){setBusy(true);$('order-log-status').textContent='Working…';try{const r=unwrap(await fn());if(!r)return;video=r.video;destination=r.destination;if(add){const existing=new Set(files.map(f=>f.id));files.push(...r.added.filter(f=>!existing.has(f.id)));sort();}if(r.created){await window.loadCreatedOrderLog?.();$('order-log-status').textContent='Order LOG created: '+r.created+'\nVideo was not merged or re-encoded.'+(r.missingTimes?'\n'+r.missingTimes+' segments have unknown recording times.':'');}else $('order-log-status').textContent=r.errors?.length?r.errors.join('\n'):'Ready to review the clip order.';changed();}catch(e){$('order-log-status').textContent=e.code==='EEXIST'?'LOG already exists. Choose another LOG file name.':e.message;}finally{setBusy(false);render();}}
 $('order-log-use-ride').onclick=()=>act(()=>window.api.orderLogUseRide());
 $('order-log-add').onclick=()=>act(()=>window.api.orderLogFiles(),true);$('order-log-choose-video').onclick=()=>act(()=>window.api.orderLogVideo());$('order-log-destination').onclick=()=>act(()=>window.api.orderLogDestination());
 $('order-log-clear').onclick=()=>act(async()=>{const r=await window.api.orderLogClear();if(r.ok)files=[];return r;});$('order-log-sort').onchange=()=>{sort();changed();};$('order-log-approved').onchange=render;
 $('order-log-create').onclick=()=>act(()=>window.api.orderLogCreate(files.map(f=>f.id),$('order-log-approved').checked));
 window.syncOrderLog=render;render();
})();
