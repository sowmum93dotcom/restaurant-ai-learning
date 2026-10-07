'use strict';

/**
 * Provider-independent Customer Intelligence boundary.
 *
 * The existing deterministic understanding and possibility contracts remain
 * authoritative. An intelligence provider may enrich understanding or ranking,
 * but it cannot manufacture business facts, bypass publication rules, or turn
 * a weak/unsupported result into an eligible result.
 */

const DEFAULT_LIMITS = Object.freeze({ maxQueryLength: 500, maxCandidates: 200, maxResults: 20 });

function cleanString(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeIntentRequest(input = {}) {
  const intention = cleanString(input.intention, 120);
  const customerText = cleanString(input.customerText, DEFAULT_LIMITS.maxQueryLength);
  const place = cleanString(input.place, 160);
  if (!intention && !customerText) return null;
  return Object.freeze({
    schemaVersion: 1,
    intention: intention || null,
    customerText: customerText || null,
    place: place || null,
    locale: cleanString(input.locale, 32) || null
  });
}

function normalizeCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  if (['possibilityId','workItemId'].some(k=>typeof candidate[k]!=='string' || !candidate[k].length || candidate[k].length>128 || candidate[k]!==candidate[k].trim())) return null;
  const possibilityId = cleanString(candidate.possibilityId, 128);
  const workItemId = cleanString(candidate.workItemId, 128);
  if (!possibilityId || !workItemId) return null;
  if(candidate.rankingEvidence!==undefined){
    const rankingEvidence=require('./customer-search-ranking').validateRankingEvidence(candidate.rankingEvidence);
    if(!rankingEvidence)return null;
    return {possibilityId,workItemId,rankingEvidence};
  }
  return { possibilityId, workItemId };
}

function normalizeRankedResult(item, eligibleIds) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  if(typeof item.possibilityId!=='string' || item.possibilityId.length>128 || item.possibilityId!==item.possibilityId.trim())return null;
  const possibilityId = cleanString(item.possibilityId, 128);
  if (!possibilityId || !eligibleIds.has(possibilityId)) return null;
  const score = Number(item.score);
  if (!Number.isFinite(score) || score < 0 || score > 1) return null;
  return {
    possibilityId,
    score,
    reasonCodes: Array.isArray(item.reasonCodes)
      ? item.reasonCodes.map((x) => cleanString(x, 64)).filter(Boolean).slice(0, 10)
      : []
  };
}

async function runCustomerIntelligence({ provider, request, candidates = [], timeoutMs = 250 } = {}) {
  const fail = reason => ({used:false, reason, ranked:[]});
  if (!request || typeof request !== 'object' || Array.isArray(request) ||
      ['intention','customerText','place','locale'].some(k => request[k] !== undefined && typeof request[k] !== 'string') ||
      (request.customerText || '').length > DEFAULT_LIMITS.maxQueryLength || (request.intention || '').length>120 || (request.place || '').length>160 || (request.locale || '').length>32) return fail('invalid_request');
  const normalizedRequest = normalizeIntentRequest(request);
  if (!normalizedRequest) return fail('invalid_request');
  if (!provider || typeof provider.rank !== 'function') return fail('provider_unavailable');
  if (!Array.isArray(candidates) || candidates.length > DEFAULT_LIMITS.maxCandidates || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) return fail('invalid_candidates_or_timeout');
  const safeCandidates = candidates.map(normalizeCandidate);
  if (!safeCandidates.length) return fail('no_eligible_candidates');
  if (safeCandidates.some(x => !x) || new Set(safeCandidates.map(x => x.possibilityId)).size !== safeCandidates.length) return fail('invalid_candidates');
  const eligibleIds = new Set(safeCandidates.map(x => x.possibilityId));
  const controller = new AbortController();
  let timer, raw;
  try {
    raw = await Promise.race([
      Promise.resolve().then(() => provider.rank({request:normalizedRequest,candidates:safeCandidates.map(Object.freeze),signal:controller.signal})),
      new Promise((_,reject) => {timer=setTimeout(() => {controller.abort();reject(new Error('provider_timeout'));},timeoutMs);})
    ]);
  } catch (error) { return fail(error?.message === 'provider_timeout' ? 'provider_timeout' : 'provider_failure'); }
  finally {clearTimeout(timer);}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(k => k !== 'ranked') || !Array.isArray(raw.ranked) || !raw.ranked.length || raw.ranked.length > DEFAULT_LIMITS.maxResults) return fail('invalid_provider_response');
  const ranked = [], seen = new Set();
  for (const item of raw.ranked) {
    // Explanations/business facts are forbidden provider output in this rank-only contract.
    if (!item || Object.keys(item).some(k => !['possibilityId','score','reasonCodes'].includes(k)) || typeof item.score !== 'number' || seen.has(item.possibilityId) ||
        (item.reasonCodes !== undefined && (!Array.isArray(item.reasonCodes) || item.reasonCodes.length > 10 || item.reasonCodes.some(x => typeof x !== 'string' || !/^[a-z_]{1,64}$/.test(x))))) return fail('invalid_provider_response');
    const valid = normalizeRankedResult(item,eligibleIds);
    if (!valid) return fail('invalid_provider_response');
    seen.add(valid.possibilityId);ranked.push(valid);
  }
  ranked.sort((a,b) => b.score-a.score);
  return {used:true, reason:'ranked', ranked};
}

function applyIntelligenceRanking(possibilities = [], intelligence = {}) {
  if (!intelligence || intelligence.used !== true || !Array.isArray(intelligence.ranked)) return possibilities.slice();
  const allowed = new Set(possibilities.map(x => x.possibilityId));
  const seen = new Set();
  if (intelligence.ranked.some(x => !x || !allowed.has(x.possibilityId) || seen.has(x.possibilityId) || !Number.isFinite(x.score) || x.score < 0 || x.score > 1 || !seen.add(x.possibilityId))) return possibilities.slice();
  const scores = new Map(intelligence.ranked.map((x) => [x.possibilityId, x.score]));
  return possibilities.map((item, index) => ({ item, index, score: scores.has(item.possibilityId) ? scores.get(item.possibilityId) : -1 }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}

module.exports = {
  DEFAULT_LIMITS,
  normalizeIntentRequest,
  runCustomerIntelligence,
  applyIntelligenceRanking
};
