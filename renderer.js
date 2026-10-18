// SPDX-License-Identifier: GPL-2.0-only
const $ = id => document.getElementById(id);
let files = [], busy = false, manual = false, compatible = false, checkVersion = 0, outputPath = null;
const dates = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const priorities = () => ['primary', 'secondary', 'tertiary'].map(id => $(id).value).filter(Boolean);
const chosen = () => files.filter(f => f.selected);
let overrides = {};
function conversionForm() {
 const result={enabled:$('compress-enabled').checked || $('operation').value==='convert',operation:$('operation').value,mode:$('compression-mode').value,crf:Number($('crf').value),bitrate:Number($('bitrate').value),metadata:{}};
 for(const id of ['codec','preset','width','height','fps','container','audio','audioBitrate','sampleRate','channels','start'])result[id]=$(id).value;
 result.duration=$('trim-duration').value;
 for(const key of ['title','comment','artist','copyright','creation_time'])result.metadata[key]=$('meta-'+key).value;
 return result;
}
const compression=()=>({...conversionForm(),overrides});
function syncCompression() {
 const c = compression();
 $('merge-original').checked=!c.enabled;$('merge-original').disabled=busy;
 $('compress-enabled').disabled=busy || c.operation==='convert';
 for(const el of document.querySelectorAll('#advanced-conversion input,#advanced-conversion select,input[id^=meta-]'))el.disabled=busy||!c.enabled;
 $('container').disabled=busy||c.operation!=='convert';
 $('merge').textContent=c.operation==='convert'?'Convert selected files →':'Merge into one video →';
 $('compression-mode').disabled = busy || !c.enabled;
 $('crf').disabled = busy || !c.enabled || c.mode !== 'quality';
 $('bitrate').disabled = busy || !c.enabled || c.mode !== 'bitrate';
 $('crf-label').hidden = c.mode !== 'quality'; $('bitrate-label').hidden = c.mode !== 'bitrate';
 $('compression-help').textContent = !c.enabled ? 'Off: fastest merge, with no quality loss.' : c.mode === 'quality' ? 'CRF 20 is the default. Higher values reduce quality and usually size. Final size is not guaranteed; compression takes longer than copying.' : 'One-pass average bitrate: size and bitrate are approximate. A high setting can make the output larger. Compression takes longer than copying.';
 $('mode-title').textContent = c.enabled ? 'Merge and compress in one pass.' : 'Same quality. One file.';
 $('mode-description').textContent = c.enabled ? `${c.codec==='libx265'?'H.265':'H.264'} compression may reduce size with some quality loss. No large intermediate video is created.` : 'Video and audio are copied without re-encoding. Subtitles, data and chapters are not copied.';
}
$('merge-original').onchange=()=>{$('compress-enabled').checked=!$('merge-original').checked;syncCompression();render();};
for (const id of ['compress-enabled', 'compression-mode', 'crf', 'bitrate']) $(id).onchange = () => { syncCompression(); render(); };
const formatDuration = n => { const total = Math.round(n); return (total >= 3600 ? `${Math.floor(total / 3600)}:` : '') + `${Math.floor(total / 60) % 60}`.padStart(2, '0') + ':' + `${total % 60}`.padStart(2, '0'); };
function message(text, error = false) {if(error)window.reportButtonFailure?.(); $('message').textContent = text; $('message').hidden = !text; $('message').className = error ? 'error' : ''; }
function setBusy(value) {
  busy = value;
  for (const el of document.querySelectorAll('button,select,input,textarea')) el.disabled = value;
  $('cancel').hidden = !value; $('cancel').disabled = false;
  $('activity').hidden = !value;
  syncCompression();
  window.syncEditing?.();
  if (!value) { $('merge').disabled = !compatible || !outputPath; renderRows(); }
}
function showProgress({ text, progress }) { $('activity-text').textContent = text; $('progress').value = progress; $('percentage').textContent = `${Math.round(progress * 100)}%`; }
window.api.onStatus(showProgress);
window.api.onReport(report => {
  $('report').hidden = false;
  $('report-text').value = report.text;
  $('report-location').textContent = report.paths?.length > 1 ? `Saved ${report.paths.length} reports beside the converted files.` : report.path ? `Saved beside the video: ${report.path}` : `Report available here. Could not save a text file: ${report.saveError || 'unknown error'}`;
  $('copy-status').textContent = '';
});
const percent = value => value == null ? '—' : `${value.toFixed(1)}%`;
const gib = value => `${(value / 1024 ** 3).toFixed(1)} GiB`;
window.api.onMetrics(data => {
  $('metrics').hidden = false;
  $('metrics-state').textContent = data.active ? 'Live' : 'Last merge attempt';
  $('metric-cpu').textContent = data.cpu == null ? (data.active ? 'Measuring…' : 'Not enough samples') : percent(data.cpu);
  $('metric-cpu-summary').textContent = `Average ${percent(data.averageCpu)} · Peak ${percent(data.peakCpu)}`;
  $('metric-memory').textContent = `${gib(data.memoryUsed)} / ${gib(data.memoryTotal)}`;
  $('metric-memory-summary').textContent = `Peak ${gib(data.peakMemory)}`;
  $('metric-elapsed').textContent = formatDuration(data.elapsedSeconds);
});
function sort() { files = Ordering.sortFiles(files, priorities()); manual = false; render(); }
function cell(text, className) { const td = document.createElement('td'); td.textContent = text; if (className) td.className = className; return td; }
function button(text, title, action, disabled = false) {
  const el = document.createElement('button'); el.textContent = text; el.title = title; el.setAttribute('aria-label', title); el.disabled = disabled || busy; el.onclick = action; return el;
}
function renderRows() {
  $('rows').replaceChildren();
  let position = 0;
  files.forEach((file, index) => {
    const row = document.createElement('tr'); if (!file.selected) row.className = 'row-excluded';
    const checkboxCell = cell(''); const input = document.createElement('input'); input.type = 'checkbox'; input.checked = file.selected; input.disabled = busy; input.setAttribute('aria-label', `Include ${file.name}`);
    input.onchange = () => { file.selected = input.checked; render(); }; checkboxCell.append(input); row.append(checkboxCell, cell(file.selected ? String(++position).padStart(2, '0') : '—'));
    const nameCell = cell(''); const name = document.createElement('div'); name.className = 'filename'; name.textContent = file.name; name.title = file.path;
    const info = document.createElement('div'); info.className = 'fileinfo'; info.textContent = file.description;
    nameCell.append(name, info); row.append(nameCell);
    for (const key of ['created', 'recorded']) row.append(cell(file[key] ? dates.format(file[key]) : 'Not available', `date${!manual && Ordering.reason(file, priorities()) === key ? ' date-used' : ''}`));
    row.append(cell(formatDuration(file.duration), 'date'));
    const actions = cell(''); const controls = document.createElement('div'); controls.className = 'row-buttons';
    const move = delta => { [files[index], files[index + delta]] = [files[index + delta], files[index]]; manual = true; render(); };
    controls.append(button('↑', `Move up: ${file.name}`, () => move(-1), index === 0), button('↓', `Move down: ${file.name}`, () => move(1), index === files.length - 1), button('▶', `Open in player: ${file.name}`, async () => { const r = await window.api.preview(file.id); if (!r.ok) message(r.error, true); }), button('×', `Remove: ${file.name}`, async () => { const r = await window.api.forget([file.id]); if (r.ok) { files = files.filter(f => f.id !== file.id); render(); } else message(r.error, true); }));
    actions.append(controls); row.append(actions); $('rows').append(row);
  });
}
async function render() {
  renderRows();
  window.refreshSource?.();
  $('empty').hidden = files.length > 0; $('table-wrap').hidden = files.length === 0;
  $('order-mode').textContent = manual ? 'Manual order' : 'Automatic order';
  $('count').textContent = `${chosen().length} of ${files.length} clips selected`;
  $('duration').textContent = `Total duration ${formatDuration(chosen().reduce((s, f) => s + f.duration, 0))}`;
  const version = ++checkVersion; compatible = false; $('merge').disabled = true;
  const result = await window.api.check(chosen().map(f => f.id), compression());
  if (version !== checkVersion) return;
  compatible = result.ok && result.value.ok;
  $('compatibility').textContent = result.ok ? result.value.message : result.error;
  $('compatibility').className = `compatibility ${chosen().length < 2 ? '' : compatible ? 'good' : 'bad'}`;
  $('merge').disabled = busy || !compatible || !outputPath;
}
async function add() {
  message(''); showProgress({ text: 'Choosing videos…', progress: 0 }); setBusy(true);
  try {
    const result = await window.api.chooseFiles();
    if (!result.ok) message(result.error, true);
    else {
      files.push(...result.value.files.map(f => ({ ...f, selected: true })));
      if (!manual) files = Ordering.sortFiles(files, priorities());
      if (result.value.errors.length) message(`Some files could not be added:\n${result.value.errors.join('\n')}`, true);
    }
  } catch (e) { message(e.message, true); }
  finally { setBusy(false); render(); }
}
$('add').onclick = add; $('empty-add').onclick = add;
for (const id of ['primary', 'secondary', 'tertiary']) $(id).onchange = () => {
  // Each priority is unique; a new selection swaps out an existing duplicate.
  const ids = ['primary', 'secondary', 'tertiary'];
  for (const other of ids.filter(x => x !== id)) {
    if ($(id).value && $(other).value === $(id).value) {
      const used = ids.map(x => $(x).value);
      $(other).value = ['created', 'recorded', 'name'].find(x => !used.includes(x)) || '';
    }
  }
  $('sort-help').textContent = $('primary').value === 'name' ? 'Natural name order: clip2 comes before clip10. Matching names use the next priority.' : 'Missing dates fall back to the next date priority. Undated clips go last; ties use the next priority, then file name.';
  sort();
};
$('resort').onclick = sort;
$('all').onclick = () => { files.forEach(f => f.selected = true); render(); };
$('none').onclick = () => { files.forEach(f => f.selected = false); render(); };
$('clear').onclick = async () => { const r = await window.api.forget(files.map(f => f.id)); if (r.ok) { files = []; overrides = {}; manual = false; message(''); render(); } else message(r.error, true); };
$('cancel').onclick = async () => { $('cancel').disabled = true; $('activity-text').textContent = 'Cancelling…'; await window.api.cancel(); };
$('show-output').onclick = () => window.api.showOutput();
$('copy-report').onclick = async () => {
  const result = await window.api.copyReport();
  $('copy-status').textContent = result.ok ? 'Report copied.' : `Could not copy: ${result.error}. Select and copy the text above.`;
};
$('choose-output').onclick = async () => {
  setBusy(true); $('activity').hidden = true; $('cancel').hidden = true;
  try {
    const result = await window.api.chooseOutput(chosen().map(f => f.id), compression());
    if (!result.ok) message(result.error, true);
    else {
      outputPath = result.value;
      $('output-path').textContent = outputPath || 'Choose a folder and file name before merging.';
      $('output-path').title = outputPath || '';
    }
  } catch (error) { message(error.message, true); }
  finally { setBusy(false); }
};
$('merge').onclick = async () => {
  const ids = chosen().map(f => f.id);
  $('report').hidden = true;
  message(''); $('show-output').hidden = true; showProgress({ text: 'Preparing merge…', progress: 0 }); setBusy(true);
  try {
    const result = await window.api.merge(ids, compression());
    if (!result.ok) message(result.error, true);
    else if (result.value) {
      if(result.value.batch) message(`Converted ${result.value.outputs.length} file(s).${result.value.cancelled?' Cancelled remaining files.':''}\n${result.value.outputs.join('\n')}${result.value.failures.length?'\nFailures:\n'+result.value.failures.map(f=>f.file+': '+f.error).join('\n'):''}`);
      else message(`Video saved successfully. Expected duration: ${formatDuration(result.value.duration)}\n${result.value.path}${result.value.timelinePath ? `\nTimeline LOG: ${result.value.timelinePath}` : ''}${result.value.warnings ? `\n\nMerge engine warnings — please check playback:\n${result.value.warnings}` : ''}`);
      $('show-output').hidden = false;
    }
  } catch (e) { message(e.message, true); }
  finally { setBusy(false); render(); }
};
render();

syncCompression();
