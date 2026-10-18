const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {setupDesktopLaunch}=require('../desktop-launch.cjs');
test('second instance focuses existing window without interpreting URL or file arguments',()=>{
 const app=new EventEmitter();app.requestSingleInstanceLock=()=>true;
 const calls=[];const window={isDestroyed:()=>false,isMinimized:()=>true,restore:()=>calls.push('restore'),show:()=>calls.push('show'),focus:()=>calls.push('focus')};
 assert.equal(setupDesktopLaunch(app,()=>window),true);
 app.emit('second-instance',{},['videokapp://open?file=untrusted','--untrusted']);
 assert.deepEqual(calls,['restore','show','focus']);
});
test('secondary process quits; early launch before a window exists does not crash',()=>{
 let quit=false; const secondary={requestSingleInstanceLock:()=>false,quit:()=>{quit=true;}};
 assert.equal(setupDesktopLaunch(secondary,()=>null),false); assert.equal(quit,true);
 const primary=new EventEmitter();primary.requestSingleInstanceLock=()=>true;
 setupDesktopLaunch(primary,()=>null);assert.doesNotThrow(()=>primary.emit('second-instance'));
});
