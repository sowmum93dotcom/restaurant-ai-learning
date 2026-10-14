'use strict';
const URL='https://restaurant-ai-learning-git-business-appro-e191e4-sowmum93dotcom.vercel.app/selling-vendor/inspect';
function vendorTestEntry(env=process.env){return env.DEMEOS_VENDOR_TEST_DASHBOARD==='true'||(env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF==='business-approval-application-access-705')?URL:null;}
module.exports={vendorTestEntry,URL};
