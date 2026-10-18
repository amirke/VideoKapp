// SPDX-License-Identifier: GPL-2.0-only
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
function pack(settings, credentials, safe) {
 const text=JSON.stringify(settings);
 if(text.length>4_000_000)throw new Error('Settings are too large.');
 let secrets=null;
 if(credentials&&Object.keys(credentials).length){
  if(!safe.isEncryptionAvailable())throw new Error('Windows credential encryption is unavailable.');
  secrets=safe.encryptString(JSON.stringify(credentials)).toString('base64');
 }
 return {application:'ChronoMerge',version:1,settings,credentials:secrets};
}
function unpack(text,safe){
 if(text.length>8_000_000)throw new Error('CFG file is too large.');
 const data=JSON.parse(text);
 if(data.application!=='ChronoMerge'||data.version!==1||!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))throw new Error('Unsupported ChronoMerge CFG file.');
 let credentials={},warning='';
 if(data.credentials){try{credentials=JSON.parse(safe.decryptString(Buffer.from(data.credentials,'base64')));}catch{warning='Settings loaded, but credentials cannot be decrypted. Sign in again on this Windows account.';}}
 return {settings:data.settings,credentials,warning};
}
async function writeConfig(file,data){
 const temp=`${file}.${randomUUID()}.tmp`;
 try{await fs.writeFile(temp,JSON.stringify(data,null,2),{flag:'wx',mode:0o600});await fs.rename(temp,file);}finally{await fs.unlink(temp).catch(()=>{});}
}
module.exports={pack,unpack,writeConfig};
