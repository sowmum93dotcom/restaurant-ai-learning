const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
test("media processing health tracks queue pressure and stuck work",()=>{
 const source=fs.readFileSync(require.resolve("../api/_lib/persistence.js"),"utf8");
 const start=source.indexOf("async getMediaProcessingHealth"),end=source.indexOf("async reconcileUnqueuedProcessingMedia",start),m=source.slice(start,end);
 assert.match(m,/status = 'queued'/);assert.match(m,/status = 'running'/);assert.match(m,/status = 'failed'/);
 assert.match(m,/stale_running/);assert.match(m,/delayed_queued/);assert.match(m,/INTERVAL '15 minutes'/);
});
