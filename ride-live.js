// Live map uses the same map and absolute playback clock as Ride Player.
(()=>{
 const $=id=>document.getElementById(id),v=$('ride-video'),stage=document.querySelector('.ride-map-stage'),home=stage.parentNode;
 const controls=$('ride-live-controls');
 const wrap=document.createElement('div');wrap.className='ride-live-stage';v.before(wrap);wrap.append(v);
 const imageArea=document.createElement('div');imageArea.className='ride-image-area';wrap.append(imageArea);
 const pane=v.closest('.ride-video-pane'),full=document.createElement('button');full.id='ride-fullscreen';full.textContent='⛶ Full screen';full.title='Full screen video and map';$('ride-play').parentNode.append(full);
 full.onclick=async()=>{try{if(document.fullscreenElement===pane)await document.exitFullscreen();else await pane.requestFullscreen();}catch(e){window.reportButtonFailure?.();$('ride-status').textContent='Full screen failed: '+e.message;}};
 document.addEventListener('fullscreenchange',()=>{full.textContent=document.fullscreenElement===pane?'⛶ Exit full screen':'⛶ Full screen';layoutImage();});
 function containBox(){if(box.hidden)return;const w=imageArea.clientWidth,h=imageArea.clientHeight;if(!w||!h)return;const maxWidth=Math.max(1,Math.min(w,(h-handle.offsetHeight-4)*4/3));box.style.width=Math.min(w*Number($('ride-live-width').value)/100,maxWidth)+'px';const left=box.style.left?parseFloat(box.style.left):w-box.offsetWidth-12,top=parseFloat(box.style.top)||12;box.style.right='auto';box.style.left=Math.max(0,Math.min(left,w-box.offsetWidth))+'px';box.style.top=Math.max(0,Math.min(top,h-box.offsetHeight))+'px';}
 function layoutImage(){const w=wrap.clientWidth,h=wrap.clientHeight,ratio=v.videoWidth&&v.videoHeight?v.videoWidth/v.videoHeight:16/9;const width=Math.min(w,h*ratio),height=width/ratio;Object.assign(imageArea.style,{left:(w-width)/2+'px',top:(h-height)/2+'px',width:width+'px',height:height+'px'});containBox();window.resizeRideMap?.();}
 v.addEventListener('loadedmetadata',layoutImage);v.addEventListener('resize',layoutImage);
 const box=document.createElement('div');box.className='ride-live-box';box.hidden=true;box.innerHTML='<div class="ride-live-handle">GPS map — drag to move</div>';imageArea.append(box);
 const reference=document.createElement('div');reference.id='ride-sync-reference';reference.textContent='Before offset';reference.hidden=true;stage.append(reference);
 const markerLayer=document.createElement('div');markerLayer.className='ride-interest-layer';stage.append(markerLayer);
 let gpsFormatter=null,gpsFormatterZone=null;let ctx=null,route=null,turns=[],loaded=null,features=[],busy=false,generation=0,lastFetch=-Infinity,lastPlan=0,lastDraw=0,stopped=false,lookupError='';
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 const status=t=>$('ride-feature-status').textContent=t;
 const radius=()=>clamp(Number($('ride-feature-radius').value)||5,.5,10)*1000;
 function cancel(){generation++;busy=false;window.api.cancelRideFeatures?.();$('ride-feature-progress').hidden=true;}
 async function lookup(force=false){
  if(!ctx?.position){status('No GPS position at the current time.');return;}
  if(busy||(!force&&performance.now()-lastFetch<45000))return;
  if(!window.api.rideFeatures){status('Restart the updated application to enable map feature lookup.');return;}
  busy=true;lastFetch=performance.now();const id=++generation,p=ctx.position;$('ride-feature-progress').hidden=false;
  status('Loading nearby POIs and road junctions…');
  try{const response=await window.api.rideFeatures({lat:p.lat,lon:p.lon,radius:radius()});if(id!==generation)return;if(!response.ok)throw Error(response.error);loaded=response.value;lookupError='';lastPlan=0;status('Nearby features loaded.');window.rideNavigate.refresh();}
  catch(e){if(id===generation){lookupError=e.message;status('POIs unavailable: '+e.message+' — route turns only.');window.reportButtonFailure?.();}}
  finally{if(id===generation){busy=false;$('ride-feature-progress').hidden=true;}}
 }
 function pip(){const enabled=$('ride-live-pip').checked;box.hidden=!enabled;$('ride-view').classList.toggle('live-pip-active',enabled);if(enabled)box.append(stage);else home.insertBefore(stage,controls.nextSibling);box.style.width=$('ride-live-width').value+'%';requestAnimationFrame(layoutImage);}
 $('ride-live-pip').onchange=pip;$('ride-live-width').oninput=pip;
 const handle=box.firstElementChild;handle.onpointerdown=e=>{e.preventDefault();handle.setPointerCapture(e.pointerId);const origin=box.getBoundingClientRect(),bounds=imageArea.getBoundingClientRect(),dx=e.clientX-origin.left,dy=e.clientY-origin.top;handle.onpointermove=ev=>{box.style.right='auto';box.style.left=clamp(ev.clientX-bounds.left-dx,0,Math.max(0,bounds.width-box.offsetWidth))+'px';box.style.top=clamp(ev.clientY-bounds.top-dy,0,Math.max(0,bounds.height-box.offsetHeight))+'px';};handle.onpointerup=()=>handle.onpointermove=null;handle.onpointercancel=()=>handle.onpointermove=null;};
 for(const direction of ['n','s','e','w','ne','nw','se','sw']){const grip=document.createElement('div');grip.className='ride-pip-resize '+direction;grip.title='Drag to resize map';box.append(grip);grip.onpointerdown=e=>{e.preventDefault();e.stopPropagation();grip.setPointerCapture(e.pointerId);const bounds=imageArea.getBoundingClientRect(),origin=box.getBoundingClientRect(),x=e.clientX,y=e.clientY;grip.onpointermove=ev=>{const delta=direction.includes('e')?ev.clientX-x:direction.includes('w')?x-ev.clientX:(direction==='n'?y-ev.clientY:ev.clientY-y)*4/3;const width=clamp((origin.width+delta)/bounds.width*100,10,95);$('ride-live-width').value=width;box.style.width=width+'%';if(direction.includes('w')){box.style.right='auto';box.style.left=Math.max(0,origin.right-bounds.left-box.offsetWidth)+'px';}if(direction.includes('n'))box.style.top=Math.max(0,origin.bottom-bounds.top-box.offsetHeight)+'px';containBox();};const end=()=>{grip.onpointermove=null;$('ride-live-width').dispatchEvent(new Event('change',{bubbles:true}));};grip.onpointerup=end;grip.onpointercancel=end;};}
 if(window.ResizeObserver){new ResizeObserver(()=>window.resizeRideMap?.()).observe(box);new ResizeObserver(layoutImage).observe(wrap);}
 $('ride-gps-play').onclick=()=>window.rideNavigate.play('activity');
 $('ride-gps-time').oninput=()=>{if(ctx?.points.length)window.rideNavigate.seek(ctx.points[0].time+Number($('ride-gps-time').value)*1000);};
 $('ride-feature-refresh').onclick=()=>{stopped=false;return lookup(true);};
 $('ride-feature-stop').onclick=()=>{stopped=true;cancel();status('Feature lookup stopped.');};
 for(const id of ['ride-auto-zoom','ride-feature-count','ride-feature-radius'])$(id).onchange=()=>{stopped=false;lastPlan=0;if(!$('ride-auto-zoom').checked){cancel();features=[];markerLayer.replaceChildren();}else window.rideNavigate.refresh();};
 window.rideLiveSettings={get:()=>Object.fromEntries(['ride-live-pip','ride-live-width','ride-auto-zoom','ride-feature-count','ride-feature-radius','ride-sync-compare','ride-north-up','ride-show-north','ride-camera-filter','ride-camera-smoothing'].map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value])),set:values=>{for(const [id,value]of Object.entries(values||{})){if(!['ride-live-pip','ride-live-width','ride-auto-zoom','ride-feature-count','ride-feature-radius','ride-sync-compare','ride-north-up','ride-show-north','ride-camera-filter','ride-camera-smoothing'].includes(id))continue;const e=$(id);if(e.type==='checkbox')e.checked=value===true;else if(Number.isFinite(Number(value)))e.value=clamp(Number(value),Number(e.min),Number(e.max));}pip();lastPlan=0;}};
 function syncOffsetInputs(){const total=Number($('ride-offset').value),minutes=Math.trunc(total/60);$('ride-live-offset').value=minutes;$('ride-fine-offset').value=Number((total-minutes*60).toPrecision(12));window.rideOffsetStatus?.();}
 window.syncRideOffsetInputs=syncOffsetInputs;
 let savedOffset=null,offsetTouched=false;
 const savedStatus=()=>{const current=Number($('ride-offset').value);$('ride-offset-saved').textContent=savedOffset===null?'Offset not saved':current===savedOffset?'Saved: '+Math.trunc(savedOffset/60)+' min '+Number((savedOffset-Math.trunc(savedOffset/60)*60).toPrecision(12))+' s':'Changed — click Save offset';if(current!==savedOffset)$('ride-offset-save').dataset.actionState='default';};
 window.rideOffsetStatus=savedStatus;
 $('ride-offset').addEventListener('change',()=>{offsetTouched=true;savedStatus();});
 $('ride-panel').addEventListener('input',e=>{if(['ride-live-offset','ride-fine-offset'].includes(e.target.id))offsetTouched=true;});
 $('ride-offset-save').onclick=async()=>{try{const a=$('ride-live-offset').value,b=$('ride-fine-offset').value,seconds=Number(a)*60+Number(b);if(!a||!b||!Number.isFinite(seconds)||Math.abs(seconds)>31536000)throw Error('Enter a numeric offset within one year.');applyOffset(seconds);const r=await window.api.rideOffsetSave(seconds);if(!r.ok)throw Error(r.error);savedOffset=seconds;savedStatus();$('ride-offset-save').dataset.actionState='ok';}catch(e){$('ride-offset-save').dataset.actionState='error';$('ride-offset-saved').textContent='Save failed: '+e.message;window.reportButtonFailure?.();}};
 window.api.rideOffsetLoad?.().then(r=>{if(!r.ok)throw Error(r.error);if(r.value){savedOffset=r.value.seconds;if(!offsetTouched)applyOffset(savedOffset);}savedStatus();}).catch(e=>{$('ride-offset-saved').textContent='Load failed: '+e.message;});
 function applyOffset(value){if(!Number.isFinite(value)||Math.abs(value)>31536000){$('ride-sync-preview').textContent='Enter a numeric offset within one year.';window.reportButtonFailure?.();syncOffsetInputs();return;}if(window.rideNavigate.playing()){window.stopRidePlayback();v.pause();}$('ride-playback-mode').value='video';$('ride-offset').value=value;syncOffsetInputs();$('ride-offset').dispatchEvent(new Event('change',{bubbles:true}));}
 $('ride-live-offset').onchange=()=>{const minutes=Number($('ride-live-offset').value);if($('ride-live-offset').value===''||!Number.isFinite(minutes)){$('ride-sync-preview').textContent='Enter a numeric offset in minutes.';syncOffsetInputs();return;}applyOffset(minutes*60+Number($('ride-fine-offset').value));};
 $('ride-fine-offset').onchange=()=>{if($('ride-fine-offset').value===''||!Number.isFinite(Number($('ride-fine-offset').value))){syncOffsetInputs();return;}applyOffset(Number($('ride-live-offset').value)*60+Number($('ride-fine-offset').value));};
 $('ride-offset-minus').onclick=()=>applyOffset(Number($('ride-offset').value)-900);$('ride-offset-plus').onclick=()=>applyOffset(Number($('ride-offset').value)+900);$('ride-second-minus').onclick=()=>applyOffset(Number($('ride-offset').value)-1);$('ride-second-plus').onclick=()=>applyOffset(Number($('ride-offset').value)+1);$('ride-offset-zero').onclick=()=>applyOffset(0);$('ride-sync-compare').onchange=()=>window.rideNavigate.refresh();
 const refresh=window.refreshRideMapSettings;window.refreshRideMapSettings=()=>{refresh?.();pip();lastPlan=0;window.rideNavigate.refresh();};
 function drawReference(){reference.hidden=true;if(!ctx||!ctx.beforePosition||!$('ride-sync-compare').checked||Number($('ride-offset').value)===0)return;const p=project(ctx.beforePosition);if(p){reference.style.left=p.x+'px';reference.style.top=p.y+'px';reference.hidden=false;}}
 function project(f){const map=ctx.map,r=stage.getBoundingClientRect();let p;if(map.cesium){const C=globalThis.Cesium,cart=C.Cartographic.fromDegrees(f.lon,f.lat);p=C.SceneTransforms.worldToWindowCoordinates(map.cesium.scene,C.Cartesian3.fromDegrees(f.lon,f.lat,map.cesium.scene.globe.getHeight(cart)||0));}else if(map.gl)p=map.gl.project([f.lon,f.lat]);else{const q=map.hitScreen(f);p={x:q.x*r.width/map.canvas.width,y:q.y*r.height/map.canvas.height};}return p&&p.x>=0&&p.y>=0&&p.x<=r.width&&p.y<=r.height?p:null;}
 function drawMarkers(){
  markerLayer.replaceChildren();if(!ctx?.position||!$('ride-auto-zoom').checked)return;
  const credit=document.createElement('small');credit.className='ride-feature-credit';credit.textContent='Features: © OpenStreetMap contributors';markerLayer.append(credit);const map=ctx.map,r=stage.getBoundingClientRect();
  for(const f of features){let p;
   if(map.cesium){const C=globalThis.Cesium,cart=C.Cartographic.fromDegrees(f.lon,f.lat),height=map.cesium.scene.globe.getHeight(cart)||0;p=C.SceneTransforms.worldToWindowCoordinates(map.cesium.scene,C.Cartesian3.fromDegrees(f.lon,f.lat,height));}
   else if(map.gl)p=map.gl.project([f.lon,f.lat]);
   else{const q=map.hitScreen(f);p={x:q.x*r.width/map.canvas.width,y:q.y*r.height/map.canvas.height};}
   if(!p||p.x<0||p.y<0||p.x>r.width||p.y>r.height)continue;
   const e=document.createElement('span');e.className='ride-interest-marker';e.style.left=p.x+'px';e.style.top=p.y+'px';e.textContent=f.kind==='poi'?'●':f.kind==='turn'?'↱':'+';e.title=f.name;markerLayer.append(e);
  }
 }
 window.rideLiveUpdate=next=>{
  ctx=next;if(!ctx.map.liveOverlayDraw){const draw=ctx.map.draw.bind(ctx.map);ctx.map.draw=()=>{draw();drawReference();drawMarkers();};ctx.map.liveOverlayDraw=true;}const clock=(t,zone)=>Number.isFinite(t)?new Date(t).toLocaleString('en-GB',{timeZone:RideTime.zone($(zone).value)}):'unavailable',coord=p=>p?p.lat.toFixed(5)+', '+p.lon.toFixed(5):'no GPS coverage';$('ride-sync-preview').textContent='Video clock: '+clock(ctx.videoTime,'ride-zone')+' | Selected GPS clock: '+clock(ctx.t,'ride-gps-zone')+' | Applied offset: '+$('ride-live-offset').value+' min '+$('ride-fine-offset').value+' s (total '+$('ride-offset').value+' s) | Before: '+coord(ctx.beforePosition)+' | After (red): '+coord(ctx.position);drawReference();
  const pts=ctx.points,slider=$('ride-gps-time');slider.disabled=pts.length<2;$('ride-gps-play').disabled=pts.length<2;slider.max=pts.length?(pts.at(-1).time-pts[0].time)/1000:0;slider.value=pts.length&&Number.isFinite(ctx.t)?clamp((ctx.t-pts[0].time)/1000,0,Number(slider.max)):0;

  const gpsZone=RideTime.zone($('ride-gps-zone').value);if(gpsFormatterZone!==gpsZone){gpsFormatterZone=gpsZone;gpsFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:gpsZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',fractionalSecondDigits:3,hourCycle:'h23',timeZoneName:'longOffset'});}const precise=t=>gpsFormatter.format(new Date(t));
  $('ride-gps-clock').textContent=Number.isFinite(ctx.t)?'GPS target: '+precise(ctx.t)+(ctx.position?' · '+ctx.position.lat.toFixed(5)+', '+ctx.position.lon.toFixed(5):' · No GPS coverage'):'GPS target time unavailable';
  let lo=0,hi=pts.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(pts[mid].time<=ctx.t)lo=mid;else hi=mid-1;}const a=pts[lo],b=pts[lo+1];$('ride-gps-samples').textContent=ctx.position&&a?(a.time===ctx.t?'Recorded GPS sample (file time): '+precise(a.time-(ctx.gpsCorrection||0)*1000):'Interpolated between GPS samples (file times): '+precise(a.time-(ctx.gpsCorrection||0)*1000)+' → '+precise(b.time-(ctx.gpsCorrection||0)*1000)):'No GPS sample for this time.';
  if(route!==pts){route=pts;cancel();turns=RideInterest.turns(pts,ctx.gap);loaded=null;features=[];lastPlan=0;lastFetch=-Infinity;}
  if(!ctx.position){markerLayer.replaceChildren();return;}
  if(!$('ride-auto-zoom').checked)return;
  if(!stopped&&!busy&&(!loaded||loaded.radius!==radius()||RideInterest.distance(ctx.position,loaded)>loaded.radius*.35))lookup();
  const now=performance.now();if(!lastPlan||now-lastPlan>600){lastPlan=now;
   const result=RideInterest.plan(ctx.position,pts,[...turns,...(loaded?.features||[])],{target:clamp(Number($('ride-feature-count').value)||8,1,50),maxRadius:radius(),gap:ctx.gap});features=result.features;
   const map=ctx.map,r=stage.getBoundingClientRect(),renderer=map.cesium?'cesium':map.gl?'gl':'canvas',current=map.gl?.getZoom?.()??map.z;
   const max=RideProviders.providers[map.provider]?.max||18,wanted=Math.min(max-(renderer==='gl'?1:0),RideInterest.zoomForRadius(ctx.position.lat,result.radius,r.width,r.height,renderer));
   if(renderer==='canvas'){if(Math.round(wanted)!==current)map.zoom(Math.round(wanted)-current);}else if(Math.abs(wanted-current)>.2)map.zoom(clamp(wanted-current,-.7,.7));
   if(!busy&&!stopped)status((lookupError?'POI lookup: '+lookupError+' · ':'')+features.length+' / '+$('ride-feature-count').value+' target features · '+(loaded?'OSM POIs + junctions + route turns':'Route turns only; POI data unavailable')+' · search radius '+(radius()/1000)+' km');
  }
  if(now-lastDraw>90){lastDraw=now;drawMarkers();}
 };
 syncOffsetInputs();pip();window.rideNavigate.refresh();
})();
