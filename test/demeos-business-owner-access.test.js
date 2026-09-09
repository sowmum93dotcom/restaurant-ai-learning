const assert = require("node:assert/strict");
const test = require("node:test");

const persistence = require("../api/_lib/persistence.js");
const { createUnresolvedActorContext } = require("../api/_lib/demeos-actor-context.js");
const {
  resolveBusinessOwnerContext
} = require("../api/_lib/demeos-business-owner-access.js");

function ownershipRepository(mappings) {
  const calls = [];
  return {
    calls,
    async isBusinessOwnedByIdentity(trustedIdentityId, businessId) {
      calls.push([trustedIdentityId, businessId]);
      return mappings.some(function (mapping) {
        return mapping[0] === trustedIdentityId && mapping[1] === businessId;
      });
    }
  };
}

test("exact stored ownership resolves an immutable trusted business owner context", async function () {
  const repository = ownershipRepository([["identity-a", "business-a"]]);
  const context = await resolveBusinessOwnerContext({
    trustedIdentityId: "identity-a", businessId: "business-a", repository
  });

  assert.deepEqual(context, {
    state: "authenticated",
    actorScope: "business-owner",
    authenticated: true,
    trustedIdentityId: "identity-a",
    businessId: "business-a"
  });
  assert.equal(Object.isFrozen(context), true);
  assert.deepEqual(repository.calls, [["identity-a", "business-a"]]);
});

test("ownership must match both the identity and business", async function () {
  const repository = ownershipRepository([["identity-a", "business-a"]]);

  assert.deepEqual(await resolveBusinessOwnerContext({
    trustedIdentityId: "identity-a", businessId: "business-b", repository
  }), createUnresolvedActorContext());
  assert.deepEqual(await resolveBusinessOwnerContext({
    trustedIdentityId: "identity-b", businessId: "business-a", repository
  }), createUnresolvedActorContext());
});

test("missing, blank, and non-string identifiers fail closed without an ownership lookup", async function () {
  const repository = ownershipRepository([]);
  const inputs = [
    { businessId: "business-a" },
    { trustedIdentityId: "identity-a" },
    { trustedIdentityId: "", businessId: "business-a" },
    { trustedIdentityId: "identity-a", businessId: "  " },
    { trustedIdentityId: {}, businessId: "business-a" },
    { trustedIdentityId: "identity-a", businessId: 42 }
  ];

  for (const input of inputs) {
    assert.deepEqual(
      await resolveBusinessOwnerContext({ ...input, repository }),
      createUnresolvedActorContext()
    );
  }
  assert.deepEqual(repository.calls, []);
});

test("client-controlled ownership claims cannot resolve an owner context", async function () {
  const repository = ownershipRepository([["identity-a", "business-a"]]);
  const claims = [
    { businessId: "business-a" },
    { actorScope: "business-owner", businessId: "business-a" },
    { localStorage: { trustedIdentityId: "identity-a" }, businessId: "business-a" },
    { body: { trustedIdentityId: "identity-a" }, businessId: "business-a" },
    { query: { trustedIdentityId: "identity-a" }, businessId: "business-a" },
    { headers: { "x-identity-id": "identity-a" }, businessId: "business-a" },
    { cookies: { trustedIdentityId: "identity-a" }, businessId: "business-a" }
  ];

  for (const claim of claims) {
    assert.deepEqual(
      await resolveBusinessOwnerContext({ ...claim, repository }),
      createUnresolvedActorContext()
    );
  }
  assert.deepEqual(repository.calls, []);
});

test("false and failed ownership checks return unresolved contexts", async function () {
  assert.deepEqual(await resolveBusinessOwnerContext({
    trustedIdentityId: "identity-a",
    businessId: "business-a",
    repository: { async isBusinessOwnedByIdentity() { return false; } }
  }), createUnresolvedActorContext());

  assert.deepEqual(await resolveBusinessOwnerContext({
    trustedIdentityId: "identity-a",
    businessId: "business-a",
    repository: { async isBusinessOwnedByIdentity() { throw new Error("database unavailable"); } }
  }), createUnresolvedActorContext());
});

test("only the repository ownership method is used as the ownership authority", async function () {
  let authoritativeChecks = 0;
  const repository = {
    async isBusinessOwnedByIdentity(identity, business) {
      authoritativeChecks += 1;
      return identity === "identity-a" && business === "business-a";
    },
    async query() {
      assert.fail("resolver must not issue its own ownership query");
    }
  };

  const context = await resolveBusinessOwnerContext({
    trustedIdentityId: "identity-a", businessId: "business-a", repository
  });
  assert.equal(context.authenticated, true);
  assert.equal(authoritativeChecks, 1);
});

test("the persistence repository is used when none is supplied and its errors fail closed", async function () {
  const originalGetRepository = persistence.getRepository;
  const repository = ownershipRepository([["identity-a", "business-a"]]);

  try {
    persistence.getRepository = function () { return repository; };
    const context = await resolveBusinessOwnerContext({
      trustedIdentityId: "identity-a", businessId: "business-a"
    });
    assert.equal(context.authenticated, true);
    assert.deepEqual(repository.calls, [["identity-a", "business-a"]]);

    persistence.getRepository = function () { throw new Error("repository unavailable"); };
    assert.deepEqual(await resolveBusinessOwnerContext({
      trustedIdentityId: "identity-a", businessId: "business-a"
    }), createUnresolvedActorContext());
  } finally {
    persistence.getRepository = originalGetRepository;
  }
});
