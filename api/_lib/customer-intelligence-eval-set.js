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

// Synthetic language-contract smoke cases, not a claim of model language quality.
const {LOCALES} = require('./customer-evidence-provenance');
const BLACK_JACKET_REQUESTS = Object.freeze({en:'black jacket',es:'chaqueta negra',fr:'veste noire',ar:'سترة سوداء',pt:'casaco preto',zh:'黑色夹克',hi:'काली जैकेट',de:'schwarze Jacke',ja:'黒いジャケット'});
const CUSTOMER_INTELLIGENCE_EVAL_SET_V2 = Object.freeze(LOCALES.map(locale=>Object.freeze({
  id:'ci-v2-black-jacket-'+locale,locale,request:BLACK_JACKET_REQUESTS[locale],
  areas:Object.freeze(['relevance','multilingual','hard-exclusion','must-have','fact-integrity']),
  eligibleIds:Object.freeze(['black-jacket']),expectedResultIds:Object.freeze(['black-jacket']),forbiddenResultIds:Object.freeze(['red-jacket']),
  clarificationRequired:false,approvedFacts:Object.freeze({'black-jacket':Object.freeze({colour:'black'})}),
  provenance:'synthetic-contract-smoke-v2',humanLanguageReviewRequired:true
})));
module.exports.CUSTOMER_INTELLIGENCE_EVAL_SET_V2=CUSTOMER_INTELLIGENCE_EVAL_SET_V2;
