const assert = require("node:assert/strict");
const test = require("node:test");

const { authorizeDemeosAction } = require("../api/_lib/demeos-authorization.js");
const {
  createPublicCustomerContext,
  createAuthenticatedBusinessOwnerContext,
  createAuthenticatedAdminContext,
  createUnresolvedActorContext
} = require("../api/_lib/demeos-actor-context.js");
const { DEMEOS_ACTIONS } = require("../api/_lib/demeos-rules.js");

const owner = createAuthenticatedBusinessOwnerContext({
  trustedIdentityId: "identity-owner",
  businessId: "business-a"
});
const publicCustomer = createPublicCustomerContext();
const admin = createAuthenticatedAdminContext({ trustedIdentityId: "identity-admin" });

test("a trusted owner may perform an owner action only for their business", function () {
  assert.equal(authorizeDemeosAction({ actorContext: owner,
    action: DEMEOS_ACTIONS.CREATE_MARKETING, businessId: "business-a" }).allowed, true);
  assert.equal(authorizeDemeosAction({ actorContext: owner,
    action: DEMEOS_ACTIONS.CREATE_MARKETING, businessId: "business-b" }).allowed, false);
});

test("an owner does not receive platform administration permission", function () {
  assert.equal(authorizeDemeosAction({ actorContext: owner,
    action: DEMEOS_ACTIONS.MANAGE_PLATFORM, businessId: "business-a" }).allowed, false);
});

test("a public customer receives only public permissions", function () {
  assert.equal(authorizeDemeosAction({ actorContext: publicCustomer,
    action: DEMEOS_ACTIONS.VIEW_CUSTOMER_EXPERIENCE }).allowed, true);
  assert.equal(authorizeDemeosAction({ actorContext: publicCustomer,
    action: DEMEOS_ACTIONS.RECORD_CUSTOMER_PARTICIPATION }).allowed, true);
  assert.equal(authorizeDemeosAction({ actorContext: publicCustomer,
    action: DEMEOS_ACTIONS.CREATE_MARKETING }).allowed, false);
});

test("a requested businessId cannot turn a public customer into an owner", function () {
  assert.equal(authorizeDemeosAction({ actorContext: publicCustomer,
    action: DEMEOS_ACTIONS.CREATE_MARKETING, businessId: "business-a" }).allowed, false);
});

test("an admin receives only permissions assigned to the admin scope", function () {
  assert.equal(authorizeDemeosAction({ actorContext: admin,
    action: DEMEOS_ACTIONS.MANAGE_PLATFORM }).allowed, true);
  assert.equal(authorizeDemeosAction({ actorContext: admin,
    action: DEMEOS_ACTIONS.MANAGE_BUSINESS_PROFILE, businessId: "business-a" }).allowed, false);
});

test("unresolved and missing actor contexts are denied", function () {
  assert.equal(authorizeDemeosAction({ actorContext: createUnresolvedActorContext(),
    action: DEMEOS_ACTIONS.VIEW_CUSTOMER_EXPERIENCE }).allowed, false);
  assert.equal(authorizeDemeosAction({ action: DEMEOS_ACTIONS.VIEW_CUSTOMER_EXPERIENCE }).allowed, false);
});

test("missing and unknown actions are denied", function () {
  assert.equal(authorizeDemeosAction({ actorContext: publicCustomer }).allowed, false);
  assert.equal(authorizeDemeosAction({ actorContext: publicCustomer, action: "unknown-action" }).allowed, false);
});

test("untrusted scope claims are denied", function () {
  assert.equal(authorizeDemeosAction({ actorContext: { actorScope: "business-owner" },
    action: DEMEOS_ACTIONS.CREATE_MARKETING, businessId: "business-a" }).allowed, false);
  assert.equal(authorizeDemeosAction({ actorContext: { actorScope: "demeos-admin" },
    action: DEMEOS_ACTIONS.MANAGE_PLATFORM }).allowed, false);
  assert.equal(authorizeDemeosAction({ actorContext: { actorScope: "public-customer" },
    action: DEMEOS_ACTIONS.VIEW_CUSTOMER_EXPERIENCE }).allowed, false);
});

test("businessId alone cannot authorize an owner action", function () {
  assert.equal(authorizeDemeosAction({
    action: DEMEOS_ACTIONS.CREATE_MARKETING,
    businessId: "business-a"
  }).allowed, false);
});

test("authorization results are immutable and contain only the public decision fields", function () {
  const result = authorizeDemeosAction({ actorContext: owner,
    action: DEMEOS_ACTIONS.CREATE_MARKETING, businessId: "business-a" });

  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(result, {
    allowed: true,
    actorScope: "business-owner",
    action: DEMEOS_ACTIONS.CREATE_MARKETING,
    businessId: "business-a"
  });
  result.allowed = false;
  assert.equal(result.allowed, true);
});
