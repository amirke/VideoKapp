const fs = require('node:fs/promises'), path = require('node:path');
const {spawnSync} = require('node:child_process');
const {hashFile, validateManifest} = require('../delta-update.cjs');
async function build(root, out) {
  root = path.resolve(root); out = path.resolve(out); await fs.mkdir(out, {recursive: true});
  const version = JSON.parse(await fs.readFile(path.join(root, 'resources/app/package.json'), 'utf8')).version;
  const groups = {app: [], maps: [], ffmpeg: [], electron: []};
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name); if (entry.isSymbolicLink()) throw Error('Symlinks are not supported in release packages.');
      if (entry.isDirectory()) {await walk(full); continue;}
      const name = path.relative(root, full).split(path.sep).join('/');
      const group = name.startsWith('resources/app/vendor/') ? 'maps' : name.startsWith('resources/app/bin/') ? 'ffmpeg' : name.startsWith('resources/app/') || ['Install.cmd', 'Install.ps1', 'README.md', 'THIRD_PARTY.md'].includes(name) ? 'app' : 'electron';
      groups[group].push({path: name, bytes: (await fs.stat(full)).size, sha256: await hashFile(full)});
    }
  }
  await walk(root); const manifest = {schema: 1, version, platform: 'win32-x64', components: []};
  for (const [id, files] of Object.entries(groups)) {
    files.sort((a,b) => a.path.localeCompare(b.path));
    const asset = `VideoKapp-${version}-${id}.zip`, zip = path.join(out, asset), spec = path.join(out, id + '-files.json');
    await fs.writeFile(spec, JSON.stringify(files));
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'build-update-zip.ps1'), '-Root', root, '-Output', zip, '-Spec', spec], {windowsHide: true, encoding: 'utf8'});
    if (result.status) throw Error(result.stderr || 'ZIP creation failed.');
    manifest.components.push({id, asset, bytes: (await fs.stat(zip)).size, sha256: await hashFile(zip), files});
    await fs.unlink(spec); console.log(id + ': ' + files.length + ' files, ' + (manifest.components.at(-1).bytes / 1048576).toFixed(2) + ' MB');
  }
  validateManifest(manifest, version); await fs.writeFile(path.join(out, 'VideoKapp-update.json'), JSON.stringify(manifest));
  return manifest;
}
if (require.main === module) build(process.argv[2], process.argv[3]).catch(e => {console.error(e); process.exitCode = 1;});
module.exports = {build};
