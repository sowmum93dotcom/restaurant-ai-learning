'use strict';
const { excludedCustomerTerms, explicitAdditionalRequirements, meaningfulTerms, evidencedConcepts } = require('./customer-possibility-contract');
const { LOCALES, plain } = require('./customer-evidence-provenance');
const SCHEMA_VERSION = 'customer-search-intention-v1';
const EXTRACTION_FIELDS = Object.freeze(['concept','mustHave','preference','exclusion','budget','date','time','location','distance','quantity','partySize','context']);
const ATTRIBUTES = Object.freeze(['black','blue','pink','waterproof']);

function budgetFrom(text) {
  const match = /\b(under|below|less than|up to|at most)\s*(£|€|GBP\s*|EUR\s*|USD\s*)\s*(\d+(?:\.\d{1,2})?)(?![\d.])/i.exec(text);
  if (!match) return null;
  return { maximum:Number(match[3]), currency:/^(£|GBP)/i.test(match[2])?'GBP':/^(€|EUR)/i.test(match[2])?'EUR':'USD', inclusive:/^(up to|at most)$/i.test(match[1]), sourceText:match[0] };
}
function structuredIntention(understanding, place='', locale='en') {
  const text = understanding.customerText;
  const exclusions = [...excludedCustomerTerms(text)].sort();
  const terms = meaningfulTerms(text);
  const preferences=ATTRIBUTES.filter(value=>new RegExp('\\b(?:prefer|preferably|ideally)\\s+'+value+'\\b','i').test(text));
  const negations=(text.match(/\b(?:not|no|without|avoid)\s+[^\s,.!?]+/giu)||[]).slice(0,20);
  const mustHave = [...new Set([...explicitAdditionalRequirements(text), ...ATTRIBUTES.filter(value=>terms.has(value)&&!exclusions.includes(value)&&!preferences.includes(value))])].sort();
  const budget=budgetFrom(text);
  const date=/\b(tomorrow|today|\d{4}-\d{2}-\d{2})\b/i.exec(text)?.[0] || null;
  const time=/\b(?:at\s+)?\d{1,2}:\d{2}\s*(?:am|pm)?\b/i.exec(text)?.[0] || null;
  const distance=/\b(?:within|under)\s+\d+(?:\.\d+)?\s*(?:km|kilometres?|miles?)\b/i.exec(text)?.[0] || null;
  const quantity=/\b\d+\s+(?:items?|pieces?|jackets?)\b/i.exec(text)?.[0] || null;
  const partySize=/\b(?:for\s+)?\d+\s+(?:people|persons?|guests?)\b/i.exec(text)?.[0] || null;
  const explicitLocation=/\b(?:near|in)\s+([\p{L}]+(?:\s+[\p{L}]+)?)(?=[,.!?]|$)/iu.exec(text)?.[1] || '';
  const local=place || (explicitLocation.toLowerCase()==='me'?'':explicitLocation);
  const ambiguity=/\bnear me\b/i.test(text)&&!local?['location-required']:[];
  return Object.freeze({schemaVersion:1,version:SCHEMA_VERSION,purpose:understanding.intention || null,
    concepts:evidencedConcepts(terms,terms),category:null,mustHave,preferences,exclusions,negations,budget,requireAvailability:terms.has('available')&&!exclusions.includes('available'),
    date,time,location:local || null,distance,quantity,partySize,context:[],locale:LOCALES.includes(locale)?locale:'en',ambiguity,
    provenance:[...mustHave.map(value=>({field:'mustHave',source:'customer-request',text:value})),...exclusions.map(value=>({field:'exclusion',source:'customer-request',text:value})),
      ...(budget?[{field:'budget',source:'customer-request',text:budget.sourceText}]:[]),...(local?[{field:'location',source:place?'customer-place':'customer-request',text:local}]:[])]});
}
// Provider may select literal request spans only, never invent a constraint or an
// identifier. New hard restrictions can narrow eligibility, never relax it.
function validateUnderstandingOutput(raw, text, baseline) {
  if(!plain(raw)||Object.keys(raw).sort().join(',')!=='extractions,schemaVersion'||raw.schemaVersion!==1||!Array.isArray(raw.extractions)||raw.extractions.length>20)return null;
  const extras={mustHave:[],preferences:[],exclusions:[],context:[],concepts:[]},seen=new Set(),provenance=[];
  const result={...baseline};
  for(const item of raw.extractions){
    if(!plain(item)||Object.keys(item).sort().join(',')!=='end,field,start'||!EXTRACTION_FIELDS.includes(item.field)||!Number.isInteger(item.start)||!Number.isInteger(item.end)||item.start<0||item.end<=item.start||item.end>text.length||item.end-item.start>120)return null;
    const key=JSON.stringify(item);if(seen.has(key))return null;seen.add(key);
    const value=text.slice(item.start,item.end).trim();if(!value)return null;
    const preceding=text.slice(Math.max(0,item.start-20),item.start);
    if(['mustHave','preference','concept'].includes(item.field)&&(/\b(?:not|no|without|avoid)\s*$/i.test(preceding)||baseline.exclusions.includes(value.toLowerCase())))return null;
    if(item.field==='exclusion'&&!baseline.exclusions.includes(value.toLowerCase())&&!/\b(?:not|no|without|avoid|exclude|excluding)\s*$/i.test(preceding))return null;
    if(item.field==='preference'&&!/\b(?:prefer|preferably|ideally)\s*$/i.test(preceding))return null;
    if(item.field==='location'&&baseline.location!==value&&!/\b(?:near|in|around|at)\s*$/i.test(preceding))return null;
    if(item.field==='date'&&!/^(today|tomorrow|\d{4}-\d{2}-\d{2})$/i.test(value))return null;
    if(item.field==='time'&&!/^(?:at\s+)?\d{1,2}:\d{2}\s*(?:am|pm)?$/i.test(value))return null;
    if(item.field==='distance'&&!/^(?:within|under)\s+\d+(?:\.\d+)?\s*(?:km|kilometres?|miles?)$/i.test(value))return null;
    if(item.field==='quantity'&&!/^\d+\s+(?:items?|pieces?|jackets?)$/i.test(value))return null;
    if(item.field==='partySize'&&!/^(?:for\s+)?\d+\s+(?:people|persons?|guests?)$/i.test(value))return null;
    if(item.field==='budget'){const parsed=budgetFrom(value);if(!parsed||JSON.stringify(parsed)!==JSON.stringify(baseline.budget))return null;}
    else if(['date','time','distance','quantity','partySize','location'].includes(item.field)){
      if(result[item.field]!==null&&result[item.field]!==value)return null;
      if(item.field==='location'&&value.toLowerCase()==='me')return null;
      result[item.field]=value;
    }else extras[{concept:'concepts',preference:'preferences',exclusion:'exclusions'}[item.field]||item.field].push(value.toLowerCase());
    provenance.push({field:item.field,source:'validated-provider-span',start:item.start,end:item.end});
  }
  for(const key of Object.keys(extras))result[key]=[...new Set([...baseline[key],...extras[key]])];
  return Object.freeze({...result,provenance:[...baseline.provenance,...provenance]});
}
module.exports={SCHEMA_VERSION,EXTRACTION_FIELDS,budgetFrom,structuredIntention,validateUnderstandingOutput};
