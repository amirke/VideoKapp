// SPDX-License-Identifier: GPL-2.0-only
const http=require('node:http');
const fs=require('node:fs/promises');
const {randomBytes,createHash}=require('node:crypto');
const AUTH='https://accounts.google.com/o/oauth2/v2/auth',TOKEN='https://oauth2.googleapis.com/token';
function uploadMetadata(fields){
 const title=String(fields.title||'').trim(),description=String(fields.description||'');
 if(!title||title.length>100||/[<>]/.test(title))throw new Error('Title is required (maximum 100 characters; no angle brackets).');
 if(Buffer.byteLength(description)>5000||/[<>]/.test(description))throw new Error('Description must be at most 5000 UTF-8 bytes, without angle brackets.');
 if(!['private','unlisted','public'].includes(fields.privacy))throw new Error('Choose video visibility.');
 if(!['yes','no'].includes(fields.madeForKids))throw new Error('Choose whether this video is made for kids.');
 if(!['yes','no'].includes(fields.synthetic))throw new Error('Choose whether the video contains realistic altered or synthetic content.');
 if(!['youtube','creativeCommon'].includes(fields.license||'youtube'))throw new Error('Choose a YouTube license.');
 const categoryId=String(fields.category||'22');if(!/^\d{1,3}$/.test(categoryId))throw new Error('Invalid category.');
 const tags=String(fields.tags||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(tags.join(',').length>450)throw new Error('Keep tags under 450 characters.');
 const snippet={title,description,categoryId,...(tags.length?{tags}:{}),...(fields.language?{defaultLanguage:String(fields.language)}:{})};
 const status={privacyStatus:fields.privacy,selfDeclaredMadeForKids:fields.madeForKids==='yes',containsSyntheticMedia:fields.synthetic==='yes',license:fields.license||'youtube'};
 return {snippet,status};
}
async function tokenRequest(body,fetcher=fetch){
 const r=await fetcher(TOKEN,{method:'POST',body:new URLSearchParams(body),signal:AbortSignal.timeout(60000)});
 const data=await r.json();if(!r.ok||!data.access_token)throw new Error('Google authorization failed. Check the desktop OAuth client and sign in again.');return data;
}
async function connect(client,openExternal,{signal,fetcher=fetch}={}){
 if(!client?.client_id?.endsWith('.apps.googleusercontent.com'))throw new Error('Import a Google Desktop OAuth client JSON first.');
 const state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
 let resolveCode,rejectCode;
 const codePromise=new Promise((resolve,reject)=>{resolveCode=resolve;rejectCode=reject;});
 // Attach immediately: cancellation/browser launch errors must not leak a rejection.
 codePromise.catch(()=>{});
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname!=='/oauth2callback'||u.searchParams.get('state')!==state){res.writeHead(400);res.end('Invalid authorization response.');return;}
  res.setHeader('Content-Type','text/plain; charset=utf-8');res.end('You can return to ChronoMerge.');
  if(u.searchParams.get('error'))rejectCode(new Error('Google sign-in was declined.'));
  else if(u.searchParams.get('code'))resolveCode(u.searchParams.get('code'));
  else rejectCode(new Error('Missing authorization code.'));
 });
 const abort=()=>rejectCode(new Error('Sign-in cancelled.'));
 const timer=setTimeout(()=>rejectCode(new Error('Sign-in timed out. Try Connect YouTube again.')),300000);
 signal?.addEventListener('abort',abort,{once:true});
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  if(signal?.aborted)throw new Error('Sign-in cancelled.');
  const redirect=`http://127.0.0.1:${server.address().port}/oauth2callback`;
  const url=new URL(AUTH);url.search=new URLSearchParams({client_id:client.client_id,redirect_uri:redirect,response_type:'code',scope:'https://www.googleapis.com/auth/youtube.upload',access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
  await openExternal(url.href);
  const code=await codePromise;
  return await tokenRequest({client_id:client.client_id,client_secret:client.client_secret||'',code,code_verifier:verifier,redirect_uri:redirect,grant_type:'authorization_code'},fetcher);
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);server.close();server.closeAllConnections();}
}
function sessionURL(text){const u=new URL(text);if(u.protocol!=='https:'||u.hostname!=='www.googleapis.com'||u.username||u.password)throw new Error('Invalid Google upload session URL.');return u.href;}
async function upload(file,fields,credentials,{signal,onProgress=()=>{},fetcher=fetch}={}){
 const metadata=uploadMetadata(fields);
 if(!credentials?.client||!credentials?.tokens?.refresh_token)throw new Error('Connect YouTube first.');
 const auth=await tokenRequest({client_id:credentials.client.client_id,client_secret:credentials.client.client_secret||'',refresh_token:credentials.tokens.refresh_token,grant_type:'refresh_token'},fetcher);
 const handle=await fs.open(file,'r');
 try{
  const stat=await handle.stat();if(!stat.isFile()||!stat.size)throw new Error('Select a nonempty video file.');
  const headers={Authorization:`Bearer ${auth.access_token}`};
  const requestSignal=()=>AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(120000)]);
  const init=await fetcher('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=false',{method:'POST',headers:{...headers,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Length':String(stat.size),'X-Upload-Content-Type':'application/octet-stream'},body:JSON.stringify(metadata),signal:requestSignal(),redirect:'error'});
  if(!init.ok)throw new Error(`YouTube could not start upload (HTTP ${init.status}). Check API access, quota and channel setup.`);
  const location=sessionURL(init.headers.get('location'));
  let offset=0,retries=0;
  while(offset<stat.size){
   if(signal?.aborted)throw new Error('Upload cancelled.');
   const length=Math.min(8*1024*1024,stat.size-offset),buffer=Buffer.alloc(length);
   const {bytesRead}=await handle.read(buffer,0,length,offset);if(bytesRead!==length)throw new Error('The upload file changed.');
   let r;
   try{r=await fetcher(location,{method:'PUT',headers:{...headers,'Content-Type':'application/octet-stream','Content-Length':String(length),'Content-Range':`bytes ${offset}-${offset+length-1}/${stat.size}`},body:buffer,signal:requestSignal(),redirect:'error'});}catch(error){if(signal?.aborted)throw new Error('Upload cancelled.');r=null;}
   if(r?.ok){const result=await r.json();if(!result.id)throw new Error('YouTube returned no video ID.');onProgress(1);return {url:`https://www.youtube.com/watch?v=${encodeURIComponent(result.id)}`,privacy:result.status?.privacyStatus||'unknown'};}
   if(r?.status===308){const range=r.headers.get('range');const match=/^bytes=0-(\d+)$/.exec(range||'');const next=match?Number(match[1])+1:0;if(next>offset&&next<=stat.size){offset=next;retries=0;onProgress(offset/stat.size);continue;}}
   else if(r&&r.status<500&&r.status!==429)throw new Error(`YouTube upload failed (HTTP ${r.status}). Check authorization, quota and upload limits.`);
   if(++retries>3)throw new Error('Upload interrupted repeatedly. Please retry from the app.');
   const status=await fetcher(location,{method:'PUT',headers:{...headers,'Content-Length':'0','Content-Range':`bytes */${stat.size}`},signal:requestSignal(),redirect:'error'});
   if(status.ok){const result=await status.json();if(!result.id)throw new Error('YouTube returned no video ID.');onProgress(1);return {url:`https://www.youtube.com/watch?v=${encodeURIComponent(result.id)}`,privacy:result.status?.privacyStatus||'unknown'};}
   if(status.status!==308)throw new Error(`Upload recovery failed (HTTP ${status.status}).`);
   const match=/^bytes=0-(\d+)$/.exec(status.headers.get('range')||'');offset=match?Number(match[1])+1:0;
   if(offset<0||offset>=stat.size)throw new Error('Invalid upload recovery position.');
  }
  throw new Error('Upload ended without a completion response.');
 }finally{await handle.close();}
}
module.exports={connect,upload,uploadMetadata,sessionURL};
