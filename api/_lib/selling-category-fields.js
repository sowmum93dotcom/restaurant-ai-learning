'use strict';
// Authoring metadata extends the authoritative 171 classification identifiers.
// Categories without reviewed field definitions retain the ordinary editor.
const registry=require('./marketing-agent-categories');
const VERSION=1;
const definitions={
 '9':[{key:'quantity',label:'Pack quantity',required:true,maxLength:120},{key:'ingredients',label:'Ingredients and allergens',required:false,maxLength:1200}],
 '10':[{key:'material',label:'Material',required:true,maxLength:300},{key:'care',label:'Care instructions',required:false,maxLength:600}],
 '11':[{key:'model',label:'Model reference',required:true,maxLength:200},{key:'specifications',label:'Technical specifications',required:true,maxLength:1200}],
 '39':[{key:'format',label:'Course format',required:true,maxLength:300},{key:'duration',label:'Duration',required:true,maxLength:120}],
 '81':[{key:'scope',label:'Service scope',required:true,maxLength:1200},{key:'duration',label:'Duration',required:false,maxLength:120}]
};
for(const [id,fields] of Object.entries(definitions)){if(!registry.getCategory(id))throw Error('Unknown field-definition category.');Object.freeze(fields.map(Object.freeze));Object.freeze(fields);}
function definition(categoryId){return registry.getCategory(categoryId)?{schemaVersion:VERSION,categoryId,datasetVersion:registry.DATASET_VERSION,fields:definitions[categoryId]||[]}:null;}
function apply(previous,classification,input,{draft=false}={}){
 const schema=definition(classification?.categoryId);
 const next=structuredClone(previous||{schemaVersion:VERSION,byCategory:{}});
 if(!schema){if(input!==undefined&&input!==null)throw Error('Choose a category before adding category fields.');return next;}
 let values=next.byCategory?.[schema.categoryId]||{};
 if(input!==undefined){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='categoryId,datasetVersion,schemaVersion,values'||input.schemaVersion!==VERSION||input.categoryId!==schema.categoryId||input.datasetVersion!==schema.datasetVersion||!input.values||typeof input.values!=='object'||Array.isArray(input.values))throw Error('Invalid category fields.');
  const fields=new Map(schema.fields.map(f=>[f.key,f]));values={};
  for(const [key,value] of Object.entries(input.values)){const field=fields.get(key);if(!field||typeof value!=='string'||value.length>field.maxLength)throw Error('Check the category field values.');values[key]=value.trim();}
 }
 if(!draft&&schema.fields.some(f=>f.required&&!values[f.key]?.trim()))throw Error('Complete the required category fields.');
 return {...next,schemaVersion:VERSION,byCategory:{...next.byCategory,[schema.categoryId]:values}};
}
function ready(product){try{apply(product.categoryAttributes,product.classification,undefined);return true;}catch{return false;}}
module.exports={VERSION,definition,apply,ready,definitions};
