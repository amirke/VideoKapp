// SPDX-License-Identifier: GPL-2.0-only
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { makeConcatText, makeConcatArgs } = require('./losslesscut-concat.cjs');

const { compressionPlan } = require('./compression.cjs');
function binary(name) { return path.join(__dirname, 'bin', `${name}.exe`); }
function run(exe, args, { input, signal, progress, timeout = 0, outputFd } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Operation cancelled.'));
    const child = spawn(exe, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe', ...(outputFd == null ? [] : [outputFd])] });
    let stdout = '', stderr = '', aborted = false, timedOut = false;
    const cancel = () => { aborted = true; child.kill(); };
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = timeout ? setTimeout(() => { timedOut = true; child.kill(); }, timeout) : null;
    child.stdout.on('data', data => {
      stdout = (stdout + data.toString()).slice(-4_000_000);
      progress?.(data.toString());
    });
    child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-24000); });
    child.stdin.on('error', () => {}); // A failed/cancelled process may close stdin early.
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); };
    child.on('error', error => { cleanup(); reject(error); });
    child.on('close', code => {
      cleanup();
      if (aborted || timedOut || code !== 0) {
        const error = new Error(aborted ? 'Operation cancelled.' : timedOut ? 'Reading video details timed out.' : stderr.trim() || `Process failed: ${code}`);
        error.stderr = stderr; error.exitCode = code; reject(error);
      }
      else resolve({ stdout, stderr });
    });
    child.stdin.end(input);
  });
}

function recordingDate(metadata) {
  const tags = [metadata.format?.tags, ...(metadata.streams || []).map(s => s.tags)];
  for (const tag of tags) {
    for (const key of ['com.apple.quicktime.creationdate', 'creation_time', 'date']) {
      if (!tag?.[key]) continue;
      const time = Date.parse(tag[key]);
      if (Number.isFinite(time) && time > 0) return time;
    }
  }
  return null;
}

async function inspect(file, signal) {
  const started = performance.now();
  const real = await fs.realpath(file);
  const stat = await fs.stat(real);
  if (!stat.isFile()) throw new Error('Please select a video file.');
  const { stdout } = await run(binary('ffprobe'), [
    '-v', 'error', '-show_format', '-show_streams', '-show_data_hash', 'sha256', '-of', 'json', real,
  ], { signal, timeout: 60000 });
  const metadata = JSON.parse(stdout);
  const videos = metadata.streams?.filter(s => s.codec_type === 'video' && !s.disposition?.attached_pic) || [];
  if (videos.length !== 1 || metadata.streams.find(s => s.codec_type === 'video') !== videos[0]) {
    throw new Error('A single primary video track without cover art is required.');
  }
  const duration = Number(metadata.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Unable to read the video duration.');
  return {
    id: randomUUID(), path: real, name: path.basename(real),
    created: stat.birthtimeMs > 0 ? stat.birthtimeMs : null,
    recorded: recordingDate(metadata), modified: stat.mtimeMs,
    size: stat.size, duration, metadata, probeMs: performance.now() - started,
    description: `${videos[0].width}×${videos[0].height} · ${videos[0].codec_name}`,
  };
}

const sharedKeys = ['codec_type', 'codec_name', 'profile', 'level', 'time_base', 'extradata_hash'];
const videoKeys = ['width', 'height', 'pix_fmt', 'r_frame_rate', 'sample_aspect_ratio', 'field_order', 'color_range', 'color_space', 'color_transfer', 'color_primaries'];
const audioKeys = ['sample_fmt', 'sample_rate', 'channels', 'channel_layout'];
function signature(stream) {
  const keys = [...sharedKeys, ...(stream.codec_type === 'video' ? videoKeys : stream.codec_type === 'audio' ? audioKeys : [])];
  return Object.fromEntries(keys.map(key => [key, stream[key] ?? null]).concat([
    ['rotation', stream.side_data_list?.find(s => s.rotation !== undefined)?.rotation ?? stream.tags?.rotate ?? 0],
  ]));
}
function compatibility(files, compression) {
  try { compressionPlan(compression, files); } catch (error) { return { ok: false, message: error.message }; }
  if (files.length < (compression?.operation === 'convert' ? 1 : 2)) return { ok: false, message: 'Select at least two clips to merge.' };
  if (compression?.operation === 'convert') return { ok: true, message: 'Each selected file will be converted separately.' };
  const reference = files[0].metadata.streams.map(signature);
  for (const file of files.slice(1)) {
    const actual = file.metadata.streams.map(signature);
    if (JSON.stringify(reference) !== JSON.stringify(actual)) {
      return { ok: false, message: `“${file.name}” is not compatible with “${files[0].name}” for lossless merging. Video/audio parameters and the number and order of tracks must match.` };
    }
  }
  return { ok: true, message: compression?.enabled ? 'The clips are compatible for merging and compressing in one pass.' : 'The clips are compatible for merging without re-encoding.' };
}

async function merge(files, output, { signal, onProgress = () => {}, compression, copyRange } = {}) {
  const started = performance.now();
  const diagnostics = {
    mode: 'fast-direct-stream-copy', startedAt: new Date().toISOString(),
    inputBytes: files.reduce((sum, file) => sum + file.size, 0),
    expectedDuration: files.reduce((sum, file) => sum + file.duration, 0),
    preflightMs: 0, ffmpegMs: 0, finalizeMs: 0, totalMs: 0,
    outputBytes: null, lastMediaSeconds: null, exitCode: null,
    commandArgs: [], stderr: '',
  };
  let handle, owned = false, completed = false, stage = 'preflight', stageStart = started;
  try {
    if (signal?.aborted) throw new Error('Operation cancelled.');
    diagnostics.compression = compressionPlan(compression, files);
    if(copyRange){
      if(files.length!==1||compression?.operation!=='convert'||compression.enabled||!Number.isFinite(copyRange.start)||!Number.isFinite(copyRange.duration)||copyRange.start<0||copyRange.duration<=0||copyRange.start+copyRange.duration>files[0].duration+.001)throw new Error('Invalid original-quality cut range.');
      diagnostics.compression={enabled:false,start:copyRange.start,duration:copyRange.duration};diagnostics.expectedDuration=copyRange.duration;
    }
    if (diagnostics.compression.enabled) {
      diagnostics.mode = compression?.operation === 'convert' ? 'convert-file' : 'merge-and-compress';
      diagnostics.expectedDuration = Math.min(diagnostics.expectedDuration - diagnostics.compression.start, diagnostics.compression.duration || Infinity) / diagnostics.compression.speed;
    }
    if(diagnostics.compression.copySpeed){diagnostics.mode='original-quality-timelapse';diagnostics.expectedDuration/=diagnostics.compression.copySpeed;}
    const check = compatibility(files, compression);
    if (!check.ok) throw new Error(check.message);
    const format = { '.mp4': 'mp4', '.mkv': 'matroska', '.mov': 'mov' }[path.extname(output).toLowerCase()];
    if (!format) throw new Error('Choose an MP4, MOV or MKV extension.');
    const canonicalOutput = path.join(await fs.realpath(path.dirname(output)), path.basename(output));
    if (files.some(f => f.path.toLowerCase() === canonicalOutput.toLowerCase())) throw new Error('Cannot overwrite a source file.');
    for (const file of files) {
      const stat = await fs.stat(file.path);
      if (stat.size !== file.size || stat.mtimeMs !== file.modified) throw new Error(`“${file.name}” has changed. Remove it and add it again.`);
    }
    // Exclusive creation prevents overwriting existing files, including races.
    // FFmpeg writes through the inherited handle, not by reopening the pathname.
    try { handle = await fs.open(output, 'wx+'); owned = true; }
    catch (error) { if (error.code === 'EEXIST') throw new Error('The output file already exists. Choose a new name.'); throw error; }
    diagnostics.preflightMs = performance.now() - stageStart;
    stage = 'ffmpeg'; stageStart = performance.now();
    diagnostics.commandArgs = makeConcatArgs({ format, compression: diagnostics.compression, source: compression?.operation === 'convert' && files.length === 1 ? files[0].path : undefined });
    let buffer = '';
    const result = await run(binary('ffmpeg'), diagnostics.commandArgs, {
      input: compression?.operation === 'convert' && files.length === 1 ? undefined : makeConcatText(files.map(f => f.path)), signal, outputFd: handle.fd,
      progress: chunk => {
        buffer += chunk;
        const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) {
          const match = /^out_time_us=(\d+)/.exec(line);
          if (match) {
            diagnostics.lastProgressTimestampSeconds = Number(match[1]) / 1e6;
              // setts changes packet timestamps after FFmpeg calculates its progress clock.
              diagnostics.lastMediaSeconds = diagnostics.lastProgressTimestampSeconds / (diagnostics.compression.copySpeed || 1);
            onProgress(Math.min(0.995, diagnostics.lastMediaSeconds / diagnostics.expectedDuration));
          }
        }
      },
    });
    diagnostics.ffmpegMs = performance.now() - stageStart;
    diagnostics.stderr = result.stderr; diagnostics.exitCode = 0;
    stage = 'finalize'; stageStart = performance.now();
    if (signal?.aborted) throw new Error('Operation cancelled.');
    diagnostics.outputBytes = (await handle.stat()).size;
    if (!diagnostics.outputBytes) throw new Error('FFmpeg produced an empty output file.');
    await handle.close(); handle = null;
    diagnostics.finalizeMs = performance.now() - stageStart;
    diagnostics.totalMs = performance.now() - started;
    completed = true;
    let timelinePath=null,timelineWarning='';
    try{const timeline=require('./timeline.cjs');timelinePath=(await timeline.save(output,await timeline.build(files,diagnostics.compression))).path;diagnostics.timelinePath=timelinePath;}
    catch(e){timelineWarning='Timeline LOG was not saved: '+e.message;diagnostics.timelineWarning=timelineWarning;}
    onProgress(1);
    return {timelinePath,
      path: output, duration: diagnostics.expectedDuration, durationVerified: false,
      warnings: [result.stderr.split('\n').filter(line => /\[(warning|error|fatal)\]/i.test(line)).join('\n').trim(),timelineWarning].filter(Boolean).join('\n'), diagnostics,
    };
  } catch (error) {
    diagnostics[`${stage}Ms`] = performance.now() - stageStart;
    diagnostics.totalMs = performance.now() - started;
    if (error.stderr) diagnostics.stderr = error.stderr;
    if (error.exitCode !== undefined) diagnostics.exitCode = error.exitCode;
    error.diagnostics = diagnostics;
    throw error;
  } finally {
    if (handle) await handle.close().catch(() => {});
    if (owned && !completed) {
      try { await fs.unlink(output); }
      catch (error) { diagnostics.cleanupWarning = `Incomplete output could not be removed: ${error.message}`; }
    }
  }
}

module.exports = { inspect, merge, compatibility, recordingDate, binary, run };
