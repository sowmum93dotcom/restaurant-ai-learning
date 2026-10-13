'use strict';
const {resolveTrustedIdentityFromRequest}=require('./demeos-authentication');
const {createAuthenticatedAdminContext}=require('./demeos-actor-context');
const {authorizeDemeosAction}=require('./demeos-authorization');
const {DEMEOS_ACTIONS}=require('./demeos-rules');
const {getRepository}=require('./persistence');
const {revision,completeness,isSubmitted}=require('./business-application-contract');
module.exports=async function(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 try{
  const identity=await resolveTrustedIdentityFromRequest(req);
  if(!identity)return res.status(401).json({error:'Authentication required.'});
  if(identity.actorScope!=='demeos-admin'||!authorizeDemeosAction({actorContext:createAuthenticatedAdminContext(identity),action:DEMEOS_ACTIONS.MANAGE_PLATFORM}).allowed)return res.status(403).json({error:'Administrator permission required.'});
  if(req.method==='POST'&&req.headers?.origin){const host=req.headers['x-forwarded-host']||req.headers.host;let originHost;try{originHost=new URL(req.headers.origin).host;}catch(_){return res.status(403).json({error:'Same-origin review required.'});}if(!host||originHost!==host)return res.status(403).json({error:'Same-origin review required.'});}
  const repository=getRepository(),id=req.query?.businessId;
  if(id!==undefined&&(typeof id!=='string'||!id.trim()||id.length>200))return res.status(400).json({error:'Invalid business reference.'});
  if(req.method==='GET'&&!id){
   const cursor=req.query?.cursor||'';if(typeof cursor!=='string'||cursor.length>200)return res.status(400).json({error:'Invalid page reference.'});
   const rows=await repository.listSubmittedBusinessApplications(cursor,26),more=rows.length>25;
   return res.status(200).json({applications:rows.slice(0,25).map(row=>({businessId:row.business_id,name:row.profile.name,submittedAt:row.profile.informationStatus?.submittedAt||null})),nextCursor:more?rows[24].business_id:null,approvalAvailable:true});
  }
  if(!id)return res.status(400).json({error:'A business reference is required.'});
  const application=await repository.getBusinessApplication(id);if(!application)return res.status(404).json({error:'Application not found.'});
  const profile=application.profile,currentRevision=revision(profile);
  if(req.method==='GET')return res.status(200).json({businessId:id,profile,owners:application.owners,revision:currentRevision,complete:profile.businessId===id&&application.owners.length>0&&completeness(profile),submitted:isSubmitted(profile),reviews:application.reviews,approvalAvailable:true});
  const body=req.body,scoped=['approved','rejected','revoked'].includes(body?.decision);
  const fields=scoped?'applications,decision,notes,revision':'decision,notes,revision';
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!==fields||
      !['reviewed','changes-requested','approved','rejected','revoked'].includes(body.decision)||typeof body.notes!=='string'||body.notes.length>2000||typeof body.revision!=='string'||!/^[a-f0-9]{64}$/.test(body.revision))return res.status(409).json({error:'Review the current application and choose a supported review decision.'});
  if(application.owners.includes(identity.trustedIdentityId))return res.status(403).json({error:'Administrators cannot review or approve their own business.'});
  if(scoped){
   if(!Array.isArray(body.applications)||!body.applications.length||body.applications.length>2||new Set(body.applications).size!==body.applications.length||body.applications.some(value=>!['marketing','selling'].includes(value)))return res.status(400).json({error:'Select Marketing, Selling or both.'});
   const applications=[...body.applications].sort();
   if(body.revision===currentRevision&&body.decision!=='revoked'){
    const requested=profile.preparationModel==='both'?['marketing','selling']:[profile.preparationModel];
    if(!isSubmitted(profile)||profile.businessId!==id||!application.owners.length||applications.some(value=>!requested.includes(value)))return res.status(409).json({error:'A complete current submission requesting these applications is required.'});
    if(body.decision==='approved'&&applications.includes('marketing')&&['brandVoice','targetCustomer','goal'].some(key=>typeof profile[key]!=='string'||!profile[key].trim()))return res.status(409).json({error:'Marketing requirements are incomplete.'});
   }
   const review=await repository.recordBusinessApplicationAccess({businessId:id,profile,revision:body.revision,administratorId:identity.trustedIdentityId,decision:body.decision,applications,notes:body.notes.trim()});
   if(!review)return res.status(409).json({error:'The application changed. Reload before deciding.'});
   return res.status(200).json({review,approved:body.decision==='approved'});
  }
  if(body.revision!==currentRevision||profile.businessId!==id||!application.owners.length||!isSubmitted(profile))return res.status(409).json({error:'A complete current submission is required.'});
  const review=await repository.recordBusinessApplicationReview({businessId:id,profile,revision:currentRevision,administratorId:identity.trustedIdentityId,decision:body.decision,notes:body.notes.trim()});
  if(!review)return res.status(409).json({error:'The application changed or already has a different decision. Reload before reviewing.'});
  return res.status(200).json({review,approved:false});
 }catch(_){return res.status(503).json({error:'Business application review is unavailable. Try again later.'});}
};
