const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const E = require('./engine.cjs');
const {checkUpdate} = require('./app-update.cjs');
const version = require('./package.json').version;
const components = {
  Merge: ['engine.cjs', 'ordering.cjs', 'compression.cjs', 'losslesscut-concat.cjs'],
  Convert: ['compression.cjs', 'editing.cjs'],
  'Summary & Time-lapse': ['scenes.cjs', 'editing.cjs'],
  'RESIZE TO AI': ['ai-resize.cjs'], OLLAMA: ['ollama.cjs'], GEMINI: ['gemini.cjs'],
  'Ride Player': ['ride.cjs', 'ride-data.js', 'fit.cjs', 'timeline.cjs', 'ride-export.cjs', 'ride-providers.js'],
  Upload: ['services.cjs', 'youtube.cjs'], Settings: ['config.cjs'], Reports: ['report.cjs', 'metrics.cjs', 'ride-diagnostic.cjs'],
  Tests: ['app-update.cjs', 'desktop-launch.cjs'],
};
async function runDiagnostics({signal, onProgress = () => {}, online = false, geminiKey = '', geminiModel = '', ollamaModel = ''} = {}) {
  const rows = [], jobs = [], started = new Date().toISOString();
  let root, source, fixture, merged;
  const add = (tab, name, run) => jobs.push({tab, name, run});
  const command = args => E.run(E.binary('ffmpeg'), ['-v', 'error', '-nostdin', ...args], {signal, timeout: 20000});
  const json = async (url, headers = {}) => {
    const combined = AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(6000)]);
    const response = await fetch(url, {headers, signal: combined});
    if (!response.ok) throw Error(`Service returned HTTP ${response.status}.`);
    return response.json();
  };
  for (const [tab, files] of Object.entries(components)) for (const file of files) add(tab, file, async () => {
    require('./' + file); return 'Module loads. Workflow checks are listed separately.';
  });
  add('All tabs', 'Packaged UI dependencies', async () => {
    const html = await fs.readFile(path.join(__dirname, 'index.html'), 'utf8');
    const files = [...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|mjs|cjs|css))"/g)].map(match => match[1]);
    files.push('vendor/maplibre-gl.mjs', 'vendor/maplibre-gl-worker.mjs');
    for (const file of files) await fs.access(path.join(__dirname, file));
    return `${files.length} UI scripts, styles and map dependencies found.`;
  });
  add('All tabs', 'Temporary output read / write', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'videokapp-tests-'));
    const file = path.join(root, 'read-write.txt'); await fs.writeFile(file, 'VideoKapp');
    assert.equal(await fs.readFile(file, 'utf8'), 'VideoKapp'); return 'Read/write verified in a temporary folder.';
  });
  for (const name of ['ffmpeg', 'ffprobe']) add('All video tabs', name, async () => {
    const r = await E.run(E.binary(name), ['-version'], {signal, timeout: 8000}); return r.stdout.split(/\r?\n/)[0];
  });
  add('Convert', 'H.264 + AAC encode and inspect', async () => {
    if (!root) throw Error('Temporary folder unavailable.');
    fixture = path.join(root, 'sample.mp4');
    await command(['-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=12', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100', '-t', '1', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', fixture]);
    source = await E.inspect(fixture, signal);
    assert.equal(source.metadata.streams[0].codec_name, 'h264');
    assert.ok(source.metadata.streams.some(s => s.codec_name === 'aac'));
    return 'Encoded and inspected a 1-second synthetic video. No user media used.';
  });
  add('Merge', 'Stream-copy merge + timeline', async () => {
    if (!source) throw Error('Synthetic source unavailable.');
    merged = path.join(root, 'merged.mp4'); await E.merge([source, source], merged, {signal});
    const output = await E.inspect(merged, signal); assert.ok(output.duration >= 1.8 && output.duration < 2.5);
    const timeline = require('./timeline.cjs'); const log = await timeline.read(merged + '.timeline.json');
    await timeline.verify(log, merged); assert.equal(log.segments.length, 2);
    return 'Merged two clips; verified duration and matching timeline.';
  });
  add('RESIZE TO AI', 'Scale / FPS / encode', async () => {
    if (!source) throw Error('Synthetic source unavailable.');
    const output = path.join(root, 'proxy.mp4');
    await command(['-i', fixture, '-vf', 'scale=80:-2,fps=2', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', output]);
    const result = await E.inspect(output, signal); assert.equal(result.metadata.streams[0].width, 80);
    assert.equal(result.metadata.streams[0].r_frame_rate, '2/1'); return 'Reduced resolution and FPS verified.';
  });
  add('Summary & Time-lapse', 'Scene detector', async () => {
    if (!source) throw Error('Synthetic source unavailable.');
    const result = await require('./scenes.cjs').detect(source, {signal, minScene: .25});
    assert.ok(result.scenes.length); return 'Scene detector processed the synthetic clip.';
  });
  add('Summary & Time-lapse', 'Time-lapse encoder', async () => {
    if (!source) throw Error('Synthetic source unavailable.');
    const output = path.join(root, 'timelapse.mp4');
    await command(['-i', fixture, '-vf', 'setpts=PTS/2,fps=12', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', output]);
    const result = await E.inspect(output, signal); assert.ok(result.duration < source.duration * .8);
    return '2x acceleration encoded and duration verified.';
  });
  add('Ride Player', 'PiP video compositor', async () => {
    if (!source) throw Error('Synthetic source unavailable.');
    const output = path.join(root, 'pip.mp4');
    await command(['-i', fixture, '-f', 'lavfi', '-i', 'color=blue:size=40x30:rate=12', '-filter_complex', '[0:v][1:v]overlay=10:10:shortest=1[v]', '-map', '[v]', '-t', '1', '-c:v', 'libx264', '-preset', 'ultrafast', output]);
    const result = await E.inspect(output, signal); assert.equal(result.metadata.streams[0].width, 160);
    return 'Synthetic PiP encoded. Actual map capture and synchronized export need a loaded ride.';
  });
  add('Ride Player', 'GPS interpolation / absolute time', async () => {
    const D = require('./ride-data.js'), t = Date.parse('2026-09-11T04:00:00Z');
    const points = [{lat: 31, lon: 35, time: t, group: 0}, {lat: 32, lon: 36, time: t + 10000, group: 0}];
    assert.equal(D.position(points, t + 5000).lat, 31.5); assert.equal(D.position(points, t - 1), null);
    assert.equal(D.realAt({segments: [{start: 0, end: 10, utcStart: t, rate: 1}]}, 5), t + 5000);
    return 'Position interpolation, unavailable-GPS boundary and video clock verified.';
  });
  add('Settings', 'CFG round trip', async () => {
    const C = require('./config.cjs'), input = {quality: 18};
    const packed = C.pack(input, {}, {}); assert.deepEqual(C.unpack(JSON.stringify(packed), {}).settings, input);
    return 'Settings serialized and restored; no saved CFG modified.';
  });
  add('Reports', 'Report formatter', async () => {
    const report = require('./report.cjs').buildReport({files: [], output: 'synthetic.mp4', error: Error('Synthetic diagnostic'), startedAt: Date.now()});
    assert.ok(report.includes('Synthetic diagnostic')); return 'Diagnostic error report generated in memory.';
  });
  add('OLLAMA', 'Local server / selected model', async () => {
    const data = await json('http://127.0.0.1:11434/api/tags');
    const model = data.models?.find(m => m.name === ollamaModel || m.name === ollamaModel + ':latest');
    return model ? `Selected model available: ${model.name}. Inference not run.` : {status: 'needs setup', detail: 'Server responds; select/download the model in OLLAMA.'};
  });
  add('Tests', 'Live GitHub version comparison', async () => online
    ? JSON.stringify(await checkUpdate(version, {signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(12000)])}))
    : {status: 'not run', detail: 'Enable online checks.'});
  add('GEMINI', 'API key / selected model', async () => {
    if (!online) return {status: 'not run', detail: 'Enable online checks.'};
    if (!geminiKey) return {status: 'needs setup', detail: 'Enter an API key in GEMINI. No video is uploaded by this check.'};
    if (!/^[\w.-]+$/.test(geminiModel)) return {status: 'needs setup', detail: 'Select a Gemini model.'};
    await json('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(geminiModel), {'x-goog-api-key': geminiKey});
    return 'API key/model lookup succeeded. Analysis quota and video inference not tested.';
  });
  add('Ride Player', 'Online map tile', async () => {
    if (!online) return {status: 'not run', detail: 'Enable online checks.'};
    const response = await fetch('https://tile.openstreetmap.org/0/0/0.png', {headers: {'User-Agent': 'VideoKapp/' + version}, signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(6000)])});
    if (!response.ok || !response.headers.get('content-type')?.includes('image')) throw Error('Map tile request failed.');
    const data = await response.arrayBuffer(); assert.ok(data.byteLength > 0); return 'OpenStreetMap image downloaded. Other providers need individual visual checks.';
  });
  add('Upload', 'Publishing / OAuth flow', async () => ({status: 'manual', detail: 'Use Upload to check your connection and publish a chosen file. Diagnostics never uploads or disconnects accounts.'}));
  try {
    for (const job of jobs) {
      if (signal?.aborted) break;
      onProgress({progress: rows.length / jobs.length, text: job.tab + ': ' + job.name});
      const begin = Date.now(); let row;
      try { const result = await job.run(); row = {status: 'pass', detail: typeof result === 'string' ? result : result.detail, ...(typeof result === 'object' ? result : {})}; }
      catch (error) { row = {status: signal?.aborted ? 'stopped' : 'fail', detail: String(error.message).slice(0, 1000)}; }
      rows.push({tab: job.tab, name: job.name, ...row, ms: Date.now() - begin});
      onProgress({progress: rows.length / jobs.length, row: rows.at(-1), text: job.name});
    }
    return {version, started, stopped: !!signal?.aborted, planned: jobs.length, rows};
  } finally {
    if (root) await fs.rm(root, {recursive: true, force: true}); // Only our freshly created temporary fixture directory.
  }
}
module.exports = {runDiagnostics};
