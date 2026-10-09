const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  availabilityCopy,
  configureAction,
  continuationType,
  priceCopy,
  safeHttps, safeContinuation
} = require("../js/customer-product-experience.js");

function actionStub() {
  const attributes = {};
  return {
    hidden: true,
    href: "",
    target: "",
    rel: "",
    textContent: "",
    setAttribute(name, value) { attributes[name] = value; },
    removeAttribute(name) { delete attributes[name]; this[name] = ""; },
    getAttribute(name) { return attributes[name] || null; }
  };
}

test('approved contact routes survive receiving without admitting scripts or route substitutions', () => {
  for (const [route,destination] of [['phone','tel:+44 161 123 4567'],['email','mailto:hello@example.org'],['quote','mailto:quotes@example.org'],['website','http://example.org/shop'],['booking','https://example.org/book']]) {
    assert.equal(safeContinuation({continuationRoute:route},destination),destination);
    const action=actionStub();assert.equal(configureAction(action,{continuationRoute:route,availability:'available'},destination),true);assert.equal(action.href,destination);
  }
  for (const [route,destination] of [['website','tel:+441611234567'],['phone','https://example.org'],['email','mailto:a@example.org?body=private'],['quote','javascript:alert(1)'],['website','https://user:password@example.org'],['website','https://'],['phone','tel:+441611234567\n'],['email','mailto:not-an-address']]) {
    assert.equal(safeContinuation({continuationRoute:route},destination),'');
  }
});

test("Product Experience only accepts HTTPS continuation destinations", () => {
  assert.equal(safeHttps("https://example.com/buy"), "https://example.com/buy");
  assert.equal(safeHttps(" http://example.com/buy "), "");
  assert.equal(safeHttps("javascript:alert(1)"), "");
  assert.equal(safeHttps("//example.com/buy"), "");
  assert.equal(safeHttps(""), "");
  assert.equal(safeHttps(null), "");
});

test("Product Experience recognises DEMEOS purchase separately from external marketing", () => {
  assert.equal(continuationType({ continuationRoute: "demeos" }), "demeos");
  assert.equal(continuationType({ continuationRoute: "demeos-purchase" }), "demeos");
  assert.equal(continuationType({ continuationRoute: "purchase" }), "demeos");
  assert.equal(continuationType({ continuationRoute: "booking" }), "booking");
  assert.equal(continuationType({ continuationRoute: "website" }), "external");
  assert.equal(continuationType({}), "external");
});

test("DEMEOS purchase route stays inside DEMEOS and remains pending until buying is built", () => {
  const action = actionStub();
  assert.equal(configureAction(action, { availability: "available", continuationRoute: "demeos" }, "https://external.example/buy"), true);
  assert.equal(action.hidden, false);
  assert.equal(action.href, "#");
  assert.equal(action.textContent, "Buy in DEMEOS");
  assert.equal(action.getAttribute("data-demeos-purchase"), "pending");
  assert.equal(action.target, "");
  assert.equal(action.rel, "");
});

test("marketing continuation requires a validated HTTPS business destination", () => {
  const safeAction = actionStub();
  assert.equal(configureAction(safeAction, { availability: "available", continuationRoute: "website" }, "https://business.example/product"), true);
  assert.equal(safeAction.href, "https://business.example/product");
  assert.equal(safeAction.target, "_blank");
  assert.equal(safeAction.rel, "noopener noreferrer");
  assert.equal(safeAction.textContent, "Where to buy");

  const unsafeAction = actionStub();
  assert.equal(configureAction(unsafeAction, { availability: "available", continuationRoute: "website" }, "javascript:alert(1)"), false);
  assert.equal(unsafeAction.hidden, true);
  assert.equal(unsafeAction.href, "");
});

test("booking continuation is explicit and HTTPS-only", () => {
  const action = actionStub();
  assert.equal(configureAction(action, { availability: "available", continuationRoute: "booking" }, "https://business.example/book"), true);
  assert.equal(action.textContent, "Book with business");
  assert.equal(action.href, "https://business.example/book");
});

test("unavailable products cannot continue through any route", () => {
  const externalAction = actionStub();
  const demeosAction = actionStub();
  assert.equal(configureAction(externalAction, { availability: "unavailable", continuationRoute: "website" }, "https://business.example/buy"), false);
  assert.equal(configureAction(demeosAction, { availability: "unavailable", continuationRoute: "demeos" }, ""), false);
  assert.equal(externalAction.hidden, true);
  assert.equal(demeosAction.hidden, true);
});

test("Product Experience presents availability without inventing business claims", () => {
  assert.equal(availabilityCopy("unavailable"), "Currently unavailable");
  assert.equal(availabilityCopy("limited"), "Limited availability");
  assert.equal(availabilityCopy("contact"), "Contact business for availability");
  assert.equal(availabilityCopy("available"), "Available");
});

test("Product Experience preserves business-provided price presentation", () => {
  assert.equal(priceCopy({ price: "£22.00" }), "£22.00");
  assert.equal(priceCopy({ price: "£22.00", priceMode: "from" }), "From £22.00");
  assert.equal(priceCopy({ price: "£22–£30", priceMode: "range" }), "Price range: £22–£30");
  assert.equal(priceCopy({ price: "" }), "");
});

test("real Customer Experience loads the Product Experience surface, controller and styling", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "customer.html"), "utf8");
  assert.match(html, /id="product-experience"/);
  assert.match(html, /id="product-experience-action"/);
  assert.match(html, /css\/customer-product-experience\.css/);
  assert.match(html, /js\/customer-product-experience\.js/);
});

test("Product Experience controller prevents inactive DEMEOS buying from navigating", () => {
  const controller = fs.readFileSync(path.join(__dirname, "..", "js", "customer-product-experience.js"), "utf8");
  assert.match(controller, /data-demeos-purchase/);
  assert.match(controller, /DEMEOS buying is not active yet/);
  assert.match(controller, /event\.preventDefault\(\)/);
  assert.match(controller, /action\.rel = "noopener noreferrer"/);
});
