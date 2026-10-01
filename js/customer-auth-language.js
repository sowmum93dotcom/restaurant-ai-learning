/* Adapter for provider copy. The existing Customer Interface owns language selection and storage. */
(function(root){
 'use strict';
 const supported=['en','es','fr','ar','pt','zh','hi','de','ja'];
 const resources=new Map();
 function code(){const value=(root.document.documentElement.lang||'en').split('-')[0];return supported.includes(value)?value:'en';}
 async function localization(language=code()){
  if(!supported.includes(language))throw new Error('Unsupported customer language');
  if(!resources.has(language))resources.set(language,root.fetch('/js/customer-auth-locales/'+language+'.json',{credentials:'same-origin'}).then(response=>{if(!response.ok)throw new Error('Authentication language unavailable');return response.json();}));
  try{return await resources.get(language);}catch(error){resources.delete(language);throw error;}
 }
 function bind(clerk){
  let previous=code(),revision=0;
  const observer=new root.MutationObserver(async()=>{
   const next=code();if(next===previous)return;previous=next;const current=++revision;
   try{
    const copy=await localization(next);if(current!==revision)return;
    // Clerk JS 6's integration hook updates the mounted provider components.
    if(typeof clerk.__internal_updateProps==='function')await clerk.__internal_updateProps({options:{localization:copy}});
    else root.location.reload();
   }catch(_){if(current===revision)root.location.reload();}
  });
  observer.observe(root.document.documentElement,{attributes:true,attributeFilter:['lang']});
 }
 root.DEMEOSCustomerAuthLanguage=Object.freeze({localization,bind});
})(typeof window!=='undefined'?window:{});
