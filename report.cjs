// SPDX-License-Identifier: GPL-2.0-only
const os = require('node:os');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { version } = require('./package.json');
const number = value => Number.isFinite(value) ? value.toFixed(3) : 'unavailable';
const percent = value => Number.isFinite(value) ? `${value.toFixed(1)}%` : 'not enough samples';

function buildReport({ files, output, result, error, metrics, startedAt }) {
  const d = result?.diagnostics || error?.diagnostics || {};
  const elapsed = d.ffmpegMs / 1000;
  const benchmark = /utime=([\d.]+)s stime=([\d.]+)s rtime=([\d.]+)s/.exec(d.stderr || '');
  const maxrss = /maxrss=(\d+)Ki?B/.exec(d.stderr || '');
  const volumes = [...new Set(files.map(f => require('node:path').parse(f.path).root))];
  const outputVolume = require('node:path').parse(output).root;
  const sameRoot = volumes.includes(outputVolume);
  const lines = [
    `ChronoMerge ${version} — merge performance report`,
    `Status: ${error ? /cancelled/i.test(error.message) ? 'CANCELLED' : 'FAILED' : 'SUCCESS'}`,
    `Started (UTC): ${d.startedAt || startedAt || 'unavailable'}`,
    `Finished (UTC): ${new Date().toISOString()}`,
    `System: ${os.platform()} ${os.release()} ${os.arch()}`,
    `CPU: ${os.cpus()[0]?.model || 'unavailable'}; logical processors: ${os.cpus().length}`,
    '', 'TIMELINE LOG', d.timelinePath || d.timelineWarning || 'Not available.', '', 'MODE',
    d.compression?.enabled ? `Video: ${d.compression.codec}, preset ${d.compression.preset}, ${d.compression.mode === 'quality' ? 'CRF' : 'average Mbps'} ${d.compression.value}; audio: ${d.compression.audio}. Merge and compression in one pass.` : d.compression?.copySpeed ? `Original-quality time-lapse: video packets copied, timestamps accelerated ${d.compression.copySpeed}x; audio removed; no re-encoding.` : 'Video/audio stream copy; no re-encoding.',
    `Conversion settings: ${JSON.stringify(d.compression || { enabled: false })}`,
    ...(d.summary ? ['SUMMARY EDIT: '+JSON.stringify(d.summary), 'Summary clips were '+(d.summary.quality==='copy'?'copied without re-encoding':'encoded')+' before the final stream-copy join. Size/rate/stage figures below describe that final join and its temporary clip inputs; summary.totalMs covers the complete export.'] : []),
    'Fast Start: OFF. Post-merge ffprobe/duration verification: OFF.',
    'Output: one direct write through an exclusively created seekable file handle.',
    'Finalization: close handle only; no full-file move/copy, no forced disk flush.',
    '', 'SIZE AND TIMING',
    `Selected clips: ${files.length}`,
    `Source bytes: ${d.inputBytes ?? files.reduce((sum, f) => sum + (f.size || 0), 0)}`,
    `Output bytes: ${d.outputBytes ?? 'unavailable'}`,
    `Size reduction (negative means larger): ${d.inputBytes > 0 && d.outputBytes != null && !error ? percent(100 * (1 - d.outputBytes / d.inputBytes)) : 'unavailable'}`,
    `Expected media duration (seconds; planned output, not output verification): ${number(d.expectedDuration)}`,
    `Last media progress (seconds in output timeline; not verified duration): ${number(d.lastMediaSeconds)}`,
    `Selected-file metadata loading before merge (sum, seconds): ${number(files.reduce((s, f) => s + (f.probeMs || 0), 0) / 1000)}`,
    `Preflight (seconds): ${number(d.preflightMs / 1000)}`,
    `FFmpeg merge including muxer finalization (seconds): ${number(elapsed)}`,
    `Handle close / output-size check (seconds): ${number(d.finalizeMs / 1000)}`,
    `Engine total (seconds; excludes report writing): ${number(d.totalMs / 1000)}`,
    `Input-size equivalent rate (MiB/s): ${elapsed > 0 && !error ? number(d.inputBytes / 1048576 / elapsed) : 'unavailable'}`,
    `Output-size equivalent rate (MiB/s): ${elapsed > 0 && !error ? number(d.outputBytes / 1048576 / elapsed) : 'unavailable'}`,
    'Rates include filesystem caching; they are NOT measured physical disk throughput.',
    '', 'RESOURCE USE',
    `FFmpeg CPU user/system/wall seconds: ${benchmark ? `${benchmark[1]} / ${benchmark[2]} / ${benchmark[3]}` : 'unavailable'}`,
    `FFmpeg peak RSS (KiB; as reported by FFmpeg): ${maxrss && Number(maxrss[1]) > 0 ? maxrss[1] : 'unavailable'}`,
    `Whole-computer CPU average / peak: ${percent(metrics?.averageCpu)} / ${percent(metrics?.peakCpu)}`,
    `Whole-computer peak used memory (GiB): ${number(metrics?.peakMemory / 1024 ** 3)}`,
    'Whole-computer readings include other apps. GPU and per-disk counters are not measured.',
    '', 'STORAGE AND NEXT COMPARISON',
    `Input path roots: ${volumes.join(', ')}`,
    `Output path root: ${outputVolume}`,
    `Input/output share a path root: ${sameRoot ? 'yes' : 'no'} (does not identify physical disks).`,
    'Disk type / USB speed / network link / antivirus impact: not measured.',
    'Compare the same clips on a local SSD. If possible, compare a separate physical output disk.',
    'Compare FFmpeg seconds and MiB/s across runs; cache effects can make repeat runs faster.',
    'If whole-computer CPU is low, storage may be limiting; this report alone does not prove that.',
    '', 'OUTPUT', output,
    '', 'INPUT ORDER',
    ...files.map((f, i) => `${i + 1}. ${f.path}\n   bytes=${f.size ?? '?'}; seconds=${number(f.duration)}; ${f.description || ''}`),
    '', 'RESULT / DIAGNOSTICS',
    `FFmpeg exit code: ${d.exitCode ?? 'not available / not started'}`,
    `Error: ${error?.message || 'none'}`,
    `Cleanup warning: ${d.cleanupWarning || 'none'}`,
    `Warnings: ${result?.warnings || 'See FFmpeg log below'}`,
    'Arguments (JSON; fd: uses inherited descriptor 3, not a shell command):',
    JSON.stringify(d.commandArgs || []),
    '', 'FFMPEG LOG (last 24,000 characters)', d.stderr || '(none)',
  ];
  return lines.join('\n');
}
async function saveReport(data) {
  const text = buildReport(data);
  const reportPath = `${data.output}.${randomUUID().slice(0, 8)}.merge-report.txt`;
  try { await fs.writeFile(reportPath, text, { encoding: 'utf8', flag: 'wx' }); return { text, path: reportPath }; }
  catch (error) { return { text, path: null, saveError: error.message }; }
}
module.exports = { buildReport, saveReport };
