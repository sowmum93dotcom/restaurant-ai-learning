const { getValidPublicCustomerWork } = require("./customer-public-work-contract.js");
const DISCOVER_TEST_MODE_HEADER = "x-demeos-test-mode";
const DISCOVER_TEST_MODE_LEGACY_HEADER = "x-demeos-discover-test";
const DISCOVER_TEST_MODE_VALUE = "controlled-preview";
const DISCOVER_TEST_MODE_QUERY = "demeos-test";

const { productExperienceTestContent } = require("./controlled-customer-test-content.js");

function isDiscoverTestMode(req) {
  if (process.env.DEMEOS_CONTROLLED_TEST_CONTENT === "disabled") return false;
  const headers = req && req.headers || {};
  const header = headers[DISCOVER_TEST_MODE_HEADER];
  const legacyHeader = headers[DISCOVER_TEST_MODE_LEGACY_HEADER];
  const query = req && req.query && req.query[DISCOVER_TEST_MODE_QUERY];
  const legacyControlledPreview = query === "1" && legacyHeader === DISCOVER_TEST_MODE_VALUE;
  const productControlledPreview = query === "1" && header === DISCOVER_TEST_MODE_VALUE;
  return legacyControlledPreview || productControlledPreview;
}

// Preserve raw public records for the downstream contract to validate once.
function selectCustomerCatalogue(work, req) {
  if (getValidPublicCustomerWork(work).length || !isDiscoverTestMode(req)) return { work, testMode: false };
  return { work: productExperienceTestContent(), testMode: true };
}
module.exports = { isDiscoverTestMode, selectCustomerCatalogue };
