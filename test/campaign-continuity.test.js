const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const {
  addBusinessIdentity,
  canAccessCampaign,
  createCampaignContinuity,
  enforceBusinessCampaignLimit,
  getCampaignBusinessId,
  getCampaignContinuity,
  getCampaignContinuityLabel,
  getVisibleCampaigns
} = require("../js/script.js");

test("campaign history shows matching and legacy records but hides other businesses", function () {
  const profile = { businessId: "business-current" };
  const matching = { id: "matching", businessId: "business-current" };
  const different = { id: "different", businessId: "business-other" };
  const legacy = { id: "legacy" };

  assert.deepEqual(getVisibleCampaigns([matching, different, legacy], profile), [matching, legacy]);
  assert.equal(canAccessCampaign(matching, profile), true);
  assert.equal(canAccessCampaign(different, profile), false);
  assert.equal(canAccessCampaign(legacy, profile), true);
});

test("retention evicts only an eligible record from the current business", function () {
  const campaigns = [
    { id: "new", businessId: "current" },
    { id: "other-new", businessId: "other" },
    { id: "current-middle", businessId: "current" },
    { id: "legacy" },
    { id: "current-old", businessId: "current" },
    { id: "other-old", businessId: "other" }
  ];

  const retained = enforceBusinessCampaignLimit(campaigns, "current", 2, ["new"]);

  assert.deepEqual(retained.map(function (campaign) { return campaign.id; }), [
    "new", "other-new", "current-middle", "legacy", "other-old"
  ]);
});

test("retention protects the exact revision source while removing another same-business record", function () {
  const campaigns = [
    { id: "revision", businessId: "current" },
    { id: "eligible", businessId: "current" },
    { id: "source", businessId: "current" }
  ];

  const retained = enforceBusinessCampaignLimit(campaigns, "current", 2, ["revision", "source"]);

  assert.deepEqual(retained.map(function (campaign) { return campaign.id; }), ["revision", "source"]);
});

test("a first profile save creates a business ID and later saves preserve it", function () {
  const firstSave = addBusinessIdentity({ name: "Restaurant" }, null);
  const secondSave = addBusinessIdentity({ name: "Renamed Restaurant" }, firstSave);

  assert.equal(typeof firstSave.businessId, "string");
  assert.ok(firstSave.businessId.length > 0);
  assert.equal(secondSave.businessId, firstSave.businessId);
});

test("campaign identity comes from the profile for originals and the source for revisions", function () {
  const profile = { businessId: "business-current" };

  assert.equal(getCampaignBusinessId(profile), "business-current");
  assert.equal(
    getCampaignBusinessId(profile, { businessId: "business-original" }),
    "business-original"
  );
  assert.equal(getCampaignBusinessId(profile, { id: "legacy-campaign" }), "business-current");
});

test("an original progresses through Revision 1 and Revision 2", function () {
  const original = {
    id: "campaign-original",
    ...createCampaignContinuity("campaign-original")
  };
  const revisionOne = {
    id: "campaign-revision-1",
    ...createCampaignContinuity("campaign-revision-1", original)
  };
  const revisionTwo = {
    id: "campaign-revision-2",
    ...createCampaignContinuity("campaign-revision-2", revisionOne)
  };

  assert.equal(getCampaignContinuityLabel(original), "Original");
  assert.equal(getCampaignContinuityLabel(revisionOne), "Revision 1");
  assert.equal(getCampaignContinuityLabel(revisionTwo), "Revision 2");
  assert.equal(revisionOne.originalMarketingWorkId, original.id);
  assert.equal(revisionTwo.originalMarketingWorkId, original.id);
});

test("creating a revision does not change the source version approval", function () {
  const approvedOriginal = {
    id: "approved-original",
    approvalStatus: "Approved",
    ...createCampaignContinuity("approved-original")
  };

  const revision = createCampaignContinuity("new-revision", approvedOriginal);

  assert.equal(approvedOriginal.approvalStatus, "Approved");
  assert.equal(revision.revisionNumber, 1);
});

test("a legacy campaign without continuity data opens as an Original", function () {
  const legacyCampaign = {
    id: "legacy-campaign",
    campaignText: "Legacy campaign content",
    approvalStatus: "Approved"
  };

  assert.deepEqual(getCampaignContinuity(legacyCampaign), {
    originalMarketingWorkId: "legacy-campaign",
    revisionNumber: 0
  });
  assert.equal(getCampaignContinuityLabel(legacyCampaign), "Original");
  assert.equal(legacyCampaign.campaignText, "Legacy campaign content");
  assert.equal(legacyCampaign.approvalStatus, "Approved");
});

test("generating with a legacy saved profile persists its new business ID on the Original", async function () {
  class FakeElement {
    constructor() {
      this.listeners = {};
      this.options = [{ text: "Social Media Post" }];
      this.selectedIndex = 0;
      this.value = "";
      this.textContent = "";
      this.hidden = false;
      this.classList = { toggle() {} };
    }

    addEventListener(eventName, listener) { this.listeners[eventName] = listener; }
    append() {}
    appendChild() {}
    prepend() {}
    scrollIntoView() {}
  }

  const elements = new Map();
  const document = {
    addEventListener(eventName, listener) {
      if (eventName === "DOMContentLoaded") this.ready = listener;
    },
    createElement() { return new FakeElement(); },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new FakeElement());
      return elements.get(id);
    }
  };
  const legacyProfile = {
    name: "Restaurant",
    type: "Cafe",
    location: "Cardiff",
    brandVoice: "Warm",
    targetCustomer: "Neighbours",
    goal: "Grow",
    legacyField: { preserved: true }
  };
  const storage = new Map([
    ["demeosBusinessProfile", JSON.stringify(legacyProfile)]
  ]);
  const context = {
    alert() {},
    console,
    document,
    fetch: async function () {
      return {
        ok: true,
        status: 200,
        async text() { return JSON.stringify({ campaign: "Original campaign" }); }
      };
    },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, value); }
    },
    Math,
    setTimeout
  };

  vm.runInNewContext(fs.readFileSync(require.resolve("../js/script.js"), "utf8"), context);
  document.ready();

  const migratedProfile = JSON.parse(storage.get("demeosBusinessProfile"));
  document.getElementById("promo-input").value = "Lunch offer";
  document.getElementById("campaign-type").value = "social";
  await document.getElementById("generate-btn").listeners.click();

  const history = JSON.parse(storage.get("demeosCampaignHistory"));
  assert.ok(migratedProfile.businessId);
  assert.deepEqual(
    JSON.parse(JSON.stringify(migratedProfile)),
    { ...legacyProfile, businessId: migratedProfile.businessId }
  );
  assert.equal(history[0].businessId, migratedProfile.businessId);
  assert.equal(history[0].revisionNumber, 0);
});

test("the application makes each saved revision the source of the next revision", async function () {
  class FakeElement {
    constructor() {
      this.listeners = {};
      this.options = [{ text: "Social Media Post" }];
      this.selectedIndex = 0;
      this.value = "";
      this.textContent = "";
      this.hidden = false;
      this.classList = { toggle() {} };
    }

    addEventListener(eventName, listener) {
      this.listeners[eventName] = listener;
    }

    append() {}
    appendChild() {}
    prepend() {}
    scrollIntoView() {}
  }

  const elements = new Map();
  const createdElements = [];
  const document = {
    addEventListener(eventName, listener) {
      if (eventName === "DOMContentLoaded") this.ready = listener;
    },
    createElement() {
      const element = new FakeElement();
      createdElements.push(element);
      return element;
    },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new FakeElement());
      return elements.get(id);
    }
  };
  const original = {
    id: "campaign-original",
    campaignText: "Original content",
    campaignType: "social",
    campaignTypeLabel: "Social Media Post",
    promoText: "Promotion",
    approvalStatus: "Approved",
    originalMarketingWorkId: "campaign-original",
    revisionNumber: 0,
    businessId: "business-restaurant"
  };
  const storage = new Map([
    ["demeosBusinessProfile", JSON.stringify({ name: "Restaurant", businessId: "business-restaurant" })],
    ["demeosCampaignHistory", JSON.stringify([original])]
  ]);
  const requestBodies = [];
  const revisionTexts = ["Revision one content", "Revision two content", "Revision three content"];
  let nextId = 1;
  const context = {
    alert() {},
    console,
    Date: class extends Date {
      static now() {
        return nextId++;
      }
    },
    document,
    fetch: async function (url, options) {
      requestBodies.push(JSON.parse(options.body));
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ campaign: revisionTexts[requestBodies.length - 1] });
        }
      };
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, value);
      }
    },
    Math,
    setTimeout
  };

  vm.runInNewContext(fs.readFileSync(require.resolve("../js/script.js"), "utf8"), context);
  document.ready();

  const revisionInstruction = document.getElementById("revision-instruction");
  const revise = document.getElementById("revise-btn").listeners.click;

  // Open the original through the real history UI before following the revision path.
  const originalOpenButton = createdElements.find(function (element) {
    return element.textContent === "Open" && element.listeners.click;
  });
  originalOpenButton.listeners.click();

  for (let index = 0; index < revisionTexts.length; index += 1) {
    revisionInstruction.value = `Change ${index + 1}`;
    await revise();
  }

  const history = JSON.parse(storage.get("demeosCampaignHistory"));
  assert.deepEqual(
    Array.from(history, function (campaign) { return campaign.revisionNumber; }),
    [3, 2, 1, 0]
  );
  assert.ok(history.every(function (campaign) {
    return campaign.originalMarketingWorkId === original.id;
  }));
  assert.ok(history.every(function (campaign) {
    return campaign.businessId === original.businessId;
  }));
  assert.deepEqual(
    Array.from(requestBodies, function (body) { return body.existingCampaign; }),
    [original.campaignText, revisionTexts[0], revisionTexts[1]]
  );
  assert.equal(history[3].approvalStatus, "Approved");
  assert.ok(history.slice(0, 3).every(function (campaign) {
    return campaign.approvalStatus === "Unapproved";
  }));
});

test("Open, Revise, and Approve reject a campaign reassigned to another business", async function () {
  class FakeElement {
    constructor() {
      this.listeners = {};
      this.options = [{ text: "Social Media Post" }];
      this.selectedIndex = 0;
      this.value = "";
      this.textContent = "";
      this.hidden = false;
      this.classList = { toggle() {} };
    }

    addEventListener(eventName, listener) { this.listeners[eventName] = listener; }
    append() {}
    appendChild() {}
    prepend() {}
    scrollIntoView() {}
  }

  const elements = new Map();
  const createdElements = [];
  const document = {
    addEventListener(eventName, listener) {
      if (eventName === "DOMContentLoaded") this.ready = listener;
    },
    createElement() {
      const element = new FakeElement();
      createdElements.push(element);
      return element;
    },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new FakeElement());
      return elements.get(id);
    }
  };
  const matching = {
    id: "matching",
    businessId: "current",
    campaignText: "Matching content",
    campaignType: "social",
    approvalStatus: "Unapproved"
  };
  const other = {
    id: "other",
    businessId: "other",
    campaignText: "Other content",
    approvalStatus: "Unapproved"
  };
  const legacy = {
    id: "legacy",
    campaignText: "Legacy content",
    campaignType: "social",
    approvalStatus: "Unapproved"
  };
  const storage = new Map([
    ["demeosBusinessProfile", JSON.stringify({ name: "Restaurant", businessId: "current" })],
    ["demeosCampaignHistory", JSON.stringify([matching, other, legacy])]
  ]);
  const alerts = [];
  let fetchCount = 0;
  const context = {
    alert(message) { alerts.push(message); },
    console,
    document,
    fetch: async function () { fetchCount += 1; },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, value); }
    },
    Math,
    setTimeout
  };

  vm.runInNewContext(fs.readFileSync(require.resolve("../js/script.js"), "utf8"), context);
  document.ready();

  const openButtons = createdElements.filter(function (element) {
    return element.textContent === "Open" && element.listeners.click;
  });
  assert.equal(openButtons.length, 2, "the other-business campaign is not rendered");

  openButtons[1].listeners.click();
  assert.equal(document.getElementById("results-content").textContent, "Legacy content");

  openButtons[0].listeners.click();
  assert.equal(document.getElementById("results-content").textContent, "Matching content");

  matching.businessId = "other";
  storage.set("demeosCampaignHistory", JSON.stringify([matching, other, legacy]));
  openButtons[0].listeners.click();

  document.getElementById("revision-instruction").value = "Change this";
  await document.getElementById("revise-btn").listeners.click();
  document.getElementById("approve-btn").listeners.click();

  assert.equal(fetchCount, 0);
  assert.deepEqual(alerts, [
    "This campaign belongs to a different business profile.",
    "This campaign belongs to a different business profile.",
    "This campaign belongs to a different business profile."
  ]);
  assert.equal(JSON.parse(storage.get("demeosCampaignHistory"))[0].approvalStatus, "Unapproved");
});
