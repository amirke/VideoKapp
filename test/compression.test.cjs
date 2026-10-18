const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { compressionPlan } = require('../compression.cjs');
const { inspect, merge, run, binary } = require('../engine.cjs');
const { buildReport } = require('../report.cjs');

test('compression validates quality, bitrate and HDR before writing', () => {
  assert.deepEqual(compressionPlan(), { enabled: false });
  for (const crf of [0, 52, 20.5, NaN]) assert.throws(() => compressionPlan({ enabled: true, crf }), /CRF/);
  for (const bitrate of [0, 101, NaN]) assert.throws(() => compressionPlan({ enabled: true, mode: 'bitrate', bitrate }), /bitrate/);
  assert.throws(() => compressionPlan({ enabled: true }, [{ metadata: { streams: [{ codec_type: 'video', color_transfer: 'smpte2084' }] } }]), /HDR/);
});

test('both compression modes produce decodable H264 video and preserve AAC audio', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'chronomerge-compression-'));
  try {
    const source = path.join(root, 'source.mp4');
    await run(binary('ffmpeg'), ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=320x240:r=25:d=1', '-f', 'lavfi', '-i', 'sine=sample_rate=48000:duration=1', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', source]);
    const f = await inspect(source);
    for (const mode of ['quality', 'bitrate']) {
      const output = path.join(root, `${mode}.mp4`);
      const result = await merge([f, f], output, { compression: { enabled: true, mode, crf: 20, bitrate: 1 } });
      const meta = await inspect(output);
      const v = meta.metadata.streams.find(s => s.codec_type === 'video');
      assert.equal(v.codec_name, 'h264'); assert.equal(v.pix_fmt, 'yuv420p');
      assert.equal(v.width, 320); assert.equal(v.r_frame_rate, '25/1');
      assert.ok(Math.abs(meta.duration - 2) < 0.15);
      assert.equal(result.diagnostics.compression.audio, 'copy');
      await run(binary('ffmpeg'), ['-v', 'error', '-xerror', '-i', output, '-f', 'null', '-']);
      const report = buildReport({ files: [f, f], output, result });
      assert.match(report, /Size reduction/); assert.match(report, /Merge and compression in one pass/);
      assert.doesNotMatch(report, /Video\/audio stream copy; no re-encoding/);
    }
    const invalid = path.join(root, 'invalid.mp4');
    await assert.rejects(merge([f, f], invalid, { compression: { enabled: true, crf: 52 } }), /CRF/);
    await assert.rejects(fs.access(invalid));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
