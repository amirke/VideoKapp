// SPDX-License-Identifier: GPL-2.0-only
const fs=require('node:fs/promises'),timeline=require('./timeline.cjs');
module.exports=function(c){
 let files=[],video=null,destination=null,created=null;
 const idle=()=>{if(c.getTask())throw Error('Wait for the current operation to finish.');};
 const view=()=>({files,video,destination});
 const filter=[{name:'Video',extensions:['mp4','mov','mkv','m4v','avi','mts','m2ts','webm']}];
 async function reading(work){idle();c.setTask(new AbortController());try{return await work(c.getTask().signal);}finally{c.setTask(null);}}
 c.handle('order-log-files',()=>reading(async signal=>{const r=await c.dialog.showOpenDialog(c.getWindow(),{title:'Choose original clips for the order LOG',properties:['openFile','multiSelections'],filters:filter});if(r.canceled)return null;const errors=[],added=[];for(const [i,p]of r.filePaths.entries()){if(signal.aborted)break;c.event('status',{text:`Reading order LOG source ${i+1}/${r.filePaths.length}`,progress:i/r.filePaths.length});try{const f=await c.inspect(p,signal);const existing=files.find(x=>x.path.toLowerCase()===f.path.toLowerCase());if(!existing)files.push(f);added.push(existing||f);}catch(e){errors.push(e.message);}}return {...view(),errors,added};}));
 c.handle('order-log-video',()=>reading(async signal=>{const r=await c.dialog.showOpenDialog(c.getWindow(),{title:'Choose the existing merged video (read only)',properties:['openFile'],filters:filter});if(r.canceled)return null;video=await c.inspect(r.filePaths[0],signal);destination=video.path+timeline.suffix;return view();}));
 c.handle('order-log-destination',async()=>{idle();if(!video)throw Error('Choose the existing merged video first.');const r=await c.dialog.showSaveDialog(c.getWindow(),{title:'Save order LOG only',defaultPath:destination,filters:[{name:'Timeline LOG',extensions:['json']}]});if(!r.canceled)destination=r.filePath;return view();});
 c.handle('order-log-use-ride',()=>{idle();const f=c.getRideVideo();if(!f)throw Error('Choose a video in Ride Player first.');video=f;destination=f.path+timeline.suffix;return view();});
 c.handle('order-log-clear',()=>{idle();files=[];return view();});
 c.handle('order-log-create',(ids,approved)=>reading(async signal=>{
  if(!video||!destination||approved!==true)throw Error('Choose the existing video and confirm the clip order.');
  if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw Error('Choose original clips in their exact merge order.');
  const selected=ids.map(id=>{const f=files.find(x=>x.id===id);if(!f)throw Error('Unknown source clip. Choose it again.');return f;});
  for(const f of [video,...selected]){const s=await fs.stat(f.path);if(s.size!==f.size||s.mtimeMs!==f.modified)throw Error('A video changed since selection. Choose it again.');}
  const duration=selected.reduce((s,f)=>s+f.duration,0);if(Math.abs(duration-video.duration)>.25+selected.length*.05)throw Error('Durations do not match. This action supports normal-speed, untrimmed merges only.');
  if(signal.aborted)throw Error('Cancelled.');let result;try{result=await timeline.save(video.path,await timeline.build(selected),destination);}catch(e){if(e.code==='EEXIST')throw Error('LOG already exists. Choose another LOG output name.');throw e;}
  created={video,path:result.path,log:result.log};
  return {...view(),created:result.path,missingTimes:result.log.segments.filter(s=>s.utcStart===null).length};
 }));
 return {getCreated:()=>created};
};
