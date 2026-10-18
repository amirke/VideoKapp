const fs = require('node:fs/promises');
const {createReadStream, createWriteStream} = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const {compareVersions} = require('./app-update.cjs');
const groups = ['app', 'maps', 'ffmpeg', 'electron'];
function relativePath(name) {
  if (typeof name !== 'string' || name.length > 240 || name.includes('\\') || name.split('/').some(s => !s || s === '.' || s === '..' || /[<>:"|?*\x00-\x1f]/.test(s) || /[. ]$/.test(s) || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(s))) throw Error('Unsafe update path.');
  return name;
}
function validateManifest(m, version) {
  if (m?.schema !== 1 || m.version !== version || !/^\d+\.\d+\.\d+$/.test(m.version) || m.platform !== 'win32-x64' || !Array.isArray(m.components) || m.components.length !== groups.length) throw Error('Unsupported update manifest.');
  const seen = new Set(), ids = new Set(); let total = 0;
  for (const c of m.components) {
    if (!groups.includes(c.id) || ids.has(c.id) || !Array.isArray(c.files) || !c.files.length || !/^[a-f0-9]{64}$/.test(c.sha256) || !Number.isSafeInteger(c.bytes) || c.bytes <= 0 || c.bytes > 2e9 || c.asset !== `VideoKapp-${version}-${c.id}.zip`) throw Error('Invalid update component.');
    ids.add(c.id);
    for (const f of c.files) {
      const name = relativePath(f.path).toLowerCase();
      if (seen.has(name) || !Number.isSafeInteger(f.bytes) || f.bytes < 0 || f.bytes > 1e9 || !/^[a-f0-9]{64}$/.test(f.sha256)) throw Error('Invalid update file.');
      seen.add(name); total += f.bytes;
    }
  }
  if (seen.size > 20000 || total > 4e9 || !seen.has('chronomerge.exe') || !seen.has('resources/app/package.json')) throw Error('Incomplete or oversized update.');
  return m;
}
async function hashFile(file, signal) {
  const hash = crypto.createHash('sha256');
  for await (const data of createReadStream(file)) {signal?.throwIfAborted(); hash.update(data);}
  return hash.digest('hex');
}
async function matches(root, file, signal) {
  try {const stat = await fs.lstat(path.join(root, file.path)); return stat.isFile() && !stat.isSymbolicLink() && stat.size === file.bytes && await hashFile(path.join(root, file.path), signal) === file.sha256;}
  catch (e) {if (signal?.aborted) throw e; return false;}
}
function assetURL(version, asset) {return `https://github.com/amirke/VideoKapp/releases/download/v${version}/${asset}`;}
async function readManifest(version, {fetchImpl = fetch, signal} = {}) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Invalid release version.');
  const r = await fetchImpl(assetURL(version, 'VideoKapp-update.json'), {signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(15000)]), cache: 'no-store'});
  if (!r.ok) throw Error(`Partial update unavailable (HTTP ${r.status}). Use the full installer for this release.`);
  let text = '';
  for await (const chunk of r.body) {text += Buffer.from(chunk).toString('utf8'); if (text.length > 8e6) throw Error('Update manifest too large.');}
  return validateManifest(JSON.parse(text), version);
}
async function planUpdate(root, manifest, {signal, onProgress = () => {}} = {}) {
  validateManifest(manifest, manifest.version);
  const changed = [], reused = []; let count = 0;
  for (const c of manifest.components) {
    let same = true;
    for (const f of c.files) {
      signal?.throwIfAborted(); if (!await matches(root, f, signal)) same = false;
      onProgress({phase: 'checking', text: `Checking local ${c.id}: ${++count} files`, progress: null});
    }
    (same ? reused : changed).push(c);
  }
  return {changed, reused, bytes: changed.reduce((n, c) => n + c.bytes, 0)};
}
async function download(url, file, expected, {fetchImpl = fetch, signal, onBytes = () => {}} = {}) {
  const response = await fetchImpl(url, {signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(600000)])});
  if (!response.ok) throw Error(`Update download failed (HTTP ${response.status}).`);
  const out = await fs.open(file, 'wx'); const hash = crypto.createHash('sha256'); let size = 0;
  try {
    for await (const chunk of response.body) {
      signal?.throwIfAborted(); size += chunk.length; if (size > expected.bytes) throw Error('Download exceeds declared size.');
      hash.update(chunk); await out.writeFile(chunk); onBytes(size);
    }
  } finally {await out.close();}
  if (size !== expected.bytes || hash.digest('hex') !== expected.sha256) throw Error('Update checksum mismatch. Installation was not changed.');
}
async function extract(archive, destination, component, {signal} = {}) {
  const spec = archive + '.json'; await fs.writeFile(spec, JSON.stringify(component.files));
  await new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'update-extract.ps1'), '-Archive', archive, '-Destination', destination, '-Spec', spec], {windowsHide: true, stdio: ['ignore', 'ignore', 'pipe']});
    let error = ''; child.stderr.on('data', data => {error = (error + data).slice(-2000);});
    const stop = () => child.kill(); signal?.addEventListener('abort', stop, {once: true}); if (signal?.aborted) stop();
    child.on('error', reject); child.on('close', code => {signal?.removeEventListener('abort', stop); if (signal?.aborted) reject(Error('Update stopped.')); else if (code) reject(Error(error || 'Extraction failed.')); else resolve();});
  });
}
async function verifyPayload(root, manifest, signal) {
  for (const c of manifest.components) for (const f of c.files) if (!await matches(root, f, signal)) throw Error('Staged update file failed verification: ' + f.path);
}
async function prepareUpdate({root, manifest, signal, onProgress = () => {}, fetchImpl = fetch, extractImpl = extract}) {
  root = await fs.realpath(root); validateManifest(manifest, manifest.version);
  const installed = JSON.parse(await fs.readFile(path.join(root, 'resources/app/package.json'), 'utf8')).version;
  if (compareVersions(manifest.version, installed) <= 0) throw Error('The selected version is not newer than the installed version.');
  const target = path.join(path.dirname(root), 'VideoKapp-' + manifest.version);
  if (await fs.stat(target).then(() => true, () => false)) throw Error('Target version folder already exists: ' + target);
  const plan = await planUpdate(root, manifest, {signal, onProgress});
  onProgress({phase: 'plan', text: `Download ${plan.changed.map(c => c.id).join(', ') || 'nothing'}: ${(plan.bytes / 1048576).toFixed(1)} MB. Reuse ${plan.reused.map(c => c.id).join(', ')}.`, progress: 0, bytes: plan.bytes});
  const stage = await fs.mkdtemp(path.join(path.dirname(root), '.videokapp-update-'));
  const payload = path.join(stage, 'payload'); await fs.mkdir(payload);
  try {
    let received = 0;
    for (const c of plan.reused) for (const f of c.files) {
      signal?.throwIfAborted(); const dest = path.join(payload, f.path); await fs.mkdir(path.dirname(dest), {recursive: true});
      await fs.copyFile(path.join(root, f.path), dest);
    }
    for (const c of plan.changed) {
      signal?.throwIfAborted(); const archive = path.join(stage, c.asset);
      await download(assetURL(manifest.version, c.asset), archive, c, {fetchImpl, signal, onBytes: bytes => onProgress({phase: 'download', text: `Downloading ${c.id}: ${((received + bytes) / 1048576).toFixed(1)} / ${(plan.bytes / 1048576).toFixed(1)} MB`, progress: (received + bytes) / plan.bytes})});
      received += c.bytes;
      onProgress({phase: 'verify', text: `Unpacking and verifying ${c.id}…`, progress: null});
      await extractImpl(archive, payload, c, {signal});
    }
    await verifyPayload(payload, manifest, signal); signal?.throwIfAborted();
    const result = {schema: 1, oldRoot: root, target, stage, payload, manifest, bytes: plan.bytes, components: plan.changed.map(c => c.id)};
    await fs.writeFile(path.join(stage, 'plan.json'), JSON.stringify(result));
    onProgress({phase: 'ready', text: `Ready to install ${manifest.version}. Downloaded ${(plan.bytes / 1048576).toFixed(1)} MB.`, progress: 1});
    return result;
  } catch (e) {await fs.rm(stage, {recursive: true, force: true}); throw e;}
}
module.exports = {relativePath, validateManifest, hashFile, readManifest, planUpdate, download, verifyPayload, prepareUpdate};
