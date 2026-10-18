// SPDX-License-Identifier: GPL-2.0-only
(function(root){
 function heading(points,t,maxGap=60){if(!Number.isFinite(t)||points.length<2)return null;let lo=0,hi=points.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(points[mid].time<=t)lo=mid;else hi=mid-1;}const i=Math.min(lo,points.length-2),a=points[i],b=points[i+1];if(t<a.time||t>b.time||a.group!==b.group||b.time-a.time>maxGap*1000)return null;const rad=Math.PI/180,lat1=a.lat*rad,lat2=b.lat*rad,dl=(b.lon-a.lon)*rad;const dy=Math.sin(dl)*Math.cos(lat2),dx=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dl);if(Math.hypot(dy,dx)*6371000<2)return null;return (Math.atan2(dy,dx)/rad+360)%360;}
 const api={heading};if(typeof module!=='undefined')module.exports=api;else root.RideCamera=api;
})(globalThis);
