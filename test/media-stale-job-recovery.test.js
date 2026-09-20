const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
test("stale running jobs use a bounded lease and concurrency safe recovery",()=>{
 const source=fs.readFileSync(require.resolve("../api/_lib/persistence.js"),"utf8");
 const a=source.indexOf("async recoverStaleMediaProcessingJobs"),b=source.indexOf("async reconcileUnqueuedProcessingMedia",a),m=source.slice(a,b);
 assert.match(m,/status = 'running'/);assert.match(m,/claimed_at < NOW\(\)/);assert.match(m,/FOR UPDATE SKIP LOCKED/);
 assert.match(m,/attempts < \$1 THEN 'queued' ELSE 'failed'/);assert.match(m,/claimed_at = NULL/);
});
test("worker recovers stale leases before reconciliation and claim",()=>{
 const source=fs.readFileSync(require.resolve("../api/_lib/media-worker.js"),"utf8");
 assert.ok(source.indexOf("recoverStaleMediaProcessingJobs")<source.indexOf("reconcileMediaProcessingQueue"));
 assert.ok(source.indexOf("reconcileMediaProcessingQueue")<source.indexOf("processNextMediaJob"));
});
