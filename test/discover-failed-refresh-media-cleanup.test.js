const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");

test("failed Discover refresh cleans up media before removing old cards", () => {
  const failure = source.slice(source.indexOf("} catch (error) {", source.indexOf("async function loadCustomerWork")));
  const clear = failure.indexOf('list.textContent = ""');
  assert.ok(clear > 0);
  assert.ok(failure.indexOf("region.discoverResizeObserver.disconnect()") < clear);
  assert.ok(failure.indexOf("previousObserver.disconnect()") < clear);
  assert.ok(failure.indexOf("discoverMediaObservers.delete(list)") < clear);
  assert.ok(failure.indexOf('list.querySelectorAll("video")') < clear);
  assert.ok(failure.indexOf("video.pause()") < clear);
  assert.ok(failure.indexOf("if (discoverRequestVersions.get(document) !== version) return;") < clear);
});
