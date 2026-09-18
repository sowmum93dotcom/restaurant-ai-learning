const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const api = fs.readFileSync(path.join(__dirname, "..", "api", "businesses", "[businessId].js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "js", "script.js"), "utf8");

test("modern Business Profile writes require explicit owner accuracy confirmation", function () {
  assert.match(api, /ownerAccuracyConfirmed === true/);
  assert.match(api, /profileVersion\) >= 3 && !ownerAccuracyConfirmed/);
});

test("only the explicit Business Profile save sends owner confirmation", function () {
  assert.match(client, /persistBusiness\(result\.profile, \{ ownerAccuracyConfirmed: true \}\)/);
  assert.match(client, /persistBusiness\(profile\)/);
});

test("owner confirmation time is refreshed only by explicit confirmation", function () {
  assert.match(api, /ownerConfirmedAt: ownerAccuracyConfirmed \? new Date\(\)\.toISOString\(\) : previousInformationStatus\.ownerConfirmedAt/);
});
