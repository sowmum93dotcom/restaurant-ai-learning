const assert = require("node:assert/strict");
const test = require("node:test");

const {
  readOwnerPendingSyncIds,
  mergeServerAuthorizedProfiles,
  getStickyNewBusinessId,
  clearStickyNewBusinessId
} = require("../js/business-workspace.js");

function storage(values) {
  const state = { ...(values || {}) };
  return {
    getItem(key) { return Object.hasOwn(state, key) ? state[key] : null; },
    setItem(key, value) { state[key] = String(value); },
    removeItem(key) { delete state[key]; },
    state
  };
}

test("pending authorized profile keeps unsynced cached fields while unauthorized cache is excluded", function () {
  const cached = [
    { businessId: "owned", name: "Unsynced Local Name", goal: "Local edit" },
    { businessId: "local-only", name: "Must Never Appear" }
  ];
  const server = [{ businessId: "owned", name: "Older Server Name", goal: "Server value" }];

  const merged = mergeServerAuthorizedProfiles(cached, server, "owned", ["owned"]);
  assert.deepEqual(merged, {
    profiles: [{ businessId: "owned", name: "Unsynced Local Name", goal: "Local edit" }],
    activeBusinessId: "owned"
  });
  assert.doesNotMatch(JSON.stringify(merged), /Must Never Appear/);
});

test("server profile wins normally after pending synchronization is cleared", function () {
  const cached = [{ businessId: "owned", name: "Cached" }];
  const server = [{ businessId: "owned", name: "Server" }];
  assert.deepEqual(mergeServerAuthorizedProfiles(cached, server, "owned", []), {
    profiles: [{ businessId: "owned", name: "Server" }],
    activeBusinessId: "owned"
  });
});

test("pending sync ids are read without granting authorization", function () {
  const local = storage({ demeosPendingBusinessProfileSync: JSON.stringify(["owned", "local-only"]) });
  assert.deepEqual(readOwnerPendingSyncIds(local), ["owned", "local-only"]);
  const merged = mergeServerAuthorizedProfiles(
    [{ businessId: "local-only", name: "Injected" }],
    [],
    "local-only",
    readOwnerPendingSyncIds(local)
  );
  assert.deepEqual(merged, { profiles: [], activeBusinessId: null });
});

test("ambiguous new-business retry reuses one stable business id", function () {
  const session = storage();
  let generated = 0;
  const createId = function () { generated += 1; return `business-${generated}`; };

  const first = getStickyNewBusinessId(session, createId);
  const retry = getStickyNewBusinessId(session, createId);
  assert.equal(first, "business-1");
  assert.equal(retry, first);
  assert.equal(generated, 1, "retry must not create a second business id");

  clearStickyNewBusinessId(session);
  const nextAttempt = getStickyNewBusinessId(session, createId);
  assert.equal(nextAttempt, "business-2");
});
