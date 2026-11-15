const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),{JSDOM}=require('jsdom');
const I=require('../ride-interest.js'),F=require('../ride-features.cjs');
test('feature selection honors real route gaps and target radius',()=>{
 const route=[{lat:0,lon:0,time:0,group:0},{lat:0,lon:.01,time:10000,group:0},{lat:0,lon:.03,time:200000,group:0}];
 const poi=[{lat:0,lon:.005,id:'near'},{lat:0,lon:.02,id:'gap'},{lat:.1,lon:0,id:'far'}];
 const p=I.plan(route[0],route,poi,{target:1,maxRadius:5000,corridor:100});assert.deepEqual(p.features.map(f=>f.id),['near']);assert(p.radius<1000);
 assert.equal(I.plan(route[0],route,poi,{target:8,maxRadius:5000,corridor:100}).radius,5000);
 assert(I.zoomForRadius(32,500,800,500,'canvas')>I.zoomForRadius(32,5000,800,500,'canvas'));
});
test('OSM junction requires three connected neighbors, and incomplete result is rejected',()=>{
 const geometry=[{lat:0,lon:0},{lat:0,lon:1},{lat:1,lon:1}];const p=F.parseFeatures({elements:[{type:'node',id:8,lat:0,lon:0,tags:{tourism:'viewpoint'}},{tags:{highway:'road'},nodes:[1,2,3],geometry},{tags:{highway:'road'},nodes:[2,4],geometry:[geometry[1],{lat:2,lon:1}]}]});assert.equal(p.filter(f=>f.kind==='junction').length,1);assert.equal(p.filter(f=>f.kind==='poi').length,1);assert.throws(()=>F.parseFeatures({remark:'timeout'}),/incomplete/);
});
test('separate GPS/video timelines share absolute time; PiP moves the same map; gaps clear position',async()=>{
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,$=id=>w.document.getElementById(id);
 w.HTMLMediaElement.prototype.pause=function(){};w.HTMLMediaElement.prototype.load=function(){};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.api={cancelRideFeatures:()=>{}};
 try{
 w.eval(['ride-data.js','ride-providers.js','ride-map.js','ride-multimap.js','ride-time.js','ride-camera.js','ride-interest.js','ride-ui.js','ride-live.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n'));
 const t=Date.UTC(2026,8,11,4);const points=Array.from({length:2200},(_,i)=>({lat:32,lon:35+i*.0001,time:t+i*1000,group:0}));
 await w.applyAiRideState({video:{path:'test.mp4',url:'file:///test.mp4',duration:20},log:{segments:[{start:0,end:10,utcStart:t+30000,rate:1},{start:10,end:20,utcStart:t+90000,rate:1}]},route:{path:'route.gpx',points}});
 assert.equal($('ride-time').max,'20');assert.equal($('ride-gps-time').max,'2199');assert.equal(Number($('ride-gps-time').value),30);
 $('ride-time').value=12;$('ride-time').oninput();assert.equal(Number($('ride-gps-time').value),92);assert.match($('ride-clock').textContent,/Selected GPS − video clock: 0.0 s/);
 $('ride-gps-time').value=5;$('ride-gps-time').oninput();assert.equal($('ride-video').hidden,true);assert.match($('ride-status').textContent,/No video/);
 $('ride-gps-time').value=35;$('ride-gps-time').oninput();assert.equal($('ride-video').currentTime,5);assert.equal($('ride-video').hidden,false);
 $('ride-live-offset').value=15;$('ride-live-offset').onchange();assert.equal(Number($('ride-offset').value),900);assert.equal(Number($('ride-gps-time').value),935);assert.equal($('ride-video').currentTime,5);assert.match($('ride-sync-preview').textContent,/Applied offset: 15 min 0 s/);$('ride-offset-plus').onclick();assert.equal(Number($('ride-offset').value),1800);$('ride-offset-minus').onclick();assert.equal(Number($('ride-offset').value),900);$('ride-live-offset').value=1;$('ride-live-offset').onchange();assert.equal(Number($('ride-offset').value),900);$('ride-offset-zero').onclick();assert.equal(Number($('ride-gps-time').value),35);
 $('ride-fine-offset').value=7;$('ride-fine-offset').onchange();assert.equal(Number($('ride-offset').value),7);assert.equal(Number($('ride-gps-time').value),42);$('ride-second-minus').onclick();assert.equal(Number($('ride-offset').value),6);assert.match($('ride-gps-clock').textContent,/GPS target:.*GMT/);assert.match($('ride-gps-samples').textContent,/Recorded GPS sample \(file time\):/);$('ride-offset-plus').onclick();assert.equal(Number($('ride-offset').value),906);assert.equal(Number($('ride-fine-offset').value),6);$('ride-offset-zero').onclick();
 $('ride-video').currentTime=5.5;$('ride-video').onseeked();assert.match($('ride-gps-clock').textContent,/\.500/);assert.match($('ride-gps-samples').textContent,/Interpolated between GPS samples/);
 const stage=w.document.querySelector('.ride-map-stage');$('ride-live-pip').checked=true;$('ride-live-pip').onchange();assert.equal(stage.parentNode.className,'ride-live-box');$('ride-live-pip').checked=false;$('ride-live-pip').onchange();assert.equal(stage.parentNode.className,'ride-map-pane');
 assert($('ride-map-follow').checked);assert($('ride-map-align').checked);
 }finally{w.close();}
});

test('camera smoothing uses shortest heading turn and resets when seeking backwards',()=>{const {Filter}=require('../ride-camera.js'),f=new Filter();f.update({lat:32,lon:35},359,10000,0,2);const r=f.update({lat:32.001,lon:35.001},9,11000,1000,2);assert(r.position.lat>32&&r.position.lat<32.001);assert(r.heading<9||r.heading>359);const back=f.update({lat:31,lon:34},90,0,1100,2);assert.equal(back.position.lat,31);assert.equal(back.heading,90);const direct=f.update({lat:30,lon:33},180,1000,1200,0);assert.equal(direct.position.lat,30);assert.equal(direct.heading,180);});
