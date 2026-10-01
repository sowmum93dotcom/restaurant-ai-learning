const {resolveTrustedCustomerIdentityFromRequest}=require('./demeos-customer-authentication');
const {getRepository}=require('./persistence');
const {isDiscoverTestMode}=require('../customer/work');
const {productExperienceTestContent}=require('./controlled-customer-test-content');
const {getValidPublicCustomerWork}=require('./customer-public-work-contract');
const contract=require('../../js/customer-purchase-preparation-contract');
// Re-read server-owned fixtures every time. No personal fulfilment information is persisted.
function createHandler(dependencies={}) {
 const authenticate=dependencies.authenticate||resolveTrustedCustomerIdentityFromRequest;
 const repository=dependencies.repository||getRepository;
 const fixtures=dependencies.fixtures||productExperienceTestContent;
 return async function(req,res){
 try {
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','x-demeos-test-mode');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({reason:'method'});}
 if(req.headers.origin && req.headers.origin!==`https://${req.headers.host}` && req.headers.origin!==`http://${req.headers.host}`)return res.status(403).json({reason:'origin'});
 if(!isDiscoverTestMode(req)||req.headers['x-demeos-test-mode']!=='controlled-preview')return res.status(403).json({reason:'controlled-only'});
 const identity=await authenticate(req);
 if(!identity)return res.status(401).json({reason:'authentication'});
 if((await repository().getOwnedBusinessIds(identity.trustedCustomerIdentityId)).length)return res.status(403).json({reason:'customer-only'});
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['draft','review','details'].includes(k))||(body.review!==undefined&&typeof body.review!=='boolean')||(body.review!==true&&body.details!==undefined))return res.status(400).json({reason:'invalid'});
 const result=contract.resolve(getValidPublicCustomerWork(fixtures()),req.body?.draft);
 if(!result.ready)return res.status(409).json({reason:result.reason});
 if(req.body?.review===true&&!contract.validDetails(result,req.body.details))return res.status(400).json({reason:'details'});
 return res.status(200).json({ready:true,paymentActive:false,orderCreated:false,accountVerified:true,preparation:{draft:result.draft,business:result.business,product:result.product,state:result.state,method:result.method}});
 }catch(_){return res.status(503).json({reason:'failed'});}
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
