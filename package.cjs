// SPDX-License-Identifier: GPL-2.0-only
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const destination = path.resolve(process.argv[2] || path.join(__dirname, '../../outputs/ChronoMerge'));
  try { await fs.access(destination); throw new Error(`Target already exists: ${destination}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const electronExe = require('electron');
  await fs.cp(path.dirname(electronExe), destination, { recursive: true });
  await fs.rename(path.join(destination, 'electron.exe'), path.join(destination, 'ChronoMerge.exe'));
  // The packaged app directory takes precedence over Electron's default starter.
  await fs.unlink(path.join(destination, 'resources/default_app.asar')).catch(() => {});
  const appDestination = path.join(destination, 'resources/app');
  await fs.mkdir(appDestination, { recursive: true });
  for (const name of ['ride-export.cjs', 'ride-export-ui.js', 'gemini.cjs', 'gemini-ui.js', 'ollama.cjs', 'ollama-ui.js', 'process-stop.js', 'button-status.js', 'ai-resize.cjs', 'ai-resize-ui.js', 'ride-diagnostic.cjs', 'ride-zones.js', 'ride-layout.js', 'ride-camera.js', 'vendor', 'ride-providers.js', 'ride-multimap.js', 'ride-time.js', 'tabs.js', 'order-log.cjs', 'order-log-ui.js', 'timeline.cjs', 'ride.cjs', 'ride-data.js', 'ride-map.js', 'ride-ui.js', 'fit.cjs', 'main.cjs', 'preload.cjs', 'engine.cjs', 'compression.cjs', 'config.cjs', 'services.cjs', 'youtube.cjs', 'studio.js', 'editing.cjs', 'editing-ui.js', 'scenes.cjs', 'ordering.cjs', 'metrics.cjs', 'report.cjs', 'losslesscut-concat.cjs', 'index.html', 'style.css', 'renderer.js', 'package.json', 'package-lock.json', 'package.cjs', 'README.md', 'THIRD_PARTY.md', 'LICENSE', 'bin', 'test', 'upstream']) {
    await fs.cp(path.join(__dirname, name), path.join(appDestination, name), { recursive: true });
  }
  await fs.copyFile(path.join(__dirname, 'README.md'), path.join(destination, 'README.md'));
  await fs.copyFile(path.join(__dirname, 'THIRD_PARTY.md'), path.join(destination, 'THIRD_PARTY.md'));
  console.log(`Packaged: ${destination}`);
})().catch(e => { console.error(e); process.exitCode = 1; });
