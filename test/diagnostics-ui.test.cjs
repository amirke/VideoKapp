const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
test('Tests tab inventories controls, exposes version and reports update states', async () => {
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), {runScripts: 'outside-only'}), w = dom.window;
  const $ = id => w.document.getElementById(id), ok = value => ({ok: true, value});
  w.HTMLMediaElement.prototype.pause = () => {};
  let update = {installed: '3.8.5', latest: '3.8.6', available: true, checkedAt: new Date().toISOString()};
  let copied;
  w.api = {diagnosticsInfo: async () => ok({version: '3.8.5', electron: '42', arch: 'x64', channels: []}), onDiagnosticsProgress: () => {}, checkAppUpdate: async () => ok(update), downloadAppUpdate: async () => ok({ready:true, version:"3.8.6",bytes:1000}), copyField: async s => {copied = s; return ok(true);}};
  try {
    for (const file of ['control-audit.js', 'tabs.js', 'diagnostics-ui.js']) w.eval(fs.readFileSync(file, 'utf8'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal($('app-version').textContent, 'v3.8.5');
    assert.equal(w.document.title, 'VideoKapp - ChronoMerge');
    w.showAppTab('tests'); assert.equal($('page-tests').hidden, false);
    assert.ok(w.auditControls().length > 100);
    assert.equal(w.auditControls().find(c => c.id === 'tests-run').wired, true);
    await $('app-check-update').onclick(); assert.equal($('app-install-update').hidden, false);
    update = {...update, available: false, latest: '3.8.5'};
    await $('app-check-update').onclick(); assert.equal($('app-download-update').hidden, true); assert.match($('app-update-state').textContent, /Up to date/);
    w.api.checkAppUpdate = async () => ({ok: false, error: 'Network offline'});
    await $('app-check-update').onclick(); assert.match($('app-update-state').textContent, /Network offline/);
    await $('tests-copy').onclick(); assert.match(copied, /BUTTON INVENTORY/); assert.match(copied, /Version: 3.8.5/);
  } finally {w.close();}
});
