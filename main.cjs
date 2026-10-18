// SPDX-License-Identifier: GPL-2.0-only
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron');
const path = require('node:path');
const { inspect, merge, compatibility } = require('./engine.cjs');
const { createSampler } = require('./metrics.cjs');
const { saveReport } = require('./report.cjs');

if (process.env.CHRONOMERGE_TEST_DATA) app.setPath('userData', process.env.CHRONOMERGE_TEST_DATA);
let window, task, lastOutput, outputPath, lastReport, updateController;
const primaryInstance = require('./desktop-launch.cjs').setupDesktopLaunch(app, () => window);
const known = new Map();
let conversionFolder;
app.disableHardwareAcceleration();
const view = file => file;
function selected(ids) {
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length) throw new Error('Invalid file selection.');
  return ids.map(id => { const f = known.get(id); if (!f) throw new Error('Please select the files again.'); return f; });
}
function event(type, payload) { if (window && !window.isDestroyed()) window.webContents.send(type, payload); }
const registeredChannels = new Set();
function handle(name, callback) {
  registeredChannels.add(name);
  ipcMain.handle(name, async (_, ...args) => {
    try { return { ok: true, value: await callback(...args) }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
}

if (primaryInstance) app.whenReady().then(() => {
  window = new BrowserWindow({
    width: 1180, height: 850, minWidth: 920, minHeight: 700,
    backgroundColor: '#101719', title: 'VideoKapp - ChronoMerge', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.webContents.session.webRequest.onBeforeSendHeaders({urls:['https://tile.openstreetmap.org/*','https://a.tile.opentopomap.org/*','https://a.tile-cyclosm.openstreetmap.fr/*']},(details,callback)=>{details.requestHeaders['User-Agent']='ChronoMerge/2.3 (Windows desktop ride player)';callback({requestHeaders:details.requestHeaders});});
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', e => e.preventDefault());
  window.loadFile(path.join(__dirname, 'index.html'));
  window.on('close', () => task?.abort());
});
app.on('window-all-closed', () => app.quit());

handle('choose-files', async () => {
  if (task) throw new Error('Please wait for the current operation to finish.');
  const result = await dialog.showOpenDialog(window, {
    title: 'Select videos to merge', properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'm4v', 'avi', 'mts', 'm2ts', 'ts', 'webm', 'mpg', 'mpeg', '3gp', 'wmv'] }, { name: 'All files', extensions: ['*'] }],
  });
  if (result.canceled) return { files: [], errors: [] };
  task = new AbortController();
  const files = [], errors = [];
  try {
    for (const [i, filePath] of result.filePaths.entries()) {
      if (task.signal.aborted) break;
      event('status', { text: `Reading video details… ${i + 1} / ${result.filePaths.length}`, progress: (i / result.filePaths.length) });
      try {
        const file = await inspect(filePath, task.signal);
        if ([...known.values()].some(f => f.path.toLowerCase() === file.path.toLowerCase())) continue;
        known.set(file.id, file); files.push(view(file));
      } catch (error) { if (!task.signal.aborted) errors.push(`${path.basename(filePath)}: ${error.message}`); }
    }
  } finally { task = null; }
  return { files, errors };
});
handle('forget', ids => { if (task) throw new Error('An operation is still running.'); for (const f of selected(ids)) known.delete(f.id); });
handle('check', (ids, compression) => {
 const files = selected(ids);
 if (compression?.operation === 'convert') {
  if (!files.length) return {ok:false,message:'Select at least one file to convert.'};
  for (const file of files) { const result=compatibility([file], {...compression,...compression.overrides?.[file.path],enabled:true,operation:'convert'}); if(!result.ok)return result; }
  return {ok:true,message:'Each selected file will produce a separate converted video.'};
 }
 return compatibility(files, compression);
});
handle('choose-output', async (ids, options) => {
  if (task) throw new Error('Another operation is in progress.');
  const files = selected(ids);
  if (options?.operation === 'convert') {
    const result=await dialog.showOpenDialog(window,{title:'Choose folder for converted videos',properties:['openDirectory','createDirectory']});
    if(!result.canceled && result.filePaths[0]) conversionFolder=result.filePaths[0];
    return conversionFolder || null;
  }
  const extension = files.length ? path.extname(files[0].path).toLowerCase() : '.mp4';
  const defaultExtension = ['.mp4', '.mov', '.mkv'].includes(extension) ? extension : '.mkv';
  const save = await dialog.showSaveDialog(window, {
    title: 'Save merged video as', defaultPath: outputPath || path.join(files.length ? path.dirname(files[0].path) : app.getPath('videos'), `merged${defaultExtension}`),
    filters: [{ name: 'Video', extensions: [defaultExtension.slice(1), ...['mp4', 'mov', 'mkv'].filter(e => `.${e}` !== defaultExtension)] }],
  });
  if (!save.canceled && save.filePath) outputPath = save.filePath;
  return outputPath || null;
});
handle('merge', async (ids, compression) => {
 if(task)throw new Error('Another operation is in progress.');
 const files=selected(ids), separate=compression?.operation==='convert';
 if(!files.length)throw new Error('Select files first.');
 if(separate&&!conversionFolder)throw new Error('Choose an output folder first.');
 if(!separate&&!outputPath)throw new Error('Choose an output folder and file name first.');
 const jobs=separate?files.map(file=>({files:[file],compression:{...compression,...compression.overrides?.[file.path],enabled:true,operation:'convert'}})):[{files,compression}];
 for(const job of jobs){const check=compatibility(job.files,job.compression);if(!check.ok)throw new Error(check.message);}
 task=new AbortController();const sample=createSampler(),startedAt=new Date().toISOString(),reports=[],results=[],failures=[];
 const timer=setInterval(()=>event('metrics',{...sample(),active:true}),1000);event('metrics',{...sample(),active:true});
 try {
  for(const [index,job] of jobs.entries()){
   if(task.signal.aborted)break;
   const extension=['mp4','mkv','mov'].includes(job.compression?.container)?job.compression.container:'mp4';
   const destination=separate?path.join(conversionFolder,path.parse(job.files[0].name).name+'_converted_'+require('node:crypto').randomUUID().slice(0,8)+'.'+extension):outputPath;
   let result,failure;
   try{result=await merge(job.files,destination,{signal:task.signal,compression:job.compression,onProgress:p=>event('status',{text:(separate?'Converting file '+(index+1)+' / '+jobs.length:compression?.enabled?'Merging and compressing':'Merging videos')+'…',progress:(index+p)/jobs.length})});results.push(result);lastOutput=result.path;}
   catch(error){failure=error;failures.push({file:job.files[0].name,error:error.message});}
   const report=await saveReport({files:job.files,output:destination,result,error:failure,metrics:sample(),startedAt});reports.push(report);
   if(failure&&!separate)throw failure;
  }
  if(!results.length)throw new Error(task.signal.aborted?'Operation cancelled.':failures[0]?.error||'No output created.');
  return separate?{...results[0],batch:true,outputs:results.map(r=>r.path),failures,cancelled:task.signal.aborted}:results[0];
 }finally{
  clearInterval(timer);event('metrics',{...sample(),active:false});
  if(reports.length){lastReport=reports.map(r=>(r.path?'Report: '+r.path+'\n':'')+r.text).join('\n\n');event('report',{text:lastReport,path:reports.length===1?reports[0].path:null,paths:reports.map(r=>r.path).filter(Boolean),saveError:reports.find(r=>r.saveError)?.saveError});}
  task=null;
 }
});
handle('cancel', () => { task?.abort(); updateController?.abort(); });
handle('show-output', () => { if (lastOutput) shell.showItemInFolder(lastOutput); });
handle('copy-report', () => { if (!lastReport) throw new Error('No report available yet.'); clipboard.writeText(lastReport); });
handle('preview', async id => {
  const [file] = selected([id]);
  const error = await shell.openPath(file.path);
  if (error) throw new Error(error);
});

const editing = require('./editing.cjs')({app,dialog,shell,handle,event,inspect,getWindow:()=>window,getTask:()=>task,setTask:value=>task=value,setOutput:value=>lastOutput=value,setReport:value=>lastReport=value});
require('./services.cjs')({editing,app,dialog,shell,clipboard,handle,event,selected,known,view,inspect,getWindow:()=>window,getTask:()=>task,setTask:value=>task=value,getOutput:()=>lastOutput,getDestinations:()=>({outputPath,conversionFolder}),setDestinations:data=>{outputPath=data.outputPath;conversionFolder=data.conversionFolder;}});

const rideController=require('./ride.cjs')({getCreatedOrderLog:()=>orderLogController.getCreated(),dialog,shell,handle,inspect,selected,getWindow:()=>window,getTask:()=>task});

const orderLogController=require('./order-log.cjs')({getRideVideo:()=>rideController.getVideo(),dialog,handle,inspect,event,getWindow:()=>window,getTask:()=>task,setTask:value=>task=value});

require('./ride-diagnostic.cjs')({handle,reveal:p=>shell.showItemInFolder(p),directory:()=>rideController.getVideo()?path.dirname(rideController.getVideo().path):path.join(app.getPath('userData'),'ride-logs'),version:require('./package.json').version});

const aiController=require('./ai-resize.cjs')({ride:rideController,dialog,clipboard,handle,event,getWindow:()=>window,getTask:()=>task,setTask:value=>task=value});

require('./ollama.cjs')({ai:aiController,dialog,handle,event,getWindow:()=>window,getTask:()=>task,setTask:value=>task=value});

require('./gemini.cjs')({ai:aiController,dialog,handle,event,getWindow:()=>window,getTask:()=>task,setTask:value=>task=value});

require('./ride-export.cjs')({ride:rideController,dialog,handle,event,getWindow:()=>window,getTask:()=>task,setTask:value=>task=value});

let latestAppUpdate, preparedUpdate, installingUpdate = false;
handle('diagnostics-info', async () => {
  const source = await require('node:fs/promises').readFile(path.join(__dirname, 'preload.cjs'), 'utf8');
  const names = [...new Set([...source.matchAll(/ipcRenderer\.invoke\('([^']+)'/g)].map(match => match[1]))];
  return {version: require('./package.json').version, electron: process.versions.electron, arch: process.arch, channels: names.map(name => ({name, registered: registeredChannels.has(name)}))};
});
handle('diagnostics-run', async options => {
  if (task) throw Error('Stop or finish the current operation first.');
  task = new AbortController();
  try { return await require('./diagnostics.cjs').runDiagnostics({online: options?.online === true, geminiKey: String(options?.geminiKey || '').slice(0, 500), geminiModel: String(options?.geminiModel || '').slice(0, 200), ollamaModel: String(options?.ollamaModel || '').slice(0, 200), signal: task.signal, onProgress: p => event('diagnostics-progress', p)}); }
  finally { task = null; }
});
handle('app-update-check', async () => {
  if (updateController) throw Error('Update check already running.');
  latestAppUpdate = null; updateController = new AbortController();
  try {
    latestAppUpdate = await require('./app-update.cjs').checkUpdate(require('./package.json').version, {signal: AbortSignal.any([updateController.signal, AbortSignal.timeout(12000)])});
    return latestAppUpdate;
  } finally { updateController = null; }
});
handle('app-update-download', async () => {
  if (!app.isPackaged) throw Error('Partial updates require the installed or portable Windows application.');
  if (task) throw Error('Finish the current operation first.');
  if (!latestAppUpdate?.available) throw Error('Check for a newer version first.');
  if (preparedUpdate?.manifest.version === latestAppUpdate.latest) return {ready: true, version: preparedUpdate.manifest.version, bytes: preparedUpdate.bytes};
  task = new AbortController();
  try {
    const updater = require('./delta-update.cjs');
    const manifest = await updater.readManifest(latestAppUpdate.latest, {signal: task.signal});
    preparedUpdate = await updater.prepareUpdate({root: path.dirname(process.execPath), manifest, signal: task.signal, onProgress: p => event('app-update-progress', p)});
    return {ready: true, version: manifest.version, bytes: preparedUpdate.bytes, components: preparedUpdate.components};
  } finally {task = null;}
});
handle('app-update-install', async () => {
  if (task) throw Error('Finish the current operation first.');
  if (!preparedUpdate) throw Error('Download and verify the update first.');
  if (installingUpdate) throw Error('Installation is already starting.');
  if (!await require('./restart-prompt.cjs').askRestart(dialog, window)) return {deferred: true};
  installingUpdate = true; task = new AbortController();
  const fs = require('node:fs/promises');
  const helper = require('node:child_process').spawn(process.execPath, [path.join(__dirname, 'update-apply.cjs'), path.join(preparedUpdate.stage, 'plan.json'), String(process.pid)], {env: {...process.env, ELECTRON_RUN_AS_NODE: '1'}, detached: true, windowsHide: true, stdio: 'ignore'});
  let helperError; helper.on('error', error => {helperError = error;}); helper.unref();
  const ready = path.join(preparedUpdate.stage, 'helper-ready');
  const deadline = Date.now() + 10000;
  while (!await fs.stat(ready).then(() => true, () => false)) {
    if (helperError || Date.now() > deadline) {helper.kill(); installingUpdate = false; task = null; throw helperError || Error('Update helper did not start. Current installation is unchanged.');}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  setTimeout(() => app.quit(), 500);
  return {log: path.join(preparedUpdate.stage, 'update-log.txt')};
});
