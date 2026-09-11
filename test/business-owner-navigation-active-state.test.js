const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getOwnerNavigationSection,
  updateOwnerNavigation
} = require("../js/business-workspace.js");

const destinations = [
  [{ pathname: "/business-workspace.html", hash: "" }, "overview"],
  [{ pathname: "/index.html", hash: "#business-profile" }, "business-profile"],
  [{ pathname: "/index.html", hash: "#recommends" }, "recommends"],
  [{ pathname: "/index.html", hash: "" }, "marketing"],
  [{ pathname: "/business-results.html", hash: "" }, "results"]
];

test("each Business Owner Workspace destination resolves its own navigation section", function () {
  destinations.forEach(function ([location, expected]) {
    assert.equal(getOwnerNavigationSection(location), expected);
  });
});

test("owner navigation has exactly one active item for every destination", function () {
  destinations.forEach(function ([location, expected]) {
    const links = destinations.map(function ([, section]) {
      const attributes = { "data-owner-section": section };
      const classes = new Set(["is-active"]);
      return {
        classList: { toggle: function (name, enabled) { enabled ? classes.add(name) : classes.delete(name); } },
        getAttribute: function (name) { return attributes[name]; },
        setAttribute: function (name, value) { attributes[name] = value; },
        removeAttribute: function (name) { delete attributes[name]; },
        isActive: function () { return classes.has("is-active"); },
        current: function () { return attributes["aria-current"]; }
      };
    });
    const documentObject = { querySelectorAll: function () { return links; } };

    assert.equal(updateOwnerNavigation(documentObject, location), expected);
    links.forEach(function (link) {
      const active = link.getAttribute("data-owner-section") === expected;
      assert.equal(link.isActive(), active);
      assert.equal(link.current(), active ? "page" : undefined);
    });
  });
});

test("displayed profile and recommendation views override Marketing without changing its logic", function () {
  assert.equal(getOwnerNavigationSection({ pathname: "/index.html", hash: "" }, "business-profile"), "business-profile");
  assert.equal(getOwnerNavigationSection({ pathname: "/index.html", hash: "" }, "recommends"), "recommends");
  assert.equal(getOwnerNavigationSection({ pathname: "/index.html", hash: "" }, "campaigns"), "marketing");
});
