// SPDX-License-Identifier: GPL-2.0-only
const conversionIds=['compress-enabled','compression-mode','crf','bitrate','codec','preset','width','height','fps','container','audio','audioBitrate','sampleRate','channels','start','trim-duration'];
const configIds=[...new Set([...conversionIds,'primary','secondary','tertiary',...Array.from(document.querySelectorAll('[data-config]'),e=>e.id)])];
function showSource(){
 const file=files.find(f=>f.id===$('source-file').value);
 $('override-status').textContent=file&&overrides[file.path]?'Custom settings saved for this file (separate conversion only).':'Uses shared settings. Per-file overrides apply only in separate conversion mode.';
 if(!file){$('source-details').textContent='Add a video to inspect its technical properties.';return;}
 const v=file.metadata?.streams?.find(s=>s.codec_type==='video'),a=file.metadata?.streams?.find(s=>s.codec_type==='audio');
 $('source-details').textContent=[file.path,`Size: ${file.size} bytes | Duration: ${file.duration} seconds`,v?`Video: ${v.codec_name} | ${v.width} × ${v.height} | FPS: ${v.avg_frame_rate||v.r_frame_rate} | Bitrate: ${v.bit_rate||'unknown'} bps | Pixel format: ${v.pix_fmt}`:'',a?`Audio: ${a.codec_name} | ${a.sample_rate} Hz | ${a.channels} channels | ${a.bit_rate||'unknown'} bps`:'No audio', 'Original CRF: usually not stored; output CRF is your new encoding setting.', '', 'All detected metadata (read-only; output settings above):',JSON.stringify(file.metadata,null,2)].join('\n');
}
window.refreshSource=()=>{const old=$('source-file').value;$('source-file').replaceChildren();for(const f of files){const o=document.createElement('option');o.value=f.id;o.textContent=f.name;$('source-file').append(o);}if(files.some(f=>f.id===old))$('source-file').value=old;showSource();};
$('source-file').onchange=showSource;
$('operation').onchange=()=>{outputPath=null;$('output-path').textContent=$('operation').value==='convert'?'Choose a folder for separate converted files.':'Choose a folder and file name before merging.';syncCompression();render();};
for(const id of conversionIds.filter(id=>!['compress-enabled','compression-mode','crf','bitrate'].includes(id)))$(id).onchange=()=>{syncCompression();render();};
function applyConversion(c){
 const mapping={enabled:'compress-enabled',mode:'compression-mode',duration:'trim-duration'};
 for(const [key,val] of Object.entries(c)){const el=$(mapping[key]||key);if(conversionIds.includes(el?.id)){if(el.type==='checkbox')el.checked=!!val;else el.value=String(val);}}
 for(const key of ['title','comment','artist','copyright','creation_time'])$('meta-'+key).value=c.metadata?.[key]||'';
 syncCompression();render();
}
$('source-values').onclick=()=>{
 const f=files.find(f=>f.id===$('source-file').value),v=f?.metadata?.streams?.find(s=>s.codec_type==='video');if(!v)return;
 const [n,d]=(v.avg_frame_rate||v.r_frame_rate||'0/1').split('/').map(Number);
 $('width').value=v.width;$('height').value=v.height;$('fps').value=d?n/d:0;$('compress-enabled').checked=true;syncCompression();render();
};
$('save-override').onclick=()=>{const f=files.find(f=>f.id===$('source-file').value);if(!f)return;overrides[f.path]={...conversionForm(),enabled:true,operation:'convert'};showSource();render();};
$('load-override').onclick=()=>{const f=files.find(f=>f.id===$('source-file').value);if(f&&overrides[f.path])applyConversion(overrides[f.path]);else message('No custom settings saved for this file.');};
$('clear-override').onclick=()=>{const f=files.find(f=>f.id===$('source-file').value);if(f)delete overrides[f.path];showSource();render();};
function savedSettings(){return {controls:Object.fromEntries(configIds.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value])),conversion:conversionForm(),rememberCredentials:$('remember-credentials').checked};}
async function action(fn){setBusy(true);try{return await fn();}catch(error){window.reportButtonFailure?.();message(error.message,true);}finally{setBusy(false);render();}}
function unwrap(r){if(!r.ok)throw new Error(r.error);return r.value;}
$('save-cfg').onclick=()=>action(async()=>{const file=unwrap(await window.api.saveConfig(savedSettings()));if(file)message('Configuration saved: '+file);});
$('load-cfg').onclick=()=>action(async()=>{
 const data=unwrap(await window.api.loadConfig());if(!data)return;
 for(const id of configIds){const value=data.settings.controls?.[id];if(value==null)continue;if($(id).type==='checkbox')$(id).checked=value===true;else $(id).value=String(value);}
 $('operation').value='merge';
 window.refreshAiSettings?.();window.refreshRideMapSettings?.();message(['Configuration loaded.',data.warning,...data.errors].filter(Boolean).join('\n'));syncCompression();refreshPlatform();await connectionStatus();
});
function uploadFields(){return {platform:$('upload-platform').value,title:$('upload-title').value,description:$('upload-description').value,tags:$('upload-tags').value,privacy:$('upload-privacy').value,category:$('upload-category').value,language:$('upload-language').value,madeForKids:$('upload-kids').value,synthetic:$('upload-synthetic').value,license:$('upload-license').value,rumbleLicense:$('rumble-license').value};}
function refreshPlatform(){const youtube=$('upload-platform').value==='youtube';$('youtube-connection').hidden=!youtube;}
$('upload-platform').onchange=refreshPlatform;
function uploadFile(file){if(!file)return;$('upload-file').textContent=file.path+' | '+formatDuration(file.duration);if(!$('upload-title').value)$('upload-title').value=file.metadata?.format?.tags?.title||file.name.replace(/\.[^.]+$/,'');if(!$('upload-description').value)$('upload-description').value=file.metadata?.format?.tags?.comment||'';$('upload-result').textContent='';}
$('choose-upload').onclick=()=>action(async()=>uploadFile(unwrap(await window.api.chooseUpload())));
$('use-output').onclick=()=>action(async()=>uploadFile(unwrap(await window.api.useOutput())));
for(const field of ['title','description','tags'])$('copy-'+field).onclick=()=>action(async()=>{unwrap(await window.api.copyField($('upload-'+field).value));$('upload-result').textContent='Copied '+field+'.';});
$('browser-upload').onclick=()=>action(async()=>{$('upload-result').textContent=unwrap(await window.api.browserUpload(uploadFields()));});
async function connectionStatus(){const r=await window.api.connectionStatus();if(r.ok)$('connection-status').textContent=r.value.connected?'YouTube connected. Credentials saved with Windows encryption.':r.value.clientLoaded?'OAuth client loaded. Click Connect YouTube.':'Not connected. Import a Desktop OAuth client JSON to enable direct upload.';}
$('import-client').onclick=()=>action(async()=>{unwrap(await window.api.importClient());await connectionStatus();});
$('connect-youtube').onclick=()=>action(async()=>{showProgress({text:'Complete Google sign-in in your browser…',progress:0});unwrap(await window.api.connectYouTube());await connectionStatus();});
$('disconnect-youtube').onclick=()=>action(async()=>{unwrap(await window.api.disconnectYouTube());await connectionStatus();message('Local authorization removed. Existing exported CFG files still contain their saved connection. To revoke Google access completely, remove the app in your Google account.');});
$('upload-youtube').onclick=()=>action(async()=>{
 $('upload-result').textContent='Uploading the chosen file with the fields shown above…';showProgress({text:'Starting YouTube upload…',progress:0});
 try{const result=unwrap(await window.api.uploadYouTube(uploadFields()));$('upload-result').replaceChildren(document.createTextNode('Upload complete. Actual visibility: '+result.privacy+'. YouTube processing may still be running. '));const a=document.createElement('span');a.textContent=result.url;$('upload-result').append(a);}catch(e){$('upload-result').textContent='Upload failed: '+e.message;throw e;}
});
refreshSource();refreshPlatform();connectionStatus().catch(e=>message(e.message,true));
