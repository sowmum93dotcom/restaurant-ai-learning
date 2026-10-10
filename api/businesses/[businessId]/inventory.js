'use strict';
const {getRepository}=require('../../_lib/persistence');
const {authorizeBusinessOwnerRequest}=require('../../_lib/demeos-business-owner-authorization');
const {DEMEOS_ACTIONS}=require('../../_lib/demeos-rules');
const inventory=require('../../_lib/vendor-inventory');
module.exports=async function(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');
 if(!['GET','PUT'].includes(req.method)){res.setHeader('Allow','GET, PUT');return res.status(405).json({error:'Method not allowed'});}
 const businessId=typeof req.query.businessId==='string'?req.query.businessId.trim():'';
 if(!businessId)return res.status(400).json({error:'Select a business.'});
 try{
  const repository=getRepository(),access=await authorizeBusinessOwnerRequest({req,businessId,repository,action:req.method==='GET'?DEMEOS_ACTIONS.VIEW_OWN_BUSINESS_RESULTS:DEMEOS_ACTIONS.MANAGE_BUSINESS_PROFILE});
  if(!access.authenticated)return res.status(401).json({error:'Authentication required.'});
  if(!access.allowed)return res.status(403).json({error:'Business access unavailable.'});
  const record=await repository.getKnownBusiness(businessId);
  if(!inventory.canManage(record,businessId))return res.status(403).json({error:'Save Selling as your business model before preparing stock.'});
  const profile=record.businessProfile,snapshot=inventory.catalogueRevision(profile),stock=await repository.getVendorInventory(businessId);
  if(req.method==='GET')return res.status(200).json({businessId,revision:stock.revision,catalogueRevision:snapshot,rows:inventory.rowsFor(profile,stock.entries),needsVariantSetup:profile.products.some(p=>p.presentation?.options?.length&&!p.presentation?.variants?.length&&p.presentation?.kind!=="service"),history:stock.history,sellingEnabled:false});
  if(!Number.isInteger(req.body?.revision)||req.body.revision<0||req.body.catalogueRevision!==snapshot||req.body.revision!==stock.revision)return res.status(409).json({error:'Stock or products changed. Reload before saving.'});
  let update;try{update=inventory.applyChanges(profile,stock.entries,req.body.changes);}catch(error){return res.status(400).json({error:error.message});}
  const saved=await repository.saveVendorInventory(access.actorContext.trustedIdentityId,businessId,profile,stock.revision,update.entries,update.audit);
  if(!saved)return res.status(409).json({error:'Stock or products changed. Reload before saving.'});
  return res.status(200).json({businessId,revision:saved.revision,catalogueRevision:snapshot,rows:inventory.rowsFor(profile,update.entries)});
 }catch(error){console.error('Vendor inventory unavailable',error);return res.status(503).json({error:'Stock could not be loaded or saved. Please retry.'});}
};
