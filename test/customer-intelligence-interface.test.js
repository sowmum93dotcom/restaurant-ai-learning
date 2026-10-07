'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeIntentRequest, runCustomerIntelligence, applyIntelligenceRanking } = require('../api/_lib/customer-intelligence-interface');

test('normalizes a bounded customer intelligence request', () => {
  const value = normalizeIntentRequest({ intention: 'Eat & enjoy', customerText: ' quiet dinner ', locale: 'en' });
  assert.equal(value.customerText, 'quiet dinner');
  assert.equal(value.locale, 'en');
});

test('provider cannot introduce a possibility outside deterministic eligible candidates', async () => {
  const provider = { rank: async () => ({ ranked: [
    { possibilityId: 'invented', score: 1 },
    { possibilityId: 'eligible-2', score: 0.9 },
    { possibilityId: 'eligible-1', score: 0.4 }
  ] }) };
  const result = await runCustomerIntelligence({
    provider,
    request: { customerText: 'something useful' },
    candidates: [
      { possibilityId: 'eligible-1', workItemId: 'w1' },
      { possibilityId: 'eligible-2', workItemId: 'w2' }
    ]
  });
  assert.equal(result.used, false);
  assert.deepEqual(result.ranked, []); // Reject the entire contaminated response, not only its unknown ID.
});

test('provider failure fails closed to deterministic order', async () => {
  const provider = { rank: async () => { throw new Error('offline'); } };
  const original = [{ possibilityId: 'a' }, { possibilityId: 'b' }];
  const result = await runCustomerIntelligence({
    provider, request: { customerText: 'query' },
    candidates: [{ possibilityId: 'a', workItemId: 'w1' }, { possibilityId: 'b', workItemId: 'w2' }]
  });
  assert.equal(result.used, false);
  assert.deepEqual(applyIntelligenceRanking(original, result), original);
});

test('ranking changes order only among already eligible possibilities', () => {
  const original = [{ possibilityId: 'a' }, { possibilityId: 'b' }, { possibilityId: 'c' }];
  const ranked = applyIntelligenceRanking(original, {
    used: true,
    ranked: [{ possibilityId: 'c', score: 0.9 }, { possibilityId: 'a', score: 0.7 }]
  });
  assert.deepEqual(ranked.map((x) => x.possibilityId), ['c', 'a', 'b']);
});
test('provider rejection values and altered or overlong IDs cannot escape the boundary',async()=>{
 const params={request:{customerText:'jacket'},candidates:[{possibilityId:'p1',workItemId:'w1'}]};
 assert.equal((await runCustomerIntelligence({...params,provider:{rank:async()=>Promise.reject(null)}})).reason,'provider_failure');
 assert.equal((await runCustomerIntelligence({...params,provider:{rank:async()=>({ranked:[{possibilityId:' p1 ',score:1}]})}})).used,false);
 assert.equal((await runCustomerIntelligence({...params,candidates:[{possibilityId:'x'.repeat(129),workItemId:'w1'}],provider:{rank:async()=>({ranked:[]})}})).used,false);
});
