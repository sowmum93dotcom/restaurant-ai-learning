const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getOwnerNavigationSection,
  updateOwnerNavigation,
  syncOwnerWorkspaceFromLocation
} = require("../js/business-workspace.js");

const destinations = [
  [{ pathname: "/business-workspace.html", hash: "" }, "overview"],
  [{ pathname: "/index.html", hash: "#business-profile" }, "business-profile"],
  [{ pathname: "/index.html", hash: "#recommends" }, "recommends"],
  [{ pathname: "/index.html", hash: "" }, "marketing"],
  [{ pathname: "/business-results.html", hash: "" }, "results"]
];

function makeItem(attributeName, attributeValue, active) {
  const attributes = { [attributeName]: attributeValue };
  const classes = new Set(active ? ["is-active"] : []);
  return {
    id: attributeName === "id" ? attributeValue : undefined,
    hidden: false,
    classList: { toggle: function (name, enabled) { enabled ? classes.add(name) : classes.delete(name); } },
    getAttribute: function (name) { return attributes[name]; },
    setAttribute: function (name, value) { attributes[name] = value; },
    removeAttribute: function (name) { delete attributes[name]; },
    isActive: function () { return classes.has("is-active"); },
    current: function () { return attributes["aria-current"]; }
  };
}

test("each Business Owner Workspace destination resolves its own navigation section", function () {
  destinations.forEach(function ([location, expected]) {
    assert.equal(getOwnerNavigationSection(location), expected);
  });
});

test("owner navigation has exactly one active item for every destination", function () {
  destinations.forEach(function ([location, expected]) {
    const links = destinations.map(function ([, section]) {
      return makeItem("data-owner-section", section, true);
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

test("clearing the index hash restores the Marketing overview and primary navigation", function () {
  const panels = [makeItem("id", "overview", false), makeItem("id", "recommends", true)];
  panels[0].id = "overview";
  panels[1].id = "recommends";
  panels[0].hidden = true;
  panels[1].hidden = false;
  const workspaceButtons = [
    makeItem("data-workspace-view", "overview", false),
    makeItem("data-workspace-view", "recommends", true)
  ];
  const ownerLinks = [
    makeItem("data-owner-section", "overview", false),
    makeItem("data-owner-section", "business-profile", false),
    makeItem("data-owner-section", "recommends", true),
    makeItem("data-owner-section", "marketing", false),
    makeItem("data-owner-section", "results", false)
  ];
  const documentObject = {
    querySelectorAll: function (selector) {
      if (selector === "[data-workspace-panel]") return panels;
      if (selector === "[data-workspace-view]") return workspaceButtons;
      if (selector === ".owner-workspace-navigation [data-owner-section]") return ownerLinks;
      return [];
    }
  };

  assert.equal(syncOwnerWorkspaceFromLocation(documentObject, { pathname: "/index.html", hash: "" }), true);
  assert.equal(panels[0].hidden, false);
  assert.equal(panels[0].isActive(), true);
  assert.equal(panels[1].hidden, true);
  assert.equal(panels[1].isActive(), false);
  assert.equal(workspaceButtons[0].isActive(), true);
  assert.equal(workspaceButtons[0].current(), "page");
  assert.equal(workspaceButtons[1].isActive(), false);
  assert.equal(ownerLinks.find(function (link) { return link.getAttribute("data-owner-section") === "marketing"; }).isActive(), true);
  assert.equal(ownerLinks.find(function (link) { return link.getAttribute("data-owner-section") === "recommends"; }).isActive(), false);
});

test("location sync leaves nonempty hashes and non-Marketing pages to their existing handlers", function () {
  const documentObject = { querySelectorAll: function () { throw new Error("should not inspect DOM"); } };
  assert.equal(syncOwnerWorkspaceFromLocation(documentObject, { pathname: "/index.html", hash: "#recommends" }), false);
  assert.equal(syncOwnerWorkspaceFromLocation(documentObject, { pathname: "/business-results.html", hash: "" }), false);
});
