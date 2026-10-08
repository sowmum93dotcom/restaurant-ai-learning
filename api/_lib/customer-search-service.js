'use strict';
const {findCustomerPossibilities,stablePossibilityId}=require('./customer-possibility-contract');
const {getValidPublicCustomerWork}=require('./customer-public-work-contract');
const {understandSearch,providerText}=require('./customer-search-understanding');
const {constrainPossibility}=require('./customer-search-constraints');
const {runIntelligenceRuntime}=require('./customer-intelligence-runtime');
const {rankingCandidates,offlineShadowProvider,FEATURE_POLICY}=require('./customer-search-ranking');
const {searchReference,emitSearchEvidence}=require('./customer-search-events');
const {scheduleCustomerSearch}=require('./customer-search-registry');
const {selectCategoryWork}=require('./customer-category-classification');
const {understandCustomerCategories}=require('./customer-category-understanding');
async function prepareCustomerSearch({understanding,work,preferences=[],feedback=[],place='',locale='en',configuration,testMode=false}={}){
  const safeConfiguration=testMode?{...configuration,understanding:null,categoryUnderstanding:null}:configuration;
  const parsed=await understandSearch({understanding,place,locale,configuration:safeConfiguration});
  const categoryUnderstanding=await understandCustomerCategories({text:understanding.customerText,locale:parsed.intention.locale,configuration:safeConfiguration});
  const categoryInterpretation=categoryUnderstanding.interpretation;
  const intention={...parsed.intention,category:categoryInterpretation.categoryIds.length===1?categoryInterpretation.categoryIds[0]:null,categoryInterpretation};
  const categorySelection=selectCategoryWork(work,categoryInterpretation);
  // Separate a parsed monetary phrase from lexical requirements; the explicit
  // monetary restriction is enforced independently before the final result cap.
  const matchingRequest=intention.budget?{...understanding,customerText:understanding.customerText.replace(intention.budget.sourceText,'')}:understanding;
  // Only separately approved source-bound semantics may extend retrieval. Mask
  // their exact spans; every remaining request term still needs same-offer evidence.
  let semanticRetrieval=null;
  if(categoryUnderstanding.reason==='validated_category_understanding'&&categoryUnderstanding.retrievalCandidates?.length===1){
    const candidate=categoryUnderstanding.retrievalCandidates[0];
    let remainingText=understanding.customerText.slice(0,candidate.evidence.start)+' '+understanding.customerText.slice(candidate.evidence.end);
    if(intention.budget)remainingText=remainingText.replace(intention.budget.sourceText,'');
    semanticRetrieval={categoryId:candidate.categoryId,remainingText};
  }
  const rejected=categorySelection.rejectedWorkItemIds.map(workItemId=>({resultId:stablePossibilityId(workItemId),reason:'category_classification_mismatch'}));
  const possibilities=findCustomerPossibilities(matchingRequest,categorySelection.work,undefined,preferences,feedback,intention.location || '',p=>{
    const checked=constrainPossibility(p,intention);if(!checked.accepted){rejected.push({resultId:p.possibilityId,reason:checked.reason});return null;}return checked.possibility;
  },semanticRetrieval);
  const eligible=new Set(possibilities.map(p=>p.possibilityId));
  const known=new Set(rejected.map(r=>r.resultId));
  for(const w of getValidPublicCustomerWork(work)){
    const resultId=stablePossibilityId(w.workItemId);
    if(!eligible.has(resultId)&&!known.has(resultId))rejected.push({resultId,reason:'deterministic_relevance_or_result_limit'});
  }
  const reason=intention.ambiguity.length?'clarification_required':possibilities.length?'supported_results':!work?.length?'empty_catalogue':rejected.some(r=>r.reason==='hard_requirement_not_supported'||r.reason==='requirement_not_verifiable')?'hard_requirements_unverified':'unsupported_request';
  return {possibilities,intention,reason,rejected,reference:searchReference(getValidPublicCustomerWork(work,20,{forSearchClassification:true}),locale)};
}
async function completeCustomerSearch({prepared,possibilities,understanding,work,identity,testMode,configuration={},defer}={}){
  // Controlled catalogue results stay local, including ranking and evidence.
  if(testMode)configuration={...configuration,mode:'baseline',allowProviderRequest:false,provider:null,artifact:null,evidence:null};
  const baseline=possibilities;
  const request={intention:providerText(understanding.intention),customerText:providerText(understanding.customerText),place:providerText(prepared.intention.location || ''),locale:prepared.intention.locale};
  const run=async()=>{
    const artifact=configuration.artifact;
    const provider=artifact&&configuration.mode==='shadow'&&configuration.featurePolicyVersion===FEATURE_POLICY?offlineShadowProvider(artifact,baseline,configuration.baselineVersion):configuration.allowProviderRequest===true?configuration.provider:null;
    if(artifact&&configuration.mode!=='shadow')return {possibilities:baseline,modeApplied:'baseline',diagnostic:{reason:'offline_artifact_shadow_only'}};
    return runIntelligenceRuntime({mode:configuration.mode,baselineVersion:configuration.baselineVersion,candidateVersion:artifact?.candidateVersion || provider?.intelligenceVersion,provider,request,
      possibilities:baseline,rankingCandidates:rankingCandidates(baseline),resolveApproval:configuration.resolveApproval,timeoutMs:configuration.timeoutMs || 150});
  };
  const capture=result=>emitSearchEvidence({configuration,reference:{...prepared.reference,intelligenceVersion:result.modeApplied==='candidate'?result.diagnostic.candidateVersion:configuration.baselineVersion},identity,testMode,possibilities:baseline,work,rejected:prepared.rejected,
    mode:result.modeApplied,visibleOrdering:result.possibilities.map(p=>p.possibilityId),candidateVersion:result.diagnostic.candidateVersion,
    artifactFingerprint:configuration.artifact?.fingerprint || configuration.provider?.artifactFingerprint,
    shadowOrdering:result.modeApplied==='shadow'?result.diagnostic.rankedIds:undefined});
  if(configuration.mode==='shadow'){
    // A host lifecycle hook is mandatory. Do not await a shadow provider before
    // responding and do not leave an untracked task after serverless shutdown.
    scheduleCustomerSearch(defer,()=>run().then(capture));
    return baseline;
  }
  const result=await run();
  if(configuration.evidence)scheduleCustomerSearch(defer,()=>capture(result));
  return result.possibilities;
}
module.exports={prepareCustomerSearch,completeCustomerSearch};
