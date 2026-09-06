const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const { getCampaignWorkspace, parseFullCampaignSections } = require("../js/script.js");

const fullCampaignText = `CAMPAIGN STRATEGY
Reach nearby families with a welcoming weekend offer.

SOCIAL MEDIA POST
Dinner plans? Join us this Saturday. #LocalDining

EMAIL CAMPAIGN
Subject: Your Saturday table is waiting

Book a relaxed family dinner with us.

SHORT AD COPY
Make Saturday delicious.

CALL TO ACTION
Reserve your table today.`;

test("a valid full campaign is split into five isolated sections in order", function () {
  const sections = parseFullCampaignSections(fullCampaignText);

  assert.deepEqual(sections.map(function (section) { return section.heading; }), [
    "CAMPAIGN STRATEGY", "SOCIAL MEDIA POST", "EMAIL CAMPAIGN", "SHORT AD COPY", "CALL TO ACTION"
  ]);
  assert.deepEqual(sections.map(function (section) { return section.content; }), [
    "Reach nearby families with a welcoming weekend offer.",
    "Dinner plans? Join us this Saturday. #LocalDining",
    "Subject: Your Saturday table is waiting\n\nBook a relaxed family dinner with us.",
    "Make Saturday delicious.",
    "Reserve your table today."
  ]);
});

test("a malformed full campaign falls back to its complete original text", function () {
  const malformed = "CAMPAIGN STRATEGY\nA plan\n\nSOCIAL MEDIA POST\nA post";
  const workspace = getCampaignWorkspace({ campaignType: "full", campaignText: malformed });

  assert.equal(workspace.sections, null);
  assert.equal(workspace.campaignText, malformed);
});

test("social and email campaigns are not parsed as full campaigns", function () {
  assert.equal(getCampaignWorkspace({ campaignType: "social", campaignText: fullCampaignText }).sections, null);
  assert.equal(getCampaignWorkspace({ campaignType: "email", campaignText: fullCampaignText }).sections, null);
});

function createBrowser(campaign) {
  class FakeElement {
    constructor() {
      this.listeners = {}; this.children = []; this.options = [{ text: "Full Marketing Campaign" }];
      this.selectedIndex = 0; this.value = ""; this.hidden = false; this.attributes = {};
      this.classList = { toggle() {} }; this._textContent = "";
    }
    get textContent() { return this._textContent; }
    set textContent(value) { this._textContent = value; if (value === "") this.children = []; }
    addEventListener(name, listener) { this.listeners[name] = listener; }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); }
    prepend(...children) { this.children.unshift(...children); }
    setAttribute(name, value) { this.attributes[name] = value; }
    scrollIntoView() {}
  }
  const elements = new Map(); const created = []; const clipboardWrites = [];
  const document = {
    addEventListener(name, listener) { if (name === "DOMContentLoaded") this.ready = listener; },
    createElement() { const element = new FakeElement(); created.push(element); return element; },
    getElementById(id) { if (!elements.has(id)) elements.set(id, new FakeElement()); return elements.get(id); }
  };
  const profile = { businessId: "business-a", name: "Cafe", type: "Cafe", location: "Town", brandVoice: "Warm", targetCustomer: "Families", goal: "Visits" };
  const values = new Map([
    ["demeosBusinessProfiles", JSON.stringify([profile])], ["demeosActiveBusinessId", profile.businessId],
    ["demeosCampaignHistory", JSON.stringify([campaign])]
  ]);
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); }, removeItem(key) { values.delete(key); }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../js/script.js"), "utf8"), {
    alert() {}, console, document, localStorage, Math, setTimeout,
    navigator: { clipboard: { writeText(text) { clipboardWrites.push(text); return Promise.resolve(); } } }
  });
  document.ready();
  return { document, created, clipboardWrites };
}

test("opening a saved full campaign renders sections, copies the original, and clearing removes them", async function () {
  const campaign = { id: "full-1", businessId: "business-a", businessName: "Cafe", campaignType: "full",
    campaignText: fullCampaignText, approvalStatus: "Unapproved", createdAt: "2026-09-05T00:00:00.000Z" };
  const browser = createBrowser(campaign);

  browser.created.find(function (element) { return element.textContent === "Open"; }).listeners.click();
  const resultsContent = browser.document.getElementById("results-content");
  assert.equal(resultsContent.children.length, 5);
  assert.deepEqual(resultsContent.children.map(function (panel) { return panel.children[0].children[0].textContent; }),
    ["Campaign Strategy", "Social Media Post", "Email Campaign", "Short Ad Copy", "Call to Action"]);

  resultsContent.children[1].children[0].children[1].listeners.click();
  await Promise.resolve();
  assert.equal(browser.clipboardWrites[0], "Dinner plans? Join us this Saturday. #LocalDining");

  browser.document.getElementById("copy-btn").listeners.click();
  await Promise.resolve();
  assert.equal(browser.clipboardWrites[1], fullCampaignText);

  browser.document.getElementById("add-business-btn").listeners.click();
  assert.equal(resultsContent.children.length, 0);
  assert.equal(resultsContent.textContent, "");
  assert.equal(browser.document.getElementById("results").hidden, true);
});
