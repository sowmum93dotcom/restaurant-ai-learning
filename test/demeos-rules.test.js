const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEMEOS_ACTOR_SCOPES,
  DEMEOS_ACTIONS,
  canPerformDemeosAction
} = require("../api/_lib/demeos-rules.js");

const allActions = Object.values(DEMEOS_ACTIONS);

function permittedActionsFor(actorScope) {
  return allActions.filter(function (action) {
    return canPerformDemeosAction({ actorScope, action });
  });
}

test("business owners can perform only the defined business-owner actions", function () {
  assert.deepEqual(permittedActionsFor(DEMEOS_ACTOR_SCOPES.BUSINESS_OWNER), [
    DEMEOS_ACTIONS.MANAGE_BUSINESS_PROFILE,
    DEMEOS_ACTIONS.CREATE_MARKETING,
    DEMEOS_ACTIONS.APPROVE_OWN_MARKETING,
    DEMEOS_ACTIONS.RECORD_CAMPAIGN_OUTCOME,
    DEMEOS_ACTIONS.RECORD_RECOMMENDATION_DECISION,
    DEMEOS_ACTIONS.VIEW_OWN_BUSINESS_RESULTS
  ]);
  assert.equal(canPerformDemeosAction({
    actorScope: DEMEOS_ACTOR_SCOPES.BUSINESS_OWNER,
    action: DEMEOS_ACTIONS.MANAGE_PLATFORM
  }), false);
});

test("public customers can only view Customer Experience and record participation", function () {
  assert.deepEqual(permittedActionsFor(DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER), [
    DEMEOS_ACTIONS.VIEW_CUSTOMER_EXPERIENCE,
    DEMEOS_ACTIONS.RECORD_CUSTOMER_PARTICIPATION
  ]);

  for (const action of [
    DEMEOS_ACTIONS.CREATE_MARKETING,
    DEMEOS_ACTIONS.APPROVE_OWN_MARKETING,
    DEMEOS_ACTIONS.VIEW_OWN_BUSINESS_RESULTS,
    DEMEOS_ACTIONS.MANAGE_PLATFORM
  ]) {
    assert.equal(canPerformDemeosAction({
      actorScope: DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER,
      action
    }), false);
  }
});

test("DEMEOS admins can manage the platform without inheriting owner permissions", function () {
  assert.deepEqual(permittedActionsFor(DEMEOS_ACTOR_SCOPES.ADMIN), [
    DEMEOS_ACTIONS.MANAGE_PLATFORM
  ]);
});

test("unknown and missing scopes and actions fail closed", function () {
  assert.equal(canPerformDemeosAction({ actorScope: "unknown", action: DEMEOS_ACTIONS.MANAGE_PLATFORM }), false);
  assert.equal(canPerformDemeosAction({ actorScope: "toString", action: DEMEOS_ACTIONS.MANAGE_PLATFORM }), false);
  assert.equal(canPerformDemeosAction({ actorScope: DEMEOS_ACTOR_SCOPES.ADMIN, action: "unknown" }), false);
  assert.equal(canPerformDemeosAction({ action: DEMEOS_ACTIONS.MANAGE_PLATFORM }), false);
  assert.equal(canPerformDemeosAction({ actorScope: DEMEOS_ACTOR_SCOPES.ADMIN }), false);
  assert.equal(canPerformDemeosAction({}), false);
  assert.equal(canPerformDemeosAction(), false);
});

test("browser and localStorage values are not permission evidence", function () {
  const browserClaims = {
    businessId: "business-from-browser",
    localStorage: {
      actorScope: DEMEOS_ACTOR_SCOPES.ADMIN,
      businessId: "claimed-owner-business"
    },
    action: DEMEOS_ACTIONS.MANAGE_PLATFORM
  };

  assert.equal(canPerformDemeosAction(browserClaims), false);
  assert.equal(canPerformDemeosAction({
    ...browserClaims,
    actorScope: DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER
  }), false);
  assert.equal(canPerformDemeosAction({
    businessId: browserClaims.businessId,
    action: DEMEOS_ACTIONS.VIEW_OWN_BUSINESS_RESULTS
  }), false);
});

test("supported scopes and actions are immutable constants", function () {
  assert.equal(Object.isFrozen(DEMEOS_ACTOR_SCOPES), true);
  assert.equal(Object.isFrozen(DEMEOS_ACTIONS), true);
  assert.deepEqual(Object.values(DEMEOS_ACTOR_SCOPES), [
    "demeos-admin", "business-owner", "public-customer"
  ]);
  assert.deepEqual(Object.values(DEMEOS_ACTIONS), [
    "manage-business-profile",
    "create-marketing",
    "approve-own-marketing",
    "record-campaign-outcome",
    "record-recommendation-decision",
    "view-own-business-results",
    "view-customer-experience",
    "record-customer-participation",
    "manage-platform"
  ]);
});
