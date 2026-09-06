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
    this.classList = { toggle() {} }; }
  set textContent(value) { this._text = value; if (value === "") this.children = []; }
  get textContent() { return this._text; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); }
  prepend(...children) { this.children.unshift(...children); }
  setAttribute() {} focus() {} scrollIntoView() {}
}

function setup(campaigns = []) {
  const profiles = [
    { businessId: "a", name: "Alpha", type: "Studio", location: "York", brandVoice: "Friendly", targetCustomer: "Families", goal: "Awareness" },
    { businessId: "b", name: "Beta", type: "Accountant", location: "Bath", brandVoice: "Formal", targetCustomer: "Founders", goal: "Enquiries" }
  ];
  const store = new Map([["demeosBusinessProfiles", JSON.stringify(profiles)], ["demeosActiveBusinessId", "a"],
    ["demeosCampaignHistory", JSON.stringify(campaigns)]]);
  const elements = new Map(); const created = [];
  const document = { addEventListener(name, fn) { if (name === "DOMContentLoaded") this.ready = fn; },
    createElement(tag) { const element = new Element(tag); created.push(element); return element; },
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); } };
  let generateCalls = 0; const recommendBodies = [];
  const recommendations = { recommendations: ["First", "Second", "Third"].map((title, index) => ({ title, reason: `Why ${index}`,
    targetCustomer: "Families", businessObjective: `Awareness objective ${index}`,
    demeosCapability: ["Full Marketing Campaign", "Social Media Campaign", "Email Campaign"][index],
    suggestedRequest: `Do ${index}`, suggestedCampaignType: ["full", "social", "email"][index] })) };
  const context = { document, console, alert() {}, Math, setTimeout, crypto: { randomUUID() { return "new-id"; } },
    localStorage: { getItem(key) { return store.has(key) ? store.get(key) : null; }, setItem(key, value) { store.set(key, value); }, removeItem(key) { store.delete(key); } },
    fetch: async (url, options = {}) => {
      if (url === "/api/recommend") { recommendBodies.push(JSON.parse(options.body)); return { ok: true, status: 200, async text() { return JSON.stringify(recommendations); } }; }
      if (url === "/api/generate") { generateCalls += 1; return { ok: true, status: 200, async text() { return JSON.stringify({ campaign: "Campaign" }); } }; }
      return { ok: false, status: 404, async json() { return {}; }, async text() { return "{}"; } };
    } };
  vm.runInNewContext(fs.readFileSync(require.resolve("../js/script.js"), "utf8"), context); document.ready();
  return { document, elements, created, profiles, recommendBodies, getGenerateCalls: () => generateCalls };
}

test("recommendations use the active profile, show loading, render three, and populate controls without generating", async () => {
  const app = setup(); const button = app.document.getElementById("recommendations-btn");
  app.document.getElementById("business-situation").value = "  Tuesday evenings are quiet.  ";
  const pending = button.listeners.click();
  assert.equal(app.document.getElementById("recommendations-status").textContent, "DEMEOS is reviewing your business...");
  await pending;
  assert.deepEqual(JSON.parse(JSON.stringify(app.recommendBodies[0].businessProfile)), app.profiles[0]);
  assert.equal(app.recommendBodies[0].businessSituation, "Tuesday evenings are quiet.");
  const list = app.document.getElementById("recommendations-list"); assert.equal(list.children.length, 3);
  const card = list.children[1];
  assert.deepEqual(card.children.slice(1, 5).map((section) => [section.children[0].textContent, section.children[1].textContent]), [
    ["Why this helps", "Why 1"], ["Target customer", "Families"],
    ["Business objective", "Awareness objective 1"], ["DEMEOS will create", "Social Media Campaign"]
  ]);
  const useButton = card.children[5]; assert.equal(useButton.textContent, "Use This Recommendation"); useButton.listeners.click();
  assert.equal(app.document.getElementById("promo-input").value, "Do 1");
  assert.equal(app.document.getElementById("campaign-type").value, "social");
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
