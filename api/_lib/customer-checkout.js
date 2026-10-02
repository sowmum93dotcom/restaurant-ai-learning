'use strict';
const {resolveTrustedCustomerIdentityFromRequest}=require('./demeos-customer-authentication');
const {getRepository}=require('./persistence');
const {isDiscoverTestMode}=require('../customer/work');
const {productExperienceTestContent}=require('./controlled-customer-test-content');
const {getValidPublicCustomerWork}=require('./customer-public-work-contract');
const preparation=require('../../js/customer-purchase-preparation-contract');
const {createPaymentService}=require('./customer-payment-service');
// No provider or private merchant quote loader is configured. Never infer either from fixtures.
const unavailable=createPaymentService();
function createHandler(dependencies={}){
 const authenticate=dependencies.authenticate||resolveTrustedCustomerIdentityFromRequest;
 const repository=dependencies.repository||getRepository;
 const fixtures=dependencies.fixtures||productExperienceTestContent;
 const service=dependencies.service||unavailable;
 return async function(req,res){try{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','x-demeos-test-mode');
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({reason:'method'});}
  if(!isDiscoverTestMode(req)||req.headers['x-demeos-test-mode']!=='controlled-preview')return res.status(403).json({reason:'controlled-only'});
  if(req.method==='POST'&&req.headers.origin!==`https://${req.headers.host}`&&req.headers.origin!==`http://${req.headers.host}`)return res.status(403).json({reason:'origin'});
  const identity=await authenticate(req);if(!identity)return res.status(401).json({reason:'authentication'});
  const customerId=identity.trustedCustomerIdentityId;
  if((await repository().getOwnedBusinessIds(customerId)).length)return res.status(403).json({reason:'customer-only'});
  const capabilities=service.capabilities();
  // This entry can never activate a live-mode payment service.
  if(capabilities.mode!=='test'||capabilities.livePayments!==false||capabilities.recipient!=='business')return res.status(503).json({reason:'gateway-not-configured',paymentActive:false});
  if(req.method==='GET'){
   if(req.query?.reference===undefined){
    const receipts=typeof service.receipts==='function'?await service.receipts(customerId):[];
    return res.status(200).json({ready:true,paymentActive:false,receipts,reason:capabilities.configured?null:'gateway-not-configured'});
   }
   const reference=req.query.reference;
   if(typeof reference!=='string'||!/^[a-zA-Z0-9-]{1,200}$/.test(reference))return res.status(400).json({reason:'invalid'});
   const receipt=await service.receipt(customerId,reference);
   return receipt?res.status(200).json({ready:true,receipt}):res.status(404).json({reason:'not-found'});
  }
  const body=req.body,key=req.headers['idempotency-key'];
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='details,draft'||typeof key!=='string'||!/^[a-zA-Z0-9-]{16,100}$/.test(key))return res.status(400).json({reason:'invalid'});
  const resolved=preparation.resolve(getValidPublicCustomerWork(fixtures()),body.draft);
  if(!resolved.ready)return res.status(409).json({reason:resolved.reason});
  if(!preparation.validDetails(resolved,body.details))return res.status(400).json({reason:'details'});
  if(!capabilities.configured)return res.status(503).json({reason:'gateway-not-configured',paymentActive:false,orderCreated:false});
  // Only the authenticated identity and freshly resolved selection reach the private quote loader.
  const result=await service.begin(customerId,{preparation:resolved,details:{...body.details}},key);
  return res.status(result.ready?200:result.reason==='gateway-unavailable'?503:409).json(result);
 }catch(_){return res.status(503).json({reason:'failed'});}};
}
module.exports=createHandler();module.exports.createHandler=createHandler;
