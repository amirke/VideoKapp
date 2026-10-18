(() => {
  const $ = id => document.getElementById(id);
  const report = {components: [], browser: [], controls: []};
  function row(target, values) {
    const tr = document.createElement('tr');
    if (target.id === 'tests-results') tr.dataset.testStatus = values[2];
    for (const value of values) {const td = document.createElement('td'); td.textContent = String(value); tr.append(td);}
    target.append(tr);
  }
  function controls() {
    report.controls = window.auditControls(); $('tests-buttons').replaceChildren();
    for (const control of report.controls) row($('tests-buttons'), [control.tab, control.label, control.id, control.wired ? 'Handler found' : 'Manual / delegated handler — verify', control.disabled ? 'Disabled until ready' : 'Enabled', control.lastAction]);
    $('tests-button-count').textContent = `${report.controls.length} controls inventoried. Wiring is not an end-to-end action test.`;
  }
  async function browserChecks() {
    report.browser = [];
    const check = (tab, name, fn) => {
      let status = 'pass', detail;
      try {detail = fn();} catch (e) {status = 'fail'; detail = e.message;}
      const result = {tab, name, status, detail}; report.browser.push(result);
      row($('tests-results'), [tab, name, status, detail]);
    };
    check('All tabs', 'Tab navigation', () => {
      const tabs = [...document.querySelectorAll('[role="tab"]')];
      try { for (const tab of tabs) {window.showAppTab(tab.dataset.tab); if (tab.getAttribute('aria-selected') !== 'true' || document.getElementById(tab.getAttribute('aria-controls')).hidden) throw Error('Navigation failed: ' + tab.textContent);} }
      finally {window.showAppTab('tests');}
      return `${tabs.length} tabs opened and restored to Tests.`;
    });
    check('All tabs', 'UI runtime errors', () => {
      if (window.appRuntimeErrors.length) throw Error(window.appRuntimeErrors.join('; '));
      return 'No uncaught UI errors recorded since launch.';
    });
    check('All tabs', 'Application action connections', () => {
      if (!report.channels) throw Error('Application information has not loaded yet.');
      const missing = report.channels.filter(c => !c.registered);
      if (missing.length) throw Error('Missing: ' + missing.map(c => c.name).join(', '));
      return `${report.channels.length} backend actions registered. This verifies wiring, not execution.`;
    });
    check('Ride Player / AI', 'Canvas renderer', () => {const canvas = document.createElement('canvas'); if (!canvas.getContext('2d')) throw Error('Canvas 2D unavailable.'); return 'Canvas 2D context available.';});
    check('Ride Player / AI', 'H.264 playback support', () => {const result = document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"'); if (!result) throw Error('H.264 not advertised by this runtime.'); return `Runtime support: ${result}; actual media playback needs a selected file.`;});
    check('Ride Player', 'GPX and KML parser', () => {
      const gpx = '<gpx><trk><trkseg><trkpt lat="31" lon="35"><time>2026-09-11T04:00:00Z</time></trkpt><trkpt lat="31.1" lon="35.1"><time>2026-09-11T04:00:10Z</time></trkpt></trkseg></trk></gpx>';
      const kml = '<kml><Placemark><LineString><coordinates>35,31,0 35.1,31.1,0</coordinates></LineString></Placemark></kml>';
      for (const xml of [gpx, kml]) if (window.RideData.parseXML(xml, DOMParser).length !== 2) throw Error('Route parsing failed.');
      return 'Two coordinates parsed from each synthetic route.';
    });
    check('Ride Player', '3D map dependency', () => {if (!window.maplibregl?.Map) throw Error('MapLibre has not loaded.'); return 'MapLibre loaded; terrain and provider rendering require a visual map check.';});
    check('Ride Player', 'Jerusalem time zone', () => {
      const time = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Jerusalem', hour: '2-digit', hourCycle: 'h23'}).format(new Date('2026-09-11T04:00:00Z'));
      if (time !== '07') throw Error('Unexpected time-zone conversion.'); return '04:00 UTC = 07:00 Jerusalem on the test date.';
    });
    const status = await window.api.connectionStatus();
    const result = {tab: 'Upload', name: 'Saved YouTube connection', status: status.ok ? 'info' : 'fail', detail: status.ok ? (status.value?.connected ? 'Stored connection found; token validity and upload remain untested.' : 'No saved connection. Connect YouTube to use API upload.') : status.error};
    report.browser.push(result); row($('tests-results'), [result.tab, result.name, result.status, result.detail]);
    controls();
  }
  $('tests-controls').onclick = controls;
  $('tests-run').onclick = async () => {
    $('tests-run').disabled = true; $('tests-results').replaceChildren(); report.components = [];
    $('tests-progress').value = 0;
    try {
      await browserChecks();
      const result = await window.api.runDiagnostics({online: $('tests-online').checked, geminiKey: $('gm-key')?.value.trim() || '', geminiModel: $('gm-model')?.value.trim() || '', ollamaModel: $('ol-model')?.value.trim() || ''});
      if (!result.ok) throw Error(result.error);
      Object.assign(report, result.value); report.components = result.value.rows;
      const failed = [...report.components, ...report.browser].filter(r => r.status === 'fail').length;
      $('tests-state').textContent = `${report.stopped ? 'Stopped' : 'Finished'}: ${report.rows.length}/${report.planned} component checks, ${failed} failures. See setup/manual items below.`;
      if (failed || report.stopped) window.reportButtonFailure?.();
    } catch (e) {$('tests-state').textContent = e.message; window.reportButtonFailure?.();}
    finally {$('tests-run').disabled = false; controls();}
  };
  $('tests-stop').onclick = async () => {await window.api.cancel(); $('tests-state').textContent = 'Stopping…';};
  $('tests-copy').onclick = async () => {
    controls();
    const text = ['VideoKapp diagnostics', `Version: ${report.version || 'unknown'}`, `Time: ${new Date().toISOString()}`, 'PASS describes only the named check, not all workflows.', ...[...report.browser, ...report.components].map(r => `[${r.status}] ${r.tab} / ${r.name}: ${r.detail}`), 'BUTTON INVENTORY', ...report.controls.map(c => `${c.tab} / ${c.id}: ${c.label} | ${c.wired ? 'wired' : 'manual/delegated'} | ${c.disabled ? 'disabled' : 'enabled'} | ${c.lastAction}`)].join('\n');
    const result = await window.api.copyField(text); if (!result.ok) throw Error(result.error);
    $('tests-state').textContent = 'Report copied.';
  };
  window.api.onDiagnosticsProgress(p => {
    $('tests-progress').value = p.progress; $('tests-state').textContent = p.text;
    if (p.row) row($('tests-results'), [p.row.tab, p.row.name, p.row.status, p.row.detail]);
  });
  $('app-check-update').onclick = async () => {
    $('app-check-update').disabled = true; $('app-download-update').hidden = true; $('app-update-state').textContent = 'Checking GitHub…';
    try {
      const result = await window.api.checkAppUpdate(); if (!result.ok) throw Error(result.error);
      const r = result.value;
      $('app-update-state').textContent = `Installed: ${r.installed} · GitHub: ${r.latest} · ${r.available ? 'Update available' : r.ahead ? 'Installed version is ahead of the published release' : 'Up to date'} · Checked ${new Date(r.checkedAt).toLocaleTimeString()}`;
      $('app-download-update').hidden = !r.available;
    } catch (e) {$('app-update-state').textContent = e.message; window.reportButtonFailure?.();}
    finally {$('app-check-update').disabled = false;}
  };
  $('app-download-update').onclick = async () => {
    const result = await window.api.downloadAppUpdate(); if (!result.ok) throw Error(result.error);
    $('app-update-state').textContent = 'Download opened. Close the app, extract the ZIP and run Install.cmd.';
  };
  window.api.diagnosticsInfo().then(result => {
    if (!result.ok) { $('tests-state').textContent = result.error; return; }
    report.version = result.value.version;
    report.channels = result.value.channels;
    $('app-version').textContent = 'v' + result.value.version;
    $('tests-version').textContent = `Installed ${result.value.version} · Electron ${result.value.electron} · ${result.value.arch}`;
    for (const channel of result.value.channels) row($('tests-ipc'), [channel.name, channel.registered ? 'Registered' : 'MISSING']);
    controls();
  }).catch(e => { $('tests-state').textContent = e.message; });
})();
