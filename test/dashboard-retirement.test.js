'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const retired=['selling-vendor.html','selling-vendor-manage.html','css/selling-vendor.css','js/vendor-development-workspace.js','js/vendor-inspection.js','api/vendor-development-workspace.js','api/_lib/vendor-inspection.js','api/_lib/vendor-inspection-media.js','api/_lib/vendor-inspection-source.js','js/vendor-inventory.js','js/vendor-orders.js','css/vendor-inventory.css','images/vendor-inspection','browser-checks/vendor-inspection-gate.js','browser-checks/vendor-inventory-gate.js','test/vendor-inspection.test.js','test/selling-production-entry.test.js','test/vendor-inspection-cloud-media.test.js','test/selling-business-setup-separation.test.js','test/selling-fulfilment-setup.test.js','test/vendor-inspection-probe-bundle.test.js','test/vendor-orders-ui.test.js'];
test('retired dashboard files and inspection bypasses remain absent after the clean rebuild',()=>{
 for(const file of retired)assert.equal(fs.existsSync(path.join(root,file)),false,file);
 function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]);}
 const files=[...fs.readdirSync(root).filter(f=>f.endsWith('.html')).map(f=>path.join(root,f)),...['js','css','api','browser-checks','.github/workflows'].flatMap(f=>walk(path.join(root,f))),path.join(root,'vercel.json')];
 for(const file of files)if(/\.(html|js|css|json|ya?ml)$/.test(file))assert.doesNotMatch(fs.readFileSync(file,'utf8'),/selling-vendor(?:-manage)?\.html|selling-vendor\/(?:manage|inspect|onboarding)|vendor-development-workspace|vendor-inspection|vendor-inventory-gate|\/js\/vendor-(?:inventory|orders)\.js/,path.relative(root,file));
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/customer-browser-gate.yml'),'utf8');
 for(const match of workflow.matchAll(/node (browser-checks\/[^\s]+\.js)/g))assert.ok(fs.existsSync(path.join(root,match[1])),match[1]);
});
test('retirement preserves Marketing, customer, administration and shared data APIs',()=>{
 for(const file of ['marketing.html','business-workspace.html','business-results.html','customer.html','admin.html','api/businesses.js','api/businesses/[businessId].js','api/businesses/[businessId]/media/index.js','api/businesses/[businessId]/products.js','api/businesses/[businessId]/inventory.js','api/businesses/[businessId]/orders.js','api/_lib/database.js','api/_lib/persistence.js','api/_lib/demeos-authentication.js'])assert.ok(fs.existsSync(path.join(root,file)),file);
});
