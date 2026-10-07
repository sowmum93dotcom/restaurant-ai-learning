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
  const possibilityId = cleanString(candidate.possibilityId, 128);
  const workItemId = cleanString(candidate.workItemId, 128);
  if (!possibilityId || !workItemId) return null;
  return { possibilityId, workItemId };
}

function normalizeRankedResult(item, eligibleIds) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
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

async function runCustomerIntelligence({ provider, request, candidates = [] } = {}) {
  const normalizedRequest = normalizeIntentRequest(request);
  if (!normalizedRequest) return { used: false, reason: 'invalid_request', ranked: [] };
  if (!provider || typeof provider.rank !== 'function') return { used: false, reason: 'provider_unavailable', ranked: [] };

  const safeCandidates = candidates.map(normalizeCandidate).filter(Boolean).slice(0, DEFAULT_LIMITS.maxCandidates);
  if (!safeCandidates.length) return { used: false, reason: 'no_eligible_candidates', ranked: [] };
  const eligibleIds = new Set(safeCandidates.map((x) => x.possibilityId));

  let raw;
  try {
    raw = await provider.rank({ request: normalizedRequest, candidates: safeCandidates });
  } catch (_error) {
    return { used: false, reason: 'provider_failure', ranked: [] };
  }

  const ranked = Array.isArray(raw && raw.ranked)
    ? raw.ranked.map((x) => normalizeRankedResult(x, eligibleIds)).filter(Boolean)
    : [];
  const deduped = [];
  const seen = new Set();
  ranked.sort((a, b) => b.score - a.score).forEach((item) => {
    if (!seen.has(item.possibilityId) && deduped.length < DEFAULT_LIMITS.maxResults) {
      seen.add(item.possibilityId);
      deduped.push(item);
    }
  });
  return { used: deduped.length > 0, reason: deduped.length ? 'ranked' : 'no_valid_ranking', ranked: deduped };
}

function applyIntelligenceRanking(possibilities = [], intelligence = {}) {
  if (!intelligence || intelligence.used !== true || !Array.isArray(intelligence.ranked)) return possibilities.slice();
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
