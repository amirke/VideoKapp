const fs = require('node:fs/promises'), path = require('node:path');
const {spawn} = require('node:child_process');
const {verifyPayload, validateManifest} = require('./delta-update.cjs');
function validatePlan(p) {
  validateManifest(p.manifest, p.manifest.version);
  const parent = path.dirname(path.resolve(p.oldRoot));
  if (p.schema !== 1 || !path.isAbsolute(p.stage) || path.dirname(p.stage) !== parent || !path.basename(p.stage).startsWith('.videokapp-update-') || p.payload !== path.join(p.stage, 'payload') || p.target !== path.join(parent, 'VideoKapp-' + p.manifest.version) || p.target === p.oldRoot) throw Error('Invalid installation plan.');
}
async function register(expected, next) {
  await new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'update-register.ps1'), '-ExpectedExe', expected, '-NewExe', next], {windowsHide: true, stdio: ['ignore', 'ignore', 'pipe']});
    let detail = ''; child.stderr.on('data', d => {detail = (detail + d).slice(-2000);});
    child.on('error', reject); child.on('exit', code => code ? reject(Error(detail || 'Shortcut update failed.')) : resolve());
  });
}
async function launch(exe) {
  const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  await new Promise((resolve, reject) => {const child = spawn(exe, [], {env, detached: true, windowsHide: true, stdio: 'ignore'}); child.once('error', reject); child.once('spawn', () => {child.unref(); resolve();});});
}
async function apply(plan, {registerImpl = register, launchImpl = launch} = {}) {
  validatePlan(plan);
  await verifyPayload(plan.payload, plan.manifest);
  // Move only our verified staging folder to its verified sibling target. Never overwrite/delete the old app.
  if (await fs.stat(plan.target).then(() => true, () => false)) throw Error('The target version already exists.');
  await fs.rename(plan.payload, plan.target);
  const oldExe = path.join(plan.oldRoot, 'ChronoMerge.exe'), nextExe = path.join(plan.target, 'ChronoMerge.exe');
  try {await registerImpl(oldExe, nextExe); await launchImpl(nextExe);}
  catch (error) {await registerImpl(nextExe, oldExe).catch(() => {}); throw error;}
  return {installed: plan.manifest.version, previous: plan.oldRoot, current: plan.target};
}
async function run(file, parentPID) {
  const plan = JSON.parse(await fs.readFile(file, 'utf8')); validatePlan(plan);
  const log = path.join(plan.stage, 'update-log.txt');
  const write = text => fs.appendFile(log, new Date().toISOString() + ' ' + text + '\n');
  try {
    await fs.writeFile(path.join(plan.stage, 'helper-ready'), 'ready');
    const deadline = Date.now() + 90000;
    while (parentPID > 0) {
      let alive = true; try {process.kill(parentPID, 0);} catch {alive = false;}
      if (!alive) break;
      if (Date.now() > deadline) throw Error('Application did not close; update not applied.');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    await write('Verifying staged files.');
    const result = await apply(plan); await write(JSON.stringify(result));
    await write('New application launched. Previous folder preserved for manual recovery.');
  } catch (e) {await write('FAILED: ' + e.message + '\nPrevious application: ' + path.join(plan.oldRoot, 'ChronoMerge.exe')); throw e;}
}
if (require.main === module) run(process.argv[2], Number(process.argv[3])).catch(e => {process.stderr.write(e.message); process.exitCode = 1;});
module.exports = {apply, validatePlan};
