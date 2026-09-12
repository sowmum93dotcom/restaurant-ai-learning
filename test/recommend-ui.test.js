const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const html = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("DEMEOS Recommends presents the optional Business Situation field", () => {
  assert.match(html, /<label for="business-situation">What is happening in your business right now\?<\/label>/);
  assert.match(html, /Tell DEMEOS about a current need, opportunity or change\. This is optional\./);
  assert.match(html, /placeholder="Example: Tuesday evenings are quiet and I would like to attract more local customers\."/);
  assert.ok(html.indexOf('id="business-situation"') < html.indexOf('id="recommendations-btn"'));
});

class Element {
  constructor(tag = "div") { this.tag = tag; this.listeners = {}; this.children = []; this.value = ""; this._text = "";
    this.hidden = false; this.disabled = false; this.options = [{ text: "Full Marketing Campaign" }]; this.selectedIndex = 0;
    this.focusCount = 0; this.classes = new Set();
    this.classList = { toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) }; }
  set textContent(value) { this._text = value; if (value === "") this.children = []; }
  get textContent() { return this._text; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); }
  prepend(...children) { this.children.unshift(...children); }
  setAttribute() {} focus() { this.focusCount += 1; } scrollIntoView() {}
}

function setup(campaigns = [], decisions = [], decisionResponseOk = true) {
  const profiles = [
    { businessId: "a", name: "Alpha", type: "Studio", location: "York", brandVoice: "Friendly", targetCustomer: "Families", goal: "Awareness" },
    { businessId: "b", name: "Beta", type: "Accountant", location: "Bath", brandVoice: "Formal", targetCustomer: "Founders", goal: "Enquiries" }
  ];
  const store = new Map([["demeosBusinessProfiles", JSON.stringify(profiles)], ["demeosActiveBusinessId", "a"],
    ["demeosCampaignHistory", JSON.stringify(campaigns)], ["demeosRecommendationDecisions", JSON.stringify(decisions)]]);
  const elements = new Map(); const created = [];
  const document = { addEventListener(name, fn) { if (name === "DOMContentLoaded") this.ready = fn; },
    createElement(tag) { const element = new Element(tag); created.push(element); return element; },
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); } };
  let generateCalls = 0; const recommendBodies = []; const decisionWrites = [];
  const recommendations = { recommendations: ["First", "Second", "Third"].map((title, index) => ({ title, reason: `Why ${index}`,
    targetCustomer: "Families", businessObjective: `Awareness objective ${index}`,
    demeosCapability: ["Full Marketing Campaign", "Social Media Campaign", "Email Campaign"][index],
    suggestedRequest: `Do ${index}`, suggestedCampaignType: ["full", "social", "email"][index],
    evidence: [{ source: "businessProfile", field: "goal", value: "Awareness", verificationState: "verified" }],
    expectedOutcome: "Aims to support Awareness through customer interest", requiredInput: [], approvalState: "pending" })) };
  const context = { document, console, alert() {}, Math, setTimeout, crypto: { randomUUID() { return "new-id"; } },
    localStorage: { getItem(key) { return store.has(key) ? store.get(key) : null; }, setItem(key, value) { store.set(key, value); }, removeItem(key) { store.delete(key); } },
    fetch: async (url, options = {}) => {
      if (url === "/api/recommend") { recommendBodies.push(JSON.parse(options.body)); return { ok: true, status: 200, async text() { return JSON.stringify(recommendations); } }; }
      if (url === "/api/generate") { generateCalls += 1; return { ok: true, status: 200, async text() { return JSON.stringify({ campaign: "Campaign" }); } }; }
      if (url.endsWith("/recommendation-decisions")) { decisionWrites.push({ url, body: JSON.parse(options.body) }); return { ok: decisionResponseOk, status: decisionResponseOk ? 201 : 500 }; }
      return { ok: false, status: 404, async json() { return {}; }, async text() { return "{}"; } };
    } };
  vm.runInNewContext(fs.readFileSync(require.resolve("../js/script.js"), "utf8"), context); document.ready();
  return { document, elements, created, profiles, recommendBodies, decisionWrites, store, getGenerateCalls: () => generateCalls };
}

test("Marketing Results includes Recommendation Decisions with its owner-choice explanation and empty state", () => {
  assert.match(html, /<h3 id="recommendation-decisions-results-heading">Recommendation Decisions<\/h3>/);
  assert.match(html, /Your recorded choices about DEMEOS recommendations\. These are owner decisions, not campaign performance results\./);
  assert.match(html, /id="recommendation-decisions-results-empty">No recommendation decisions recorded yet\./);
  assert.match(html, /id="recommendation-decisions-results-list"/);
  assert.ok(html.indexOf("Campaign Outcomes") < html.indexOf("Recommendation Decisions"));
  assert.ok(html.indexOf("Recommendation Decisions") < html.indexOf("Participation Signals"));
  const app = setup();
  assert.equal(app.document.getElementById("recommendation-decisions-results-empty").hidden, false);
  assert.equal(app.document.getElementById("recommendation-decisions-results-list").children.length, 0);
});

test("Recommendation Decisions renders only valid active-business owner choices with friendly labels", () => {
  const decisions = [
    { businessId: "a", recommendationTitle: "Welcome families", suggestedCampaignType: "full", decision: "used", timestamp: "2026-09-10T10:00:00.000Z" },
    { businessId: "a", recommendationTitle: "Share lunch news", suggestedCampaignType: "social", decision: "modified", timestamp: "2026-09-11T11:00:00.000Z" },
    { businessId: "a", recommendationTitle: "Email regulars", suggestedCampaignType: "email", decision: "rejected", timestamp: "2026-09-12T12:00:00.000Z" },
    { businessId: "b", recommendationTitle: "Other business", suggestedCampaignType: "email", decision: "used", timestamp: "2026-09-12T13:00:00.000Z" },
    { businessId: "a", recommendationTitle: "Bad campaign", suggestedCampaignType: "video", decision: "used", timestamp: "2026-09-12T14:00:00.000Z" },
    { businessId: "a", recommendationTitle: "Bad decision", suggestedCampaignType: "email", decision: "successful", timestamp: "2026-09-12T15:00:00.000Z" },
    { businessId: "a", recommendationTitle: "Bad date", suggestedCampaignType: "email", decision: "used", timestamp: "today" },
    { businessId: "a", recommendationTitle: "   ", suggestedCampaignType: "email", decision: "used", timestamp: "2026-09-12T16:00:00.000Z" }
  ];
  const app = setup([], decisions);
  const list = app.document.getElementById("recommendation-decisions-results-list");
  assert.equal(app.document.getElementById("recommendation-decisions-results-empty").hidden, true);
  assert.equal(list.children.length, 3);
  assert.deepEqual(list.children.map((item) => item.children.slice(0, 3).map((child) => child.textContent)), [
    ["Email regulars", "Campaign type: Email Campaign", "Owner decision: Not for me"],
    ["Share lunch news", "Campaign type: Social Media Campaign", "Owner decision: Modified"],
    ["Welcome families", "Campaign type: Full Marketing Campaign", "Owner decision: Used"]
  ]);
  assert.equal(list.children[0].children[3].textContent,
    `Decision date: ${new Date("2026-09-12T12:00:00.000Z").toLocaleString()}`);
});

test("persisted recommendation decisions appear immediately and failed writes do not appear", async () => {
  const app = setup();
  await app.document.getElementById("recommendations-btn").listeners.click();
  await app.document.getElementById("recommendations-list").children[0].children[9].listeners.click();
  const list = app.document.getElementById("recommendation-decisions-results-list");
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].children[0].textContent, "First");
  assert.equal(list.children[0].children[2].textContent, "Owner decision: Used");

  const failed = setup([], [], false);
  await failed.document.getElementById("recommendations-btn").listeners.click();
  await failed.document.getElementById("recommendations-list").children[0].children[9].listeners.click();
  assert.equal(failed.document.getElementById("recommendation-decisions-results-list").children.length, 0);
  assert.deepEqual(JSON.parse(failed.store.get("demeosRecommendationDecisions")), []);
});

test("recommendations use the active profile, show loading, render three, and populate controls without generating", async () => {
  const app = setup(); const button = app.document.getElementById("recommendations-btn");
  app.document.getElementById("business-situation").value = "  Tuesday evenings are quiet.  ";
  const pending = button.listeners.click();
  assert.equal(app.document.getElementById("recommendations-status").textContent, "DEMEOS is reviewing your business...");
  await pending;
  assert.equal(app.recommendBodies[0].businessId, "a");
  assert.deepEqual(JSON.parse(JSON.stringify(app.recommendBodies[0].businessProfile)), app.profiles[0]);
  assert.equal(app.recommendBodies[0].businessSituation, "Tuesday evenings are quiet.");
  const list = app.document.getElementById("recommendations-list"); assert.equal(list.children.length, 3);
  const card = list.children[1];
  assert.deepEqual(card.children.slice(1, 5).map((section) => [section.children[0].textContent, section.children[1].textContent]), [
    ["Why this helps", "Why 1"], ["Target customer", "Families"],
    ["Business objective", "Awareness objective 1"], ["DEMEOS will create", "Social Media Campaign"]
  ]);
  const useButton = card.children[9]; assert.equal(useButton.textContent, "Use This Recommendation"); useButton.listeners.click();
  assert.equal(app.document.getElementById("promo-input").value, "Do 1");
  assert.equal(app.document.getElementById("campaign-type").value, "social");
  assert.deepEqual(app.decisionWrites, [{ url: "/api/businesses/a/recommendation-decisions", body: {
    recommendationTitle: "Second", suggestedCampaignType: "social", decision: "used"
  } }]);
  assert.equal(app.getGenerateCalls(), 0);
});

test("Modify records modified, fills editable controls, and does not generate", async () => {
  const app = setup(); await app.document.getElementById("recommendations-btn").listeners.click();
  const card = app.document.getElementById("recommendations-list").children[2];
  card.children[10].listeners.click();
  const input = app.document.getElementById("promo-input");
  assert.equal(input.value, "Do 2");
  assert.equal(app.document.getElementById("campaign-type").value, "email");
  assert.equal(input.disabled, false); assert.equal(input.focusCount, 1);
  assert.equal(app.decisionWrites[0].body.decision, "modified");
  assert.equal(app.getGenerateCalls(), 0);
});

test("Not for me records rejected visibly without filling or generating and keeps other recommendations", async () => {
  const app = setup(); await app.document.getElementById("recommendations-btn").listeners.click();
  const list = app.document.getElementById("recommendations-list");
  const request = app.document.getElementById("promo-input"); request.value = "Owner's existing request";
  list.children[0].children[11].listeners.click();
  assert.equal(request.value, "Owner's existing request");
  assert.equal(list.children[0].children[12].textContent, "Not for me");
  assert.equal(list.children[0].classes.has("is-rejected"), true);
  assert.equal(list.children.length, 3);
  assert.equal(app.decisionWrites[0].body.decision, "rejected");
  assert.equal(app.getGenerateCalls(), 0);
});

test("switching businesses and Add Business clear recommendations", async () => {
  const app = setup(); const situation = app.document.getElementById("business-situation");
  situation.value = "Only for Alpha"; await app.document.getElementById("recommendations-btn").listeners.click();
  const list = app.document.getElementById("recommendations-list"); assert.equal(list.children.length, 3);
  const selector = app.document.getElementById("business-selector"); selector.value = "b"; selector.listeners.change();
  assert.equal(list.children.length, 0, "the first business recommendations must not appear under the second business");
  assert.equal(situation.value, "", "the first business situation must not appear under the second business");
  situation.value = "Only for Beta";
  await app.document.getElementById("recommendations-btn").listeners.click(); assert.equal(list.children.length, 3);
  app.document.getElementById("add-business-btn").listeners.click(); assert.equal(list.children.length, 0);
  assert.equal(situation.value, "", "the previous business situation must not appear when adding a business");
});

test("switching businesses keeps recommendation decisions scoped to the active business", async () => {
  const app = setup();
  await app.document.getElementById("recommendations-btn").listeners.click();
  app.document.getElementById("recommendations-list").children[0].children[11].listeners.click();
  const selector = app.document.getElementById("business-selector"); selector.value = "b"; selector.listeners.change();
  await app.document.getElementById("recommendations-btn").listeners.click();
  app.document.getElementById("recommendations-list").children[1].children[9].listeners.click();
  assert.deepEqual(app.decisionWrites.map((write) => [write.url, write.body.decision]), [
    ["/api/businesses/a/recommendation-decisions", "rejected"],
    ["/api/businesses/b/recommendation-decisions", "used"]
  ]);
  assert.deepEqual(app.recommendBodies[0].recommendationDecisions, []);
  assert.deepEqual(app.recommendBodies[1].recommendationDecisions, []);
});

test("only the active business's 20 most recent decisions are sent and switching isolates them", async () => {
  const alpha = Array.from({ length: 22 }, (_, index) => ({ businessId: "a", recommendationTitle: `Alpha ${index}`,
    suggestedCampaignType: ["full", "social", "email"][index % 3], decision: ["used", "modified", "rejected"][index % 3],
    timestamp: `2026-09-${String(index + 1).padStart(2, "0")}T10:00:00.000Z` }));
  const beta = { businessId: "b", recommendationTitle: "Beta only", suggestedCampaignType: "email", decision: "rejected",
    timestamp: "2026-09-30T10:00:00.000Z" };
  const app = setup([], alpha.concat(beta));
  await app.document.getElementById("recommendations-btn").listeners.click();
  assert.equal(app.recommendBodies[0].recommendationDecisions.length, 20);
  assert.equal(app.recommendBodies[0].recommendationDecisions[0].recommendationTitle, "Alpha 21");
  assert.equal(app.recommendBodies[0].recommendationDecisions.some((item) => Object.hasOwn(item, "businessId")), false);
  assert.deepEqual(new Set(app.recommendBodies[0].recommendationDecisions.map((item) => item.decision)), new Set(["used", "modified", "rejected"]));
  const selector = app.document.getElementById("business-selector"); selector.value = "b"; selector.listeners.change();
  await app.document.getElementById("recommendations-btn").listeners.click();
  assert.deepEqual(JSON.parse(JSON.stringify(app.recommendBodies[1].recommendationDecisions)), [{
    recommendationTitle: "Beta only", suggestedCampaignType: "email", decision: "rejected", timestamp: "2026-09-30T10:00:00.000Z"
  }]);
});

test("a blank situation is sent with the active profile", async () => {
  const app = setup(); app.document.getElementById("business-situation").value = "  ";
  await app.document.getElementById("recommendations-btn").listeners.click();
  assert.equal(app.recommendBodies[0].businessSituation, "");
  assert.deepEqual(JSON.parse(JSON.stringify(app.recommendBodies[0].businessProfile)), app.profiles[0]);
  assert.deepEqual(app.recommendBodies[0].campaignOutcomes, []);
});

test("only saved outcome history belonging to the active business is sent", async () => {
  const app = setup([
    { id: "a-used", businessId: "a", campaignType: "social", promoText: "Reach families", outcome: { outcome: "Positive", ownerNote: "Families mentioned it." } },
    { id: "a-no-outcome", businessId: "a", campaignType: "email", promoText: "No feedback" },
    { id: "b-used", businessId: "b", campaignType: "full", promoText: "Reach founders", outcome: { outcome: "Mixed", ownerNote: "Founders replied." } },
    { id: "legacy", campaignType: "email", promoText: "Unscoped", outcome: { outcome: "Positive", ownerNote: "Must not leak." } }
  ]);
  await app.document.getElementById("recommendations-btn").listeners.click();
  assert.deepEqual(JSON.parse(JSON.stringify(app.recommendBodies[0].campaignOutcomes)), [
    { campaignType: "social", marketingRequest: "Reach families", outcome: "Positive", ownerNote: "Families mentioned it." }
  ]);
});

test("business switching keeps each business outcome history isolated", async () => {
  const app = setup([
    { id: "a", businessId: "a", campaignType: "social", outcome: { outcome: "Not used yet", ownerNote: "Alpha note" } },
    { id: "b", businessId: "b", campaignType: "email", outcome: { outcome: "No noticeable result", ownerNote: "Beta note" } }
  ]);
  await app.document.getElementById("recommendations-btn").listeners.click();
  const selector = app.document.getElementById("business-selector"); selector.value = "b"; selector.listeners.change();
  await app.document.getElementById("recommendations-btn").listeners.click();
  assert.deepEqual(app.recommendBodies.map((body) => body.campaignOutcomes.map((item) => item.ownerNote)), [["Alpha note"], ["Beta note"]]);
});

test("recommendation cards render structured contract fields without raw JSON and preserve controls", async () => {
  const app = setup(); await app.document.getElementById("recommendations-btn").listeners.click();
  const card = app.document.getElementById("recommendations-list").children[0];
  assert.deepEqual(card.children.slice(5, 9).map((section) => [section.children[0].textContent, section.children[1].textContent]), [
    ["Evidence", "Primary marketing goal — Awareness — Verified Business Profile"],
    ["Expected outcome", "Aims to support Awareness through customer interest"],
    ["Required information", "None"], ["Approval", "Pending"]
  ]);
  assert.deepEqual(card.children.slice(9, 12).map((button) => button.textContent),
    ["Use This Recommendation", "Modify", "Not for me"]);
  assert.doesNotMatch(card.children[5].children[1].textContent, /[{}\[\]"]/);
});
