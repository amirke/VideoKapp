// Cesium is a renderer. Imagery remains the selected base/overlay provider.
class RideCesiumMap extends RideMultiMap {
 configure(id,online,date) {
  this.cesium?.destroy();this.cesium=null;this.cesiumToken=(this.cesiumToken||0)+1;
  if(document.getElementById('ride-map-renderer')?.value!=='cesium'||!online)return super.configure(id,online,date);
  clearTimeout(this.glTimer);this.gl?.remove();this.gl=null;this.clearTiles();this.provider=id;this.online=online;this.date=date;this.mapError='';this.canvas.hidden=true;this.host.hidden=false;this.status('CesiumJS — loading terrain and imagery…');
  const token=this.cesiumToken;
  try {
   const C=globalThis.Cesium;if(!C)throw Error('CesiumJS is not loaded.');
   C.Ion.defaultAccessToken='';
   const viewer=this.cesium=new C.Viewer(this.host,{baseLayer:false,baseLayerPicker:false,geocoder:false,animation:false,timeline:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,selectionIndicator:false,infoBox:false,requestRenderMode:true,maximumRenderTimeChange:Infinity});
   this.cesiumLoading=true;this.layerKey=null;this.routeStamp=null;this.progressStamp=null;
   viewer.scene.renderError.addEventListener((_scene,error)=>{this.mapError='Cesium render error: '+error.message;this.status(this.mapError);});
   viewer.scene.globe.tileLoadProgressEvent.addEventListener(()=>{this.status(this.mapError||(this.cesiumLoading||!viewer.scene.globe.tilesLoaded?'CesiumJS — loading…':'CesiumJS — Ready'));});
   C.CesiumTerrainProvider.fromUrl('https://terrain.reearth.land/cesium-mesh/ellipsoid',{requestVertexNormals:true}).then(terrain=>{
    if(token!==this.cesiumToken)return;viewer.terrainProvider=terrain;this.cesiumLoading=false;this.setCesiumCamera();viewer.scene.requestRender();
   }).catch(error=>{if(token!==this.cesiumToken)return;this.cesiumLoading=false;this.mapError='Terrain failed: '+error.message;this.status(this.mapError);});
   viewer.screenSpaceEventHandler.setInputAction(click=>this.pickCesium(click.position),C.ScreenSpaceEventType.LEFT_CLICK);
   this.draw();this.fit();
  } catch(error){this.mapError='CesiumJS unavailable: '+error.message;this.status(this.mapError);}
 }
 imagery(id){
  const C=Cesium,p=RideProviders.providers[id],source=id==='reearth'?'satellite':id;
  let provider;
  if(source==='openfree'||p.labelStyle)provider={tileWidth:256,tileHeight:256,minimumLevel:0,maximumLevel:18,tilingScheme:new C.WebMercatorTilingScheme(),rectangle:C.Rectangle.fromDegrees(-180,-85.05112878,180,85.05112878),tileDiscardPolicy:undefined,errorEvent:new C.Event(),credit:new C.Credit(p.credits.map(x=>x[0]).join(' · ')),hasAlphaChannel:!!p.labelStyle,getTileCredits:()=>undefined,pickFeatures:()=>undefined,requestImage:(x,y,z)=>RideVectorTiles.tile(z,x,y,p.labelStyle||false)};
  else {const q=RideProviders.providers[source];provider=new C.UrlTemplateImageryProvider({url:RideProviders.tile(source,'{z}','{x}','{y}',this.date),maximumLevel:q.max,tilingScheme:new C.WebMercatorTilingScheme(),credit:p.credits.map(x=>x[0]).join(' · ')});}
  provider.errorEvent.addEventListener(error=>{this.mapError='Map layer failed: '+p.name+' — '+error.message;this.status(this.mapError);});return provider;
 }
 layers(){const overlay=this.overlaySettings(),labels=this.labelSettings(),key=this.provider+'|'+overlay.id+'|'+labels.id+'|'+this.date;if(key!==this.layerKey){this.cesium.imageryLayers.removeAll();this.cesium.imageryLayers.addImageryProvider(this.imagery(this.provider));if(overlay.enabled)this.cesium.imageryLayers.addImageryProvider(this.imagery(overlay.id));if(labels.enabled)this.cesium.imageryLayers.addImageryProvider(this.imagery(labels.id));this.layerKey=key;}if(overlay.enabled)this.cesium.imageryLayers.get(1).alpha=overlay.opacity;}
 setCesiumCamera(){if(!this.cesium)return;const C=Cesium,lon=this.center.x*360-180,lat=Math.atan(Math.sinh(Math.PI*(1-2*this.center.y)))*180/Math.PI;const range=40075016*Math.cos(lat*Math.PI/180)/2**this.z;const height=this.cesium.scene.globe.getHeight(C.Cartographic.fromDegrees(lon,lat))||0;this.cesium.camera.lookAt(C.Cartesian3.fromDegrees(lon,lat,height),new C.HeadingPitchRange(C.Math.toRadians(this.bearing||0),C.Math.toRadians(-90+Math.min(85,this.pitch||0)),Math.max(30,range)));this.cesium.camera.lookAtTransform(C.Matrix4.IDENTITY);this.cesium.scene.requestRender();}
 updateCamera(p,heading,follow,align){if(!this.cesium)return super.updateCamera(p,heading,follow,align);RideCanvasMap.prototype.updateCamera.call(this,p,heading,follow,align);if(follow&&p||align||this.cameraBearing!==this.bearing){this.setCesiumCamera();this.cameraBearing=this.bearing;}}
 setPitch(value){this.pitch=value;if(this.cesium)this.setCesiumCamera();else this.gl?.setPitch(Math.min(85,value));}
 fit(){if(!this.cesium)return super.fit();RideCanvasMap.prototype.fit.call(this);this.setCesiumCamera();}
 zoom(delta){if(!this.cesium)return super.zoom(delta);this.z=Math.max(0,Math.min(18,this.z+delta));this.setCesiumCamera();this.zoomStatus();}
 resize(){if(this.cesium)this.cesium.resize();else this.gl?.resize();}
 zoomStatus(){if(!this.cesium)return super.zoomStatus();this.syncZoomSlider(this.z,0,18,.1);const el=document.getElementById('ride-map-zoom');if(el)el.textContent='CesiumJS · requested view zoom '+this.z.toFixed(1)+' · camera height '+Math.round(this.cesium.camera.positionCartographic.height)+' m · source imagery limit '+(RideProviders.providers[this.provider].max??18)+' · perspective changes local scale.';}
 ready(){return !!this.cesium&&!this.cesiumLoading&&this.cesium.scene.globe.tilesLoaded&&!this.mapError;}
 async waitForTiles(timeout=30000){if(!this.cesium)return super.waitForTiles(timeout);const until=Date.now()+timeout;while(Date.now()<until){if(this.mapError)throw Error(this.mapError);if(this.ready())return;await new Promise(r=>setTimeout(r,100));}throw Error('Cesium map loading timed out. Refresh map.');}
 draw(){if(!this.cesium)return super.draw();const C=Cesium,v=this.cesium;this.layers();const style=this.routeStyle();
  const lines=(id,coords,color,show)=>{for(const e of [...v.entities.values])if(e.id.startsWith(id))v.entities.remove(e);if(show)coords.forEach((line,i)=>v.entities.add({id:id+i,polyline:{positions:C.Cartesian3.fromDegreesArray(line.flat()),width:id==='full-'?4:5,material:C.Color.fromCssColorString(color),clampToGround:true}}));};
  const full=JSON.stringify([style.full,style.color,this.progressGap]);if(this.routePoints!==this.points||this.routeStamp!==full){lines('full-',this.routeLines(),style.color,style.full);this.routePoints=this.points;this.routeStamp=full;}
  const stamp=JSON.stringify([Math.floor((this.progressTime??-1)/100),style.progress,style.progressColor,this.progressGap]);if(this.progressStamp!==stamp||this.cesiumPoints!==this.points){lines('progress-',this.routeLines(true),style.progressColor,style.progress);this.progressStamp=stamp;this.cesiumPoints=this.points;}
  let marker=v.entities.getById('position');if(!marker)marker=v.entities.add({id:'position',point:{pixelSize:14,color:C.Color.RED,outlineColor:C.Color.WHITE,outlineWidth:2,heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Infinity}});marker.show=!!this.marker;if(this.marker)marker.position=C.Cartesian3.fromDegrees(this.marker.lon,this.marker.lat);v.scene.requestRender();this.zoomStatus();
 }
 pickCesium(pos){const C=Cesium;let best;for(let i=0;i<this.points.length-1;i++){const a=this.points[i],b=this.points[i+1];if(a.group!==b.group||b.time-a.time>(this.progressGap||60)*1000)continue;const screen=p=>{const cart=C.Cartographic.fromDegrees(p.lon,p.lat);return C.SceneTransforms.worldToWindowCoordinates(this.cesium.scene,C.Cartesian3.fromDegrees(p.lon,p.lat,this.cesium.scene.globe.getHeight(cart)||0));};const p=screen(a),q=screen(b);if(!p||!q)continue;const dx=q.x-p.x,dy=q.y-p.y,k=Math.max(0,Math.min(1,((pos.x-p.x)*dx+(pos.y-p.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(pos.x-p.x-k*dx,pos.y-p.y-k*dy);if(d<24&&(!best||d<best.d))best={d,point:{...a,time:Number.isFinite(a.time)&&Number.isFinite(b.time)?a.time+k*(b.time-a.time):null}};}if(best)this.onPick(best.point);}
}
globalThis.RideMap=RideCesiumMap;
