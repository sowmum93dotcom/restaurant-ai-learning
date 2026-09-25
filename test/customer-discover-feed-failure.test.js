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
  const document = {
    getElementById(id) {
      return id === "customer-work-list" ? list : id === "customer-work-status" ? status : null;
    },
    createElement(tag) {
      assert.equal(tag, "button");
      return { type: "", className: "", textContent: "", disabled: false, addEventListener(event, callback) { this[event] = callback; } };
    }
  };
  return { document, list, status };
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
