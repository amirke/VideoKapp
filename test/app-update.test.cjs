const {test} = require('node:test');
const assert = require('node:assert/strict');
const {compareVersions, checkUpdate} = require('../app-update.cjs');
test('update comparison uses numeric versions and live response, not page version', async () => {
  assert.equal(compareVersions('v3.10.0', '3.9.9'), 1);
  const fetchImpl = async () => ({ok: true, json: async () => ({tag_name: 'v3.8.5', assets: [{name: 'VideoKapp-Windows-x64.zip', browser_download_url: 'https://github.com/amirke/VideoKapp/releases/download/v3.8.5/VideoKapp-Windows-x64.zip'}]})});
  assert.equal((await checkUpdate('3.8.4', {fetchImpl})).available, true);
  assert.equal((await checkUpdate('3.8.5', {fetchImpl})).available, false);
  assert.equal((await checkUpdate('3.8.6', {fetchImpl})).ahead, true);
});
test('failed or untrusted releases cannot provide an update', async () => {
  await assert.rejects(checkUpdate('3.8.4', {fetchImpl: async () => ({ok: false, status: 403})}), /HTTP 403/);
  await assert.rejects(checkUpdate('3.8.4', {fetchImpl: async () => ({ok: true, json: async () => ({tag_name: 'v3.9.0', assets: [{name: 'VideoKapp-Windows-x64.zip', browser_download_url: 'https://example.com/a.zip'}]})})}), /Unexpected/);
});
