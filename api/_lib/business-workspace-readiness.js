'use strict';
// Presentation of existing owner permissions. No merchant loader or live
// gateway is installed in customer-checkout; owner data cannot grant selling.
function workspaceReadiness(record, businessId) {
  if (!record?.businessProfile || record.businessProfile.businessId !== businessId) return null;
  return {
    businessId,
    onboarding: {status: record.businessProfile.informationStatus?.reviewState === 'submitted' ? 'submitted' : 'draft',
      approved: false, canSubmit: true, reviewAvailable: false},
    marketing: {canPrepare: true, continuation: 'approved-business-destination'},
    selling: {canPrepare: true, canSell: false, status: 'preparation-only', reason: 'merchant-and-purchase-authorization-required'},
    publication: {draftsPublic: false, submissionAvailable: true}
  };
}
module.exports = {workspaceReadiness};
