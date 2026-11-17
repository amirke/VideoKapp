const fs=require('node:fs/promises'),T=require('./timeline.cjs');
module.exports=c=>{
 const current=p=>{const v=c.getVideo();if(!v||p!==v.path)throw Error('The video changed. Try again.');return v;};
 const validate=(marks,v)=>{if(!Array.isArray(marks)||marks.length>5000)throw Error('Too many markers.');return marks.map(m=>{if(!['poi','start','end'].includes(m.type)||!Number.isFinite(m.seconds)||m.seconds<0||m.seconds>v.duration+.05||typeof m.note!=='string'||m.note.length>200)throw Error('Invalid marker.');return {type:m.type,seconds:m.seconds,note:m.note};});};
 c.handle('ride-markers-load',async p=>{const v=current(p),file=p+'.markers.json';try{if((await fs.stat(file)).size>2000000)throw Error('Markers file too large.');const d=JSON.parse(await fs.readFile(file,'utf8'));if(d.application!=='VideoKapp markers'||d.version!==1)throw Error('Unsupported markers file.');await T.verify(d,p);return {path:file,markers:validate(d.markers,v)};}catch(e){if(e.code==='ENOENT')return {path:file,markers:[]};throw e;}});
 c.handle('ride-markers-save',async(p,marks)=>{const v=current(p),markers=validate(marks,v),output=await T.identity(p);current(p);await require('./config.cjs').writeConfig(p+'.markers.json',{application:'VideoKapp markers',version:1,output,markers});return {path:p+'.markers.json',markers};});
};
