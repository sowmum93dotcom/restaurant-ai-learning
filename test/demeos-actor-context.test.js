const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEMEOS_ACTOR_CONTEXT_STATES,
  createPublicCustomerContext,
  createAuthenticatedBusinessOwnerContext,
  createAuthenticatedAdminContext,
  createUnresolvedActorContext,
  isTrustedBusinessOwnerContext,
  isTrustedAdminContext
} = require("../api/_lib/demeos-actor-context.js");

test("public customer context is explicitly public and unauthenticated", function () {
  assert.deepEqual(createPublicCustomerContext(), {
    state: "public",
    actorScope: "public-customer",
    authenticated: false,
    businessId: null
  });
});

test("business-owner context requires both trusted identity and business identifiers", function () {
  const context = createAuthenticatedBusinessOwnerContext({
    trustedIdentityId: "identity-1",
    businessId: "business-1"
  });

  assert.deepEqual(context, {
    state: "authenticated",
    actorScope: "business-owner",
    authenticated: true,
    trustedIdentityId: "identity-1",
    businessId: "business-1"
  });
  assert.equal(isTrustedBusinessOwnerContext(context, "business-1"), true);
});

test("missing trusted identity fails closed", function () {
  const context = createAuthenticatedBusinessOwnerContext({ businessId: "business-1" });
  assert.deepEqual(context, createUnresolvedActorContext());
  assert.equal(isTrustedBusinessOwnerContext(context, "business-1"), false);
});

test("missing business identifier fails closed", function () {
  const context = createAuthenticatedBusinessOwnerContext({ trustedIdentityId: "identity-1" });
  assert.deepEqual(context, createUnresolvedActorContext());
});

test("business owner cannot access a different business", function () {
  const context = createAuthenticatedBusinessOwnerContext({
    trustedIdentityId: "identity-1",
    businessId: "business-1"
  });
  assert.equal(isTrustedBusinessOwnerContext(context, "business-2"), false);
});

test("business identifier alone is never trusted identity", function () {
  assert.equal(isTrustedBusinessOwnerContext({
    state: "authenticated",
    actorScope: "business-owner",
    authenticated: true,
    businessId: "business-1"
  }, "business-1"), false);
});

test("client-selected actor scope does not create a trusted context", function () {
  const context = createAuthenticatedBusinessOwnerContext({
    actorScope: "business-owner",
    businessId: "business-1"
  });
  assert.deepEqual(context, createUnresolvedActorContext());
});

test("localStorage values are not identity evidence", function () {
  const context = createAuthenticatedAdminContext({
    localStorage: { trustedIdentityId: "browser-identity", actorScope: "demeos-admin" }
  });
  assert.deepEqual(context, createUnresolvedActorContext());
});

test("query, body, header, and cookie values are not automatically trusted", function () {
  for (const clientInput of [
    { query: { trustedIdentityId: "query-identity" } },
    { body: { trustedIdentityId: "body-identity" } },
    { headers: { "x-identity-id": "header-identity" } },
    { cookies: { trustedIdentityId: "cookie-identity" } }
  ]) {
    assert.deepEqual(createAuthenticatedAdminContext(clientInput), createUnresolvedActorContext());
  }
});

test("admin context requires a trusted identity", function () {
  assert.equal(isTrustedAdminContext(createAuthenticatedAdminContext({
    trustedIdentityId: "admin-identity"
  })), true);
  assert.deepEqual(createAuthenticatedAdminContext(), createUnresolvedActorContext());
  assert.deepEqual(createAuthenticatedAdminContext({ trustedIdentityId: "  " }), createUnresolvedActorContext());
});

test("business owner is not an admin", function () {
  const owner = createAuthenticatedBusinessOwnerContext({
    trustedIdentityId: "identity-1",
    businessId: "business-1"
  });
  assert.equal(isTrustedAdminContext(owner), false);
});

test("admin is not a business owner", function () {
  const admin = createAuthenticatedAdminContext({ trustedIdentityId: "admin-identity" });
  assert.equal(isTrustedBusinessOwnerContext(admin, "business-1"), false);
});

test("unresolved context has no permissions or business identity", function () {
  const context = createUnresolvedActorContext();
  assert.deepEqual(context, {
    state: "unresolved",
    actorScope: null,
    authenticated: false,
    businessId: null
  });
  assert.equal(isTrustedAdminContext(context), false);
  assert.equal(isTrustedBusinessOwnerContext(context, "business-1"), false);
});

test("actor-context constants and returned contexts are immutable", function () {
  const contexts = [
    createPublicCustomerContext(),
    createUnresolvedActorContext(),
    createAuthenticatedBusinessOwnerContext({ trustedIdentityId: "identity-1", businessId: "business-1" }),
    createAuthenticatedAdminContext({ trustedIdentityId: "admin-identity" })
  ];

  assert.equal(Object.isFrozen(DEMEOS_ACTOR_CONTEXT_STATES), true);
  for (const context of contexts) assert.equal(Object.isFrozen(context), true);
});
