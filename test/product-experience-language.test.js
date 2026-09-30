const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadCopy() {
  const source = fs.readFileSync("js/demeos-product-experience-copy.js", "utf8");
  const window = {};
  vm.runInNewContext(source, { window });
  return window.DEMEOSProductExperienceCopy;
}

test("Product Experience has complete interface copy for all nine released languages", () => {
  const copy = loadCopy();
  const languages = ["en","es","fr","ar","pt","zh","hi","de","ja"];
  assert.deepEqual(Object.keys(copy).sort(), languages.slice().sort());
  const keys = Object.keys(copy.en).sort();
  languages.forEach(code => {
    assert.deepEqual(Object.keys(copy[code]).sort(), keys);
    keys.forEach(key => assert.equal(typeof copy[code][key], "string"));
    keys.forEach(key => assert.ok(copy[code][key].length > 0));
  });
});

test("Customer page loads Product Experience language layer after the main interface language controller", () => {
  const html = fs.readFileSync("customer.html", "utf8");
  const controller = html.indexOf('js/customer-interface-language.js');
  const copy = html.indexOf('js/demeos-product-experience-copy.js');
  const productLanguage = html.indexOf('js/demeos-product-experience-language.js');
  assert.ok(controller >= 0 && copy > controller && productLanguage > copy);
});

test("Product Experience language layer targets DEMEOS interface classes without rewriting business names or descriptions", () => {
  const source = fs.readFileSync("js/demeos-product-experience-language.js", "utf8");
  assert.match(source, /customer-product-price/);
  assert.match(source, /customer-product-availability/);
  assert.match(source, /customer-product-fulfilment/);
  assert.match(source, /customer-product-continue-action/);
  assert.doesNotMatch(source, /customer-product-name/);
  assert.doesNotMatch(source, /customer-product-description/);
});
