const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),{EventEmitter}=require('node:events');
const {launch}=require('../update-apply.cjs');
test('restart requests a visible window and waits for loaded-window acknowledgement',async()=>{
 let marker,unref=false;
 await launch(path.resolve('ChronoMerge.exe'),{spawnImpl:(exe,args,options)=>{
  assert.equal(options.windowsHide,false);assert.equal(options.cwd,path.dirname(exe));assert.equal(options.env.ELECTRON_RUN_AS_NODE,undefined);
  marker=options.env.VIDEOKAPP_UPDATE_READY;
  const child=new EventEmitter();child.unref=()=>{unref=true;};
  setTimeout(()=>fs.writeFile(marker,'ready'),20);return child;
 }});
 assert(unref);await assert.rejects(fs.stat(marker),{code:'ENOENT'});
});
test('a spawned process without a ready window is not reported as success',async()=>{
 await assert.rejects(launch(path.resolve('ChronoMerge.exe'),{timeout:10,spawnImpl:()=>{const c=new EventEmitter();c.unref=()=>{};return c;}}),/did not confirm/);
});
