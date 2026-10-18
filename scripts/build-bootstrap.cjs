const fs = require('node:fs/promises'), path = require('node:path'), {spawnSync} = require('node:child_process');
(async () => {
  const out = path.resolve(process.argv[2]); await fs.mkdir(path.dirname(out), {recursive: true});
  const stage = await fs.mkdtemp(path.join(path.dirname(out), 'bootstrap-build-'));
  try {
    const files = [];
    for (const name of ['app-update.cjs','delta-update.cjs','update-apply.cjs','update-extract.ps1','update-register.ps1','bootstrap-update.cjs','Update.cmd','Update.ps1']) {
      const source = ['bootstrap-update.cjs','Update.cmd','Update.ps1'].includes(name) ? path.join(__dirname, name) : path.join(__dirname, '..', name);
      await fs.copyFile(source, path.join(stage, name)); files.push({path: name});
    }
    const spec = path.join(stage, 'files.json'); await fs.writeFile(spec, JSON.stringify(files));
    const result = spawnSync('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'build-update-zip.ps1'),'-Root',stage,'-Output',out,'-Spec',spec], {windowsHide: true, encoding: 'utf8'});
    if (result.status) throw Error(result.stderr); console.log(out);
  } finally {await fs.rm(stage, {recursive: true, force: true});}
})().catch(e => {console.error(e); process.exitCode = 1;});
