/* Localizes DEMEOS-owned Product Experience UI only. Business-provided content is never rewritten. */
(function (root) {
  "use strict";
  function code() {
    var control = root.document.getElementById("customer-language");
    var value = control ? control.value : root.document.documentElement.lang;
    value = String(value || "en").toLowerCase().split("-")[0];
    return root.DEMEOSProductExperienceCopy && root.DEMEOSProductExperienceCopy[value] ? value : "en";
  }
  function format(value, values) {
    return Object.keys(values || {}).reduce(function (text, key) { return text.replace("{" + key + "}", values[key]); }, value);
  }
  function canonical(element) {
    if (!element.dataset.demeosCanonicalText) element.dataset.demeosCanonicalText = element.textContent;
    return element.dataset.demeosCanonicalText;
  }
  function setText(selector, key) {
    root.document.querySelectorAll(selector).forEach(function (element) { canonical(element); element.textContent = root.DEMEOSProductExperienceCopy[code()][key]; });
  }
  function apply() {
    if (!root.DEMEOSProductExperienceCopy) return;
    var copy = root.DEMEOSProductExperienceCopy[code()];
    var heading = root.document.querySelector(".customer-products-heading");
    if (heading) { canonical(heading); heading.textContent = copy.heading; }
    root.document.querySelectorAll(".customer-products-count").forEach(function (element) {
      var source = canonical(element), match = source.match(/^(\d+)/), count = match ? match[1] : "1";
      element.textContent = count === "1" ? copy.one : format(copy.many, { count: count });
    });
    setText(".customer-product-no-image", "noImage");
    root.document.querySelectorAll(".customer-product-no-image").forEach(function (element) {
      if (canonical(element).indexOf("Image unavailable.") === 0) element.textContent = copy.imageUnavailable;
    });
    root.document.querySelectorAll(".customer-product-price").forEach(function (element) {
      var source = canonical(element), value = source;
      if (source === "Contact business for price") value = copy.contactPrice;
      else if (source.indexOf("From ") === 0) value = format(copy.from, { price: source.slice(5) });
      else if (source.indexOf("Price range: ") === 0) value = format(copy.range, { price: source.slice(13) });
      element.textContent = value;
    });
    var availability = { "Available":"available", "Limited availability — contact the business first":"limited", "Not currently available":"unavailable", "Contact the business to confirm availability":"contactAvailability" };
    root.document.querySelectorAll(".customer-product-availability").forEach(function (element) { var key = availability[canonical(element)]; if (key) element.textContent = copy[key]; });
    var methods = { "Collection":"collection", "Delivery":"delivery", "Shipping":"shipping", "At the business":"premises", "At your location":"customerLocation", "Appointment":"appointment", "Digital":"digital" };
    root.document.querySelectorAll(".customer-product-fulfilment").forEach(function (element) {
      var source = canonical(element).replace(/^How you receive it:\s*/, "");
      var translated = source.split(" · ").map(function (method) { return methods[method] ? copy[methods[method]] : method; }).join(" · ");
      element.textContent = format(copy.receive, { methods: translated });
    });
    root.document.querySelectorAll(".customer-product-continue-action").forEach(function (element) { if (element.closest("#customer-work-list[data-controlled-test=\"true\"]")) return; canonical(element); element.textContent = copy.buy; });
    setText(".customer-product-unavailable-note", "unavailableNote");
  }
  function start() {
    apply();
    var control = root.document.getElementById("customer-language");
    if (control) control.addEventListener("change", function () { root.setTimeout(apply, 0); });
    var focused = root.document.getElementById("customer-focused-possibility");
    if (focused && typeof root.MutationObserver === "function") {
      new root.MutationObserver(function () { root.setTimeout(apply, 0); }).observe(focused, { childList:true, subtree:true });
    }
  }
  root.DEMEOSProductExperienceLanguage = Object.freeze({ apply: apply });
  if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start); else start();
}(typeof window !== "undefined" ? window : {}));
