const DEMEOS_ACTOR_SCOPES = Object.freeze({
  ADMIN: "demeos-admin",
  BUSINESS_OWNER: "business-owner",
  PUBLIC_CUSTOMER: "public-customer"
});

const DEMEOS_ACTIONS = Object.freeze({
  MANAGE_BUSINESS_PROFILE: "manage-business-profile",
  CREATE_MARKETING: "create-marketing",
  APPROVE_OWN_MARKETING: "approve-own-marketing",
  RECORD_CAMPAIGN_OUTCOME: "record-campaign-outcome",
  RECORD_RECOMMENDATION_DECISION: "record-recommendation-decision",
  VIEW_OWN_BUSINESS_RESULTS: "view-own-business-results",
  VIEW_CUSTOMER_EXPERIENCE: "view-customer-experience",
  RECORD_CUSTOMER_PARTICIPATION: "record-customer-participation",
  MANAGE_PLATFORM: "manage-platform"
});

const permissionsByActorScope = Object.freeze({
  [DEMEOS_ACTOR_SCOPES.ADMIN]: Object.freeze([
    DEMEOS_ACTIONS.MANAGE_PLATFORM
  ]),
  [DEMEOS_ACTOR_SCOPES.BUSINESS_OWNER]: Object.freeze([
    DEMEOS_ACTIONS.MANAGE_BUSINESS_PROFILE,
    DEMEOS_ACTIONS.CREATE_MARKETING,
    DEMEOS_ACTIONS.APPROVE_OWN_MARKETING,
    DEMEOS_ACTIONS.RECORD_CAMPAIGN_OUTCOME,
    DEMEOS_ACTIONS.RECORD_RECOMMENDATION_DECISION,
    DEMEOS_ACTIONS.VIEW_OWN_BUSINESS_RESULTS
  ]),
  [DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER]: Object.freeze([
    DEMEOS_ACTIONS.VIEW_CUSTOMER_EXPERIENCE,
    DEMEOS_ACTIONS.RECORD_CUSTOMER_PARTICIPATION
  ])
});

function canPerformDemeosAction({ actorScope, action } = {}) {
  if (!Object.hasOwn(permissionsByActorScope, actorScope)) return false;
  const allowedActions = permissionsByActorScope[actorScope];
  return allowedActions.includes(action);
}

module.exports = {
  DEMEOS_ACTOR_SCOPES,
  DEMEOS_ACTIONS,
  canPerformDemeosAction
};
