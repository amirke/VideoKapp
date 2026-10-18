// SPDX-License-Identifier: GPL-2.0-only
(function(root){
const osm='https://www.openstreetmap.org/copyright',eox='https://maps.eox.at/';
const satellite='https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg';
const providers={
 overlay:{name:'EOX transparent labels / roads',url:'https://tiles.maps.eox.at/wmts/1.0.0/overlay_bright_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.png',max:14,credits:[['© OpenStreetMap contributors',osm],['Overlay rendering © EOX and MapServer',eox]],note:'Transparent reference overlay. Shared public service.'},
 osm:{name:'OpenStreetMap',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',max:19,credits:[['© OpenStreetMap contributors',osm]],note:'Street map. Shared service; visible tiles only.'},
 opentopo:{name:'OpenTopoMap',url:'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',max:17,credits:[['© OpenStreetMap contributors',osm],['SRTM · © OpenTopoMap (CC BY-SA)', 'https://opentopomap.org/about']],note:'Topographic map with contour lines. Shared service.'},
 cyclosm:{name:'CyclOSM',url:'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',max:20,credits:[['© OpenStreetMap contributors',osm],['CyclOSM · OpenStreetMap France','https://www.cyclosm.org/']],note:'Cycling routes, lanes and road surfaces.'},
 satellite:{name:'EOX Sentinel-2 Cloudless 2024',url:satellite,max:14,credits:[['Sentinel-2 cloudless by EOX · modified Copernicus Sentinel data 2024 (CC BY-NC-SA 4.0)','https://cloudless.eox.at/pricing']],note:'Free for noncommercial use with attribution/share-alike. Satellite mosaic, not imagery from the ride date. Shared service may throttle.'},
 eox:{name:'EOX Terrain',url:'https://tiles.maps.eox.at/wmts/1.0.0/terrain-light_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',max:13,credits:[['© OpenStreetMap contributors',osm],['Terrain Light · Rendering © EOX · data credits',eox+'#data']],note:'Terrain shading and geographic context. Shared service may throttle.'},
 nasa:{name:'NASA GIBS — MODIS True Color',url:'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpeg',max:9,credits:[['NASA EOSDIS GIBS · MODIS Terra','https://www.earthdata.nasa.gov/engage/open-data-services-and-software/data-services/global-imagery-browse-services-gibs']],note:'Choose imagery date (UTC). Clouds/missing coverage are possible. Regional resolution; zooming in cannot reveal road detail.'},
 openfree:{name:'OpenFreeMap — Liberty',vector:true,credits:[['OpenFreeMap','https://openfreemap.org/'],['© OpenMapTiles','https://openmaptiles.org/'],['© OpenStreetMap contributors',osm]],note:'Vector streets. Requires WebGL; no account or API key.'},
 reearth:{name:'Re:Earth — 3D terrain + EOX satellite',vector:true,credits:[['Re:Earth Terrain','https://terrain.reearth.land/'],['Mapterhorn (CC BY 4.0)','https://mapterhorn.com/'],['EGM2008 (NGA)','https://earth-info.nga.mil/'],['EOX Sentinel-2 cloudless 2024 (CC BY-NC-SA 4.0)','https://cloudless.eox.at/pricing']],note:'Tilted 3D terrain with satellite imagery. Shift-drag to rotate/tilt. Requires WebGL. EOX imagery is free for noncommercial use.'}
};
function tile(id,z,x,y,date){return providers[id].url.replace('{z}',z).replace('{x}',x).replace('{y}',y).replace('{date}',/^\d{4}-\d{2}-\d{2}$/.test(date||'')?date:'default');}
const api={providers,tile};if(typeof module!=='undefined')module.exports=api;else root.RideProviders=api;
})(globalThis);
