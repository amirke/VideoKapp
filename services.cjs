// SPDX-License-Identifier: GPL-2.0-only
const fs=require('node:fs/promises');
const path=require('node:path');
const config=require('./config.cjs');
const youtube=require('./youtube.cjs');
const {compressionPlan}=require('./compression.cjs');
function validateSettings(s){
 if(!s||typeof s!=='object'||Array.isArray(s))throw new Error('Invalid settings.');
 if(s.conversion)compressionPlan(s.conversion);
 if(s.overrides){if(typeof s.overrides!=='object'||Array.isArray(s.overrides))throw new Error('Invalid per-file settings.');for(const o of Object.values(s.overrides))compressionPlan({...o,enabled:true});}
 if(s.files&&(!Array.isArray(s.files)||s.files.length>1000||s.files.some(f=>typeof f.path!=='string'||f.path.length>32767)))throw new Error('Invalid saved file list.');
 if(s.destinations)for(const k of ['outputPath','conversionFolder'])if(s.destinations[k]!=null&&typeof s.destinations[k]!=='string')throw new Error('Invalid output destination.');
 return s;
}
module.exports=function register(c){
 const {safeStorage}=require('electron');
 let credentials={},uploadPath=null,loaded=false;
 const cache=()=>path.join(c.app.getPath('userData'),'connections.cfg');
 const idle=()=>{if(c.getTask())throw new Error('Wait for the current operation to finish.');};
 const saveCredentials=async()=>{await fs.mkdir(c.app.getPath('userData'),{recursive:true});await config.writeConfig(cache(),config.pack({},credentials,safeStorage));};
 const loadCredentials=async()=>{if(loaded)return;loaded=true;try{credentials=config.unpack(await fs.readFile(cache(),'utf8'),safeStorage).credentials;}catch(error){if(error.code!=='ENOENT')credentials={};}};
 c.handle('connection-status',async()=>{await loadCredentials();return {clientLoaded:!!credentials.client,connected:!!credentials.tokens?.refresh_token};});
 c.handle('save-config',async settings=>{
  idle();validateSettings(settings);await loadCredentials();
  const result=await c.dialog.showSaveDialog(c.getWindow(),{title:'Save ChronoMerge configuration',defaultPath:'ChronoMerge.cfg',filters:[{name:'ChronoMerge configuration',extensions:['cfg']}]});
  if(result.canceled)return null;
  const data={controls:settings.controls,conversion:settings.conversion,rememberCredentials:settings.rememberCredentials};
  await config.writeConfig(result.filePath,config.pack(data,settings.rememberCredentials?credentials:null,safeStorage));return result.filePath;
 });
 c.handle('load-config',async()=>{
  idle();const result=await c.dialog.showOpenDialog(c.getWindow(),{title:'Load ChronoMerge configuration',properties:['openFile'],filters:[{name:'ChronoMerge configuration',extensions:['cfg']}]});
  if(result.canceled)return null;
  const stat=await fs.stat(result.filePaths[0]);if(stat.size>8_000_000)throw new Error('CFG file is too large.');
  const data=config.unpack(await fs.readFile(result.filePaths[0],'utf8'),safeStorage);validateSettings(data.settings);
  const errors=[];
  if(data.credentials.client||data.credentials.tokens){credentials=data.credentials;loaded=true;try{await saveCredentials();}catch{errors.push('Connection restored for this session, but automatic credential storage failed.');}}
  return {settings:{controls:data.settings.controls,conversion:data.settings.conversion},errors,warning:data.warning};
 });
 c.handle('import-client',async()=>{
  idle();await loadCredentials();
  const result=await c.dialog.showOpenDialog(c.getWindow(),{title:'Import Google OAuth client JSON (Desktop app)',properties:['openFile'],filters:[{name:'OAuth client JSON',extensions:['json']}]});if(result.canceled)return null;
  if((await fs.stat(result.filePaths[0])).size>100000)throw new Error('OAuth client file is too large.');
  const data=JSON.parse(await fs.readFile(result.filePaths[0],'utf8')),client=data.installed;
  if(!client||typeof client.client_id!=='string'||!client.client_id.endsWith('.apps.googleusercontent.com')||typeof client.client_secret!=='string')throw new Error('Choose an OAuth client JSON for a Desktop app, not a service account or web app.');
  credentials={client:{client_id:client.client_id,client_secret:client.client_secret}};await saveCredentials();return {clientLoaded:true,connected:false};
 });
 c.handle('connect-youtube',async()=>{
  idle();await loadCredentials();c.setTask(new AbortController());
  try{const tokens=await youtube.connect(credentials.client,url=>c.shell.openExternal(url),{signal:c.getTask().signal});if(!tokens.refresh_token)throw new Error('Google did not grant offline access. Disconnect and connect again.');credentials.tokens={refresh_token:tokens.refresh_token};await saveCredentials();return {connected:true};}finally{c.setTask(null);}
 });
 c.handle('disconnect-youtube',async()=>{idle();await loadCredentials();delete credentials.tokens;await saveCredentials();return {connected:false};});
 c.handle('choose-upload',async()=>{
  idle();const r=await c.dialog.showOpenDialog(c.getWindow(),{title:'Choose finished video to upload',properties:['openFile'],filters:[{name:'Video',extensions:['mp4','mov','mkv','m4v','webm']}]});if(r.canceled)return null;
  const file=await c.inspect(r.filePaths[0]);uploadPath=file.path;return c.view(file);
 });
 c.handle('use-output',async()=>{idle();const file=c.getOutput();if(!file)throw new Error('No completed output yet. Use Choose video to select an existing file.');const info=await c.inspect(file);uploadPath=file;return c.view(info);});
 c.handle('upload-youtube',async fields=>{
  idle();if(!uploadPath)throw new Error('Choose the finished video to upload.');await loadCredentials();youtube.uploadMetadata(fields);
  c.setTask(new AbortController());
  try{return await youtube.upload(uploadPath,fields,credentials,{signal:c.getTask().signal,onProgress:p=>c.event('status',{text:'Uploading to YouTube…',progress:p})});}finally{c.setTask(null);}
 });
 c.handle('browser-upload',async fields=>{
  idle();if(!uploadPath)throw new Error('Choose the finished video to upload.');
  if(!['youtube','rumble'].includes(fields.platform))throw new Error('Choose a platform.');
  if(!String(fields.title||'').trim())throw new Error('Enter a title.');
  const text=['File: '+uploadPath,'Title: '+fields.title,'Description: '+(fields.description||''),'Tags: '+(fields.tags||''),'Visibility: '+fields.privacy,...(fields.platform==='rumble'?['License: '+(fields.rumbleLicense||'Personal Use')]:['Made for kids: '+(fields.madeForKids||'Choose on website'),'Altered / synthetic: '+(fields.synthetic||'Choose on website')])].join('\n');
  c.clipboard.writeText(text);c.shell.showItemInFolder(uploadPath);
  await c.shell.openExternal(fields.platform==='youtube'?'https://www.youtube.com/upload':'https://rumble.com/upload');
  return 'Upload page opened. Details copied. Select the video on the website, paste the fields, review and publish there. Browser sign-in stays in your browser.';
 });
 c.handle('copy-field',text=>{if(typeof text!=='string'||text.length>10000)throw new Error('Invalid field.');c.clipboard.writeText(text);});
};
module.exports.validateSettings=validateSettings;
