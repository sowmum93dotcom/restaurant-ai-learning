const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createPersistenceRepository } = require("../api/_lib/persistence.js");
const dashboard = require("../js/my-demeos.js");

test("issued possibility history is customer-scoped and rendered from immutable issuance snapshots", async function () {
  const calls = [];
  const oldSnapshot = { approvalStatus: "Approved", campaignType: "social", campaignText: "The message originally shown" };
  const db = { ensureSchema: async () => {}, query: async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [{ work_item_id: "work-7", campaign_snapshot: oldSnapshot,
      business_name_snapshot: "Original Cafe", location_snapshot: "York", intention_id: 31,
      issued_at: "2026-09-01T12:00:00.000Z", response: "Not quite", comment: "Earlier, please",
      feedback_at: "2026-09-02T12:00:00.000Z" }] };
  } };
  const result = await createPersistenceRepository(db).getCustomerIssuedPossibilities("customer-a", 50);
  assert.deepEqual(calls[0].values, ["customer-a", 50]);
  assert.match(calls[0].sql, /campaign_snapshot/);
  assert.doesNotMatch(calls[0].sql, /campaign_snapshot\s*=\s*c\.campaign/);
  assert.deepEqual(result, [{ workItemId: "work-7", content: "The message originally shown",
    businessName: "Original Cafe", issuedAt: "2026-09-01T12:00:00.000Z", location: "York",
    intentionId: "31", feedback: { response: "Not quite", createdAt: "2026-09-02T12:00:00.000Z",
      comment: "Earlier, please" } }]);
});

test("issuance retries preserve the first snapshot and authoritative issuance time", function () {
  const persistence = fs.readFileSync(require.resolve("../api/_lib/persistence.js"), "utf8");
  const trust = fs.readFileSync(require.resolve("../api/_lib/customer-possibility-issuance-trust.js"), "utf8");
  assert.match(persistence, /ON CONFLICT \(trusted_customer_identity_id, work_item_id\) DO NOTHING/);
  assert.doesNotMatch(persistence, /SET campaign_snapshot = EXCLUDED\.campaign_snapshot/);
  assert.match(trust, /BEFORE INSERT ON demeos_customer_possibility_issuances/);
  assert.doesNotMatch(trust, /SET delivery_confirmed = TRUE, issued_at = NOW\(\)/);
});

test("explicit preference retries use the trusted owner lock without inferring preferences", async function () {
  let write;
  const db = { ensureSchema: async () => {}, query: async (sql, values) => {
    write = { sql, values };
    return { rows: [{ preference_id: 8, preference_text: "Quiet tables", created_at: "2026-09-17T10:00:00Z" }] };
  } };
  const saved = await createPersistenceRepository(db).saveCustomerPreference("customer-a", { preference: "Quiet tables" });
  assert.deepEqual(write.values, ["customer-a", "Quiet tables"]);
  assert.match(write.sql, /pg_advisory_xact_lock/);
  assert.match(write.sql, /trusted_customer_identity_id = \$1 AND preference_text = \$2/);
  assert.equal(saved.preference, "Quiet tables");
});

test("My Possibilities presents feedback as feedback and does not expose internal provenance IDs", function () {
  const nodes = [];
  const list = { textContent: "", appendChild(node) { nodes.push(node); } };
  const elements = { "my-possibilities-list": list, "my-possibilities-empty": {},
    "my-possibilities-loading": {} };
  const documentObject = { getElementById(id) { return elements[id]; }, createElement(tag) {
    return { tag, children: [], appendChild(child) { this.children.push(child); }, addEventListener() {} };
  } };
  dashboard.renderPossibilities(documentObject, [{ workItemId: "internal-work", intentionId: "internal-intention",
    content: "A calm supper", businessName: "Cafe", issuedAt: "2026-09-17T10:00:00Z",
    feedback: { response: "Relevant", comment: "Good fit", createdAt: "2026-09-17T11:00:00Z" } }]);
  const visible = JSON.stringify(nodes);
  assert.match(visible, /Your feedback: Relevant/);
  assert.match(visible, /Good fit/);
  assert.doesNotMatch(visible, /internal-work|internal-intention/);
  assert.doesNotMatch(visible, /purchase|sale|conversion|score|confidence/i);
});

test("workspace guidance remains explicit, off by default, and separate from historical evidence", function () {
  const schema = fs.readFileSync(require.resolve("../api/_lib/database.js"), "utf8");
  const possibilities = fs.readFileSync(require.resolve("../api/customer/possibilities.js"), "utf8");
  assert.match(schema, /use_preferences_as_guidance BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(schema, /use_feedback_as_guidance BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(possibilities, /if \(controls\.usePreferencesAsGuidance/);
  assert.match(possibilities, /if \(controls\.useFeedbackAsGuidance/);
  assert.doesNotMatch(possibilities, /score|profile.*activity|confidence percentage/i);
});
