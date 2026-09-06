const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const { getActiveMarketingWork, getCampaignWorkspace, parseFullCampaignSections } = require("../js/script.js");

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

function createBrowser(campaign, fetchImpl) {
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
    scrollIntoView(options) { this.scrollCalls = (this.scrollCalls || []).concat([options]); }
    focus() { this.focusCalls = (this.focusCalls || 0) + 1; }
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
    ["demeosCampaignHistory", JSON.stringify(Array.isArray(campaign) ? campaign : [campaign])]
  ]);
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); }, removeItem(key) { values.delete(key); }
  };
  const context = {
    alert() {}, console, document, localStorage, Math, setTimeout,
    navigator: { clipboard: { writeText(text) { clipboardWrites.push(text); return Promise.resolve(); } } }
  };
  if (fetchImpl) context.fetch = fetchImpl;
  vm.runInNewContext(fs.readFileSync(require.resolve("../js/script.js"), "utf8"), context);
  document.ready();
  return { document, created, clipboardWrites, localStorage, context };
}

test("active marketing work selects one latest version per business continuity chain with the correct status and action", function () {
  const campaigns = [
    { id: "draft-old", businessId: "business-a", originalMarketingWorkId: "draft-old", revisionNumber: 0, approvalStatus: "Approved" },
    { id: "draft-latest", businessId: "business-a", originalMarketingWorkId: "draft-old", revisionNumber: 2, approvalStatus: "Unapproved" },
    { id: "approved", businessId: "business-a", originalMarketingWorkId: "approved", revisionNumber: 0, approvalStatus: "Approved" },
    { id: "complete", businessId: "business-a", originalMarketingWorkId: "complete", revisionNumber: 0, approvalStatus: "Approved", outcome: { outcome: "Positive" } },
    { id: "other", businessId: "business-b", originalMarketingWorkId: "draft-old", revisionNumber: 9, approvalStatus: "Approved" }
  ];

  const work = getActiveMarketingWork(campaigns, "business-a");

  assert.deepEqual(work.map(function (entry) { return entry.campaign.id; }), ["draft-latest", "approved", "complete"]);
  assert.deepEqual(work.map(function (entry) { return entry.status; }), [
    "Draft — needs approval", "Approved — outcome needed", "Outcome recorded"
  ]);
  assert.deepEqual(work.map(function (entry) { return entry.action; }), [
    "Review Campaign", "Record Outcome", "View Campaign"
  ]);
  assert.deepEqual(getActiveMarketingWork(campaigns, "business-b").map(function (entry) { return entry.campaign.id; }), ["other"]);
  assert.deepEqual(getActiveMarketingWork(campaigns, null), []);
});

test("active-work actions open each exact latest stored version and Record Outcome brings its outcome controls into attention", function () {
  const campaigns = [
    { id: "draft-old", businessId: "business-a", originalMarketingWorkId: "draft-old", revisionNumber: 0,
      campaignType: "social", campaignText: "Old draft", approvalStatus: "Unapproved", promoText: "Old purpose" },
    { id: "draft-latest", businessId: "business-a", originalMarketingWorkId: "draft-old", revisionNumber: 1,
      campaignType: "social", campaignText: "Latest draft", approvalStatus: "Unapproved", promoText: "Current purpose" },
    { id: "approved", businessId: "business-a", originalMarketingWorkId: "approved", revisionNumber: 0,
      campaignType: "email", campaignText: "Approved exact", approvalStatus: "Approved" },
    { id: "complete", businessId: "business-a", originalMarketingWorkId: "complete", revisionNumber: 0,
      campaignType: "full", campaignText: "Complete exact", approvalStatus: "Approved", outcome: { outcome: "Mixed" } }
  ];
  const browser = createBrowser(campaigns);
  const actions = ["Review Campaign", "Record Outcome", "View Campaign"].map(function (label) {
    return browser.created.find(function (element) { return element.textContent === label; });
  });

  actions[0].listeners.click();
  assert.equal(browser.document.getElementById("results-content").textContent, "Latest draft");
  actions[1].listeners.click();
  assert.equal(browser.document.getElementById("results-content").textContent, "Approved exact");
  assert.equal(browser.document.getElementById("campaign-outcome").hidden, false);
  assert.equal(browser.document.getElementById("campaign-outcome").scrollCalls.length, 1);
  assert.equal(browser.document.getElementById("campaign-outcome-value").focusCalls, 1);
  actions[2].listeners.click();
  assert.equal(browser.document.getElementById("results-content").textContent, "Complete exact");

  browser.document.getElementById("add-business-btn").listeners.click();
  assert.equal(browser.document.getElementById("active-marketing-work-list").children.length, 0);
  assert.equal(browser.document.getElementById("active-marketing-work-empty").hidden, false);
});

test("opening a saved full campaign renders sections, copies the original, and clearing removes them", async function () {
  const campaign = { id: "full-1", businessId: "business-a", businessName: "Cafe", campaignType: "full",
    campaignText: fullCampaignText, approvalStatus: "Unapproved", createdAt: "2026-09-05T00:00:00.000Z" };
  const browser = createBrowser(campaign);

  browser.created.find(function (element) { return element.textContent === "Open"; }).listeners.click();
  const resultsContent = browser.document.getElementById("results-content");
  assert.equal(resultsContent.children.length, 5);
  assert.deepEqual(resultsContent.children.map(function (panel) { return panel.children[0].children[0].textContent; }),
    ["Campaign Strategy", "Social Media Post", "Email Campaign", "Short Ad Copy", "Call to Action"]);
  assert.equal(browser.created.filter(function (element) { return element.textContent === "Revise"; }).length, 5);

  resultsContent.children[1].children[0].children[2].listeners.click();
  assert.equal(browser.document.getElementById("revision-target-indicator").textContent, "Revising: Social Media Post");
  assert.equal(browser.document.getElementById("revision-target-indicator").hidden, false);

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
  assert.equal(browser.document.getElementById("revision-target-indicator").hidden, true);
});

test("section actions are absent when a full campaign cannot be parsed safely", function () {
  const campaign = { id: "bad-1", businessId: "business-a", campaignType: "full",
    campaignText: "CAMPAIGN STRATEGY\nOnly one section", createdAt: "2026-09-05T00:00:00.000Z" };
  const browser = createBrowser(campaign);
  browser.created.find(function (element) { return element.textContent === "Open"; }).listeners.click();
  assert.equal(browser.created.filter(function (element) { return element.textContent === "Revise"; }).length, 0);
});

test("opening another campaign and switching businesses clear the selected section", function () {
  const campaigns = ["one", "two"].map(function (id) { return { id, businessId: "business-a", campaignType: "full",
    campaignText: fullCampaignText, createdAt: `2026-09-0${id === "one" ? 5 : 4}T00:00:00.000Z` }; });
  const browser = createBrowser(campaigns);
  const opens = browser.created.filter(function (element) { return element.textContent === "Open"; });
  opens[0].listeners.click();
  browser.document.getElementById("results-content").children[0].children[0].children[2].listeners.click();
  opens[1].listeners.click();
  assert.equal(browser.document.getElementById("revision-target-indicator").hidden, true);
  assert.equal(browser.document.getElementById("revision-instruction").value, "");
  browser.document.getElementById("results-content").children[0].children[0].children[2].listeners.click();
  browser.document.getElementById("business-selector").value = "business-a";
  browser.document.getElementById("business-selector").listeners.change();
  assert.equal(browser.document.getElementById("revision-target-indicator").hidden, true);
});

test("Campaign Versions marks the open version and switches to the exact stored full campaign", function () {
  const revisedText = fullCampaignText.replace("Saturday delicious", "Sunday delicious");
  const campaigns = [
    { id: "revision", businessId: "business-a", originalMarketingWorkId: "original", revisionNumber: 1,
      campaignType: "full", campaignText: revisedText, approvalStatus: "Approved", createdAt: "2026-09-06T00:00:00.000Z" },
    { id: "other-chain", businessId: "business-a", originalMarketingWorkId: "other-chain", revisionNumber: 0,
      campaignType: "social", campaignText: "Unrelated", createdAt: "2026-09-07T00:00:00.000Z" },
    { id: "original", businessId: "business-a", originalMarketingWorkId: "original", revisionNumber: 0,
      campaignType: "full", campaignText: fullCampaignText, approvalStatus: "Unapproved", createdAt: "2026-09-05T00:00:00.000Z" }
  ];
  const browser = createBrowser(campaigns);
  browser.created.filter(function (element) { return element.textContent === "Open"; })[0].listeners.click();
  let versionButtons = browser.document.getElementById("campaign-versions-list").children;
  assert.deepEqual(versionButtons.map(function (button) { return button.textContent; }), ["Original", "Revision 1"]);
  assert.equal(versionButtons[1].attributes["aria-current"], "true");

  browser.document.getElementById("results-content").children[0].children[0].children[2].listeners.click();
  browser.document.getElementById("revision-instruction").value = "Discard this instruction";
  versionButtons[0].listeners.click();

  assert.equal(browser.document.getElementById("results-content").children.length, 5);
  assert.equal(browser.document.getElementById("results-content").children[3].children[1].textContent, "Make Saturday delicious.");
  assert.equal(browser.document.getElementById("campaign-approval-status").textContent, "Status: Unapproved");
  assert.equal(browser.document.getElementById("revision-target-indicator").hidden, true);
  assert.equal(browser.document.getElementById("revision-instruction").value, "");
  versionButtons = browser.document.getElementById("campaign-versions-list").children;
  assert.equal(versionButtons[0].attributes["aria-current"], "true");
});

test("Campaign Outcome appears only for approved versions and restores that exact version's feedback", function () {
  const campaigns = [
    { id: "revision", businessId: "business-a", originalMarketingWorkId: "original", revisionNumber: 1,
      campaignType: "social", campaignText: "Revised", approvalStatus: "Approved", createdAt: "2026-09-06",
      outcome: { outcome: "Positive", ownerNote: "More regulars returned.", savedAt: "2026-09-06T12:00:00.000Z" } },
    { id: "original", businessId: "business-a", originalMarketingWorkId: "original", revisionNumber: 0,
      campaignType: "social", campaignText: "Original", approvalStatus: "Unapproved", createdAt: "2026-09-05" }
  ];
  const browser = createBrowser(campaigns);
  browser.created.filter(function (element) { return element.textContent === "Open"; })[0].listeners.click();
  assert.equal(browser.document.getElementById("campaign-outcome").hidden, false);
  assert.equal(browser.document.getElementById("campaign-outcome-value").value, "Positive");
  assert.equal(browser.document.getElementById("campaign-outcome-note").value, "More regulars returned.");

  browser.document.getElementById("campaign-versions-list").children[0].listeners.click();
  assert.equal(browser.document.getElementById("campaign-outcome").hidden, true);
  assert.equal(browser.document.getElementById("campaign-outcome-value").value, "");
  assert.equal(browser.document.getElementById("campaign-outcome-note").value, "");
});

test("saving an outcome updates only the open approved version and preserves campaign content and approval", async function () {
  const campaign = { id: "approved-a", businessId: "business-a", campaignType: "social", campaignText: "Do not change",
    approvalStatus: "Approved", createdAt: "2026-09-05" };
  const browser = createBrowser(campaign, async function () {});
  browser.context.fetch = async function (url, options) {
    assert.equal(url, "/api/businesses/business-a/campaigns/approved-a/outcome");
    assert.deepEqual(JSON.parse(options.body), { outcome: "Mixed", ownerNote: "A few guests mentioned it." });
    return { ok: true, async json() { return { outcome: { outcome: "Mixed", ownerNote: "A few guests mentioned it.", savedAt: "2026-09-06T12:00:00.000Z" } }; } };
  };
  browser.created.find(function (element) { return element.textContent === "Open"; }).listeners.click();
  browser.document.getElementById("campaign-outcome-value").value = "Mixed";
  browser.document.getElementById("campaign-outcome-note").value = "A few guests mentioned it.";
  await browser.document.getElementById("save-campaign-outcome").listeners.click();

  const saved = JSON.parse(browser.localStorage.getItem("demeosCampaignHistory"))[0];
  assert.equal(saved.campaignText, "Do not change");
  assert.equal(saved.approvalStatus, "Approved");
  assert.equal(saved.outcome.outcome, "Mixed");
  assert.equal(browser.document.getElementById("campaign-outcome-value").value, "Mixed");
});

test("social and email campaigns expose their continuity chains in Campaign Versions", function () {
  ["social", "email"].forEach(function (type) {
    const campaigns = [
      { id: `${type}-revision`, businessId: "business-a", originalMarketingWorkId: `${type}-original`, revisionNumber: 1,
        campaignType: type, campaignText: `${type} revised`, createdAt: "2026-09-06" },
      { id: `${type}-original`, businessId: "business-a", originalMarketingWorkId: `${type}-original`, revisionNumber: 0,
        campaignType: type, campaignText: `${type} original`, createdAt: "2026-09-05" }
    ];
    const browser = createBrowser(campaigns);
    browser.created.filter(function (element) { return element.textContent === "Open"; })[0].listeners.click();
    const buttons = browser.document.getElementById("campaign-versions-list").children;
    assert.deepEqual(buttons.map(function (button) { return button.textContent; }), ["Original", "Revision 1"]);
    buttons[0].listeners.click();
    assert.equal(browser.document.getElementById("results-content").textContent, `${type} original`);
  });
});

test("a successful section revision sends its target, saves continuity, and renders the complete campaign", async function () {
  const source = { id: "full-1", businessId: "business-a", campaignType: "full", campaignTypeLabel: "Full Marketing Campaign",
    campaignText: fullCampaignText, promoText: "Saturday dinner", createdAt: "2026-09-05T00:00:00.000Z" };
  const revised = fullCampaignText.replace("Dinner plans?", "Saturday plans?");
  const browser = createBrowser(source);
  const requests = [];
  browser.context.fetch = async function (url, options) {
    requests.push({ url, body: options.body ? JSON.parse(options.body) : null });
    return { ok: true, status: 200, async text() {
      return url === "/api/generate" ? JSON.stringify({ campaign: revised }) : "{}";
    } };
  };

  browser.created.find(function (element) { return element.textContent === "Open"; }).listeners.click();
  browser.document.getElementById("results-content").children[1].children[0].children[2].listeners.click();
  browser.document.getElementById("revision-instruction").value = "Make the opening more direct.";
  await browser.document.getElementById("revise-btn").listeners.click();

  assert.equal(requests[0].body.revisionTarget, "social_media_post");
  assert.equal(requests[0].body.existingCampaign, fullCampaignText);
  const history = JSON.parse(browser.localStorage.getItem("demeosCampaignHistory"));
  assert.equal(history[0].campaignText, revised);
  assert.equal(history[0].originalMarketingWorkId, source.id);
  assert.equal(history[0].revisionNumber, 1);
  assert.equal(browser.document.getElementById("results-content").children.length, 5);
  assert.equal(browser.document.getElementById("revision-target-indicator").hidden, true);
  assert.equal(browser.document.getElementById("revision-instruction").value, "");
  const versions = browser.document.getElementById("campaign-versions-list").children;
  assert.deepEqual(versions.map(function (button) { return button.textContent; }), ["Original", "Revision 1"]);
  assert.equal(versions[1].attributes["aria-current"], "true");
});
