'use strict';
const {acceptEvidence, ids, id, plain, fingerprint}=require('./customer-evidence-provenance');
function groupEvidence(records, options={}) {
  if (!Array.isArray(records) || records.length>10000) return {valid:false,reason:'bounded_records_required'};
  const groups=new Map(), seen=new Set(), searchGroups=new Map(), rejected=[];
  for(const raw of records) {
    const checked=acceptEvidence(raw,options);
    if(!checked.accepted){rejected.push({reason:checked.reason});continue;}
    const e=checked.evidence;
    if(seen.has(e.evidenceId))return {valid:false,reason:'duplicate_evidence_id'};
    seen.add(e.evidenceId);
    const key=e.evaluationId || e.searchId;
    if(searchGroups.has(e.searchId) && searchGroups.get(e.searchId)!==key)return {valid:false,reason:'inconsistent_interaction_reference'};
    searchGroups.set(e.searchId,key);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(e);
  }
  return {valid:true,rejected,groups:[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([groupId,evidence])=>{
    evidence.sort((a,b)=>a.evidenceId.localeCompare(b.evidenceId));
    const conflicts=[];
    if(new Set(evidence.map(e=>JSON.stringify([e.requestReference,e.catalogueVersion,e.intelligenceVersion,e.locale]))).size!==1)conflicts.push({type:'snapshot_disagreement',evidenceIds:evidence.map(e=>e.evidenceId)});
    const positive=evidence.filter(e=>e.assessment==='relevant');
    for(const e of positive) for(const other of evidence) if(other!==e && (other.assessment==='irrelevant' || other.system?.rejectedIds.length)) {
      const overlap=e.resultIds.filter(x=>(other.assessment==='irrelevant'?other.resultIds:other.system.rejectedIds).includes(x));
      if(overlap.length)conflicts.push({type:'relevance_disagreement',resultIds:overlap,evidenceIds:[e.evidenceId,other.evidenceId].sort()});
    }
    return {groupId,evidence,conflicts,groupFingerprint:fingerprint(evidence)};
  })};
}
function constructLearningLabel(group, decision) {
  if(!plain(group) || !Array.isArray(group.evidence) || !group.evidence.length || !plain(decision))return {accepted:false,reason:'invalid_label_input'};
  // Revalidate all raw evidence; neither an arbitrary object nor a copied hash
  // grants approval. The decision comes from a trusted offline adjudication gate.
  const rebuilt=groupEvidence(group.evidence,{purpose:group.evidence[0].purpose});
  if(!rebuilt.valid || rebuilt.rejected.length || rebuilt.groups.length!==1 || rebuilt.groups[0].groupFingerprint!==group.groupFingerprint)return {accepted:false,reason:'invalid_evidence_group'};
  group=rebuilt.groups[0];
  const resolved=ids(decision.resolvedEvidenceIds), expected=ids(decision.expectedResultIds);
  if(decision.approved!==true || decision.trust!=='adjudicated' || !id(decision.decisionId) || !id(decision.policyVersion) || !id(decision.reasonCode) || !resolved || !expected)return {accepted:false,reason:'adjudication_required'};
  const evidenceIds=group.evidence.map(e=>e.evidenceId);
  if(resolved.some(x=>!evidenceIds.includes(x)) || group.conflicts.some(c=>c.evidenceIds.some(x=>!resolved.includes(x))))return {accepted:false,reason:'unresolved_conflict'};
  if(evidenceIds.some(x=>!resolved.includes(x)))return {accepted:false,reason:'unreviewed_evidence'};
  if(group.conflicts.some(c=>c.type==='snapshot_disagreement'))return {accepted:false,reason:'incompatible_snapshots'};
  const systems=group.evidence.filter(e=>e.system);
  if(systems.length!==1 || !systems[0].system.constraintsPassed || !systems[0].system.factIntegrityPassed)return {accepted:false,reason:'verified_system_snapshot_required'};
  const snapshot=systems[0];
  if(expected.some(x=>!snapshot.system.eligibleIds.includes(x)))return {accepted:false,reason:'ineligible_label'};
  // Behaviour and a business's self-claim alone can never supervise a ranker.
  if(!group.evidence.some(e=>['customer','outcome'].includes(e.sourceType) && ['relevant','irrelevant','unsupported','correction'].includes(e.assessment)))return {accepted:false,reason:'judgment_evidence_required'};
  return {accepted:true,label:{schemaVersion:1,groupId:group.groupId,requestReference:snapshot.requestReference,
    locale:snapshot.locale,purpose:snapshot.purpose,evidenceIds,evidenceFingerprint:group.groupFingerprint,
    sourceEvidenceVersions:group.evidence.map(e=>({evidenceId:e.evidenceId,evidenceVersion:e.evidenceVersion,schemaVersion:e.schemaVersion})),
    eligibleIds:snapshot.system.eligibleIds,expectedResultIds:expected,features:snapshot.system.features,
    policyVersion:decision.policyVersion,decisionId:decision.decisionId,reasonCode:decision.reasonCode,
    status:'adjudicated',productionDeploymentAllowed:false}};
}
module.exports={groupEvidence,constructLearningLabel};
