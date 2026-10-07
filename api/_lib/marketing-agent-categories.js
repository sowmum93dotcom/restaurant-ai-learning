'use strict';
// Classification data only. No category has execution, permission or payment authority.
const source = require('../../data/marketing-agent/categories-v1.json');
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const keys = (value, expected) => plain(value) && Object.keys(value).sort().join(',') === expected.slice().sort().join(',');
function validateDataset(data) {
  if (!keys(data, ['datasetVersion', 'sectors', 'categories']) || data.datasetVersion !== 'marketing-agent-categories-v1' || !Array.isArray(data.sectors) || data.sectors.length !== 9 || !Array.isArray(data.categories) || data.categories.length !== 171) return false;
  const sectors = new Map();
  for (const sector of data.sectors) {
    if (!keys(sector, ['sectorId', 'sectorName']) || !/^[1-9]$/.test(sector.sectorId) || typeof sector.sectorId !== 'string' || typeof sector.sectorName !== 'string' || !sector.sectorName.trim() || sectors.has(sector.sectorId)) return false;
    sectors.set(sector.sectorId, sector.sectorName);
  }
  const seen = new Set();
  for (const category of data.categories) {
    if (!keys(category, ['categoryId', 'categoryName', 'sectorId', 'sectorName', 'datasetVersion']) || typeof category.categoryId !== 'string' || !/^[1-9]\d{0,2}$/.test(category.categoryId) || Number(category.categoryId) > 171 || category.sectorId !== String(Math.floor((Number(category.categoryId)-1)/19)+1) || seen.has(category.categoryId) || typeof category.categoryName !== 'string' || !category.categoryName.trim() || sectors.get(category.sectorId) !== category.sectorName || category.datasetVersion !== data.datasetVersion) return false;
    seen.add(category.categoryId);
  }
  return true;
}
if (!validateDataset(source)) throw new Error('Invalid controlled Marketing Agent category dataset');
const DATASET_VERSION = source.datasetVersion;
const SECTORS = Object.freeze(source.sectors.map(record => Object.freeze({...record})));
const CATEGORIES = Object.freeze(source.categories.map(record => Object.freeze({...record})));
const categoryById = new Map(CATEGORIES.map(record => [record.categoryId, record]));
const sectorById = new Map(SECTORS.map(record => [record.sectorId, record]));
function getCategory(id) { return typeof id === 'string' ? categoryById.get(id) || null : null; }
function getSector(id) { return typeof id === 'string' ? sectorById.get(id) || null : null; }
function validateReference(reference) {
  if (!keys(reference, ['categoryId', 'sectorId'])) return null;
  const category = getCategory(reference.categoryId);
  return category && reference.sectorId === category.sectorId ? Object.freeze({categoryId:category.categoryId, sectorId:category.sectorId}) : null;
}
module.exports = {DATASET_VERSION, SECTORS, CATEGORIES, getCategory, getSector, validateReference, validateDataset};
