// SPDX-License-Identifier: GPL-2.0-only
// FIT record-message reader. Unknown standard/developer fields are skipped by definition size.
const {normalize}=require('./ride-data.js');
function crc(data){let value=0;for(const byte of data){value^=byte;for(let i=0;i<8;i++)value=(value&1)?(value>>>1)^0xa001:value>>>1;}return value;}
function parseFIT(b){
 if(b.length<14||![12,14].includes(b[0])||b.toString('ascii',8,12)!=='.FIT')throw Error('Invalid FIT header.');
 const end=b[0]+b.readUInt32LE(4);if(end+2>b.length)throw Error('Truncated FIT file.');
 if(b[0]===14&&b.readUInt16LE(12)!==0&&crc(b.subarray(0,12))!==b.readUInt16LE(12))throw Error('FIT header checksum failed.');
 if(crc(b.subarray(0,end))!==b.readUInt16LE(end))throw Error('FIT file checksum failed. Export GPX from Garmin Connect if needed.');
 let i=b[0],lastTime=null;const defs={},points=[];const need=n=>{if(i+n>end)throw Error('Truncated FIT message.');};
 function number(field,le){const size=field.size,type=field.type&31;let v=null;const take=(n,fn,invalid)=>{if(size<n)return null;const value=b[fn](i);return value===invalid?null:value;};
  if(type===0||type===2)v=take(1,'readUInt8',255);else if(type===1)v=take(1,'readInt8',127);else if(type===4)v=take(2,le?'readUInt16LE':'readUInt16BE',65535);else if(type===3)v=take(2,le?'readInt16LE':'readInt16BE',32767);else if(type===6)v=take(4,le?'readUInt32LE':'readUInt32BE',4294967295);else if(type===5)v=take(4,le?'readInt32LE':'readInt32BE',2147483647);return v;
 }
 while(i<end){need(1);const h=b[i++],compressed=!!(h&128),local=compressed?(h>>5)&3:h&15;
  if(!compressed&&(h&64)){need(5);i++;const le=b[i++]===0,global=le?b.readUInt16LE(i):b.readUInt16BE(i);i+=2;const count=b[i++],fields=[];need(count*3);for(let n=0;n<count;n++){fields.push({id:b[i],size:b[i+1],type:b[i+2]});i+=3;}let extra=0;if(h&32){need(1);const count=b[i++];need(count*3);for(let n=0;n<count;n++){extra+=b[i+1];i+=3;}}defs[local]={le,global,fields,extra};continue;}
  const def=defs[local];if(!def)throw Error('FIT data has no message definition.');const values={};for(const f of def.fields){if(compressed&&f.id===253)continue;need(f.size);values[f.id]=number(f,def.le);i+=f.size;}need(def.extra);i+=def.extra;
  if(compressed){if(lastTime===null)throw Error('FIT compressed timestamp has no base.');const offset=h&31;values[253]=lastTime-(lastTime%32)+offset+(offset<(lastTime%32)?32:0);}
  if(values[253]!=null)lastTime=values[253];
  if(def.global===20&&values[0]!=null&&values[1]!=null&&values[253]!=null){const alt=values[78]??values[2];points.push({lat:values[0]*180/2147483648,lon:values[1]*180/2147483648,time:Date.UTC(1989,11,31)+values[253]*1000,ele:alt==null?null:alt/5-500,hr:values[3]??null,group:0});}
 }
 return normalize(points);
}
module.exports={parseFIT};
