// SPDX-License-Identifier: GPL-2.0-only
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
function fields(value,depth=1){
 const indent='  '.repeat(depth);
 return Object.entries(value).map(([key,item])=>{
  if(item!==null&&typeof item==='object')return indent+key+':\n'+fields(item,depth+1);
  let text=item==null?'(unavailable)':String(item);
  if(typeof item==='number'&&/utc/i.test(key)&&Number.isFinite(item)&&Math.abs(item)<=8640000000000000)text+=' ('+new Date(item).toISOString()+'; UTC milliseconds)';
  return indent+key+': '+text.replace(/\r?\n/g,'\n'+indent+'  ');
 }).join('\n');
}
function formatEvent(data,version){
 const {event,...details}=data;
 return '['+new Date().toISOString()+'] '+String(event||'event')+'\n'+fields({version,...details})+'\n'+'-'.repeat(72)+'\n';
}
module.exports=c=>{let file,queue=Promise.resolve();const name='ride-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8)+'.txt';async function location(){const dir=path.resolve(c.directory());if(!file||path.dirname(file)!==dir){await fs.mkdir(dir,{recursive:true});const next=path.join(dir,name);if(file){try{await fs.copyFile(file,next,require('node:fs').constants.COPYFILE_EXCL);}catch(e){if(e.code!=='ENOENT'&&e.code!=='EEXIST')throw e;}}file=next;}return file;}
 c.handle('ride-diagnostic',async data=>{const text=JSON.stringify(data);if(text.length>150000)throw Error('Diagnostic event too large.');const job=queue.then(async()=>{const p=await location();await fs.appendFile(p,formatEvent(data,c.version),'utf8');return p;});queue=job.catch(()=>{});return job;});
 c.handle('ride-diagnostic-folder',async()=>{await queue;const p=await location();await fs.appendFile(p,'','utf8');c.reveal(p);return p;});
 c.handle('ride-diagnostic-show',async()=>{await queue;const p=await location();try{const h=await fs.open(p,'r');try{const size=(await h.stat()).size,n=Math.min(size,250000),b=Buffer.alloc(n);await h.read(b,0,n,size-n);return {path:p,text:(size>n?'[Showing last 250 KB]\n':'')+b.toString('utf8')};}finally{await h.close();}}catch(e){if(e.code==='ENOENT')return {path:p,text:'No events recorded yet.'};throw e;}});
};
