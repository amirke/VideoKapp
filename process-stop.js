// SPDX-License-Identifier: GPL-2.0-only
(()=>{for(const panel of document.querySelectorAll('[role=tabpanel]')){if(!panel.querySelector('[data-process-stop]')){const row=document.createElement('div');row.className='button-row process-stop-row';const b=document.createElement('button');b.textContent='STOP';b.className='secondary';b.dataset.processStop='';b.title='Stop the active processing task';row.append(b);panel.prepend(row);}}
for(const b of document.querySelectorAll('[data-process-stop]'))b.onclick=async()=>{const r=await window.api.cancel();if(!r.ok)throw Error(r.error);document.getElementById('activity-text').textContent='STOP requested — stopping active task…';};
const observer=new MutationObserver(()=>{for(const b of document.querySelectorAll('[data-process-stop]'))if(b.disabled)b.disabled=false;});observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['disabled']});
})();
