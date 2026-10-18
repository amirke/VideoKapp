// SPDX-License-Identifier: GPL-2.0-only
const presets = ['ultrafast','superfast','veryfast','faster','fast','medium','slow'];
function numeric(value, fallback, min, max, label, integer=false) {
 const n = value === '' || value == null ? fallback : Number(value);
 if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new Error(`${label} must be ${integer ? 'a whole number ' : ''}between ${min} and ${max}.`);
 return n;
}
function compressionPlan(o, files=[]) {
 if (!o?.enabled) {
  if(o?.copySpeed!=null){const speed=numeric(o.copySpeed,1,1,10000,'Speed multiplier');if(o.operation!=='convert')throw new Error('Original-quality speed change requires a single file.');return {enabled:false,copySpeed:speed,audio:'none'};}
  return {enabled:false};
 }
 const mode=o.mode||'quality', codec=o.codec||'libx264', preset=o.preset||'fast';
 if (!['quality','bitrate'].includes(mode)) throw new Error('Choose CRF or average bitrate.');
 if (!['libx264','libx265'].includes(codec)) throw new Error('Choose H.264 or H.265.');
 if (!presets.includes(preset)) throw new Error('Unsupported encoding preset.');
 const value=mode==='quality'?numeric(o.crf,20,1,51,'CRF',true):numeric(o.bitrate,8,.1,100,'Average bitrate');
 const width=numeric(o.width,0,0,7680,'Width',true),height=numeric(o.height,0,0,4320,'Height',true);
 if(width%2||height%2)throw new Error('Width and height must be even (0 keeps source dimensions).');
 const speed=numeric(o.speed,1,1,10000,'Speed multiplier'),fps=numeric(o.fps,0,0,120,'Frame rate'),start=numeric(o.start,0,0,86400,'Trim start'),duration=numeric(o.duration,0,0,86400,'Trim duration');
 let audio=o.audio||'auto';
 if(!['auto','copy','aac','none'].includes(audio))throw new Error('Unsupported audio mode.');
 if(audio==='auto')audio=files.every(f=>f.metadata.streams.filter(s=>s.codec_type==='audio').every(s=>s.codec_name==='aac'))?'copy':'aac';
 const audioBitrate=numeric(o.audioBitrate,128,32,512,'Audio bitrate',true), sampleRate=numeric(o.sampleRate,0,0,96000,'Audio sample rate',true),channels=numeric(o.channels,0,0,2,'Audio channels',true);
 if(![0,8000,16000,22050,24000,32000,44100,48000,96000].includes(sampleRate))throw new Error('Unsupported audio sample rate.');
 if(audio==='copy'&&(sampleRate||channels))throw new Error('Choose AAC to change audio sample rate or channels.');
 for(const f of files){const v=f.metadata.streams.find(s=>s.codec_type==='video');
 if(['smpte2084','arib-std-b67'].includes(v.color_transfer)||v.color_primaries==='bt2020')throw new Error('Compression currently supports SDR video. HDR conversion requires tone mapping.');
 if(!width&&!height&&(v.width%2||v.height%2))throw new Error('Choose even output dimensions for this source.');}
 if(files.length&&start>=files.reduce((s,f)=>s+f.duration,0))throw new Error('Trim start must be before the end of the video.');
 const metadata={};for(const k of ['title','comment','artist','copyright','creation_time']){const t=o.metadata?.[k];if(t!=null&&(typeof t!=='string'||t.length>5000||t.includes('\0')))throw new Error(`Invalid metadata: ${k}`);if(t)metadata[k]=t;}
 if(metadata.creation_time&&!Number.isFinite(Date.parse(metadata.creation_time)))throw new Error('Creation time must be an ISO date/time.');
 return {enabled:true,mode,value,codec,preset,width,height,fps,speed,start,duration,audio,audioBitrate,sampleRate,channels,metadata};
}
function encodingArgs(p){
 if(!p?.enabled)return ['-c','copy',...(p?.copySpeed?['-an','-bsf:v',`setts=pts=PTS*TB/(${p.copySpeed}*TB_OUT):dts=DTS*TB/(${p.copySpeed}*TB_OUT):duration=DURATION*TB/(${p.copySpeed}*TB_OUT):time_base=1/1000000`]:[]),...(p?.duration?['-t',String(p.duration),'-avoid_negative_ts','make_zero']:[])];
 const scale=p.width&&p.height?`scale=${p.width}:${p.height}:force_original_aspect_ratio=decrease:force_divisible_by=2:in_range=auto:out_range=tv,pad=${p.width}:${p.height}:(ow-iw)/2:(oh-ih)/2,setsar=1`:`scale=${p.width||(p.height?-2:'iw')}:${p.height||(p.width?-2:'ih')}:in_range=auto:out_range=tv`;
 return ['-c:v',p.codec,'-preset',p.preset,'-profile:v',p.codec==='libx264'?'high':'main',...(p.codec==='libx265'?['-tag:v','hvc1']:[]),'-vf',p.speed>1?`setpts=(PTS-STARTPTS)/${p.speed},fps=${p.fps||30},${scale},format=yuv420p`:`${scale},format=yuv420p${p.fps?`,fps=${p.fps}`:''}`,'-color_range','tv',...(p.mode==='quality'?['-crf',String(p.value)]:['-b:v',`${p.value}M`]),...(p.start?['-ss',String(p.start)]:[]),...(p.duration?['-t',String(p.duration)]:[]),...(p.audio==='none'?['-an']:['-c:a',p.audio,...(p.audio==='aac'?['-b:a',`${p.audioBitrate}k`,...(p.sampleRate?['-ar',String(p.sampleRate)]:[]),...(p.channels?['-ac',String(p.channels)]:[])]:[])])];
}
module.exports={compressionPlan,encodingArgs};
