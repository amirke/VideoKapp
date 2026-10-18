'use strict';
const element = id => document.getElementById(id);
element('launch').addEventListener('click', () => {
  element('launch-status').textContent = 'Open requested. Accept the browser prompt.';
});
element('check-update').addEventListener('click', async () => {
  const button = element('check-update');
  button.disabled = true;
  button.dataset.state = '';
  element('update-download').hidden = true;
  element('update-instructions').hidden = true;
  element('update-status').textContent = 'Checking…';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://api.github.com/repos/amirke/VideoKapp/releases/latest', {
      headers: {Accept: 'application/vnd.github+json'}, cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) throw new Error('GitHub unavailable');
    const release = await response.json();
    const asset = release.assets?.find(item => item.name === 'VideoKapp-Windows-x64.zip');
    if (release.draft || release.prerelease || !asset) throw new Error('No Windows release');
    const url = new URL(asset.browser_download_url);
    if (url.origin !== 'https://github.com' || !url.pathname.startsWith('/amirke/VideoKapp/releases/download/')) throw new Error('Invalid download');
    element('download').href = url.href;
    const patch = release.assets?.find(item => item.name === 'VideoKapp-Update.zip');
    const patchURL = patch ? new URL(patch.browser_download_url) : url;
    if (patchURL.origin !== 'https://github.com' || !patchURL.pathname.startsWith('/amirke/VideoKapp/releases/download/')) throw new Error('Invalid update download');
    element('update-download').href = patchURL.href;
    element('update-instructions').textContent = patch ? 'Extract the update ZIP → close VideoKapp → Update.cmd.' : 'Close VideoKapp → Extract All → Install.cmd.';
    element('update-download').hidden = false;
    element('update-instructions').hidden = false;
    element('update-status').textContent = `Latest release: ${release.tag_name}.`;
    button.dataset.state = 'success';
  } catch {
    element('update-status').textContent = 'Check failed. Try again or open Release details below.';
    button.dataset.state = 'error';
  } finally {
    clearTimeout(timer);
    button.disabled = false;
  }
});
