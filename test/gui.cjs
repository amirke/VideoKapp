const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
(async () => {
  if (process.env.CHRONOMERGE_ALLOW_GUI_TESTS !== '1') throw new Error('GUI tests are disabled on this host because earlier launches produced Windows error dialogs. Use non-GUI tests until the launch issue has been resolved.');
  const root = path.resolve(__dirname, '../../test-media');
  const fixtures = JSON.parse(await fs.readFile(path.join(root, 'fixtures.json'), 'utf8'));
  const env = { ...process.env, CHRONOMERGE_TEST_DATA: path.join(root, 'electron-profile') };
  delete env.ELECTRON_RUN_AS_NODE;
  // CI-only flags: nested Chromium sandbox/GPU subprocesses cannot initialize
  // in the restricted Windows test host. The shipped launcher keeps its sandbox.
  const packaged = process.env.CHRONOMERGE_PACKAGED_EXE;
  const application = await electron.launch({
    ...(packaged ? { executablePath: packaged } : {}),
    args: [...(packaged ? [] : [path.resolve(__dirname, '..')]), '--no-sandbox', '--in-process-gpu'], env,
  });
  application.process().stderr.on('data', data => process.stderr.write(data));
  try {
    const page = await application.firstWindow();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('#add');
    assert.equal(await page.locator('#primary').inputValue(), 'created');
    await application.evaluate(({ dialog }, files) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: files }); }, [...fixtures].reverse());
    await page.locator('#add').click();
    await page.waitForFunction(() => document.querySelectorAll('#rows tr').length === 3 && !document.querySelector('#add').disabled);
    const rowNames = () => page.locator('.filename').allTextContents();
    assert.deepEqual(await rowNames(), fixtures.map(f => path.basename(f)));
    await page.locator('#primary').selectOption('name');
    assert.deepEqual(await rowNames(), [fixtures[2], fixtures[1], fixtures[0]].map(f => path.basename(f)));
    await page.locator('#primary').selectOption('recorded');
    assert.deepEqual(await rowNames(), fixtures.map(f => path.basename(f)));
    await page.locator('#rows tr').nth(1).getByRole('button', { name: /^Move up/ }).click();
    assert.equal(await page.locator('#order-mode').innerText(), 'Manual order');
    assert.equal((await rowNames())[0], path.basename(fixtures[1]));
    await page.locator('#resort').click();
    await page.locator('#rows input').last().uncheck();
    assert.match(await page.locator('#count').innerText(), /^2 of 3/);
    const output = path.join(root, `gui-${Date.now()}.mp4`);
    await application.evaluate(({ dialog }, output) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: output }); }, output);
    assert.equal(await page.locator('#merge').isDisabled(), true);
    await page.locator('#choose-output').click();
    assert.equal(await page.locator('#output-path').innerText(), output);
    await page.locator('#merge').click();
    await page.waitForFunction(() => document.querySelector('#message').textContent.includes('saved successfully'), { timeout: 30000 });
    assert.equal(await page.locator('#metrics').isVisible(), true);
    assert.equal(await page.locator('#report').isVisible(), true);
    assert.match(await page.locator('#report-text').inputValue(), /Status: SUCCESS/);
    assert.ok((await fs.stat(output)).size > 0);
    await page.locator('#all').click();
    await page.locator('#primary').selectOption('created');
    await page.locator('#none').click();
    assert.equal(await page.locator('#merge').isDisabled(), true);
    await page.locator('#clear').click();
    assert.equal(await page.locator('#empty').isVisible(), true);
    await page.reload();
    await page.locator('#add').click();
    await page.waitForFunction(() => document.querySelectorAll('#rows tr').length === 3 && !document.querySelector('#add').disabled);
    await page.screenshot({ path: path.join(root, 'gui-screenshot.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('GUI PASS: creation-date default, name/date sorting, manual order, selection, real export, empty state.');
  } finally { await application.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
