'use strict';
const native=require('./selling-native-intelligence');
const {catalogueRevision}=require('./vendor-inventory');
const fields=require('./selling-category-fields');
const {categoryReference}=require('./selling-submissions');
function editorProduct(saved,input,businessId){
 if(input===undefined)return saved;
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['name','description','sku','price','priceMode','availability','classification','categoryFields'].includes(k)))throw Error('editor');
 const limits={name:200,description:2000,sku:120,price:100,priceMode:20,availability:20};
 for(const [key,max] of Object.entries(limits))if(typeof input[key]!=='string'||input[key].length>max)throw Error('editor');
 if(input.classification!==null&&!categoryReference(input.classification))throw Error('category');
 const product={...(saved||{productId:'unsaved-draft',businessId}),...Object.fromEntries(Object.keys(limits).map(k=>[k,input[k].trim()])),classification:input.classification};
 if(input.classification===null)delete product.classification;
 product.categoryAttributes=fields.apply(saved?.categoryAttributes,input.classification,input.categoryFields,{draft:true});
 if(!saved?.categoryAttributes&&!Object.keys(product.categoryAttributes.byCategory).length)delete product.categoryAttributes;
 return product;
}
async function run({store,profile,identity,environment,body,visualRunner=null}){
 const id=body.productId;
 if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(id)||!['analyze-product','review-intelligence'].includes(body.action))return {status:400,error:'Check the required fields and permitted values.'};
 const saved=profile.products.find(p=>p.productId===id);
 if(!saved&&id!=='unsaved-draft')return {status:404,error:'Product not found.'};
 if(body.productRevision!==(saved?catalogueRevision(saved):'new'))return {status:409,error:'Information changed. Reload and review.'};
 let product;
 try{product=editorProduct(saved,body.editor,profile.businessId);}catch{return {status:400,error:'Check the required fields and permitted values.'};}
 if(!product)return {status:400,error:'Check the required fields and permitted values.'};
 const assets=saved?await store.getSellingIntelligenceMedia(identity,profile.businessId,saved):[];
 const stock=await store.getVendorInventory(profile.businessId);
 const persisted=Boolean(saved&&native.hash(product)===native.hash(saved));
 // Equivalent editor objects can have a different JSON key order from stored JSONB.
 // Bind execution to the exact saved record, rather than an editor reconstruction.
 if(persisted)product=saved;
 const input={profile,product,assets,stock,environment,identity};
 const inputHash=visualRunner?native.hash([native.fingerprint(input),visualRunner.signature]):native.fingerprint(input);
 const storedCache=persisted?await store.getSellingIntelligence(identity,profile.businessId,id,inputHash):null;
 const cached=storedCache&&Date.parse(storedCache.validUntil)>Date.now()?storedCache:null;
 if(body.action==='review-intelligence'){
  if(body.editor!==undefined||!cached||body.inputHash!==inputHash||body.confirmed!==true)return {status:409,error:'Information changed. Reload and review.'};
  let result;
  if(body.proposalId!==undefined){
   if(typeof body.proposalId!=='string'||!cached.visual?.proposals?.some(p=>p.proposalId===body.proposalId))return {status:400,error:'Check the required fields and permitted values.'};
   try{
    const boundary=require('./selling-model-boundary');
    const proposal=cached.visual.proposals.find(p=>p.proposalId===body.proposalId);
    const reviewed=boundary.reviewProposal(proposal,{actor:identity,businessId:profile.businessId,productId:id,productRevision:catalogueRevision(saved),decision:body.decision,value:body.value});
    if(body.decision==='edited'&&!boundary.validateVisualOutput({schemaVersion:2,outputSchema:boundary.VISUAL_CONTRACT.outputSchema,proposals:[{kind:proposal.kind,value:body.value,evidence:proposal.evidence,confidence:null}]},{media:assets.flatMap(a=>a.kind==='image'?[{contentHash:a.processedHash}]:(a.videoFrames?.frames||[]).map(f=>({contentHash:f.contentHash})))}))throw Error('invalid-edit');
    result={...cached,visual:{...cached.visual,proposals:cached.visual.proposals.map(p=>p.proposalId===proposal.proposalId?reviewed:p)},review:{...cached.review,actions:[...cached.review.actions,{action:'visual-proposal-'+body.decision,proposalId:proposal.proposalId,actor:identity,at:new Date().toISOString(),inputHash}]}};
   }catch{return {status:400,error:'Check the required fields and permitted values.'};}
  }else{
   if(cached.visual?.proposals?.some(p=>p.review.state==='pending'))return {status:409,error:'Information changed. Reload and review.'};
   if(cached.review.status==='reviewed')return {status:200,analysis:cached,cacheHit:true,persisted:true};
   result={...cached,review:{status:'reviewed',actions:[...cached.review.actions,{action:'vendor-reviewed',actor:identity,at:new Date().toISOString(),inputHash}]}};
  }
  const stored=await store.saveSellingIntelligence(identity,profile,saved,assets,stock,result,inputHash,cached);
  return stored?{status:200,analysis:stored,persisted:true,cacheHit:true}:{status:409,error:'Information changed. Reload and review.'};
 }
 if(cached)return {status:200,analysis:cached,cacheHit:true,persisted:true};
 const result=native.analyze(input);result.inputHash=inputHash;
 if(persisted&&visualRunner){
  result.visual=await visualRunner.analyze({profile,product,assets,identity});
  result.model=result.visual.status==='succeeded'?{available:true,modelId:result.visual.provenance.modelId,modelVersion:result.visual.provenance.modelVersion}:{available:false,reason:result.visual.code||'model-execution-failed'};
  if(result.visual.status!=='succeeded')result.validUntil=new Date(Date.now()+5000).toISOString();
 }
 if(!persisted){if(visualRunner)result.visual={status:'unavailable',code:'save-product-first'};return {status:200,analysis:result,cacheHit:false,persisted:false};}
 const stored=await store.saveSellingIntelligence(identity,profile,saved,assets,stock,result);
 return stored?{status:200,analysis:stored,cacheHit:false,persisted:true}:{status:409,error:'Information changed. Reload and review.'};
}
module.exports={editorProduct,run};
