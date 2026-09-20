const {timingSafeEqual}=require("node:crypto");
function clean(v){return typeof v==="string"&&v.trim()?v.trim():null;}
function getBearer(req){const h=req&&req.headers&&(req.headers.authorization||req.headers.Authorization);if(typeof h!=="string"||!/^Bearer\s+/i.test(h))return null;return clean(h.replace(/^Bearer\s+/i,""));}
function authorizeMediaWorker(req,env=process.env){
 const expected=clean(env.DEMEOS_MEDIA_WORKER_SECRET),provided=getBearer(req);
 if(!expected||expected.length<32||!provided)return false;
 const a=Buffer.from(expected),b=Buffer.from(provided);return a.length===b.length&&timingSafeEqual(a,b);
}
module.exports={authorizeMediaWorker};
