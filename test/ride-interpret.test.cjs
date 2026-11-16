const {test}=require('node:test'),assert=require('node:assert/strict'),T=require('../ride-time.js'),timeline=require('../timeline.cjs');
test('local filename and metadata interpretations preserve source and apply zone once',()=>{const source={segments:[{start:0,end:30,utcStart:Date.parse('2026-09-11T07:38:33Z'),rate:1,source:'20260911073803_000024.MP4'}]},before=JSON.stringify(source);for(const mode of ['filename','local-end']){const r=T.interpret(source,mode,'Asia/Jerusalem');assert.equal(T.wall(r.segments[0].utcStart,'Asia/Jerusalem'),'2026-09-11T07:38:03');assert.equal(JSON.stringify(source),before);assert.deepEqual(T.interpret(source,mode,'Asia/Jerusalem'),r);}assert.equal(T.interpret(source,'absolute','Asia/Jerusalem').segments[0].utcStart,source.segments[0].utcStart);assert.throws(()=>T.interpret({segments:[{...source.segments[0],source:'no-date.mp4'}]},'filename','utc'),/No YYYY/);});
test('trim offset and acceleration preserve filename-based recording time',()=>{const segments=timeline.transform([{start:0,end:30,utcStart:Date.parse('2026-09-11T07:38:03Z'),rate:1,source:'20260911073803_000024.MP4',sourceElapsed:0}],5,25,2);const r=T.interpret({segments},'filename','Asia/Jerusalem');assert.equal(T.wall(r.segments[0].utcStart,'Asia/Jerusalem'),'2026-09-11T07:38:08');assert.equal(r.segments[0].rate,2);});

test('auto end-time evidence preserves originals and applies trim and zone once',async()=>{
 const raw=Date.parse('2026-11-13T11:51:47Z'),source='20261113114648_000185.MP4';
 const file={path:require('node:path').join(require('node:os').tmpdir(),'missing-timeline-'+process.pid,source),duration:300,recorded:raw};
 const segments=await timeline.sourceSegments(file);assert.equal(segments[0].utcStart,null);assert.equal(segments[0].sourceTiming.recorded,raw);assert.equal(segments[0].timingDecision.basis,'camera-wall-end');
 const before=JSON.stringify(segments),r=T.interpret({segments},'auto','Asia/Jerusalem');assert.equal(T.wall(r.segments[0].utcStart,'Asia/Jerusalem'),'2026-11-13T11:46:47');assert.equal(JSON.stringify(segments),before);
 const trimmed=timeline.transform(segments,10,30,2),a=T.interpret({segments:trimmed},'auto','Asia/Jerusalem');assert.equal(T.wall(a.segments[0].utcStart,'Asia/Jerusalem'),'2026-11-13T11:46:57');assert.equal(a.segments[0].rate,2);assert.deepEqual(T.interpret(a,'auto','Asia/Jerusalem'),a);
 const legacy={segments:[{...segments[0],utcStart:raw}]};assert.equal(T.interpret(legacy,'auto','Asia/Jerusalem').segments[0].utcStart,r.segments[0].utcStart);assert.equal(T.interpret({segments},'local-end','Asia/Jerusalem').segments[0].utcStart,r.segments[0].utcStart);
});
test('auto does not subtract duration for start timestamps, ambiguous zones or explicit capture dates',()=>{
 const raw=Date.parse('2026-11-13T11:46:48Z'),base={start:0,end:300,utcStart:raw,rate:1,source:'20261113114648_000185.MP4',sourceTiming:{recorded:raw,duration:300}};
 assert.equal(T.interpret({segments:[base]},'auto','Asia/Jerusalem').segments[0].utcStart,raw);
 const ambiguous={...base,sourceTiming:{recorded:raw+7200000,duration:7200}};assert.equal(T.evidence(ambiguous).basis,'metadata');
 const explicit={...base,sourceTiming:{recorded:raw+300000,duration:300,format:{tags:{'com.apple.quicktime.creationdate':'2026-11-13T11:46:48+0200'}}}};assert.equal(T.evidence(explicit).basis,'metadata');
});
