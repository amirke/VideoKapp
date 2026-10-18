// SPDX-License-Identifier: GPL-2.0-only
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const suffix='.timeline.json';
async function identity(file){const h=await fs.open(file,'r');try{const stat=await h.stat(),n=Math.min(stat.size,65536),a=Buffer.alloc(n),b=Buffer.alloc(n);await h.read(a,0,n,0);await h.read(b,0,n,Math.max(0,stat.size-n));return {bytes:stat.size,edgeSha256:crypto.createHash('sha256').update(a).update(b).digest('hex')};}finally{await h.close();}}
function validate(log){
 if(log?.application!=='ChronoMerge timeline'||log.version!==1||!Array.isArray(log.segments)||!log.segments.length||log.segments.length>100000)throw Error('Choose a ChronoMerge .timeline.json LOG, not a performance report.');
 let last=0;for(const s of log.segments){if(!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<last-.001||s.end<=s.start||!Number.isFinite(s.rate)||s.rate<=0||s.rate>10000||!(s.utcStart===null||(Number.isFinite(s.utcStart)&&Math.abs(s.utcStart)<8000000000000000)))throw Error('Invalid timeline segments.');last=s.end;}
 return log;
}
async function read(file){if((await fs.stat(file)).size>20000000)throw Error('Timeline LOG is too large.');return validate(JSON.parse(await fs.readFile(file,'utf8')));}
async function verify(log,file){const id=await identity(file);if(id.bytes!==log.output?.bytes||id.edgeSha256!==log.output?.edgeSha256)throw Error('The LOG belongs to a different or modified video. Choose its matching video and LOG.');}
async function sourceSegments(file){
 try{const log=await read(file.path+suffix);await verify(log,file.path);return log.segments;}catch(e){if(e.code!=='ENOENT')return [{start:0,end:file.duration,utcStart:null,rate:1,source:file.path,note:'Source LOG could not be verified: '+e.message}];}
 return [{start:0,end:file.duration,utcStart:Number.isFinite(file.recorded)?file.recorded:null,rate:1,source:file.path,sourceElapsed:0,sourceTiming:{recorded:file.recorded,duration:file.duration,filesystemCreated:file.created,filesystemModified:file.modified,format:file.metadata?.format,streams:file.metadata?.streams},note:Number.isFinite(file.recorded)?'Source recording metadata':'Recording time missing; not inferred from filesystem dates'}];
}
function transform(segments,start,end,speed=1){const out=[];for(const s of segments){const a=Math.max(s.start,start),b=Math.min(s.end,end);if(b<=a)continue;out.push({...s,sourceElapsed:(s.sourceElapsed||0)+(a-s.start)*s.rate,start:(a-start)/speed,end:(b-start)/speed,utcStart:s.utcStart===null?null:s.utcStart+(a-s.start)*s.rate*1000,rate:s.rate*speed});}return out;}
async function build(files,plan={}){let cursor=0,segments=[];for(const f of files){for(const s of await sourceSegments(f))segments.push({...s,start:s.start+cursor,end:s.end+cursor});cursor+=f.duration;}const start=plan.start||0,end=Math.min(cursor,start+(plan.duration||Infinity));return transform(segments,start,end,plan.speed||plan.copySpeed||1);}
async function save(output,segments,destination=output+suffix){const log={application:'ChronoMerge timeline',version:1,createdAt:new Date().toISOString(),timing:'UTC milliseconds; source metadata plus container-duration boundaries. Packet rounding can cause small boundary differences. Clock correction is applied only in the player.',output:{name:path.basename(output),...await identity(output)},segments:segments.map(s=>({...s,utcStartIso:s.utcStart===null?null:new Date(s.utcStart).toISOString(),utcEndIso:s.utcStart===null?null:new Date(s.utcStart+(s.end-s.start)*s.rate*1000).toISOString()}))};validate(log);const file=destination;await fs.writeFile(file,JSON.stringify(log,null,2),{flag:'wx'});return {path:file,log};}
module.exports={suffix,identity,validate,read,verify,sourceSegments,transform,build,save};
