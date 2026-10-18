// SPDX-License-Identifier: GPL-2.0-only
const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
const {run,binary,inspect,merge}=require('./engine.cjs');
function finite(value,min,max,name){const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw new Error(`${name} must be between ${min} and ${max}.`);return n;}
function boundaries(cuts,duration,minScene=1){
 const times=[0];for(const t of cuts.filter(Number.isFinite).sort((a,b)=>a-b))if(t-times.at(-1)>=minScene&&duration-t>=minScene)times.push(t);
 times.push(duration);return times.slice(0,-1).map((start,i)=>({scene:i+1,start,end:times[i+1]}));
}
async function detect(file,{threshold=.3,minScene=2,signal,onProgress=()=>{}}={}){
 threshold=finite(threshold,.01,.95,'Scene threshold');minScene=finite(minScene,.25,60,'Minimum scene length');
 const before=await fs.stat(file.path);if(before.size!==file.size||before.mtimeMs!==file.modified)throw new Error('Source changed. Choose it again.');
 const cuts=[];let buffer='',frameTime=0,lastProgress=-1;
 await run(binary('ffmpeg'),['-hide_banner','-loglevel','error','-nostdin','-nostats','-progress','pipe:1','-i',file.path,'-an','-vf',`fps=3,scale=320:-2,select='gte(scene,0)',metadata=print:file=-`,'-fps_mode','vfr','-f','null','-'],{signal,progress:chunk=>{
  buffer+=chunk;const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){const match=/pts_time:([\d.]+)/.exec(line);if(match){frameTime=Number(match[1]);const p=Math.min(.99,frameTime/file.duration);if(p-lastProgress>=.005){onProgress(p);lastProgress=p;}}const score=/^lavfi\.scene_score=([\d.eE+-]+)/.exec(line);if(score&&Number(score[1])>threshold&&cuts.length<2001)cuts.push(frameTime);}
 }});
 if(cuts.length>2000)throw new Error('More than 2000 cuts detected. Increase the scene threshold and analyze again.');
 onProgress(1);return {scenes:boundaries(cuts,file.duration,minScene),threshold,minScene,sampleFps:3,method:'Visual frame changes at 3 FPS / 320 px; no semantic AI ranking.'};
}
function propose(scenes,{target=120,clipLength=6}={}){
 target=finite(target,1,1800,'Target duration');clipLength=finite(clipLength,1,30,'Clip length');
 if(!Array.isArray(scenes)||!scenes.length)throw new Error('Detect scenes first.');
 const full=scenes.reduce((sum,s)=>sum+s.end-s.start,0),candidates=[];
 for(const scene of scenes){const count=target>=full?1:Math.max(1,Math.ceil((scene.end-scene.start)/Math.max(30,clipLength*4)));for(let i=0;i<count;i++){const start=scene.start+(scene.end-scene.start)*i/count,end=scene.start+(scene.end-scene.start)*(i+1)/count;candidates.push({...scene,section:i+1,rangeStart:start,rangeEnd:end});}}
 if(candidates.length>2000)throw new Error('Too many review rows. Use a shorter source.');
 const n=Math.min(candidates.length,Math.max(1,Math.ceil(target/clipLength))),indices=new Set();
 for(let i=0;i<n;i++)indices.add(n===1?Math.floor(candidates.length/2):Math.round(i*(candidates.length-1)/(n-1)));
 let remaining=Math.min(target,full);
 return candidates.map((c,i)=>{const selected=indices.has(i),length=target>=full?c.rangeEnd-c.rangeStart:Math.min(clipLength,c.rangeEnd-c.rangeStart,selected?remaining:clipLength),start=c.rangeStart+(c.rangeEnd-c.rangeStart-length)/2;if(selected)remaining-=length;return {id:i+1,scene:c.scene,section:c.section,rangeStart:c.rangeStart,rangeEnd:c.rangeEnd,start:Number(start.toFixed(3)),end:Number((start+length).toFixed(3)),selected:selected&&length>.01};});
}
function approvedClips(rows,duration){
 if(!Array.isArray(rows)||rows.length>2000)throw new Error('Invalid summary selection.');
 const clips=rows.filter(r=>r.selected===true).map(r=>({start:finite(r.start,0,duration,'Clip start'),end:finite(r.end,0,duration,'Clip end')})).sort((a,b)=>a.start-b.start);
 if(!clips.length||clips.length>200)throw new Error('Select between 1 and 200 clips.');
 clips.forEach((r,i)=>{if(r.end-r.start<.1)throw new Error('Each clip must be at least 0.1 seconds.');if(i&&r.start<clips[i-1].end-.001)throw new Error('Selected clips overlap. Adjust their start/end times.');});return clips;
}
async function keyframes(file,{signal,onProgress=()=>{}}={}){
 const times=[0];let buffer='',lastProgress=-1;await run(binary('ffprobe'),['-v','error','-select_streams','v:0','-show_packets','-show_entries','packet=pts_time,flags','-of','csv=p=0',file.path],{signal,progress:chunk=>{buffer+=chunk;const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){const [pts,flags]=line.trim().split(',');const n=Number(pts);if(Number.isFinite(n)){if(flags?.includes('K')&&n>0&&n<file.duration)times.push(n);const p=Math.min(.99,n/file.duration);if(p-lastProgress>=.005){onProgress(p);lastProgress=p;}}}}});onProgress(1);return [...new Set(times)].sort((a,b)=>a-b).concat(file.duration);
}
function alignCuts(rows,duration,keys){
 const requested=approvedClips(rows,duration),out=[];
 for(const clip of requested){let start=0,end=duration;for(const k of keys){if(k<=clip.start+.001)start=k;if(k>=clip.end-.001){end=k;break;}}if(out.length&&start<=out.at(-1).end+.001)out.at(-1).end=Math.max(end,out.at(-1).end);else out.push({start,end});}
 return out.map((c,i)=>({...c,id:i+1,scene:i+1,section:1,selected:true}));
}
async function exportSummary(file,rows,output,{signal,onProgress=()=>{},crf=20,quality='encode',keys}={}){
 let clips=approvedClips(rows,file.duration);if(!['encode','copy'].includes(quality))throw new Error('Invalid summary quality mode.');
 if(quality==='copy'){const snapped=alignCuts(rows,file.duration,keys||await keyframes(file,{signal}));if(snapped.length!==clips.length||snapped.some((r,i)=>Math.abs(r.start-clips[i].start)>.001||Math.abs(r.end-clips[i].end)>.001))throw new Error('Align cuts for original quality, review them and approve again.');}else{crf=finite(crf,1,51,'CRF');if(!Number.isInteger(crf))throw new Error('CRF must be a whole number.');}
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'chronomerge-summary-')),parts=[],started=Date.now();
 try{
  for(const [i,clip]of clips.entries()){
   if(signal?.aborted)throw new Error('Operation cancelled.');
   const part=path.join(root,`${i}.mp4`);
   await merge([file],part,{signal,compression:quality==='copy'?{enabled:false,operation:'convert'}:{enabled:true,operation:'convert',codec:'libx264',preset:'fast',crf,start:clip.start,duration:clip.end-clip.start,audio:'aac',fps:0},copyRange:quality==='copy'?{start:clip.start,duration:clip.end-clip.start}:undefined,onProgress:p=>onProgress(.9*(i+p)/clips.length)});
   parts.push(await inspect(part,signal));
  }
  const result=await merge(parts,output,{signal,compression:parts.length===1?{operation:'convert',enabled:false}:undefined,onProgress:p=>onProgress(.9+.1*p)});
  result.diagnostics.summary={source:file.path,clips,crf:quality==='copy'?null:crf,quality,codec:quality==='copy'?'source codec':'H.264',fps:file.metadata.streams.find(s=>s.codec_type==='video')?.avg_frame_rate || 'source',audio:quality==='copy'?'source audio':'AAC',encoding:quality==='copy'?'Original video/audio packets copied; keyframe-aligned cuts, no re-encoding':'Each selected clip encoded once; final join stream copy',totalMs:Date.now()-started};
  result.diagnostics.mode='approved-summary';return result;
 }finally{
  const absolute=path.resolve(root),base=path.resolve(os.tmpdir());if(path.dirname(absolute)===base&&path.basename(absolute).startsWith('chronomerge-summary-'))await fs.rm(absolute,{recursive:true,force:true});
 }
}
module.exports={detect,boundaries,propose,approvedClips,exportSummary,keyframes,alignCuts};
