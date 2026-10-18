// SPDX-License-Identifier: GPL-2.0-only
const path=require('node:path');const {pathToFileURL}=require('node:url');const {merge}=require('./engine.cjs');const scenes=require('./scenes.cjs');const {saveReport}=require('./report.cjs');const {createSampler}=require('./metrics.cjs');
module.exports=function register(c){
 let specificFile=null,specificOutput=null,sceneFile=null,sceneOutput=null,analysis=null,keys=null;
 const fileView=f=>f?{...f,url:pathToFileURL(f.path).href}:null;
 const idle=()=>{if(c.getTask())throw new Error('Wait for the current operation to finish.');};
 async function tracked(text,work){idle();c.setTask(new AbortController());const sample=createSampler(),timer=setInterval(()=>c.event('metrics',{...sample(),active:true}),1000);c.event('metrics',{...sample(),active:true});c.event('status',{text,progress:0});try{return await work(c.getTask().signal,p=>c.event('status',{text,progress:p}),sample);}finally{clearInterval(timer);c.event('metrics',{...sample(),active:false});c.setTask(null);}}
 async function choose(kind){return tracked('Reading video details…',async signal=>{const r=await c.dialog.showOpenDialog(c.getWindow(),{title:kind==='specific'?'Choose specific file to convert':'Choose video for scene detection and summary',properties:['openFile'],filters:[{name:'Video',extensions:['mp4','mov','mkv','m4v','avi','mts','m2ts','webm']}]});if(r.canceled)return null;const f=await c.inspect(r.filePaths[0],signal);if(kind==='specific'){specificFile=f;specificOutput=null;}else{sceneFile=f;analysis=null;keys=null;sceneOutput=null;}return fileView(f);});}
 async function destination(kind,container){idle();const file=kind==='specific'?specificFile:sceneFile;if(!file)throw new Error('Choose a source file in this section first.');const ext=kind==='scene'?'mp4':['mp4','mov','mkv'].includes(container)?container:'mp4';const previous=kind==='specific'?specificOutput:sceneOutput;const r=await c.dialog.showSaveDialog(c.getWindow(),{title:kind==='specific'?'Save converted file':'Save approved summary',defaultPath:previous||path.join(path.dirname(file.path),path.parse(file.name).name+(kind==='specific'?'_converted.':'_summary.')+ext),filters:[{name:'Video',extensions:kind==='scene'?['mp4']:[ext,...['mp4','mov','mkv'].filter(e=>e!==ext)]}]});if(!r.canceled){if(kind==='specific')specificOutput=r.filePath;else sceneOutput=r.filePath;}return kind==='specific'?specificOutput:sceneOutput;}
 async function withReport(file,output,work,sample){let result,error;try{result=await work();c.setOutput(result.path);return result;}catch(e){error=e;throw e;}finally{const report=await saveReport({files:[file],output,result,error,metrics:sample()});c.setReport(report.text);c.event('report',report);}}
 c.handle('choose-specific',()=>choose('specific'));
 c.handle('specific-destination',container=>destination('specific',container));
 c.handle('convert-specific',options=>tracked('Converting specific file…',async(signal,onProgress,sample)=>{if(!specificFile||!specificOutput)throw new Error('Choose a specific source and output in this section.');return withReport(specificFile,specificOutput,()=>merge([specificFile],specificOutput,{signal,onProgress,compression:options?.preserveOriginal?{enabled:false,operation:'convert'}:{...options,enabled:true,operation:'convert'}}),sample);}));
 c.handle('choose-scenes',()=>choose('scene'));
 c.handle('scene-destination',()=>destination('scene'));
 c.handle('detect-scenes',options=>tracked('Detecting scene changes…',async(signal,onProgress)=>{if(!sceneFile)throw new Error('Choose a source video for scene detection.');analysis=null;analysis=await scenes.detect(sceneFile,{...options,signal,onProgress});return {...analysis,proposal:scenes.propose(analysis.scenes,options)};}));
 c.handle('propose-summary',options=>{idle();if(!analysis)throw new Error('Detect scenes first.');return scenes.propose(analysis.scenes,options);});
 c.handle('align-summary',options=>tracked('Finding original-quality cut points…',async(signal,onProgress)=>{if(!sceneFile)throw new Error('Choose a summary source.');keys=keys||await scenes.keyframes(sceneFile,{signal,onProgress});return scenes.alignCuts(options.rows,sceneFile.duration,keys);}));
 c.handle('export-timelapse',options=>tracked('Rendering full-video time-lapse…',async(signal,onProgress,sample)=>{
  if(!sceneFile||!sceneOutput)throw new Error('Choose a source and output in this section.');if(options?.approved!==true)throw new Error('Approve the time-lapse before exporting.');const seconds=Number(options.minutes)*60;if(!Number.isFinite(seconds)||seconds<.6||seconds>sceneFile.duration)throw new Error('Target must be at least 0.01 minutes and no longer than the source.');
  return withReport(sceneFile,sceneOutput,()=>merge([sceneFile],sceneOutput,{signal,onProgress,compression:options.reencode===true?{enabled:true,operation:'convert',codec:'libx264',preset:'fast',crf:options.crf??18,speed:sceneFile.duration/seconds,fps:30,audio:'none'}:{enabled:false,operation:'convert',copySpeed:sceneFile.duration/seconds}}),sample);
 }));
 c.handle('export-summary',options=>tracked('Exporting approved summary…',async(signal,onProgress,sample)=>{if(!sceneFile||!sceneOutput)throw new Error('Choose a source and summary output in this section.');if(options?.approved!==true)throw new Error('Review the clips and check approval before export.');return withReport(sceneFile,sceneOutput,()=>scenes.exportSummary(sceneFile,options.rows,sceneOutput,{signal,onProgress,crf:options.crf,quality:options.quality,keys}),sample);}));
 return {
  snapshot:()=>({specificPath:specificFile?.path,specificOutput,scenePath:sceneFile?.path,sceneOutput,sceneIdentity:sceneFile?{size:sceneFile.size,modified:sceneFile.modified}:null}),
  restore:async(data={})=>{
   specificFile=null;specificOutput=null;sceneFile=null;sceneOutput=null;analysis=null;keys=null;const errors=[];
   for(const kind of ['specific','scene']){const p=data[kind+'Path'];if(typeof p!=='string')continue;try{const f=await c.inspect(p,c.getTask()?.signal);if(kind==='specific'){specificFile=f;specificOutput=typeof data.specificOutput==='string'?data.specificOutput:null;}else{sceneFile=f;sceneOutput=typeof data.sceneOutput==='string'?data.sceneOutput:null;}}catch(e){errors.push(kind+': '+e.message);}}
   const changed=!!sceneFile&&(sceneFile.size!==data.sceneIdentity?.size||sceneFile.modified!==data.sceneIdentity?.modified);
   return {specificFile:fileView(specificFile),specificOutput,sceneFile:fileView(sceneFile),sceneOutput,changed,errors};
  }
 };
};
