'use strict';
// Personal ROOT requests have no Selling business/product authority.
const {createHash}=require('node:crypto');
const LOCALES=Object.freeze(['en','es','fr','ar','pt','zh','hi','de','ja','tr']);
const LIMITS=Object.freeze({timeoutMs:2000,maxInputBytes:16384,maxOutputBytes:8192,maxOutputTokens:64,maxTextChars:500,maxReplyChars:500,maxJobsPerHour:20,maxTotalJobs:100});
const CONTRACT=Object.freeze({schemaVersion:1,inputSchema:'demeos-root-text-input-v1',outputSchema:'demeos-root-text-output-v1',capability:'root-text-response',limits:LIMITS});
const plain=v=>Boolean(v&&Object.getPrototypeOf(v)===Object.prototype);
const exact=(v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const requestId=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const workspaceId=v=>typeof v==='string'&&/^root-[a-f0-9]{64}$/.test(v);
const principalKey=identity=>createHash('sha256').update(JSON.stringify(['root-native-budget-v1',identity])).digest('hex');
function validateInput(v){
 try{return exact(v,['schemaVersion','inputSchema','capability','workspaceId','audience','requestId','outputLocale','text','media'])&&v.schemaVersion===1&&v.inputSchema===CONTRACT.inputSchema&&v.capability===CONTRACT.capability&&workspaceId(v.workspaceId)&&['business','customer'].includes(v.audience)&&requestId(v.requestId)&&LOCALES.includes(v.outputLocale)&&typeof v.text==='string'&&v.text===v.text.trim()&&v.text.length>0&&v.text.length<=LIMITS.maxTextChars&&Array.isArray(v.media)&&v.media.length===0&&Buffer.byteLength(JSON.stringify(v))<=LIMITS.maxInputBytes;}catch{return false;}
}
function validateOutput(v){
 try{return exact(v,['schemaVersion','outputSchema','reply'])&&v.schemaVersion===1&&v.outputSchema===CONTRACT.outputSchema&&typeof v.reply==='string'&&v.reply===v.reply.trim()&&v.reply.length>0&&v.reply.length<=LIMITS.maxReplyChars&&!/[<>\u0000-\u0008\u000b-\u001f\u007f]/.test(v.reply)&&Buffer.byteLength(JSON.stringify(v))<=LIMITS.maxOutputBytes;}catch{return false;}
}
module.exports={CONTRACT,LIMITS,LOCALES,validateInput,validateOutput,requestId,workspaceId,principalKey,digest};
