const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const source=fs.readFileSync(require.resolve("../api/media-worker.js"),"utf8");
test("worker endpoint is POST only and requires trusted authorization",()=>{
 assert.match(source,/req\.method!=="POST"/);assert.match(source,/authorizeMediaWorker\(req\)/);assert.match(source,/status\(401\)/);
});
test("worker endpoint fails closed until real processing drivers exist",()=>{
 assert.match(source,/function getDrivers\(\)\{return null;\}/);assert.match(source,/status\(503\)/);
});
test("worker response does not expose processor output or internal errors",()=>{
 const response=source.slice(source.indexOf("return res.status(result.status"));
 assert.doesNotMatch(response,/deliveryUrl/);assert.doesNotMatch(response,/storageKey/);assert.doesNotMatch(response,/last_error/);
});
