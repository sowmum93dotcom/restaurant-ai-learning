const assert = require("node:assert/strict");
const test = require("node:test");

const { bindOwnerClerkSession } = require("../js/business-workspace.js");

function elements() {
  return {
    loading: { hidden: false }, signedOut: { hidden: true }, signedIn: { hidden: true },
    error: { hidden: true }, account: { hidden: true },
    signIn: { addEventListener: function () {} },
    signOut: { addEventListener: function () {} }
  };
}

function storage() {
  return {
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function () {}
  };
}

function documentWithReload(counter) {
  const nodes = {
    "workspace-business-identity": { replaceChildren: function () {}, appendChild: function () {}, textContent: "" },
    "workspace-current-work": { replaceChildren: function () {}, appendChild: function () {}, textContent: "" },
    "workspace-header-business": { textContent: "" }
  };
  return {
    defaultView: { location: { reload: function () { counter.count += 1; } } },
    getElementById: function (id) { return nodes[id] || null; },
    createElement: function () { return { textContent: "", append: function () {} }; }
  };
}

test("a fresh Clerk sign-in refreshes once so authorized businesses are loaded", function () {
  const counter = { count: 0 };
  const clerk = {
    user: null,
    addListener: function (listener) { this.listener = listener; },
    openSignIn: function () {},
    signOut: function () {}
  };
  bindOwnerClerkSession(clerk, documentWithReload(counter), storage(), elements());
  clerk.listener({ user: { id: "owner" } });
  assert.equal(counter.count, 1);
  clerk.listener({ user: { id: "owner" } });
  assert.equal(counter.count, 1);
});

test("an already signed-in Clerk session does not reload on initial binding", function () {
  const counter = { count: 0 };
  const clerk = {
    user: { id: "owner" },
    addListener: function (listener) { this.listener = listener; },
    openSignIn: function () {},
    signOut: function () {}
  };
  bindOwnerClerkSession(clerk, documentWithReload(counter), storage(), elements());
  assert.equal(counter.count, 0);
});
