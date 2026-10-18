const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { inspect, merge, compatibility, binary, run } = require('../engine.cjs');
const { sortFiles } = require('../ordering.cjs');

const root = path.resolve(__dirname, '../../test-media');
async function make(name, color, tone, recorded, size = '320x240', audio = true) {
  const target = path.join(root, name);
  await run(binary('ffmpeg'), [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=${color}:s=${size}:r=25:d=1.2`,
    ...(audio ? ['-f', 'lavfi', '-i', `sine=frequency=${tone}:sample_rate=48000:duration=1.2`] : []),
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-g', '25',
    ...(audio ? ['-c:a', 'aac', '-b:a', '96k'] : []),
    '-metadata', `creation_time=${recorded}`, '-y', target,
  ]);
  return target;
}
test('real video merge preserves chronological color order, audio and source files', async () => {
  await fs.mkdir(root, { recursive: true });
  const paths = [
    await make("clip10 אדום's.mp4", 'red', 440, '2024-01-01T00:00:00Z'),
    await make('clip2 ירוק.mp4', 'lime', 660, '2024-02-01T00:00:00Z'),
    await make('clip1 כחול.mp4', 'blue', 880, '2024-03-01T00:00:00Z'),
  ];
  await fs.writeFile(path.join(root, 'fixtures.json'), JSON.stringify(paths));
  const files = await Promise.all(paths.map(f => inspect(f)));
  const ordered = sortFiles([...files].reverse(), ['recorded', 'created', 'name']);
  assert.deepEqual(ordered.map(f => f.path), paths);
  assert.equal(compatibility(ordered).ok, true);
  const output = path.join(root, `integration-${Date.now()}.mp4`);
  const result = await merge(ordered, output);
  assert.equal(result.durationVerified, false);
  assert.ok(result.diagnostics.ffmpegMs > 0);
  assert.ok(result.diagnostics.outputBytes > 0);
  assert.ok(!result.diagnostics.commandArgs.includes('+faststart'));
  assert.equal(result.diagnostics.commandArgs.at(-1), 'fd:');
  assert.match(result.diagnostics.stderr, /bench:.*utime=/);
  const { saveReport } = require('../report.cjs');
  const report = await saveReport({ files: ordered, output, result });
  assert.match(await fs.readFile(report.path, 'utf8'), /Status: SUCCESS/);
  // MP4 metadata is left at the end rather than doing a faststart rewrite.
  const mp4 = await fs.readFile(output);
  assert.ok(mp4.indexOf(Buffer.from('mdat')) < mp4.indexOf(Buffer.from('moov')));
  const meta = await inspect(output);
  assert.ok(Math.abs(meta.duration - 3.6) < 0.15);
  assert.equal(meta.metadata.streams.filter(s => s.codec_type === 'audio').length, 1);
  // Decode a frame from the middle of each segment and assert dominant RGB color.
  for (const [i, seek] of [0.6, 1.8, 3.0].entries()) {
    const ppm = path.join(root, `frame-${i}.ppm`);
    await run(binary('ffmpeg'), ['-v', 'error', '-ss', String(seek), '-i', output, '-frames:v', '1', '-vf', 'scale=1:1', '-c:v', 'ppm', '-y', ppm]);
    const rgb = [...(await fs.readFile(ppm)).subarray(-3)];
    assert.ok(rgb[i] > 200 && rgb.filter((_, channel) => channel !== i).every(v => v < 45), `Unexpected frame ${i}: ${rgb}`);
  }
  await run(binary('ffmpeg'), ['-v', 'error', '-xerror', '-i', output, '-f', 'null', '-']);
  const before = await fs.stat(paths[0]);
  await assert.rejects(merge(ordered, paths[0]), /source file/);
  assert.equal((await fs.stat(paths[0])).size, before.size);
  await assert.rejects(merge(ordered, output), /already exists/);
  const mismatch = await inspect(await make('mismatch.mp4', 'black', 440, '2024-04-01T00:00:00Z', '640x360'));
  assert.equal(compatibility([files[0], mismatch]).ok, false);
  const noAudio = await inspect(await make('silent.mp4', 'black', 440, '2024-04-01T00:00:00Z', '320x240', false));
  assert.equal(compatibility([files[0], noAudio]).ok, false);
  const silentOut = path.join(root, `silent-${Date.now()}.mkv`);
  await merge([noAudio, noAudio], silentOut);
  assert.equal((await inspect(silentOut)).metadata.streams.filter(s => s.codec_type === 'audio').length, 0);
  const controller = new AbortController(); controller.abort();
  const cancelOut = path.join(root, 'cancelled.mp4');
  await assert.rejects(merge(ordered, cancelOut, { signal: controller.signal }), /cancelled/);
  await assert.rejects(fs.access(cancelOut));
  const activeCancel = new AbortController();
  const activeOut = path.join(root, `active-cancel-${Date.now()}.mp4`);
  await assert.rejects(merge(ordered, activeOut, {
    signal: activeCancel.signal, onProgress: p => { if (p > 0 && p < 1) activeCancel.abort(); },
  }), /cancelled/);
  await assert.rejects(fs.access(activeOut));
  assert.equal((await fs.readdir(root)).filter(f => f.startsWith('.chronomerge-')).length, 0);
});
