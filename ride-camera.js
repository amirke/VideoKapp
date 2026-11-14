// SPDX-License-Identifier: GPL-2.0-only
(function(root){
 function heading(points,t,maxGap=60){if(!Number.isFinite(t)||points.length<2)return null;let lo=0,hi=points.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(points[mid].time<=t)lo=mid;else hi=mid-1;}const i=Math.min(lo,points.length-2),a=points[i],b=points[i+1];if(t<a.time||t>b.time||a.group!==b.group||b.time-a.time>maxGap*1000)return null;const rad=Math.PI/180,lat1=a.lat*rad,lat2=b.lat*rad,dl=(b.lon-a.lon)*rad;const dy=Math.sin(dl)*Math.cos(lat2),dx=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dl);if(Math.hypot(dy,dx)*6371000<2)return null;return (Math.atan2(dy,dx)/rad+360)%360;}
 class Filter {
  reset(){this.p=null;this.h=null;this.last=null;this.time=null;}
  constructor(){this.reset();}
  update(p,h,time,now,tau=1.5){
   if(!p){this.reset();return {position:null,heading:h};}
   const dt=this.last===null?0:Math.max(0,(now-this.last)/1000),jump=this.time!==null&&(!Number.isFinite(time)||time<this.time||Math.abs(time-this.time)>Math.max(2000,dt*15000));
   if(!this.p||jump||tau<=0){this.p={...p};this.h=Number.isFinite(h)?h:this.h;}
   else{const a=1-Math.exp(-dt/Math.max(.1,tau)),meters=Math.hypot((p.lat-this.p.lat)*111320,(p.lon-this.p.lon)*111320*Math.cos(p.lat*Math.PI/180));if(meters>3){this.p.lat+=(p.lat-this.p.lat)*a;this.p.lon+=(p.lon-this.p.lon)*a;}if(Number.isFinite(h)){if(this.h===null)this.h=h;else{const d=((h-this.h+540)%360)-180;if(Math.abs(d)>3)this.h=(this.h+d*a+360)%360;}}}
   this.last=now;this.time=time;return {position:this.p,heading:this.h};
  }
 }
 const api={heading,Filter};if(typeof module!=='undefined')module.exports=api;else root.RideCamera=api;
})(globalThis);
