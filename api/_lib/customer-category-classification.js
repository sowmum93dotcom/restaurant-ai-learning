'use strict';
const {DATASET_VERSION, CATEGORIES, getCategory, validateReference, validateCategoryIds} = require('./marketing-agent-categories');
const MAX_CATEGORIES = 8;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
function canonicalWords(text) {
  return typeof text === 'string' ? (text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) : [];
}
function containsCategory(text, category) {
  if (typeof text !== 'string') return false;
  const normalized = text.normalize('NFKC').toLowerCase();
  const tokens = [...normalized.matchAll(/[\p{L}\p{N}]+/gu)], name = canonicalWords(category.categoryName);
  return tokens.some((_, index) => {
    if (!name.every((word, offset) => tokens[index + offset]?.[0] === word)) return false;
    const prefix = normalized.slice(0,tokens[index].index);
    const boundary = Math.max(...[';', '.', '!', '?', '\n', ','].map(mark => prefix.lastIndexOf(mark)));
    // Negation governs the bounded clause, even when intervening words are long.
    // Punctuation ends that scope; the positive idiom "not only" is exempt.
    const preceding = tokens.slice(0,index).filter(token => token.index > boundary).map(token => token[0]);
    return !preceding.some((word,offset) => ['no','not','without','avoid','exclude','excluding','except'].includes(word) && !(word === 'not' && preceding[offset+1] === 'only'));
  });
}
// References are claims until supported by the SAME validated public offer.
// Never use another product, business slogans or a self-approved boolean.
function validateClassification(value, publicEvidence) {
  if (!plain(value) || Object.keys(value).sort().join(',') !== 'categories,datasetVersion' || value.datasetVersion !== DATASET_VERSION || !Array.isArray(value.categories) || !value.categories.length || value.categories.length > MAX_CATEGORIES || typeof publicEvidence !== 'string' || publicEvidence.length > 10000) return null;
  const categories = [], seen = new Set();
  for (const reference of value.categories) {
    const valid = validateReference(reference);
    if (!valid || seen.has(valid.categoryId) || !containsCategory(publicEvidence, getCategory(valid.categoryId))) return null;
    seen.add(valid.categoryId); categories.push(valid);
  }
  return Object.freeze({datasetVersion:DATASET_VERSION, categories:Object.freeze(categories)});
}
function classificationFromProducts(products) {
  const categories = new Map();
  for (const product of products || []) {
    const checked = validateClassification(product.categoryClassification, product.name + ' ' + product.description);
    if (checked) for (const reference of checked.categories) categories.set(reference.categoryId, reference);
  }
  return categories.size ? {datasetVersion:DATASET_VERSION, categories:[...categories.values()].sort((a,b) => Number(a.categoryId)-Number(b.categoryId))} : null;
}
function interpretCategories(text) {
  if (typeof text !== 'string' || text.length > 500) return {datasetVersion:DATASET_VERSION, categoryIds:[], source:'baseline-fallback'};
  const excluded = require('./customer-possibility-contract').excludedCustomerTerms(text);
  const matches = CATEGORIES.filter(category => containsCategory(text, category) && !canonicalWords(category.categoryName).some(word => excluded.has(word)));
  // Ambiguous/oversized classification is not permission to force a category.
  return {datasetVersion:DATASET_VERSION, categoryIds:matches.length <= MAX_CATEGORIES ? matches.map(category => category.categoryId) : [], source:matches.length && matches.length <= MAX_CATEGORIES ? 'literal-canonical-name' : 'baseline-fallback'};
}
// Future provider-independent advisory boundary. Not an active provider call.
function validateCategoryAdvisory(value, text) {
  if (!plain(value) || Object.keys(value).sort().join(',') !== 'categories,datasetVersion' || value.datasetVersion !== DATASET_VERSION || !Array.isArray(value.categories) || !value.categories.length || value.categories.length > MAX_CATEGORIES || typeof text !== 'string' || text.length > 500) return null;
  const interpreted = interpretCategories(text), seen = new Set(), categoryIds = [];
  for (const row of value.categories) {
    if (!plain(row) || Object.keys(row).sort().join(',') !== 'categoryId,end,start' || !getCategory(row.categoryId) || !interpreted.categoryIds.includes(row.categoryId) || seen.has(row.categoryId) || !Number.isInteger(row.start) || !Number.isInteger(row.end) || row.start < 0 || row.end <= row.start || row.end > text.length || !containsCategory(text.slice(row.start,row.end), getCategory(row.categoryId))) return null;
    seen.add(row.categoryId); categoryIds.push(row.categoryId);
  }
  return {datasetVersion:DATASET_VERSION, categoryIds, source:'validated-advisory-span'};
}
// Same catalogue records, narrowed copies only; classification cannot add offers.
function selectCategoryWork(work, interpretation) {
  const categoryIds = plain(interpretation) && interpretation.datasetVersion === DATASET_VERSION ? validateCategoryIds(interpretation.categoryIds, MAX_CATEGORIES) : null;
  if (!categoryIds || !categoryIds.length) return {work, rejectedWorkItemIds:[]};
  const {getValidPublicCustomerWork} = require('./customer-public-work-contract');
  const projected = getValidPublicCustomerWork(work, 20, {forSearchClassification:true});
  const byWork = new Map(projected.map(item => [item.workItemId,item]));
  const rejectedWorkItemIds = [], selected = [];
  for (const item of Array.isArray(work) ? work : []) {
    const publicItem = byWork.get(typeof item?.workItemId === 'string' ? item.workItemId.trim() : null);
    if (!publicItem) continue;
    const products = publicItem.products || [];
    const kept = products.filter(product => !product.categoryClassification || product.categoryClassification.categories.some(reference => categoryIds.includes(reference.categoryId)));
    if (products.length && !kept.length) { rejectedWorkItemIds.push(publicItem.workItemId); continue; }
    // Carry the raw ownership context to the existing deterministic projection.
    // The shared projection rejects duplicate IDs before this association.
    const allowed = new Set(kept.map(product => product.productId));
    selected.push({...item, ...(Array.isArray(item.products) ? {
      ...(item.products.length ? {hasDeclaredOffers:true} : {}),
      products:item.products.filter(product => typeof product?.productId === 'string' && allowed.has(product.productId.trim()))} : {})});
  }
  return {work:selected, rejectedWorkItemIds};
}
module.exports = {MAX_CATEGORIES, validateClassification, classificationFromProducts, interpretCategories, validateCategoryAdvisory, selectCategoryWork};
