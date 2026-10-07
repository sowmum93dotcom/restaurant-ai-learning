'use strict';

/**
 * Versioned offline evaluation set for Customer Intelligence.
 * These records are synthetic/judged test cases only. They are not customer
 * profiles and must never be treated as live business facts.
 */
const CUSTOMER_INTELLIGENCE_EVAL_SET_V1 = Object.freeze([
  Object.freeze({
    id: 'ci-v1-family-dinner',
    request: Object.freeze({ intention: 'Eat & enjoy', customerText: 'quiet family dinner tonight', locale: 'en' }),
    expectedResultIds: Object.freeze(['family-dining']),
    unsupportedResultIds: Object.freeze(['nightclub-only'])
  }),
  Object.freeze({
    id: 'ci-v1-running-shoes',
    request: Object.freeze({ intention: 'Get something done', customerText: 'running shoes size 9', locale: 'en' }),
    expectedResultIds: Object.freeze(['running-shoes-size-9']),
    unsupportedResultIds: Object.freeze(['fashion-shoes-unknown-size'])
  }),
  Object.freeze({
    id: 'ci-v1-unsupported',
    request: Object.freeze({ intention: 'Discover something new', customerText: 'a service that is not in the approved catalogue', locale: 'en' }),
    expectedResultIds: Object.freeze([]),
    unsupportedResultIds: Object.freeze(['invented-result'])
  })
]);

module.exports = { CUSTOMER_INTELLIGENCE_EVAL_SET_V1 };
