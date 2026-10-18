const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('output chooser, cancellation, merge destination and metrics lifecycle without opening Windows', async () => {
  const handlers = new Map(), sent = [], timers = new Set();
  let saveResponse = { canceled: true }, mergeDestination, failMerge = false, clipboardText;
  const electron = {
    app: { whenReady: () => Promise.resolve(), on() {}, disableHardwareAcceleration() {}, getPath: () => 'C:/Videos' },
    BrowserWindow: class {
      webContents = { send: (type, data) => sent.push({ type, data }), setWindowOpenHandler() {}, on() {} };
      isDestroyed() { return false; } loadFile() {} on() {}
    },
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: ['C:/a.mp4', 'C:/b.mp4'] }), showSaveDialog: async () => saveResponse },
    shell: {},
    clipboard: { writeText: text => { clipboardText = text; } },
  };
  const engine = {
    inspect: async file => ({ id: file, path: file, metadata: {} }),
    compatibility: files => ({ ok: files.length >= 2, message: 'Select two clips' }),
    merge: async (files, output) => { mergeDestination = output; if (failMerge) throw new Error('Disk full'); return { path: output }; },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.cjs'), 'utf8'), {
    require: name => name === './editing.cjs' ? () => ({}) : name === './services.cjs' ? () => {} : name === 'electron' ? electron : name === './engine.cjs' ? engine : name === './metrics.cjs' ? require('../metrics.cjs') : name === './report.cjs' ? { saveReport: async data => ({ text: data.error ? 'FAILED report' : 'SUCCESS report', path: null }) } : require(name),
    __dirname: path.resolve(__dirname, '..'), process: { env: {} }, AbortController,
    setInterval: callback => { timers.add(callback); return callback; }, clearInterval: callback => timers.delete(callback),
  });
  await Promise.resolve();
  const call = (name, ...args) => handlers.get(name)({}, ...args);
  await call('choose-files');
  const ids = ['C:/a.mp4', 'C:/b.mp4'];
  assert.match((await call('merge', ids)).error, /output folder/);
  assert.equal((await call('choose-output', ids)).value, null);
  saveResponse = { canceled: false, filePath: 'C:/chosen destination/result.mkv' };
  assert.equal((await call('choose-output', ids)).value, saveResponse.filePath);
  saveResponse = { canceled: true };
  assert.equal((await call('choose-output', ids)).value, 'C:/chosen destination/result.mkv');
  assert.equal((await call('merge', ids)).ok, true);
  assert.equal(mergeDestination, 'C:/chosen destination/result.mkv');
  assert.equal(timers.size, 0);
  assert.equal(sent.filter(e => e.type === 'metrics').at(-1).data.active, false);
  assert.equal((await call('copy-report')).ok, true);
  assert.equal(clipboardText, 'SUCCESS report');
  failMerge = true;
  assert.equal((await call('merge', ids)).error, 'Disk full');
  assert.equal(timers.size, 0);
  assert.equal(sent.filter(e => e.type === 'metrics').at(-1).data.active, false);
  await call('copy-report');
  assert.equal(clipboardText, 'FAILED report');
});

test('all shipped UI messages are English and document has LTR direction', () => {
  const root = path.resolve(__dirname, '..');
  for (const file of ['index.html', 'renderer.js', 'main.cjs', 'engine.cjs', 'losslesscut-concat.cjs']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /[\u0590-\u05ff]/, file);
  }
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /lang="en" dir="ltr"/);
});

test('separate conversion uses each override/container and keeps successful files after a failure', async()=>{
 const handlers=new Map(),destinations=[],sent=[];let folder=true;
 const source=['a','b','c'].map(name=>({id:name,path:'C:/'+name+'.mp4',name:name+'.mp4',metadata:{}}));
 const electron={app:{whenReady:()=>Promise.resolve(),on(){},disableHardwareAcceleration(){},getPath:()=> 'C:/Videos'},BrowserWindow:class {webContents={send:(type,data)=>sent.push({type,data}),setWindowOpenHandler(){},on(){}};isDestroyed(){return false;}loadFile(){}on(){}},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},dialog:{showOpenDialog:async()=>folder?{canceled:false,filePaths:['C:/out']}:{canceled:false,filePaths:source.map(f=>f.path)}},shell:{},clipboard:{}};
 const engine={inspect:async p=>source.find(f=>f.path===p),compatibility:()=>({ok:true}),merge:async(files,output,options)=>{destinations.push({output,options});if(files[0].id==='b')throw Error('Test failure');return {path:output,duration:1};}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.cjs'),'utf8'),{require:name=>name==='electron'?electron:name==='./engine.cjs'?engine:name==='./editing.cjs'?()=>({}):name==='./services.cjs'?()=>{}:name==='./metrics.cjs'?require('../metrics.cjs'):name==='./report.cjs'?{saveReport:async()=>({text:'report',path:'report.txt'})}:require(name),__dirname:path.resolve(__dirname,'..'),process:{env:{}},AbortController,setInterval:()=>1,clearInterval(){}});
 await Promise.resolve();const call=(name,...args)=>handlers.get(name)({},...args);
 folder=false;await call('choose-files');folder=true;await call('choose-output',['a','b','c'],{operation:'convert'});
 const result=await call('merge',['a','b','c'],{operation:'convert',enabled:true,container:'mp4',overrides:{'C:/a.mp4':{container:'mkv',crf:25}}});
 assert.equal(result.ok,true);assert.equal(result.value.outputs.length,2);assert.equal(result.value.failures.length,1);assert.match(destinations[0].output,/\.mkv$/);assert.equal(destinations[0].options.compression.crf,25);assert.match(destinations[2].output,/\.mp4$/);assert.equal(sent.filter(e=>e.type==='metrics').at(-1).data.active,false);
});
