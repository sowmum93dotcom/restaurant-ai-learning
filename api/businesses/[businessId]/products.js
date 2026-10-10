'use strict';
const {getRepository}=require('../../_lib/persistence');
const {authorizeBusinessOwnerRequest}=require('../../_lib/demeos-business-owner-authorization');
const {DEMEOS_ACTIONS}=require('../../_lib/demeos-rules');
const {canManage,catalogueRevision,rowsFor,key}=require('../../_lib/vendor-inventory');
const {preserveProduct}=require('../../../js/business-product-preparation');
const {validateProfile}=require('../[businessId].js');
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
  if(!canManage(record,businessId))return res.status(403).json({error:'Save Selling as your business model before preparing products.'});
  const previous=record.businessProfile;
  if(Number(previous.profileVersion)<2)return res.status(409).json({error:"Complete and save My Business before preparing the selling catalogue."});
  if(req.method==='GET')return res.status(200).json({businessId,products:previous.products||[],catalogueRevision:catalogueRevision(previous)});
  if(req.body?.catalogueRevision!==catalogueRevision(previous))return res.status(409).json({error:'Products changed. Reload before saving.'});
  if(!Array.isArray(req.body.products)||req.body.products.length>100||req.body.accuracyConfirmed!==true)return res.status(400).json({error:'Review your products and confirm their accuracy.'});
  const prepared=[];
  for(const item of req.body.products){
   if(!item||typeof item!=='object'||Array.isArray(item))return res.status(400).json({error:'Check each product.'});
   const old=previous.products?.find(p=>p.productId===item.productId);
   if(old?.presentation&&item.presentation===undefined&&(old.price!==item.price||old.priceMode!==item.priceMode))return res.status(409).json({error:'Review saved options and pricing before changing the price.'});
   prepared.push(old?.presentation&&item.presentation?{...item,presentation:{...item.presentation,options:item.presentation.options??old.presentation.options,variants:item.presentation.variants??old.presentation.variants}}:item);
  }
  const validated=validateProfile({body:{businessProfile:{...previous,products:prepared}},query:{businessId}});
  if(!validated)return res.status(400).json({error:'Check product names, descriptions, prices, options and fulfilment.'});
  let products;try{products=validated.products.map(product=>preserveProduct(previous.products?.find(old=>old.productId===product.productId),product));}catch(error){return res.status(409).json({error:error.message});}
  const inventory=await repository.getVendorInventory(businessId);
  const nextRows=new Map(rowsFor({...previous,products},inventory.entries).map(row=>[key(row.productId,row.variantId),row]));
  if(Object.keys(inventory.entries).some(id=>nextRows.get(id)?.blocked))return res.status(409).json({error:'Recorded stock options cannot be reassigned. Add a new variant for a different combination.'});
  // Gallery references are server-validated exact assets, never browser URLs.
  for(const product of products){
   const supplied=req.body.products.find(p=>p.productId===product.productId)?.mediaGallery;
   if(supplied!==undefined){
    if(!supplied||!Array.isArray(supplied.assetIds)||supplied.assetIds.length>20||new Set(supplied.assetIds).size!==supplied.assetIds.length||supplied.assetIds.some(id=>typeof id!=='string')||typeof supplied.mainAssetId!=='string'||(supplied.mainAssetId&&!supplied.assetIds.includes(supplied.mainAssetId)))return res.status(400).json({error:'Choose matching product images for the gallery.'});
    const assets=await repository.getBusinessMediaAssetsByIds(businessId,supplied.assetIds);
    if(assets.length!==supplied.assetIds.length||assets.some(asset=>asset.businessId!==businessId||asset.relatedEntityId!==product.productId||asset.state!=='ready')||supplied.mainAssetId&&!assets.some(asset=>asset.assetId===supplied.mainAssetId&&asset.kind==='image'))return res.status(400).json({error:'Use only ready images and videos belonging to this product.'});
    product.mediaGallery={assetIds:supplied.assetIds,mainAssetId:supplied.mainAssetId};
   }
  }
  const next={...previous,products,informationStatus:{...previous.informationStatus,ownerConfirmedAt:new Date().toISOString(),reviewState:'draft',submittedAt:null}};
  const saved=await repository.saveSellingProducts(access.actorContext.trustedIdentityId,businessId,previous,next);
  if(!saved)return res.status(409).json({error:'Products changed. Reload before saving.'});
  return res.status(200).json({businessId,products:saved.products,informationStatus:saved.informationStatus,catalogueRevision:catalogueRevision(saved)});
 }catch(error){console.error('Vendor products unavailable',error);return res.status(503).json({error:'Products could not be saved. Your edits are retained.'});}
};
