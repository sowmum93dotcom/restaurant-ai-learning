'use strict';
// Server-maintained extension of the existing authoritative business profile.
// This field is deliberately absent from the owner profile input contract.
// Model intent, URL, browser storage and preparation selection are not grants.
function applicationAccess(record, businessId) {
  const profile = record?.businessProfile;
  if (!profile || profile.businessId !== businessId) return {marketing:false, selling:false};
  const grants = profile.applicationAccess;
  return {marketing:grants?.marketing === true, selling:grants?.selling === true};
}
module.exports = {applicationAccess};
