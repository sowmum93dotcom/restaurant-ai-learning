'use strict';
// These server-only settings authorize exact Clerk identity/business pairs.
// They never replace Clerk verification or the persisted SQL owner relationship.
function isolatedTestEnvironment(env) {
  if (env.VERCEL_ENV !== 'preview' || env.DEMEOS_SELLING_DATA_ENVIRONMENT !== 'test' ||
      !env.DEMEOS_SELLING_TEST_PREVIEW_BRANCH || env.VERCEL_GIT_COMMIT_REF !== env.DEMEOS_SELLING_TEST_PREVIEW_BRANCH ||
      !env.DEMEOS_SELLING_TEST_DATABASE_HOST) return false;
  try {
    // @vercel/postgres createPool uses POSTGRES_URL. An environment label alone
    // cannot enable test grants while the adapter still points at shared data.
    const url = new URL(env.POSTGRES_URL);
    return ['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname === env.DEMEOS_SELLING_TEST_DATABASE_HOST;
  } catch { return false; }
}

function dataEnvironment(businessId, env, identityId) {
  const test = /^test-/i.test(businessId);
  if (!test) return env.DEMEOS_SELLING_DATA_ENVIRONMENT === 'test' ? null : 'live';
  if (!/^test-business-/i.test(businessId) || !isolatedTestEnvironment(env) || !identityId) return null;
  try {
    const grants = JSON.parse(env.DEMEOS_SELLING_TEST_AUTHORIZATIONS || '[]');
    return Array.isArray(grants) && grants.some(grant=>grant?.businessId === businessId && grant.ownerIdentityId === identityId) ? 'test' : null;
  } catch { return null; }
}

module.exports={isolatedTestEnvironment,dataEnvironment};
