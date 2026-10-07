'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evidenceFromCustomerFeedback, evidenceFromSearchOutcome } = require('../api/_lib/customer-learning-evidence');

test('relevant customer feedback becomes controlled positive evidence', () => {
  const result = evidenceFromCustomerFeedback({
    feedback: 'Relevant', request: 'quiet dinner', resultIds: ['p1'],
    learningConsent: true, verified: true
  });
  assert.equal(result.accepted, true);
  assert.equal(result.evidence.signal, 'result_relevant');
});

test('negative customer feedback becomes controlled negative evidence', () => {
  const result = evidenceFromCustomerFeedback({
    feedback: 'Not quite', request: 'black waterproof jacket', resultIds: ['p2'],
    learningConsent: true, verified: true
  });
  assert.equal(result.accepted, true);
  assert.equal(result.evidence.signal, 'result_not_relevant');
});

test('feedback cannot silently enter learning without consent and verification', () => {
  assert.equal(evidenceFromCustomerFeedback({
    feedback: 'Relevant', request: 'quiet dinner', verified: true
  }).accepted, false);
  assert.equal(evidenceFromCustomerFeedback({
    feedback: 'Relevant', request: 'quiet dinner', learningConsent: true
  }).accepted, false);
});

test('validated search outcomes can become evidence without accepting arbitrary event names', () => {
  assert.equal(evidenceFromSearchOutcome({
    outcome: 'selection', request: 'camping tent', learningConsent: true, verified: true
  }).accepted, true);
  assert.equal(evidenceFromSearchOutcome({
    outcome: 'page_view', request: 'camping tent', learningConsent: true, verified: true
  }).accepted, false);
});
