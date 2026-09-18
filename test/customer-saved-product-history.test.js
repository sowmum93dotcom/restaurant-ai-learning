const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const persistence = fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "persistence.js"), "utf8");
const myDemeos = fs.readFileSync(path.join(__dirname, "..", "js", "my-demeos.js"), "utf8");

test("saved possibilities restore products from the trusted issuance snapshot", function () {
  assert.match(persistence, /LEFT JOIN demeos_customer_possibility_issuances i/);
  assert.match(persistence, /i\.trusted_customer_identity_id = s\.trusted_customer_identity_id/);
  assert.match(persistence, /i\.work_item_id = s\.work_item_id/);
  assert.match(persistence, /const products = Array\.isArray\(snapshot\.products\)/);
});

test("My DEMEOS labels saved product availability as historical", function () {
  assert.match(myDemeos, /Shown availability:/);
  assert.match(myDemeos, /product information DEMEOS showed at the time/);
  assert.match(myDemeos, /Availability may have changed/);
});

test("saved product history does not create continuation, purchase or interest evidence", function () {
  const section = myDemeos.slice(myDemeos.indexOf("Products shown with this possibility"), myDemeos.indexOf("if (possibility.relevance"));
  assert.doesNotMatch(section, /Interested|purchase|booking|sale|customerContinuation|href|addEventListener/);
});
