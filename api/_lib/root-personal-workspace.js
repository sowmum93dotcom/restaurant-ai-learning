'use strict';
const {createHash}=require('node:crypto');
function workspace(identity,audience){
 return {workspaceId:'root-'+createHash('sha256').update(JSON.stringify(['root-personal-v1',identity,audience])).digest('hex'),kind:'personal',audience,permissions:['understand-supplied-text'],organisationAccess:false};
}
module.exports={workspace};
