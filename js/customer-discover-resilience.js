(function () {
  "use strict";

  function discoverStillWaiting(document) {
    const status = document && document.getElementById("customer-work-status");
    const list = document && document.getElementById("customer-work-list");
    if (!status || !list) return false;
    return list.children.length === 0 && /loading approved work/i.test(status.textContent || "");
  }

  function recoverDiscover(document, fetcher, location) {
    if (!discoverStillWaiting(document)) return false;
    if (typeof loadCustomerWork !== "function" || typeof fetcher !== "function") return false;
    loadCustomerWork(document, fetcher, location);
    return true;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { discoverStillWaiting, recoverDiscover };
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () {
      // customer.js normally owns Discover. This only recovers a page that is
      // still stuck at its initial loading state after another surface fails.
      recoverDiscover(document, globalThis.fetch, globalThis.location);
    });
  }
})();
