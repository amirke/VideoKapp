const {test} = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const D = require('../delta-update.cjs'), {apply} = require('../update-apply.cjs');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
async function fixture(fn) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'videokapp-delta-test-')), root = path.join(base, 'old'); await fs.mkdir(root);
  const data = {app: {'resources/app/package.json': '{"version":"3.8.7"}'}, maps: {'resources/app/vendor/map.js': 'maps'}, ffmpeg: {'resources/app/bin/ffmpeg.exe': 'fake ffmpeg'}, electron: {'ChronoMerge.exe': 'fake runtime'}};
  const manifest = {schema: 1, version: '3.8.7', platform: 'win32-x64', components: Object.entries(data).map(([id, values]) => ({id, asset: `VideoKapp-3.8.7-${id}.zip`, bytes: 3, sha256: sha('zip'), files: Object.entries(values).map(([name, value]) => ({path:name,bytes:Buffer.byteLength(value),sha256:sha(value)}))}))};
  for (const values of Object.values(data)) for (const [name,value] of Object.entries(values)) {const file=path.join(root,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,name.endsWith('package.json')?'{"version":"3.8.6"}':value);}
  const extractImpl = async (archive, dest, component) => {for(const [name,value] of Object.entries(data[component.id])){await fs.mkdir(path.dirname(path.join(dest,name)),{recursive:true});await fs.writeFile(path.join(dest,name),value);}};
  try {await fn({base,root,manifest,extractImpl});} finally {await fs.rm(base,{recursive:true,force:true});}
}
test('downloads only changed component, reuses verified files, installs side-by-side',()=>fixture(async ({root,manifest,extractImpl})=>{
  const urls=[]; const plan=await D.prepareUpdate({root,manifest,extractImpl,fetchImpl:async url=>{urls.push(url);return new Response('zip');}});
  assert.equal(urls.length,1);assert.match(urls[0],/-app.zip$/);assert.deepEqual(plan.components,['app']);assert.equal(plan.bytes,3);
  const calls=[];await apply(plan,{registerImpl:async(a,b)=>calls.push([a,b]),launchImpl:async exe=>calls.push(exe)});
  assert.equal(JSON.parse(await fs.readFile(path.join(root,'resources/app/package.json'),'utf8')).version,'3.8.6');
  assert.equal(JSON.parse(await fs.readFile(path.join(plan.target,'resources/app/package.json'),'utf8')).version,'3.8.7');assert.equal(calls.length,2);
}));
test('corruption and cancellation never alter the installed app',()=>fixture(async ({root,manifest,extractImpl})=>{
  await assert.rejects(D.prepareUpdate({root,manifest,extractImpl,fetchImpl:async()=>new Response('bad')}),/checksum/);
  const c=new AbortController();c.abort();await assert.rejects(D.prepareUpdate({root,manifest,extractImpl,signal:c.signal}));
  assert.equal(JSON.parse(await fs.readFile(path.join(root,'resources/app/package.json'),'utf8')).version,'3.8.6');
}));
test('unsafe paths and duplicate files are rejected',()=>fixture(async ({manifest})=>{
  for(const name of ['../escape','C:/escape','/escape','a\\b','NUL.txt','a/../b'])assert.throws(()=>D.relativePath(name));
  const bad=structuredClone(manifest);bad.components[0].files.push(bad.components[0].files[0]);assert.throws(()=>D.validateManifest(bad,bad.version),/Invalid update file/);
}));
test('failed launch restores registration and preserves previous files',()=>fixture(async ({root,manifest,extractImpl})=>{
  const plan=await D.prepareUpdate({root,manifest,extractImpl,fetchImpl:async()=>new Response('zip')});const registrations=[];
  await assert.rejects(apply(plan,{registerImpl:async(a,b)=>registrations.push([a,b]),launchImpl:async()=>{throw Error('Launch failed');}}),/Launch failed/);
  assert.equal(registrations.length,2);assert.equal(registrations[1][1],path.join(await fs.realpath(root),'ChronoMerge.exe'));assert.equal(await fs.readFile(path.join(root,'ChronoMerge.exe'),'utf8'),'fake runtime');
}));
