"""Existing acceptance validator through a persistent native Node HTTPS client.
No hosted inference, origin fallback, deadline increase or quality approval.
"""
import sys,json,pathlib,subprocess,hashlib,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from acceptance import load_pack,run_case
from contracts import MODEL_ID,MODEL_VERSION
from urllib.error import HTTPError,URLError
from io import BytesIO
import argparse,re,urllib.parse
parser=argparse.ArgumentParser(description='Bounded native operator evaluation; never approves quality or activation.')
for field in ('origin','secret-file','weights-manifest-hash','runtime-code-hash','pack','media-root','output'):
 parser.add_argument('--'+field,required=True)
args=parser.parse_args()
url=urllib.parse.urlsplit(args.origin)
if url.scheme!='https' or not url.hostname or url.username or url.password or url.path not in ('','/') or url.query or url.fragment:raise ValueError('https-service-origin-required')
for value in (args.weights_manifest_hash,args.runtime_code_hash):
 if not re.fullmatch('[a-f0-9]{64}',value):raise ValueError('pinned-provenance-required')
secret_path=pathlib.Path(args.secret_file)
if not secret_path.is_file() or secret_path.stat().st_size>257 or secret_path.stat().st_mode&0o077:raise ValueError('private-secret-file-required')
credential=secret_path.read_bytes().strip()
if not 32<=len(credential)<=256 or any(c<=32 or c>126 for c in credential):raise ValueError('invalid-secret')
ORIGIN=args.origin.rstrip('/')
SECRET=str(secret_path.resolve())
WEIGHTS=args.weights_manifest_hash
CODE=args.runtime_code_hash
NODE=r'''
const fs=require('node:fs'),rl=require('node:readline');
const origin=process.argv[1],secret=fs.readFileSync(process.argv[2],'utf8').trim();
async function request(path,payload,limit,ms){
 if(payload)payload=require("node:zlib").gzipSync(Buffer.from(payload),{level:1});
 const r=await fetch(origin+path,{method:payload?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(ms),headers:{Authorization:'Bearer '+secret,...(payload?{'Content-Type':'application/json','Content-Encoding':'gzip','X-DEMEOS-Signature':require('node:crypto').createHmac('sha256',secret).update(payload).digest('hex')}:{})},...(payload?{body:payload}:{})});
 const reader=r.body.getReader(),chunks=[];let n=0;
 try{while(true){const x=await reader.read();if(x.done)break;n+=x.value.length;if(n>limit)throw Error('response-too-large');chunks.push(Buffer.from(x.value));}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 return {status:r.status,body:Buffer.concat(chunks).toString('utf8')};
}
(async()=>{
 try{console.log(JSON.stringify(await request('/healthz',null,2048,10000)));}catch(e){console.log(JSON.stringify({error:e.name}));process.exitCode=1;return;}
 for await(const line of rl.createInterface({input:process.stdin,crlfDelay:Infinity})){
  try{const item=JSON.parse(line);console.log(JSON.stringify(await request('/v1/infer',item.payload,36864,3000)));}catch(e){console.log(JSON.stringify({error:e.name}));}
 }
})();
'''
pack,assets,pack_hash=load_pack(args.pack,args.media_root)
output=pathlib.Path(args.output)
handle=output.open('x')
report=dict(schemaVersion=1,scope=pack['scope'],packHash=pack_hash,modelId=MODEL_ID,modelVersion=MODEL_VERSION,weightsManifestHash=WEIGHTS,runtimeCodeHash=CODE,route='native-operator-node-https-client-to-runtime',timeoutMs=2000,plannedCaseCount=len(pack['cases']),results=[],executionPassed=False,productAccuracyVerified=False,multilingualAccuracyVerified=False,categoryAccuracyVerified=False,activationApproved=False,operatorSourceHash=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest())
def checkpoint():
 handle.seek(0);handle.truncate();json.dump(report,handle,indent=2,ensure_ascii=False);handle.write('\n');handle.flush()
checkpoint()
p=subprocess.Popen(['node','-e',NODE,ORIGIN,SECRET],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True,bufsize=1)
try:
 started=time.perf_counter();health=json.loads(p.stdout.readline());report['preflightMs']=(time.perf_counter()-started)*1000
 assert health.get('status')==200
 h=json.loads(health['body']);assert h.get('ready') is True and h.get('busy') is False and h['modelId']==MODEL_ID and h['modelVersion']==MODEL_VERSION and h['weightsManifestHash']==WEIGHTS and h['runtimeCodeHash']==CODE
 report['health']=h;checkpoint();print('Exact native HTTPS health verified',flush=True)
 class Bridge:
  def open(self,req,timeout=3):
   assert req.full_url==ORIGIN+'/v1/infer'
   p.stdin.write(json.dumps({'payload':req.data.decode()})+'\n');p.stdin.flush();row=json.loads(p.stdout.readline())
   if row.get('error'):raise URLError(row['error'])
   raw=row['body'].encode()
   if row['status']!=200:raise HTTPError(req.full_url,row['status'],'runtime response',{},BytesIO(raw))
   return BytesIO(raw)
 secret=credential
 for case in pack['cases']:
  result=run_case(case,assets[case['asset']],ORIGIN,secret,WEIGHTS,CODE,Bridge());report['results'].append(result);checkpoint();print(case['id']+': '+('passed' if result['passed'] else 'failed'),flush=True)
  if not result['passed']:break
 report['executionPassed']=len(report['results'])==len(pack['cases']) and all(r['passed'] for r in report['results']);checkpoint()
 print(json.dumps({'executionPassed':report['executionPassed'],'count':len(report['results']),'minimumMs':min(r['endToEndMs'] for r in report['results']),'maximumMs':max(r['endToEndMs'] for r in report['results'])}),flush=True)
finally:
 p.terminate();p.wait(timeout=5);handle.close()
