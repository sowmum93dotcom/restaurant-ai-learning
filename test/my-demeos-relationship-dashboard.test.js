const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const dashboard = require("../js/my-demeos.js");
const html = fs.readFileSync(path.join(__dirname, "..", "my-demeos.html"), "utf8");

class TestElement {
  constructor(id) {
    this.id = id;
    this.hidden = false;
    this.listeners = {};
    this.attributes = {};
    this.heading = null;
    this.focused = false;
    this.clickCount = 0;
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  click() { this.clickCount += 1; if (this.listeners.click) this.listeners.click(); }
  focus() { this.focused = true; }
  getAttribute(name) { return this.attributes[name]; }
  querySelector(selector) { return selector === "h2" ? this.heading : null; }
}

function dashboardDocument() {
  const overview = new TestElement("my-demeos-overview");
  const signIn = new TestElement("customer-sign-in");
  const relationships = ["my-intentions", "my-possibilities", "my-participation"].map(function (id) {
    const trigger = new TestElement("open-" + id);
    const view = new TestElement(id);
    const heading = new TestElement(id + "-heading");
    const back = new TestElement(id + "-back");
    const enter = new TestElement(id + "-enter");
    trigger.attributes["data-relationship-area"] = id;
    view.heading = heading;
    view.hidden = true;
    return { trigger, view, heading, back, enter };
  });
  const elements = { "my-demeos-overview": overview, "customer-sign-in": signIn };
  relationships.forEach(function (item) { elements[item.view.id] = item.view; });
  return {
    overview, signIn, relationships,
    getElementById(id) { return elements[id] || null; },
    querySelectorAll(selector) {
      if (selector === "[data-relationship-area]") return relationships.map((item) => item.trigger);
      if (selector === ".my-demeos-relationship-view") return relationships.map((item) => item.view);
      if (selector === "[data-relationship-back]") return relationships.map((item) => item.back);
      if (selector === ".relationship-sign-in") return relationships.map((item) => item.enter);
      return [];
    }
  };
}

test("the three implemented relationship areas are native controls tied to their real views", function () {
  for (const id of ["my-intentions", "my-possibilities", "my-participation"]) {
    assert.match(html, new RegExp(`<button id="open-${id}"[^>]+type="button"[^>]+aria-controls="${id}"[^>]+data-relationship-area="${id}"`));
    assert.match(html, new RegExp(`<div id="${id}" class="my-demeos-relationship-view"[^>]+hidden>`));
  }
  assert.equal((html.match(/data-relationship-back/g) || []).length, 3);
  assert.equal((html.match(/Back to My DEMEOS/g) || []).length, 3);
});

test("each relationship control opens its matching view, focuses its heading, and Back restores focus", function () {
  const documentObject = dashboardDocument();
  dashboard.setupRelationshipDashboard(documentObject);

  documentObject.relationships.forEach(function (selected) {
    selected.trigger.click();
    assert.equal(documentObject.overview.hidden, true);
    documentObject.relationships.forEach(function (candidate) {
      assert.equal(candidate.view.hidden, candidate !== selected);
    });
    assert.equal(selected.heading.focused, true);

    selected.back.click();
    assert.equal(documentObject.overview.hidden, false);
    assert.equal(selected.trigger.focused, true);
    assert.ok(documentObject.relationships.every((item) => item.view.hidden));
  });
});

test("native buttons provide keyboard operation and detail entry reuses the existing authentication action", function () {
  const documentObject = dashboardDocument();
  dashboard.setupRelationshipDashboard(documentObject);
  documentObject.relationships[1].enter.click();
  assert.equal(documentObject.signIn.clickCount, 1);
  assert.doesNotMatch(html, /tabindex="0"[^>]*data-relationship-area|onkeydown=/);
});

test("signed-out detail states are truthful for every implemented relationship area", function () {
  assert.match(html, /Enter My DEMEOS to keep and see your intentions across visits\./);
  assert.match(html, /Enter My DEMEOS to keep and see your possibilities across visits\./);
  assert.match(html, /Enter My DEMEOS to see your participation across visits\./);
  assert.equal((html.match(/class="demeos-primary-button relationship-sign-in"/g) || []).length, 3);
});

test("future areas are honest non-controls and introduce no fabricated privacy functionality", function () {
  assert.match(html, /Coming to your DEMEOS relationship/);
  assert.match(html, /Preferences will only come from choices you explicitly make\./);
  assert.match(html, /More relationship controls are being prepared\./);
  assert.match(html, /DEMEOS will only show controls here when they are genuinely available\./);
  assert.doesNotMatch(html, /<button[^>]*>\s*(?:Delete my data|Export data|Consent settings|History controls)/i);
  assert.doesNotMatch(html, /data-relationship-area="(?:my-preferences|privacy-control)"/);
});

test("trusted evidence meanings and existing authenticated render targets remain unchanged", function () {
  for (const id of ["my-intentions-list", "my-possibilities-list", "my-participation-list"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /Interested is an interest signal only\. It is not a purchase, booking or sale\./);
  assert.match(html, /Interest remains interest\. Feedback remains feedback\. A choice is not automatically a purchase, sale or success\./);
});
