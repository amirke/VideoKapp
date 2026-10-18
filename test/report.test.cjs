const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildReport, saveReport } = require('../report.cjs');
test('performance report exposes stage times, actual FFmpeg CPU and unverified duration', () => {
  const report = buildReport({
    files: [{ path: 'C:/clips/one.mp4', size: 1048576, duration: 20, probeMs: 100 }],
    output: 'C:/out/merged.mp4',
    result: { warnings: '', diagnostics: {
      inputBytes: 1048576, outputBytes: 1048576, expectedDuration: 20,
      preflightMs: 20, ffmpegMs: 500, finalizeMs: 1, totalMs: 521,
      stderr: '[info] bench: utime=0.200s stime=0.050s rtime=0.500s', exitCode: 0,
    } }, metrics: { averageCpu: 25, peakCpu: 40, peakMemory: 1073741824 },
  });
  assert.match(report, /FFmpeg merge including muxer finalization \(seconds\): 0.500/);
  assert.match(report, /Output-size equivalent rate \(MiB\/s\): 2.000/);
  assert.match(report, /0.200 \/ 0.050 \/ 0.500/);
  assert.match(report, /not output verification/);
  assert.match(report, /NOT measured physical disk throughput/);
  assert.match(report, /CPU average \/ peak: 25.0% \/ 40.0%/);
});
test('report text survives failure to save beside an invalid destination', async () => {
  const report = await saveReport({ files: [], output: '\0bad', error: new Error('Operation cancelled.') });
  assert.equal(report.path, null);
  assert.ok(report.saveError);
  assert.match(report.text, /Status: CANCELLED/);
});
