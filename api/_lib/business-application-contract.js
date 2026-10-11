'use strict';
const {createHash}=require('node:crypto');
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
function revision(profile){return createHash('sha256').update(JSON.stringify(canonical(profile))).digest('hex');}
function completeness(profile){return !!profile&&Number(profile.profileVersion)>=3&&!!profile.informationStatus?.ownerConfirmedAt&&!!profile.preparationModel&&typeof profile.offeringCategoryId==='string'&&!!require('../businesses/[businessId]').validateProfile({body:{businessProfile:profile},query:{businessId:profile.businessId}});}
function isSubmitted(profile){return profile?.informationStatus?.reviewState==='submitted'&&typeof profile.informationStatus.submittedAt==='string'&&!!profile.informationStatus.submittedAt&&completeness(profile);}
function ownerStatus(profile,review){
 const applications=Object.fromEntries(['marketing','selling'].map(application=>[application,{status:profile?.applicationAccess?.[application]===true?'approved':profile?.applicationDecisions?.[application]?.status|| (isSubmitted(profile)?review?.decision||'submitted':'draft'),decidedAt:profile?.applicationDecisions?.[application]?.decidedAt||null}]));
 const approved=Object.values(applications).some(application=>application.status==='approved');
 const intent=profile?.preparationModel==='both'?['marketing','selling']:[profile?.preparationModel||'marketing'];
 const states=intent.map(application=>applications[application]?.status);
 return {status:approved?'approved':states.includes('revoked')?'revoked':states.includes('rejected')?'rejected':isSubmitted(profile)?review?.decision||'submitted':'draft',approved,applications,reviewAvailable:true,decidedAt:isSubmitted(profile)?review?.decided_at||null:null};
}
module.exports={revision,completeness,isSubmitted,ownerStatus};
