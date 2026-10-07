# Customer request engine evaluation

This engine retrieves from the same validated catalogue used by Discover. It is a deterministic, evidence-based matcher; this change does not fine-tune a language model or introduce an external web-search provider.

## Behaviour

- Approved repository work always replaces supplied examples. Repository errors remain errors. The existing explicit header/query gate and server disable switch control temporary examples.
- Fictional examples never create trusted issuance or automatic customer history. Saving an example is not offered as an authenticated result.
- Exact declared town/city remains a filter, not inferred distance or proximity.
- Narrow product concepts permit short requests such as jacket, dress and camping. Quiet/peaceful and relaxed/relaxing qualifiers need evidence in the same offer. Specific massage, fitness, hotel, breakfast and sauna requests cannot be satisfied by broad category similarity. Separate products cannot be combined to invent a capability.
- Unavailable, hidden and invalid items remain excluded. Explicit requirements and exclusions remain constraints. Previous preferences and feedback cannot create relevance for an unrelated current request.

## Evaluation and research

Stanford's *Introduction to Information Retrieval* recommends testing against query-document relevance judgments, measuring both relevant results retrieved and irrelevant results returned:
https://nlp.stanford.edu/IR-book/html/htmledition/information-retrieval-system-evaluation-1.html
https://nlp.stanford.edu/IR-book/html/htmledition/evaluation-of-unranked-retrieval-sets-1.html

The review of query expansion by Azad and Deepak explains expansion using related expressions and the need to evaluate the resulting retrieval:
https://arxiv.org/abs/1708.00247

Our small regression collection specifies exact expected results for seventeen independently judged requests. It includes atmosphere, service, exclusions, negation, place and unsupported requests. Separate ambiguity tests distinguish the sport of running from running a workshop, and negation tests preserve “not only” as an additive phrase. Additional endpoint tests cover automatic real-content replacement, supplied products, no-store responses and repository failure. This is regression evidence, not an estimate of accuracy across all customers.

Run `npm test` and `node browser-checks/customer-search-gate.js` with the same static server and Playwright setup as the existing customer browser workflow. The new browser gate executes the real possibilities handler against an isolated repository and verifies visible results at 390, 820 and 1440 pixels.

## Limits

No guarantees about stock, prices, dietary safety, opening hours or suitability beyond declared information. Missing details stay unconfirmed. Matching vocabulary is intentionally bounded and primarily English; translated interface support does not demonstrate free-text matching quality in every language. Wider language, budget/date parsing and new product coverage need separately judged evaluation sets before expanding claims.
