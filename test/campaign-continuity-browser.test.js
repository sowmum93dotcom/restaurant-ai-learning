const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

class FakeElement {
  constructor() {
    this.listeners = {};
    this.classList = { toggle() {} };
    this.options = [{ text: "Full Marketing Campaign" }];
    this.selectedIndex = 0;
    this.value = "";
    this.textContent = "";
    this.hidden = false;
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  append() {}
  appendChild() {}
  prepend() {}
  scrollIntoView() {}

  async click() {
    await this.listeners.click();
  }
}

test("browser workflow revises the newly saved Revision 1 into Revision 2", async function () {
  const elements = new Map();
  const localStorageValues = new Map();
  const generatedCampaigns = ["Original copy", "Revision one copy", "Revision two copy"];
  let domContentLoaded;

  const document = {
    addEventListener(type, listener) {
      if (type === "DOMContentLoaded") domContentLoaded = listener;
    },
    createElement() {
      return new FakeElement();
    },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new FakeElement());
      return elements.get(id);
    }
  };
  const localStorage = {
    getItem(key) {
      return localStorageValues.has(key) ? localStorageValues.get(key) : null;
    },
    setItem(key, value) {
      localStorageValues.set(key, value);
    }
  };
  const context = {
    alert() {},
    console,
    document,
    fetch: async function () {
      const campaign = generatedCampaigns.shift();
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ campaign });
        }
      };
    },
    localStorage,
    Math,
    Date,
    setTimeout
  };

  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../js/script.js"), "utf8"),
    context
  );
  domContentLoaded();

  localStorage.setItem("demeosBusinessProfile", JSON.stringify({
    name: "DEMEOS Test Restaurant",
    type: "Restaurant",
    location: "London",
    brandVoice: "Warm",
    targetCustomer: "Families",
    goal: "Increase visits"
  }));
  elements.get("promo-input").value = "Promote dinner";
  elements.get("campaign-type").value = "full";

  await elements.get("generate-btn").click();
  elements.get("revision-instruction").value = "Make the first revision";
  await elements.get("revise-btn").click();
  elements.get("revision-instruction").value = "Make the second revision";
  await elements.get("revise-btn").click();

  const history = JSON.parse(localStorage.getItem("demeosCampaignHistory"));
  assert.deepEqual(
    history.map(function (campaign) { return campaign.revisionNumber; }),
    [2, 1, 0]
  );
  assert.equal(history[0].originalMarketingWorkId, history[2].id);
  assert.equal(history[1].originalMarketingWorkId, history[2].id);
});
