const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const {inspect,run,binary}=require('../engine.cjs');const {boundaries,detect,propose,approvedClips,exportSummary}=require('../scenes.cjs');
test('summary proposal covers long continuous scenes and validates edits',()=>{
 const s=boundaries([3,3.1,7],10,1);assert.equal(s.length,3);
 const rows=propose([{scene:1,start:0,end:600}],{target:30,clipLength:6});const selected=rows.filter(r=>r.selected);assert.equal(selected.length,5);assert.ok(selected[0].start<30);assert.ok(selected.at(-1).end>570);assert.ok(selected.reduce((sum,r)=>sum+r.end-r.start,0)<=30.01);
 assert.throws(()=>approvedClips([{selected:true,start:5,end:4}],10),/at least/);assert.throws(()=>approvedClips([{selected:true,start:0,end:4},{selected:true,start:3,end:5}],10),/overlap/);
});
test('detects real scene boundaries and exports only approved clips with audio and correct order',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'chronomerge-scenes-test-'));
 try{const source=path.join(root,'scenes.mp4');await run(binary('ffmpeg'),['-v','error','-f','lavfi','-i','color=red:s=320x240:r=25:d=2','-f','lavfi','-i','color=lime:s=320x240:r=25:d=2','-f','lavfi','-i','color=blue:s=320x240:r=25:d=2','-f','lavfi','-i','sine=sample_rate=48000:duration=6','-filter_complex','[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]','-map','[v]','-map','3:a','-c:v','libx264','-preset','ultrafast','-c:a','aac',source]);
 const file=await inspect(source),analysis=await detect(file,{threshold:.15,minScene:.5});assert.equal(analysis.scenes.length,3);assert.ok(Math.abs(analysis.scenes[1].start-2)<.4);
 const rows=propose(analysis.scenes,{target:3,clipLength:1});rows[1].selected=false;const output=path.join(root,'summary.mp4');const result=await exportSummary(file,rows,output,{crf:20});const meta=await inspect(output);assert.ok(Math.abs(meta.duration-2)<.25);assert.equal(meta.metadata.streams.find(s=>s.codec_type==='video').r_frame_rate,'25/1');assert.equal(meta.metadata.streams.find(s=>s.codec_type==='audio').codec_name,'aac');assert.equal(result.diagnostics.summary.clips.length,2);
 for(const [i,channel]of [0,2].entries()){const frame=path.join(root,`frame${i}.ppm`);await run(binary('ffmpeg'),['-v','error','-ss',String(i+.5),'-i',output,'-frames:v','1','-vf','scale=1:1','-c:v','ppm',frame]);const rgb=[...(await fs.readFile(frame)).subarray(-3)];assert.ok(rgb[channel]>180,JSON.stringify(rgb));}
 await run(binary('ffmpeg'),['-v','error','-xerror','-i',output,'-f','null','-']);
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(exportSummary(file,rows,path.join(root,'cancel.mp4'),{signal:cancelled.signal}),/cancelled/);await assert.rejects(fs.access(path.join(root,'cancel.mp4')));
 }finally{const resolved=path.resolve(root);if(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('chronomerge-scenes-test-'))await fs.rm(resolved,{recursive:true,force:true});}
});

test('scene progress advances on a short video without cuts',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'chronomerge-progress-'));try{const source=path.join(root,'static.mp4');await run(binary('ffmpeg'),['-v','error','-f','lavfi','-i','color=red:s=160x120:r=25:d=3','-c:v','libx264','-preset','ultrafast',source]);const progress=[];const result=await detect(await inspect(source),{onProgress:p=>progress.push(p)});assert.equal(result.scenes.length,1);assert.ok(progress.some(p=>p>.2&&p<.9));assert.equal(progress.at(-1),1);}finally{const p=path.resolve(root);if(path.dirname(p)===path.resolve(os.tmpdir())&&path.basename(p).startsWith('chronomerge-progress-'))await fs.rm(p,{recursive:true,force:true});}
});

test('original-quality summary retains decoded pixel hashes with keyframe-aligned cuts',async()=>{
 const {keyframes,alignCuts}=require('../scenes.cjs');const root=await fs.mkdtemp(path.join(os.tmpdir(),'chronomerge-copy-test-'));
 try{const source=path.join(root,'source.mp4');await run(binary('ffmpeg'),['-v','error','-f','lavfi','-i','testsrc2=s=160x120:r=25:d=6','-c:v','libx264','-preset','ultrafast','-g','25','-keyint_min','25','-sc_threshold','0','-bf','0',source]);const f=await inspect(source),keys=await keyframes(f);const rows=alignCuts([{start:.2,end:.8,selected:true},{start:4.2,end:4.8,selected:true}],f.duration,keys);assert.equal(rows.length,2);assert.equal(rows[0].start,0);assert.equal(rows[1].start,4);const output=path.join(root,'copy.mp4');await exportSummary(f,rows,output,{quality:'copy',keys});const meta=await inspect(output);assert.ok(Math.abs(meta.duration-2)<.15);
 // Muxing may repeat SPS/PPS headers, so compare decoded pixels instead of packet bytes.
 async function hashes(file){const r=await run(binary('ffmpeg'),['-v','error','-i',file,'-map','0:v:0','-f','framemd5','-']);return r.stdout.split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split(',').at(-1).trim());}
 const before=await hashes(source),after=await hashes(output);assert.ok(after.length>0);assert.deepEqual(after,[...before.slice(0,25),...before.slice(100,125)]);await run(binary('ffmpeg'),['-v','error','-xerror','-i',output,'-f','null','-']);
 }finally{const p=path.resolve(root);if(path.dirname(p)===path.resolve(os.tmpdir())&&path.basename(p).startsWith('chronomerge-copy-test-'))await fs.rm(p,{recursive:true,force:true});}
});
