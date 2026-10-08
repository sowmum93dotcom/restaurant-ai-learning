const crypto = require("node:crypto");
const { buildCustomerUnderstanding } = require("../../js/customer-understanding.js");
const { getValidPublicCustomerWork } = require("./customer-public-work-contract.js");

const SUPPORTED_INTENTIONS = Object.freeze([
  "Eat & enjoy", "Take care of myself", "Spend time together",
  "Get something done", "Go somewhere", "Discover something new"
]);
const MAX_POSSIBILITIES = 5;
const FIELD_LIMITS = Object.freeze({ intention: 40, customerText: 500, understanding: 700 });
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "our", "but", "not",
  "have", "has", "had", "was", "were", "would", "could", "should", "into", "onto", "about", "there",
  "here", "today", "tomorrow", "want", "wants", "wanted", "like", "need", "needs", "needed", "looking",
  "business", "businesses", "customer", "customers", "something", "somewhere", "myself", "my", "me", "we",
  "they", "their", "them", "its", "get", "getting", "make", "take", "use", "using", "enjoy", "discover"
]);

// A deliberately small, reviewable vocabulary connects equivalent expressions
// without turning the Customer Experience into open-ended keyword search.  A
// concept must be evidenced in both the current request and authorized work.
const SOLUTION_CONCEPTS = Object.freeze([
  // Narrow product/service families: category similarity is not suitability.
  ...[
    ["dress", ["dress", "dresses"]], ["jacket", ["jacket", "jackets"]],
    ["activewear", ["activewear"]], ["groceries", ["grocery", "groceries"]],
    ["running", ["running", "jogging"]], ["football", ["football", "soccer"]],
    ["fishing", ["fishing"]], ["camping", ["camping", "campsite"]],
    ["hiking", ["hiking", "hike"]]
  ].map(([name, terms]) => Object.freeze({name, terms: Object.freeze(terms)})),
  Object.freeze({ name: "meal", terms: Object.freeze(["meal", "dinner", "lunch", "breakfast", "supper", "food", "eat", "restaurant"]) }),
  Object.freeze({ name: "bicycle care", terms: Object.freeze(["bicycle", "bike", "cycle"]) }),
  Object.freeze({ name: "wellbeing", terms: Object.freeze(["wellbeing", "wellness", "health", "massage", "fitness"]) }),
  Object.freeze({ name: "shared time", terms: Object.freeze(["family", "friends", "together", "group", "celebrate", "celebration"]) }),
  Object.freeze({ name: "journey", terms: Object.freeze(["travel", "trip", "visit", "journey", "stay", "hotel"]) }),
  Object.freeze({ name: "learning", terms: Object.freeze(["learn", "learning", "class", "course", "workshop", "discover"]) })
]);

function ownKeysAre(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every(function (key, index) { return key === keys[index]; });
}

function validateConfirmedUnderstanding(body) {
  if (!ownKeysAre(body, ["understanding"]) && !ownKeysAre(body, ["place", "understanding"])) return null;
  const value = body.understanding;
  const keys = ["confidenceState", "customerText", "intention", "source", "understanding"].sort();
  if (!ownKeysAre(value, keys)) return null;
  if (value.source !== "customer-provided" || value.confidenceState !== "confirmed") return null;
  if (typeof value.intention !== "string" || typeof value.customerText !== "string" ||
      typeof value.understanding !== "string") return null;
  if (value.intention.length > FIELD_LIMITS.intention || value.customerText.length > FIELD_LIMITS.customerText ||
      value.understanding.length > FIELD_LIMITS.understanding) return null;
  const intention = value.intention.trim();
  const customerText = value.customerText.trim().replace(/\s+/g, " ");
  const understanding = value.understanding.trim();
  if (value.intention !== intention || value.customerText !== customerText || value.understanding !== understanding) return null;
  if (intention && !SUPPORTED_INTENTIONS.includes(intention)) return null;
  if (!intention && !customerText) return null;
  if (!understanding) return null;

  const expected = buildCustomerUnderstanding(intention, customerText);
  if (!expected || expected.confidenceState !== "ready-for-confirmation" || expected.understanding !== understanding) return null;
  return Object.freeze({ intention, customerText, understanding, source: value.source, confidenceState: value.confidenceState });
}


// Place is customer-provided, optional and scoped to this one request. Match only
// an explicit business-provided place; no geocoding, distance or inferred proximity.
function validateCustomerPlace(body) {
  if (!Object.prototype.hasOwnProperty.call(body, "place")) return "";
  if (typeof body.place !== "string" || body.place.length > 80) return null;
  const place = body.place.trim().replace(/\s+/g, " ");
  if (!place || !/^[\p{L}\p{M}\p{N} .,'-]+$/u.test(place)) return null;
  return place;
}
function sameDeclaredPlace(place, businessPlace) {
  if (!place || typeof businessPlace !== "string") return false;
  const normalize = value => value.normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g, " ").trim();
  return normalize(place) === normalize(businessPlace);
}

function meaningfulTerms(value) {
  const matches = String(value || "").toLocaleLowerCase("en").match(/[\p{L}\p{N}]+/gu) || [];
  return new Set(matches.filter(function (term) { return term.length >= 3 && !STOP_WORDS.has(term); }));
}

// Explicit exclusions are constraints, not positive evidence for a recommendation.
// Be conservative: an excluded term in business copy makes the offer unsuitable
// for automatic recommendation, even when other terms happen to overlap.
function excludedCustomerTerms(customerText) {
  const words = String(customerText || "").toLocaleLowerCase("en").match(/[\p{L}\p{N}]+/gu) || [];
  const excluded = new Set();
  for (let index = 0; index < words.length - 1; index += 1) {
    if (![ "without", "exclude", "excluding", "avoid", "no", "except", "not" ].includes(words[index])) continue;
    let position = index + 1;
    // "Not only" adds possibilities; it is not an exclusion.
    if (words[index] === "not" && words[position] === "only") continue;
    while (["a", "an", "the", "any", "added", "too"].includes(words[position])) position += 1;
    const next = words[position];
    if (!next || next.length < 3 || STOP_WORDS.has(next)) continue;
    excluded.add(next);
    // Only an explicit "or" extends the same exclusion. "And" may introduce
    // a positive requirement, so it must not silently exclude the next item.
    while (words[position + 1] === "or") {
      position += 2;
      const alternative = words[position];
      if (!alternative || alternative.length < 3 || STOP_WORDS.has(alternative)) break;
      excluded.add(alternative);
    }
  }
  return excluded;
}

// An explicit "with" clause states additional customer requirements, not merely
// optional ranking preferences. Require published evidence for each meaningful
// term; otherwise leave the offer out rather than imply the requirement is met.
function explicitAdditionalRequirements(customerText) {
  const words = String(customerText || "").toLocaleLowerCase("en").match(/[\p{L}\p{N}]+/gu) || [];
  // These phrases explicitly introduce required features, not preference signals.
  // Keep the vocabulary narrow so ordinary descriptive prose is not over-read.
  const introducers = new Set(["with", "including", "offering"]);
  const index = words.findIndex(function (word) { return introducers.has(word); });
  if (index < 0) return new Set();
  const end = words.findIndex(function (word, position) {
    return position > index && ["without", "excluding", "avoid", "except"].includes(word);
  });
  return meaningfulTerms(words.slice(index + 1, end < 0 ? undefined : end).join(" "));
}

// Specific requests and atmosphere qualifiers require evidence in the same
// offer. A broad wellbeing, journey or shared-time category is not enough.
const SPECIFIC_OFFER_REQUIREMENTS = Object.freeze([
  Object.freeze(["quiet", "peaceful", "tranquil"]),
  Object.freeze(["children", "child", "kids", "kid"]),
  Object.freeze(["relaxed", "relaxing", "relaxation"]),
  Object.freeze(["massage", "massages"]),
  Object.freeze(["fitness", "gym", "workout", "exercise"]),
  Object.freeze(["hotel", "hotels", "accommodation"]),
  Object.freeze(["breakfast", "breakfasts"]),
  Object.freeze(["dinner", "supper"]),
  Object.freeze(["lunch", "luncheon"]),
  Object.freeze(["sauna", "saunas"])
]);
function supportsRequestedOffer(customerTerms, sourceTerms) {
  return SPECIFIC_OFFER_REQUIREMENTS.every(forms =>
    !forms.some(term => customerTerms.has(term)) || forms.some(term => sourceTerms.has(term)));
}

function evidencedConcepts(customerTerms, contentTerms) {
  return SOLUTION_CONCEPTS.filter(function (concept) {
    // "Running" can be a verb for an unrelated activity, such as running a
    // workshop. Alone, or with sporting context, it can identify the sport.
    if (concept.name === "running" && !customerTerms.has("jogging") &&
        !(customerTerms.size === 1 && customerTerms.has("running")) &&
        !["session", "sessions", "fitness", "exercise", "jog", "sport", "sports"].some(term => customerTerms.has(term))) return false;
    return concept.terms.some(function (term) { return customerTerms.has(term); }) &&
      concept.terms.some(function (term) { return contentTerms.has(term); });
  }).map(function (concept) { return concept.name; });
}

function preferenceTerms(storedPreferences) {
  const values = (Array.isArray(storedPreferences) ? storedPreferences : []).slice(0, 50)
    .filter(function (item) { return item && typeof item.preference === "string"; })
    .map(function (item) { return item.preference; });
  return meaningfulTerms(values.join(" "));
}

function feedbackGuidance(storedFeedback) {
  return (Array.isArray(storedFeedback) ? storedFeedback : []).slice(0, 50).reduce(function (guidance, item) {
    if (!item || !["Relevant", "Not quite", "Something different"].includes(item.response)) return guidance;
    const terms = meaningfulTerms([item.possibilityContent, item.comment].join(" "));
    terms.forEach(function (term) {
      const signal = item.response === "Relevant" ? 1 : -1;
      guidance.set(term, (guidance.get(term) || 0) + signal);
    });
    return guidance;
  }, new Map());
}

// Broad category overlap cannot substitute for a specifically requested service.
// Use only narrow, reviewable word families rather than inferring capabilities.
const SERVICE_WORD_FAMILIES = Object.freeze([
  Object.freeze(["repair", "repairs", "repaired", "repairing"]),
  Object.freeze(["clean", "cleans", "cleaned", "cleaning"]),
  Object.freeze(["install", "installs", "installed", "installation", "installing"]),
  Object.freeze(["rent", "rents", "rental", "rentals", "renting"]),
  Object.freeze(["deliver", "delivers", "delivered", "delivery", "deliveries", "delivering"])
]);
function hasRequirementEvidence(term, sourceTerms) {
  const family = SERVICE_WORD_FAMILIES.concat(SPECIFIC_OFFER_REQUIREMENTS).find(function (forms) { return forms.includes(term); });
  return family ? family.some(function (form) { return sourceTerms.has(form); }) : sourceTerms.has(term);
}

function hasExcludedEvidence(excludedTerms, sourceTerms) {
  return Array.from(excludedTerms).some(function (term) {
    return hasRequirementEvidence(term, sourceTerms);
  });
}

function supportsExplicitService(customerTerms, sourceTerms) {
  return SERVICE_WORD_FAMILIES.every(function (forms) {
    return !forms.some(function (term) { return customerTerms.has(term); }) ||
      forms.some(function (term) { return sourceTerms.has(term); });
  });
}

function productRelevance(product, customerTerms) {
  if (!product || typeof product !== "object") return null;
  const productTerms = meaningfulTerms([product.name, product.description].join(" "));
  const evidence = Array.from(customerTerms).filter(function (term) { return productTerms.has(term); }).sort();
  const concepts = evidencedConcepts(customerTerms, productTerms);
  if (!supportsRequestedOffer(customerTerms, productTerms) || !supportsExplicitService(customerTerms, productTerms) || (evidence.length < 2 && concepts.length === 0)) return null;
  return Object.freeze({
    basis: "current-intention-product-information",
    evidence: (evidence.length >= 2 ? evidence : concepts).slice(0, 5)
  });
}

function relevantProductsForCustomer(products, customerTerms) {
  if (!Array.isArray(products)) return [];
  return products.reduce(function (matches, product) {
    if (!product || product.availability === "unavailable") return matches;
    const relevance = productRelevance(product, customerTerms);
    if (!relevance) return matches;
    const publicProduct = { ...product, relevance }; delete publicProduct.customerVisible; delete publicProduct.categoryClassification;
    matches.push(publicProduct);
    return matches;
  }, []);
}

function stablePossibilityId(workItemId) {
  return "possibility_" + crypto.createHash("sha256").update("demeos-customer-possibility:" + workItemId)
    .digest("base64url").slice(0, 20);
}

function findCustomerPossibilities(understanding, repositoryWork, limit = MAX_POSSIBILITIES, storedPreferences = [], storedFeedback = [], place = "", eligibilityFilter, semanticRetrieval) {
  const excludedTerms = excludedCustomerTerms(understanding.customerText);
  const additionalRequirements = explicitAdditionalRequirements(understanding.customerText);
  const requestWords = understanding.customerText.toLocaleLowerCase("en").match(/[\p{L}\p{N}]+/gu) || [];
  const requirementStart = requestWords.findIndex(function (word) { return ["with", "including", "offering"].includes(word); });
  const primaryRequirements = additionalRequirements.size && requirementStart >= 0
    ? meaningfulTerms(requestWords.slice(0, requirementStart).join(" ")) : new Set();
  const customerTerms = meaningfulTerms([understanding.intention, understanding.customerText].join(" "));
  excludedTerms.forEach(function (term) {
    const family = SERVICE_WORD_FAMILIES.concat(SPECIFIC_OFFER_REQUIREMENTS).find(function (forms) { return forms.includes(term); });
    (family || [term]).forEach(function (form) { customerTerms.delete(form); });
  });
  const guidanceTerms = preferenceTerms(storedPreferences);
  const feedbackSignals = feedbackGuidance(storedFeedback);
  const candidates = [];
  (semanticRetrieval ? getValidPublicCustomerWork(repositoryWork, 20, {forSearchClassification:true}) : getValidPublicCustomerWork(repositoryWork)).forEach(function (work) {
    const semanticProducts = new Set(), semanticPublicProducts = new Set();
    if (semanticRetrieval) {
      const remaining = meaningfulTerms(semanticRetrieval.remainingText);
      for (const product of work.products || []) {
        const source = meaningfulTerms(product.name + ' ' + product.description);
        if (product.availability !== 'unavailable' &&
            product.categoryClassification?.categories.some(row => row.categoryId === semanticRetrieval.categoryId) &&
            [...remaining].every(term => hasRequirementEvidence(term, source)) &&
            supportsRequestedOffer(customerTerms, source) && supportsExplicitService(customerTerms, source) &&
            [...additionalRequirements].every(term => hasRequirementEvidence(term, source))) semanticProducts.add(product);
      }
    }
    // An explicitly unavailable business cannot be presented as a current possibility.
    // Unknown/contact status is not treated as confirmed availability.
    if (work.operationalAvailability && work.operationalAvailability.status === "unavailable") return;
    if (place && !sameDeclaredPlace(place, work.location)) return;
    const contentTerms = meaningfulTerms(work.content);
    const productTerms = meaningfulTerms((Array.isArray(work.products) ? work.products : []).map(function (product) {
      return product && product.availability !== "unavailable" && [product.name, product.description].join(" ");
    }).join(" "));
    if (hasExcludedEvidence(excludedTerms, contentTerms) || hasExcludedEvidence(excludedTerms, productTerms)) return;
    // Validated product information is also business evidence. A specific product
    // can satisfy a request even when the campaign headline is generic.
    const offerTerms = new Set([...contentTerms, ...productTerms]);
    // Never combine unrelated products into a single match, even when the
    // customer did not use an explicit additional-requirement phrase.
    // Evaluate each validated source independently.
    const evidenceSources = [contentTerms].concat((Array.isArray(work.products) ? work.products : [])
      .filter(function (product) { return product && product.availability !== "unavailable"; })
      .map(function (product) { return meaningfulTerms([product.name, product.description].join(" ")); }));
    const matchingSources = semanticRetrieval
      ? (work.products || []).filter(product => semanticProducts.has(product)).map(product => meaningfulTerms(product.name + ' ' + product.description))
      : additionalRequirements.size
      ? evidenceSources.filter(function (terms) {
        return [...additionalRequirements, ...primaryRequirements].every(function (term) { return hasRequirementEvidence(term, terms); });
      })
      : evidenceSources;
    if (!matchingSources.length) return;
    const matchedTerms = matchingSources.reduce(function (best, terms) {
      const evidence = Array.from(customerTerms).filter(function (term) { return terms.has(term); }).sort();
      const concepts = evidencedConcepts(customerTerms, terms);
      const strength = supportsRequestedOffer(customerTerms, terms) && supportsExplicitService(customerTerms, terms) ? evidence.length + concepts.length : -1;
      return !best || strength > best.strength ? { evidence, concepts, strength } : best;
    }, null);
    const evidence = matchedTerms.evidence;
    const concepts = matchedTerms.concepts;
    // Generic token overlap alone is not a defensible connection. Require either
    // two specific shared expressions or a transparent DEMEOS solution concept.
    if (semanticRetrieval ? !semanticProducts.size : (matchedTerms.strength < 0 || (evidence.length < 2 && concepts.length === 0))) return;
    const guidanceOverlap = Array.from(guidanceTerms).filter(function (term) { return contentTerms.has(term); }).length;
    const feedbackGuidanceScore = Array.from(contentTerms).reduce(function (score, term) {
      return score + (feedbackSignals.get(term) || 0);
    }, 0);
    const possibility = {
      possibilityId: stablePossibilityId(work.workItemId), workItemId: work.workItemId,
      businessName: work.businessName, content: work.content, participationAction: "Interested",
      relevance: { basis: "current-intention-authorized-work", evidence: (semanticProducts.size ? work.products.filter(product => semanticProducts.has(product)).map(product => product.name.slice(0,60)) : evidence.length >= 2 ? evidence : concepts).slice(0, 5),
        explanation: "This authorized possibility connects to your current request." }
    };
    if (work.location) possibility.location = work.location;
    if (work.customerContinuation) possibility.customerContinuation = work.customerContinuation;
    if (work.fulfilment) possibility.fulfilment = work.fulfilment;
    if (work.operationalAvailability) possibility.operationalAvailability = work.operationalAvailability;
    if (Array.isArray(work.products) && work.products.length) {
      const semanticMatches = (work.products || []).filter(product => semanticProducts.has(product)).map(product => {
        const publicProduct = {...product, relevance: {basis: "current-intention-product-information", evidence: [product.name.slice(0,60)]}};
        delete publicProduct.categoryClassification;
        semanticPublicProducts.add(publicProduct);
        return publicProduct;
      });
      const relevantProducts = [...semanticMatches, ...(semanticRetrieval ? [] : relevantProductsForCustomer(work.products, customerTerms)).filter(product => !semanticProducts.has(product))]
        .filter(function (product) {
          if (semanticRetrieval) return semanticPublicProducts.has(product);
          if (!additionalRequirements.size) return true;
          const productTerms = meaningfulTerms([product.name, product.description].join(" "));
          return [...additionalRequirements, ...primaryRequirements].every(function (term) { return hasRequirementEvidence(term, productTerms); });
        });
      if (relevantProducts.length) possibility.products = relevantProducts;
    }
    if (work.informationSource === "business-provided") possibility.informationSource = "business-provided";
    let eligible = typeof eligibilityFilter === "function" ? eligibilityFilter(possibility) : possibility;
    if (!eligible) return;
    let strength = concepts.length + evidence.length;
    if (semanticRetrieval) {
      const retained = (eligible.products || []).filter(product => semanticPublicProducts.has(product));
      if (!retained.length) return;
      eligible = {...eligible, products: retained, relevance: {...eligible.relevance, evidence: retained.map(product => product.name.slice(0,60)).slice(0,5)}};
      // Relevance strength and visible support come from the SAME surviving
      // offers; neither rejected nor unclassified siblings can affect the cap.
      strength = Math.max(...retained.map(product => {
        const source = meaningfulTerms(product.name + ' ' + product.description);
        return 1 + [...customerTerms].filter(term => source.has(term)).length + evidencedConcepts(customerTerms, source).length;
      }));
    }
    candidates.push({ strength, guidanceOverlap, feedbackGuidanceScore, possibility: eligible });
  });
  candidates.sort(function (left, right) {
    return right.strength - left.strength || right.guidanceOverlap - left.guidanceOverlap ||
      right.feedbackGuidanceScore - left.feedbackGuidanceScore ||
      left.possibility.workItemId.localeCompare(right.possibility.workItemId);
  });
  return candidates.slice(0, Math.min(MAX_POSSIBILITIES, Math.max(0, limit))).map(function (item) { return item.possibility; });
}

module.exports = {
  validateCustomerPlace, sameDeclaredPlace, FIELD_LIMITS, MAX_POSSIBILITIES, SUPPORTED_INTENTIONS, findCustomerPossibilities,
  evidencedConcepts, explicitAdditionalRequirements, excludedCustomerTerms, feedbackGuidance, meaningfulTerms, preferenceTerms, productRelevance, relevantProductsForCustomer, stablePossibilityId, validateConfirmedUnderstanding
};
