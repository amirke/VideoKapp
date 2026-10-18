// SPDX-License-Identifier: GPL-2.0-only
(()=>{const tabs=Array.from(document.querySelectorAll('[role="tab"]'));
 window.showAppTab=id=>{if(!tabs.some(t=>t.dataset.tab===id))return;for(const t of tabs){const active=t.dataset.tab===id;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!active;}for(const v of document.querySelectorAll('[role="tabpanel"][hidden] video'))v.pause();if(id==='ride')window.resizeRideMap?.();else window.stopRidePlayback?.();if(id!=='summary'&&typeof stopPreview==='function')stopPreview();};
 for(const [i,t]of tabs.entries()){t.onclick=()=>showAppTab(t.dataset.tab);t.onkeydown=e=>{let n;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;e.preventDefault();showAppTab(tabs[n].dataset.tab);tabs[n].focus();};}
 showAppTab('merge');
})();
