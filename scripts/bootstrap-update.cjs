const path = require('node:path'), fs = require('node:fs/promises');
const {checkUpdate} = require('./app-update.cjs');
const {readManifest, prepareUpdate} = require('./delta-update.cjs');
const {apply} = require('./update-apply.cjs');
(async () => {
  const root = path.dirname(process.execPath);
  const current = JSON.parse(await fs.readFile(path.join(root, 'resources/app/package.json'), 'utf8')).version;
  const release = await checkUpdate(current);
  console.log(`Installed: ${current} | GitHub: ${release.latest}`);
  if (!release.available) {console.log('Already up to date.'); return;}
  const controller = new AbortController(); process.on('SIGINT', () => controller.abort());
  let phase = '', bucket = -1;
  const manifest = await readManifest(release.latest, {signal: controller.signal});
  const plan = await prepareUpdate({root, manifest, signal: controller.signal, onProgress: p => {
    const next = Math.floor((p.progress || 0) * 10);
    if (p.phase !== phase || next !== bucket) {console.log(p.text); phase = p.phase; bucket = next;}
  }});
  const readline = require('node:readline/promises').createInterface({input: process.stdin, output: process.stdout});
  let restart;
  try {restart = /^y(es)?$/i.test((await readline.question('Restart the program now? [y/N]: ')).trim());} finally {readline.close();}
  const result = await apply(plan, restart ? {} : {launchImpl: async () => {}});
  if (!restart) console.log('Updated without starting the program. Open it from your shortcut when ready.');
  console.log(`Updated to ${result.installed}. Previous folder kept: ${result.previous}`);
})().catch(e => {console.error('Update failed: ' + e.message + '\nPrevious application folder was not overwritten.'); process.exitCode = 1;});
