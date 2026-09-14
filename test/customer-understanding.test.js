const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { buildCustomerUnderstanding, confirmCustomerUnderstanding } = require("../js/customer-understanding.js");

test("selected intention alone produces only a broad customer-provided understanding", function () {
  assert.deepEqual(buildCustomerUnderstanding("Spend time together", ""), {
    intention: "Spend time together", customerText: "",
    understanding: "You’d like to spend time together.",
    source: "customer-provided", confidenceState: "ready-for-confirmation"
  });
});

test("selected intention and free text produce a concise combined understanding", function () {
  const result = buildCustomerUnderstanding("Spend time together", " I want somewhere relaxed for dinner with my family. ");
  assert.equal(result.understanding,
    "You’d like to spend time together and are looking for somewhere relaxed for dinner with your family.");
  assert.equal(result.customerText, "I want somewhere relaxed for dinner with my family.");
  assert.equal(result.confidenceState, "ready-for-confirmation");
});

test("free text alone remains quoted customer information", function () {
  const result = buildCustomerUnderstanding("", "  Help me plan a team dinner  ");
  assert.equal(result.understanding, "You told DEMEOS: “Help me plan a team dinner”");
  assert.equal(result.source, "customer-provided");
  assert.equal(result.confidenceState, "ready-for-confirmation");
});

test("empty or invalid input cannot produce an understanding", function () {
  assert.equal(buildCustomerUnderstanding("", "  "), null);
  assert.equal(buildCustomerUnderstanding("Find the best business", ""), null);
});

test("a broad get-something-done intention requests one clarification", function () {
  const broad = buildCustomerUnderstanding("Get something done", "");
  assert.equal(broad.confidenceState, "needs-clarification");
  assert.equal(confirmCustomerUnderstanding(broad), null);

  const clarified = buildCustomerUnderstanding("Get something done", "", "repair my bicycle");
  assert.equal(clarified.confidenceState, "ready-for-confirmation");
  assert.equal(clarified.understanding, "You’d like to get something done and are looking for repair your bicycle.");
});

test("understanding ignores coordinates, business data, and unrelated arguments", function () {
  const result = buildCustomerUnderstanding("Eat & enjoy", "a quiet lunch", {
    coordinates: { latitude: 51.5, longitude: -0.1 }, businessName: "Invented Cafe", rating: 5
  });
  assert.equal(result.understanding, "You’d like to eat and enjoy and are looking for a quiet lunch.");
  assert.doesNotMatch(JSON.stringify(result), /51\.5|Invented Cafe|rating|nearby/);
});

test("confirmation is an explicit in-memory state change and customer code does not post it", function () {
  const ready = buildCustomerUnderstanding("Go somewhere", "visit a museum");
  assert.equal(ready.confidenceState, "ready-for-confirmation");
  const confirmed = confirmCustomerUnderstanding(ready);
  assert.equal(confirmed.confidenceState, "confirmed");
  const source = fs.readFileSync(path.join(__dirname, "..", "js/customer.js"), "utf8");
  const confirmationHandler = source.slice(source.indexOf('getElementById("customer-understanding-confirm")'),
    source.indexOf("function toCustomerWorkItem"));
  assert.doesNotMatch(confirmationHandler, /fetch|XMLHttpRequest|\/api\/customer\/work|participation|localStorage/);
});

test("Stage 2 exposes accessible controls, preserves Stage 1, and introduces no marketplace features", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "customer.html"), "utf8");
  const source = fs.readFileSync(path.join(__dirname, "..", "js/customer.js"), "utf8");
  assert.match(html, /id="customer-understanding-heading" tabindex="-1"/);
  assert.match(html, /for="customer-clarification-text"/);
  assert.match(html, /id="customer-understanding-status"[^>]*aria-live="polite"/);
  assert.match(source, /intentionForm\.hidden = false/);
  assert.doesNotMatch(html + source, /star rating|book now|sponsored|filter bar|marketplace/i);
});
