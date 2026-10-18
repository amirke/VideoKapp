// SPDX-License-Identifier: GPL-2.0-only
(function(root){
 function zone(value){return value==='utc'?'UTC':value==='local'?Intl.DateTimeFormat().resolvedOptions().timeZone:value;}
 function wall(time,tz){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone(tz),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(time));const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;}
 function utc(value,tz){value=value.replace(/\.000$/,'');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))throw Error('Enter the actual date and time of the first video frame.');const normalized=value.length===16?value+':00':value,base=Date.parse(normalized+'Z');if(!Number.isFinite(base))throw Error('Invalid date.');let candidate=base;for(let i=0;i<4;i++)candidate+=base-Date.parse(wall(candidate,tz)+'Z');if(wall(candidate,tz)!==normalized)throw Error('This local time does not exist in the selected time zone.');for(const delta of [-3600000,3600000])if(wall(candidate+delta,tz)===normalized)throw Error('This local time occurs twice during the daylight-saving change. Use UTC or enter an explicit clock correction.');return candidate;}
 function interpret(log,mode,tz){
  if(!log)return null;
  return {...log,segments:log.segments.map(s=>{
   if(!mode||mode==='absolute')return {...s};
   const elapsed=s.sourceElapsed||0;let start;
   if(mode==='filename'){
    const name=(s.source||'').split(/[\\/]/).pop(),m=/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:_|\.)/.exec(name);
    if(!m)throw Error('No YYYYMMDDhhmmss timestamp in source filename: '+name);
    start=utc(m[1]+'-'+m[2]+'-'+m[3]+'T'+m[4]+':'+m[5]+':'+m[6],tz)+elapsed*1000;
   }else{
    if(s.utcStart===null)return {...s};
    const raw=s.sourceTiming?.recorded??(s.utcStart-elapsed*1000);
    start=utc(wall(raw,'utc'),tz)+elapsed*1000;
    if(mode==='local-end'){
     const duration=s.sourceTiming?.duration??((s.end-s.start)*s.rate);
     if(!s.sourceTiming&&((s.rate!==1)||elapsed))throw Error('End-time interpretation needs original duration for trimmed or accelerated legacy timelines.');
     start-=duration*1000;
    }
   }
   return {...s,utcStart:start};
  })};
 }
 const api={zone,wall,utc,interpret};if(typeof module!=='undefined')module.exports=api;else root.RideTime=api;
})(globalThis);
