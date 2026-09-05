const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const {
  addBusinessIdentity,
  createCampaignContinuity,
  getCampaignBusinessId,
  getCampaignContinuity,
  getCampaignContinuityLabel
} = require("../js/script.js");

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

test("saving a profile gives a newly generated Original the same business ID", async function () {
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
  const storage = new Map();
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

  const fields = {
    "business-name": "Restaurant",
    "business-type": "Cafe",
    "business-location": "Cardiff",
    "business-brand-voice": "Warm",
    "business-target-customer": "Neighbours",
    "business-goal": "Grow"
  };
  Object.entries(fields).forEach(function ([id, value]) {
    document.getElementById(id).value = value;
  });
  document.getElementById("save-business-profile-btn").listeners.click();

  const firstProfile = JSON.parse(storage.get("demeosBusinessProfile"));
  document.getElementById("business-name").value = "Renamed Restaurant";
  document.getElementById("save-business-profile-btn").listeners.click();
  const secondProfile = JSON.parse(storage.get("demeosBusinessProfile"));
  document.getElementById("promo-input").value = "Lunch offer";
  document.getElementById("campaign-type").value = "social";
  await document.getElementById("generate-btn").listeners.click();

  const history = JSON.parse(storage.get("demeosCampaignHistory"));
  assert.ok(firstProfile.businessId);
  assert.equal(secondProfile.businessId, firstProfile.businessId);
  assert.equal(history[0].businessId, firstProfile.businessId);
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
