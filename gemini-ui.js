// SPDX-License-Identifier: GPL-2.0-only
(()=>{const $=id=>document.getElementById(id);
 $('gm-load-proxy').onclick=async()=>{const r=await window.loadExistingAiCopy();$('gm-status').textContent=r?'Ready to upload existing AI copy: '+r.proxy.path:document.getElementById('ai-status').textContent;};
 $('gm-prepare').onclick=()=>window.showAppTab('ai');
 $('gm-review').onclick=()=>window.showAppTab('ai');
 window.api.onGeminiProgress(p=>{if(p.progress===null)$('gm-progress').removeAttribute('value');else $('gm-progress').value=p.progress;$('gm-progress-label').textContent=p.text;});
 $('gm-analyze').onclick=async()=>{const buttons=[...$('page-gemini').querySelectorAll('button:not([data-process-stop])')];buttons.forEach(b=>b.disabled=true);$('gm-progress').value=0;$('gm-status').textContent='Working…';try{const r=await window.api.geminiAnalyze({key:$('gm-key').value.trim(),model:$('gm-model').value.trim(),prompt:$('gm-prompt').value});if(!r.ok)throw Error(r.error);if(r.value){window.acceptOllamaRows(r.value.rows);$('gm-status').textContent='Saved '+r.value.path+'. '+r.value.rows.length+' clips ready for Preview / GPS and export. '+(r.value.cleanupWarning||'Uploaded copy deleted.');}else $('gm-status').textContent='Cancelled.';}catch(e){window.reportButtonFailure?.();$('gm-progress').value=0;$('gm-status').textContent=e.message;}finally{buttons.forEach(b=>b.disabled=false);}};
})();
