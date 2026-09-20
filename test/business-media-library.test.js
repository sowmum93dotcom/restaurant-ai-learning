const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
test("business media library has isolated persistence and owner authorization", function () {
  const database = fs.readFileSync(require.resolve("../api/_lib/database.js"), "utf8");
  const persistence = fs.readFileSync(require.resolve("../api/_lib/persistence.js"), "utf8");
  const rules = fs.readFileSync(require.resolve("../api/_lib/demeos-rules.js"), "utf8");
  const api = fs.readFileSync(require.resolve("../api/businesses/[businessId]/media/index.js"), "utf8");
  assert.match(database, /demeos_business_media_assets/);
  assert.match(database, /business_id TEXT NOT NULL REFERENCES demeos_businesses/);
  assert.match(persistence, /saveBusinessMediaAsset/);
  assert.match(persistence, /getBusinessMediaAssets/);
  assert.match(persistence, /WHERE business_id = \$1 ORDER BY created_at DESC/);
  assert.match(rules, /MANAGE_BUSINESS_MEDIA/);
  assert.match(api, /authorizeBusinessOwnerRequest/);
  assert.match(api, /state: "pending-upload"/);
  assert.match(api, /randomUUID/);
});
