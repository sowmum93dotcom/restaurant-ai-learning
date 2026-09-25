const test = require("node:test");
const assert = require("node:assert/strict");
const { loadCustomerWork } = require("../js/customer.js");

function createDiscoverDocument() {
  const list = { textContent: "Previously displayed business content" };
  const status = {
    className: "",
    textContent: "",
    children: [],
    appendChild(child) { this.children.push(child); }
  };
  const navigationHint = { hidden: true };
  const document = {
    querySelector(selector) { return selector === ".customer-discover-navigation-hint" ? navigationHint : null; },
    getElementById(id) {
      return id === "customer-work-list" ? list : id === "customer-work-status" ? status : null;
    },
    createElement(tag) {
      assert.equal(tag, "button");
      return { type: "", className: "", textContent: "", disabled: false, addEventListener(event, callback) { this[event] = callback; } };
    }
  };
  return { document, list, status, navigationHint };
}

test("failed Discover request clears previously displayed cards and offers retry", async () => {
  const { document, list, status } = createDiscoverDocument();
  await loadCustomerWork(document, async () => { throw new Error("network unavailable"); }, { search: "" });
  assert.equal(list.textContent, "");
  assert.equal(status.className, "customer-empty-state customer-load-error");
  assert.equal(status.children.length, 1);
  assert.equal(status.children[0].textContent, "Try again");
});

test("invalid live response clears stale cards rather than showing test content", async () => {
  const { document, list, status } = createDiscoverDocument();
  await loadCustomerWork(document, async () => ({
    ok: true,
    json: async () => ({ testMode: true, work: [] })
  }), { search: "" });
  assert.equal(list.textContent, "");
  assert.equal(status.className, "customer-empty-state customer-load-error");
  assert.equal(status.children[0].textContent, "Try again");
});

test("older failed request cannot clear a newer successful Discover state", async () => {
  const { document, list, status } = createDiscoverDocument();
  let rejectOlder;
  const older = loadCustomerWork(document, () => new Promise((resolve, reject) => { rejectOlder = reject; }), { search: "" });
  const newer = loadCustomerWork(document, async () => ({ ok: true, json: async () => ({ work: [] }) }), { search: "" });
  await newer;
  assert.equal(status.className, "customer-empty-state");
  rejectOlder(new Error("older network failure"));
  await older;
  assert.equal(status.className, "customer-empty-state");
  assert.equal(status.children.length, 0);
  assert.equal(list.textContent, "");
});

test("older successful response cannot replace newer Discover state", async () => {
  const { document, status } = createDiscoverDocument();
  let resolveOlder;
  const older = loadCustomerWork(document, () => new Promise(resolve => { resolveOlder = resolve; }), { search: "" });
  const newer = loadCustomerWork(document, async () => ({ ok: true, json: async () => ({ work: [] }) }), { search: "" });
  await newer;
  resolveOlder({ ok: true, json: async () => ({ work: [{ businessName: "Stale business" }] }) });
  await older;
  assert.equal(status.className, "customer-empty-state");
  assert.equal(status.children.length, 0);
});

test("empty Discover keeps navigation guidance hidden", async () => {
  const { document, navigationHint } = createDiscoverDocument();
  navigationHint.hidden = false;
  await loadCustomerWork(document, async () => ({
    ok: true,
    json: async () => ({ work: [] })
  }), { search: "" });
  assert.equal(navigationHint.hidden, true);
});

test("failed Discover refresh hides previously visible navigation guidance", async () => {
  const { document, navigationHint } = createDiscoverDocument();
  navigationHint.hidden = false;
  await loadCustomerWork(document, async () => { throw new Error("offline"); }, { search: "" });
  assert.equal(navigationHint.hidden, true);
});

test("outdated failed request cannot hide newer navigation state", async () => {
  const { document, navigationHint } = createDiscoverDocument();
  let rejectOlder;
  const older = loadCustomerWork(document, () => new Promise((resolve, reject) => { rejectOlder = reject; }), { search: "" });
  const newer = loadCustomerWork(document, async () => ({
    ok: true,
    json: async () => ({ work: [] })
  }), { search: "" });
  await newer;
  navigationHint.hidden = false;
  rejectOlder(new Error("late failure"));
  await older;
  assert.equal(navigationHint.hidden, false);
});
