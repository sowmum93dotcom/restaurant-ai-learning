'use strict';
const {getRepository}=require('../../_lib/persistence');
const {authorizeBusinessOwnerRequest}=require('../../_lib/demeos-business-owner-authorization');
const {DEMEOS_ACTIONS}=require('../../_lib/demeos-rules');
const {canManage}=require('../../_lib/vendor-inventory');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
 const businessId=typeof req.query.businessId==='string'?req.query.businessId.trim():'';
 if(!businessId)return res.status(400).json({error:'Select a business.'});
 try{const repository=getRepository(),access=await authorizeBusinessOwnerRequest({req,businessId,repository,action:DEMEOS_ACTIONS.VIEW_OWN_BUSINESS_RESULTS});
 if(!access.authenticated)return res.status(401).json({error:'Authentication required.'});
 if(!access.allowed)return res.status(403).json({error:'Business access unavailable.'});
 if(!canManage(await repository.getKnownBusiness(businessId),businessId))return res.status(403).json({error:'Selling workspace access required.'});
 return res.status(200).json({businessId,orders:await repository.getVendorOrders(access.actorContext.trustedIdentityId,businessId),liveOrderingActive:false});
 }catch(_){return res.status(503).json({error:'Orders unavailable.'});}
};
