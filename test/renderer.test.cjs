const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
test('compression controls forward settings and clear removes all entries without launching a window', async () => {
  const root = path.join(__dirname, '..');
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { runScripts: 'outside-only' });
  const w = dom.window, $ = id => w.document.getElementById(id);
  let forgotten, merged;
  const ok = value => ({ ok: true, value });
  w.api = {
    onStatus() {}, onMetrics() {}, onReport() {},
    check: async ids => ok({ ok: ids.length >= 2, message: 'Check complete' }),
    chooseFiles: async () => ok({ errors: [], files: ['a','b'].map((id, i) => ({ id, path: id, name: id, created: i + 1, duration: 1, description: 'H264' })) }),
    chooseOutput: async () => ok('output.mp4'),
    merge: async (ids, config) => { merged = { ids, config }; return ok(null); },
    forget: async ids => { forgotten = [...ids]; return ok(); },
  };
  w.Ordering = require('../ordering.cjs');
  w.eval(fs.readFileSync(path.join(root, 'renderer.js'), 'utf8'));
  try {
    assert.equal($('compress-enabled').checked, false); assert.equal($('crf').disabled, true);
    $('compress-enabled').checked = true; $('compress-enabled').onchange();
    assert.equal($('crf').value, '20'); assert.equal($('crf').disabled, false);
    $('compression-mode').value = 'bitrate'; $('compression-mode').onchange();
    assert.equal($('crf-label').hidden, true); assert.equal($('bitrate').disabled, false);
    $('bitrate').value = '6'; $('bitrate').onchange();
    await $('add').onclick(); await $('choose-output').onclick(); await $('merge').onclick();
    assert.equal(merged.config.enabled, true); assert.equal(merged.config.bitrate, 6);
    assert.equal($('crf').disabled, true); assert.equal($('bitrate').disabled, false);
    const input = $('rows').querySelector('input'); input.checked = false; input.onchange();
    await $('clear').onclick();
    assert.deepEqual(forgotten.sort(), ['a', 'b']); assert.equal($('rows').children.length, 0);
    assert.equal($('merge').disabled, true);
  } finally { await new Promise(resolve => setImmediate(resolve)); w.close(); }
});
