/* Catalogue presence is not full-journey verification or permission to enable a language. */
(function (root) {
  "use strict";
  var required = Object.freeze(["navigation", "discover", "intention", "confirmation", "results",
    "possibilities", "noMatch", "save", "status", "feedback", "myDemeos"]);
  var complete = Object.freeze({
    en: Object.freeze(required.slice()), fr: Object.freeze(required.slice()), ar: Object.freeze(required.slice()),
    es: Object.freeze(required.slice()), pt: Object.freeze(required.slice()), zh: Object.freeze(required.slice()),
    hi: Object.freeze(required.slice()), de: Object.freeze(required.slice()), ja: Object.freeze(required.slice())
  });
  // Preserve existing availability. No complete nine-language journey has been certified by this audit.
  var enabled = Object.freeze(["en", "fr", "ar"]);
  var verifiedJourneys = Object.freeze([]);
  function missing(code) {
    return required.filter(function (item) { return (complete[code] || []).indexOf(item) < 0; });
  }
  function journeyVerified(code) { return verifiedJourneys.indexOf(code) >= 0; }
  function releaseReady(code) { return missing(code).length === 0 && journeyVerified(code); }
  function selectable(code) { return enabled.indexOf(code) >= 0 && missing(code).length === 0; }
  var gate = Object.freeze({ required: required, complete: complete, missing: missing,
    enabled: enabled, verifiedJourneys: verifiedJourneys, journeyVerified: journeyVerified,
    releaseReady: releaseReady, selectable: selectable });
  if (typeof module !== "undefined" && module.exports) module.exports = gate;
  root.DEMEOSLanguageCoverage = gate;
}(typeof window !== "undefined" ? window : {}));
