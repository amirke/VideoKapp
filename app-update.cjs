const endpoint = 'https://api.github.com/repos/amirke/VideoKapp/releases/latest';
function compareVersions(a, b) {
  const parse = value => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value);
    if (!match) throw Error('Unsupported release version.');
    return match.slice(1).map(Number);
  };
  const aa = parse(a), bb = parse(b);
  for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return Math.sign(aa[i] - bb[i]);
  return 0;
}
async function checkUpdate(installed, { fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl(endpoint, {headers: {Accept: 'application/vnd.github+json'}, cache: 'no-store', signal: signal || AbortSignal.timeout(12000)});
  if (!response.ok) throw Error(`GitHub update check failed (HTTP ${response.status}).`);
  const release = await response.json();
  const asset = release.assets?.find(item => item.name === 'VideoKapp-Windows-x64.zip');
  if (release.draft || release.prerelease || !asset) throw Error('No stable Windows package is available.');
  const url = new URL(asset.browser_download_url);
  if (url.origin !== 'https://github.com' || !url.pathname.startsWith('/amirke/VideoKapp/releases/download/')) throw Error('Unexpected update download URL.');
  const comparison = compareVersions(release.tag_name, installed);
  return {installed, latest: release.tag_name.replace(/^v/, ''), available: comparison > 0, ahead: comparison < 0, download: url.href, checkedAt: new Date().toISOString()};
}
module.exports = {compareVersions, checkUpdate};
