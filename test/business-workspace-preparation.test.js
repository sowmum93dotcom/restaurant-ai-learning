'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {prepareBusinessDraft}=require('../api/_lib/business-marketing-draft');
const {workspaceReadiness}=require('../api/_lib/business-workspace-readiness');
const {getOwnerActivityMetrics}=require('../js/business-results');
const profile={businessId:'owned',name:'Engineering shop',location:'London',products:[{businessId:'owned',productId:'offer',name:'Exact jacket',description:'Owner supplied description',price:'£89',priceMode:'fixed',availability:'limited',continuationRoute:'website'}],customerContinuation:{routes:['website']}};
const asset={businessId:'owned',assetId:'media-owned',relatedEntityId:'offer',purpose:'product',kind:'image',state:'ready',deliveryUrl:'https://example.org/exact.jpg'};
test('factual preparation uses only saved facts and exact media, and never publishes',()=>{
 const draft=prepareBusinessDraft({businessProfile:profile},'owned','offer','media-owned',[asset]);
 assert.equal(draft.preparationOnly,true);assert.deepEqual(draft.media,[{assetId:'media-owned',role:'primary'}]);
 assert.equal(draft.campaign,'Exact jacket\n\nEngineering shop\n\nOwner supplied description\n\n£89\n\nLimited availability\n\nLondon\n\nVisit our website.');
 assert.equal(prepareBusinessDraft({businessProfile:profile},'foreign','offer'),null);
 for(const override of [{businessId:'foreign'},{relatedEntityId:'wrong'},{state:'processing'},{purpose:'marketing'}])assert.equal(prepareBusinessDraft({businessProfile:profile},'owned','offer','media-owned',[{...asset,...override}]),null);
});
test('missing price and availability remain contact requests without inferred facts',()=>{
 const record={businessProfile:{...profile,products:[{...profile.products[0],price:'',priceMode:'contact',availability:'contact'}]}};
 const draft=prepareBusinessDraft(record,'owned','offer');assert.match(draft.campaign,/Contact the business for pricing/);assert.match(draft.campaign,/confirm availability/);assert.doesNotMatch(draft.campaign,/£|in stock|free/i);
});
test('owner profile choices cannot activate selling or infer a merchant permission',()=>{
 const readiness=workspaceReadiness({businessProfile:{...profile,selling:true,sellerStatus:'verified',workspaceReadiness:{selling:{canSell:true}}}},'owned');
 assert.equal(readiness.marketing.canPrepare,true);assert.equal(readiness.selling.canPrepare,true);assert.equal(readiness.selling.canSell,false);assert.equal(readiness.publication.draftsPublic,false);
 assert.equal(workspaceReadiness({businessProfile:profile},'foreign'),null);
});
test('activity distinguishes unavailable product metrics and private stored interaction evidence',()=>{
 const metrics=getOwnerActivityMetrics({businessProfile:profile,campaigns:[{businessId:'owned',id:'campaign',approvalStatus:'Approved'}],customerParticipationResults:[{businessId:'owned',workItemId:'campaign',customerInterestCount:3},{businessId:'foreign',workItemId:'other',customerInterestCount:999}]},'owned');
 assert.deepEqual(metrics.map(m=>m.value),[null,null,3,null,null]);assert.doesNotMatch(JSON.stringify(metrics),/999|identity|customerId/);
 assert.equal(getOwnerActivityMetrics({businessProfile:profile},'foreign'),null);
});
test('persisted private marker survives old-window and stale writes atomically',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),{createDatabase}=require('../api/_lib/database'),{createPersistenceRepository}=require('../api/_lib/persistence');
 const client=new PGlite(),database=createDatabase(client),repo=createPersistenceRepository(database);
 try{
  await database.ensureSchema();await repo.saveBusiness(profile);
  const original={id:'private-old',businessId:'owned',campaignText:'Private reviewed content',campaignType:'social',campaignTypeLabel:'Social Media Campaign',businessName:profile.name,createdAt:'2020-01-01T00:00:00Z',approvalStatus:'Unapproved',preparationOnly:true,productId:'offer'};
  await repo.saveCampaign(original);
  await database.query("UPDATE demeos_campaigns SET created_at = '2020-01-01' WHERE campaign_id = $1",[original.id]);
  for(let i=0;i<21;i++)await repo.saveCampaign({...original,id:'recent-'+i,preparationOnly:false});
  assert.ok(!(await repo.getKnownBusiness('owned')).campaigns.some(c=>c.id===original.id));
  assert.equal((await repo.getBusinessCampaign('owned',original.id)).preparationOnly,true);
  assert.equal(await repo.getBusinessCampaign('foreign',original.id),null);
  assert.equal(await repo.approveCampaign('owned',original.id),null);
  assert.equal(await repo.saveCampaign({...original,preparationOnly:false,approvalStatus:'Approved'}),null);
  const stale=await repo.saveCampaign({...original,preparationOnly:false});assert.equal(stale.preparationOnly,true);assert.equal(stale.approvalStatus,'Unapproved');
  assert.equal(await repo.saveCampaign({...original,id:'insert-approved',approvalStatus:'Approved'}),null);
 }finally{await client.close();}
});
test('public projection rejects a prepared draft even with an invalid approved flag',()=>{
 const {canPublishToDemeosCustomerExperience}=require('../api/_lib/customer-publication-rules');
 assert.equal(canPublishToDemeosCustomerExperience({approvalStatus:'Approved',campaignType:'social',campaignText:'Reviewed draft',preparationOnly:true}),false);
 assert.equal(canPublishToDemeosCustomerExperience({approvalStatus:'Approved',campaignType:'social',campaignText:'Existing legacy campaign'}),true);
});
