const test=require("node:test"),assert=require("node:assert/strict");
const {authorizeMediaWorker}=require("../api/_lib/media-worker-authorization.js");
const secret="01234567890123456789012345678901";
test("worker authorization requires exact long bearer secret",()=>{
 assert.equal(authorizeMediaWorker({headers:{authorization:"Bearer "+secret}},{DEMEOS_MEDIA_WORKER_SECRET:secret}),true);
 assert.equal(authorizeMediaWorker({headers:{authorization:"Bearer wrong"}},{DEMEOS_MEDIA_WORKER_SECRET:secret}),false);
 assert.equal(authorizeMediaWorker({headers:{}},{DEMEOS_MEDIA_WORKER_SECRET:secret}),false);
});
test("worker authorization fails closed for weak or absent server configuration",()=>{
 assert.equal(authorizeMediaWorker({headers:{authorization:"Bearer short"}},{DEMEOS_MEDIA_WORKER_SECRET:"short"}),false);
 assert.equal(authorizeMediaWorker({headers:{authorization:"Bearer "+secret}},{}),false);
});
