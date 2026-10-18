const {test} = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), {EventEmitter} = require('node:events');
test('every event subscription returns cloneable undefined and hides Electron events', async () => {
  let api; const ipc = new EventEmitter(); ipc.invoke = async () => ({ok: true, value: 1});
  vm.runInNewContext(fs.readFileSync('preload.cjs', 'utf8'), {require: () => ({ipcRenderer: ipc, contextBridge: {exposeInMainWorld: (_name, value) => {api = value;}}})});
  const received = [];
  for (const name of Object.keys(api).filter(name => name.startsWith('on'))) {
    const result = api[name]((...args) => {received.push({name, args});});
    assert.equal(result, undefined, name); assert.doesNotThrow(() => structuredClone(result), name);
  }
  const privateEvent = {sender: ipc};
  ipc.emit('status', privateEvent, {text: 'Ready'});
  assert.deepEqual(received.find(r => r.name === 'onStatus').args, [{text: 'Ready'}]);
  await api.cancel();
  assert.ok(received.some(r => r.name === 'onActionActivity' && r.args[0].phase === 'end'));
});
