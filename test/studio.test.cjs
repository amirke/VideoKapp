const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
const {inspect,merge,run,binary}=require('../engine.cjs');const {pack,unpack}=require('../config.cjs');const {upload,uploadMetadata,sessionURL}=require('../youtube.cjs');
test('single-file conversion changes dimensions, FPS, audio, metadata and HEVC codec',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'chronomerge-single-'));
 try{const source=path.join(root,'source.mp4');await run(binary('ffmpeg'),['-v','error','-f','lavfi','-i','testsrc2=s=320x240:r=25:d=2','-f','lavfi','-i','sine=sample_rate=48000:duration=2','-c:v','libx264','-preset','ultrafast','-c:a','aac',source]);const input=await inspect(source);
 for(const codec of ['libx264','libx265']){const output=path.join(root,codec+'.mp4');const result=await merge([input],output,{compression:{enabled:true,operation:'convert',codec,preset:'ultrafast',width:160,height:90,fps:15,audio:'aac',sampleRate:44100,channels:2,start:.25,duration:1,metadata:{title:'Conversion test'}}});const actual=await inspect(output),v=actual.metadata.streams.find(s=>s.codec_type==='video'),a=actual.metadata.streams.find(s=>s.codec_type==='audio');assert.equal(v.width,160);assert.equal(v.height,90);assert.equal(v.r_frame_rate,'15/1');assert.equal(v.codec_name,codec==='libx265'?'hevc':'h264');assert.equal(a.channels,2);assert.equal(a.sample_rate,'44100');assert.equal(actual.metadata.format.tags.title,'Conversion test');assert.ok(Math.abs(actual.duration-1)<.2);assert.equal(result.diagnostics.expectedDuration,1);await run(binary('ffmpeg'),['-v','error','-xerror','-i',output,'-f','null','-']);}
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('CFG roundtrip isolates encrypted credentials; other-user failures preserve settings',()=>{
 const safe={isEncryptionAvailable:()=>true,encryptString:t=>Buffer.from(t).map(v=>v^123),decryptString:b=>Buffer.from(b).map(v=>v^123).toString()};
 const data=pack({conversion:{crf:22},overrides:{'clip.mp4':{width:1280}}},{tokens:{refresh_token:'SECRET_TEST_TOKEN'}},safe),text=JSON.stringify(data);
 assert.ok(!text.includes('SECRET_TEST_TOKEN'));assert.equal(unpack(text,safe).credentials.tokens.refresh_token,'SECRET_TEST_TOKEN');assert.equal(unpack(text,{decryptString(){throw Error('other user');}}).settings.conversion.crf,22);assert.match(unpack(text,{decryptString(){throw Error();}}).warning,/Sign in/);assert.throws(()=>pack({}, {token:'x'},{isEncryptionAvailable:()=>false}),/unavailable/);assert.throws(()=>unpack('{"application":"other"}',safe),/Unsupported/);
});
test('YouTube fields require explicit audience choices and reject credential exfiltration URL',()=>{
 assert.throws(()=>uploadMetadata({title:'Test',privacy:'unlisted'}),/kids/);
 const fields={title:'Test',privacy:'unlisted',madeForKids:'no',synthetic:'no'};assert.equal(uploadMetadata(fields).status.selfDeclaredMadeForKids,false);assert.throws(()=>sessionURL('https://attacker.invalid/upload'),/Invalid/);assert.throws(()=>sessionURL('http://www.googleapis.com/upload'),/Invalid/);
});
test('YouTube upload uses authorized chunks and reports actual server visibility',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'chronomerge-upload-'));const file=path.join(root,'test.mp4');await fs.writeFile(file,Buffer.alloc(9*1024*1024));const calls=[];let chunks=0;
 const fetcher=async(url,options)=>{calls.push({url,options});if(url.includes('oauth2'))return {ok:true,json:async()=>({access_token:'MOCK_ONLY'})};if(options.method==='POST')return {ok:true,headers:new Headers({location:'https://www.googleapis.com/upload/session'})};chunks++;if(chunks===1)return {status:308,headers:new Headers({range:'bytes=0-8388607'})};return {ok:true,json:async()=>({id:'video-id',status:{privacyStatus:'private'}})};};
 try{const result=await upload(file,{title:'Test',privacy:'unlisted',madeForKids:'no',synthetic:'no'},{client:{client_id:'client'},tokens:{refresh_token:'refresh'}},{fetcher});assert.equal(result.privacy,'private');assert.equal(chunks,2);assert.equal(calls[2].options.headers['Content-Range'],'bytes 0-8388607/9437184');assert.equal(calls[3].options.headers['Content-Range'],'bytes 8388608-9437183/9437184');assert.equal(JSON.parse(calls[1].options.body).status.privacyStatus,'unlisted');}finally{await fs.rm(root,{recursive:true,force:true});}
});

test('OAuth uses PKCE, random state, local callback and fixed token endpoint',async()=>{
 const {connect}=require('../youtube.cjs');let tokenBody;
 const tokens=await connect({client_id:'test.apps.googleusercontent.com',client_secret:'test'},async url=>{
  const u=new URL(url);assert.equal(u.hostname,'accounts.google.com');assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.ok(u.searchParams.get('state').length>30);const callback=new URL(u.searchParams.get('redirect_uri'));callback.search=new URLSearchParams({code:'code',state:u.searchParams.get('state')}).toString();await fetch(callback);
 },{fetcher:async(url,options)=>{assert.equal(url,'https://oauth2.googleapis.com/token');tokenBody=options.body;return {ok:true,json:async()=>({access_token:'test',refresh_token:'test_refresh'})};}});
 assert.ok(tokenBody.get('code_verifier').length>40);assert.equal(tokens.refresh_token,'test_refresh');
});
