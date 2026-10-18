const {test}=require('node:test'),assert=require('node:assert/strict'),T=require('../ride-time.js');
test('Israel clock conversion preserves the GPS-to-recording gap and accounts for seasons',()=>{
 const gps=Date.parse('2026-09-11T04:03:07Z');assert.equal(T.wall(gps,'Asia/Jerusalem'),'2026-09-11T07:03:07');const video=T.utc('2026-09-11T07:38:00','Asia/Jerusalem');assert.equal(new Date(video).toISOString(),'2026-09-11T04:38:00.000Z');assert.equal((video-gps)/1000,2093);assert.equal(T.wall(Date.parse('2026-01-11T05:38:00Z'),'Asia/Jerusalem'),'2026-01-11T07:38:00');
});
test('invalid and ambiguous daylight-saving wall times require correction',()=>{
 assert.throws(()=>T.utc('2026-03-08T02:30','America/New_York'),/does not exist/);assert.throws(()=>T.utc('2026-11-01T01:30','America/New_York'),/occurs twice/);
});
