'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {promisify}=require('node:util');
const execFile=promisify(require('node:child_process').execFile);

test('the deployed inspection bundle can load and run its video probe without the source node_modules', {skip:process.platform!=='linux'||process.arch!=='x64'}, async()=>{
 const root=path.resolve(__dirname,'..'),bundle=await fs.mkdtemp(path.join(os.tmpdir(),'demeos-probe-bundle-'));
 try{
  // These wrapper files are traced by Vercel; its dynamic platform dependency
  // must be supplied by includeFiles. Isolate the bundle to expose missing files.
  const wrapper='node_modules/@ffprobe-installer/ffprobe';
  await fs.mkdir(path.join(bundle,'node_modules/@ffprobe-installer'),{recursive:true});
  await fs.cp(path.join(root,wrapper),path.join(bundle,wrapper),{recursive:true});
  const configured=require('../vercel.json').functions['api/businesses.js'].includeFiles;
  for(const entry of configured.replace(/^\{|\}$/g,'').split(',').filter(p=>p.startsWith('node_modules/@ffprobe-installer/'))){
   await fs.mkdir(path.dirname(path.join(bundle,entry)),{recursive:true});
   await fs.copyFile(path.join(root,entry),path.join(bundle,entry));
  }
  const modulePath=path.join(bundle,wrapper);
  const code="const p=require(process.argv[1]).path;const r=require('node:child_process').execFileSync(p,['-v','error','-show_entries','format=duration','-of','json',process.argv[2]],{encoding:'utf8'});process.stdout.write(r);";
  const {stdout}=await execFile(process.execPath,['-e',code,modulePath,path.join(root,'images/vendor-inspection/sample-jacket.mp4')],{cwd:bundle,env:{...process.env,NODE_PATH:''},timeout:10000});
  assert.equal(Number(JSON.parse(stdout).format.duration),3);
 }finally{await fs.rm(bundle,{recursive:true,force:true});}
});
