// Live map uses the same map and absolute playback clock as Ride Player.
(()=>{
 const $=id=>document.getElementById(id),v=$('ride-video'),stage=document.querySelector('.ride-map-stage'),home=stage.parentNode;
 const controls=$('ride-live-controls');
 const wrap=document.createElement('div');wrap.className='ride-live-stage';v.before(wrap);wrap.append(v);
 const box=document.createElement('div');box.className='ride-live-box';box.hidden=true;box.innerHTML='<div class="ride-live-handle">GPS map — drag to move</div>';wrap.append(box);
 const markerLayer=document.createElement('div');markerLayer.className='ride-interest-layer';stage.append(markerLayer);
 let ctx=null,route=null,turns=[],loaded=null,features=[],busy=false,generation=0,lastFetch=-Infinity,lastPlan=0,lastDraw=0,stopped=false,lookupError='';
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
 function pip(){const enabled=$('ride-live-pip').checked;box.hidden=!enabled;$('ride-view').classList.toggle('live-pip-active',enabled);if(enabled)box.append(stage);else home.insertBefore(stage,controls.nextSibling);box.style.width=$('ride-live-width').value+'%';requestAnimationFrame(()=>window.resizeRideMap?.());}
 $('ride-live-pip').onchange=pip;$('ride-live-width').oninput=pip;
 const handle=box.firstElementChild;handle.onpointerdown=e=>{e.preventDefault();handle.setPointerCapture(e.pointerId);const origin=box.getBoundingClientRect(),bounds=wrap.getBoundingClientRect(),dx=e.clientX-origin.left,dy=e.clientY-origin.top;handle.onpointermove=ev=>{box.style.right='auto';box.style.left=clamp(ev.clientX-bounds.left-dx,0,Math.max(0,bounds.width-box.offsetWidth))+'px';box.style.top=clamp(ev.clientY-bounds.top-dy,0,Math.max(0,bounds.height-box.offsetHeight))+'px';};handle.onpointerup=()=>handle.onpointermove=null;handle.onpointercancel=()=>handle.onpointermove=null;};
 if(window.ResizeObserver)new ResizeObserver(()=>window.resizeRideMap?.()).observe(box);
 $('ride-gps-play').onclick=()=>window.rideNavigate.play('activity');
 $('ride-gps-time').oninput=()=>{if(ctx?.points.length)window.rideNavigate.seek(ctx.points[0].time+Number($('ride-gps-time').value)*1000);};
 $('ride-feature-refresh').onclick=()=>{stopped=false;return lookup(true);};
 $('ride-feature-stop').onclick=()=>{stopped=true;cancel();status('Feature lookup stopped.');};
 for(const id of ['ride-auto-zoom','ride-feature-count','ride-feature-radius'])$(id).onchange=()=>{stopped=false;lastPlan=0;if(!$('ride-auto-zoom').checked){cancel();features=[];markerLayer.replaceChildren();}else window.rideNavigate.refresh();};
 window.rideLiveSettings={get:()=>Object.fromEntries(['ride-live-pip','ride-live-width','ride-auto-zoom','ride-feature-count','ride-feature-radius','ride-north-up','ride-show-north','ride-camera-filter','ride-camera-smoothing'].map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value])),set:values=>{for(const [id,value]of Object.entries(values||{})){if(!['ride-live-pip','ride-live-width','ride-auto-zoom','ride-feature-count','ride-feature-radius','ride-north-up','ride-show-north','ride-camera-filter','ride-camera-smoothing'].includes(id))continue;const e=$(id);if(e.type==='checkbox')e.checked=value===true;else if(Number.isFinite(Number(value)))e.value=clamp(Number(value),Number(e.min),Number(e.max));}pip();lastPlan=0;}};
 const refresh=window.refreshRideMapSettings;window.refreshRideMapSettings=()=>{refresh?.();pip();lastPlan=0;window.rideNavigate.refresh();};
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
  ctx=next;const pts=ctx.points,slider=$('ride-gps-time');slider.disabled=pts.length<2;$('ride-gps-play').disabled=pts.length<2;slider.max=pts.length?(pts.at(-1).time-pts[0].time)/1000:0;slider.value=pts.length&&Number.isFinite(ctx.t)?clamp((ctx.t-pts[0].time)/1000,0,Number(slider.max)):0;
  $('ride-gps-play').textContent=window.rideNavigate.playing()?'⏸':'▶';
  $('ride-gps-clock').textContent=ctx.position?'GPS: '+new Date(ctx.t).toLocaleString('en-GB',{timeZone:RideTime.zone($('ride-gps-zone').value)})+' · '+ctx.position.lat.toFixed(5)+', '+ctx.position.lon.toFixed(5):'No GPS position at this video time';
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
 pip();window.rideNavigate.refresh();
})();
