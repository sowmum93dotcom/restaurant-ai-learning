# PR708 native acceptance — 23 October 2026

Application source: `b220be3489fcb50475c85bee97f0e7e95ef41241`, on the existing `rebuild/selling-foundation-phase-1` PR branch. No merge or Production deployment. This is engineering execution evidence, not human language review or customer activation approval.

## Exact provenance

- Model: Qwen3-VL-4B-Instruct, revision `ebb281ec70b05090aa6165b016eac8ec08e71b17`.
- Thirteen original model files independently verified against the publisher-derived weights manifest `e2c07fc24e1523d0987dfb6b082020c0eb74a04eb622f36c153fd97c5d254ae2`.
- Final runtime hash: `ee970cec4ba2996bdc6c2c11d0ce4cab849043f89cf78b18e6f2d5bbb289853d`.
- Hardware: NVIDIA L40S, torch 2.8.0+cu128 with CUDA available. Non-root read-only model verification passed. Same supervised offline worker and existing signed native transport; no hosted inference.

## Findings and corrections

The initial runtime `e6c87ab1ed561d33735e23e6a0c5a5b2ed4adb70dc3cc5a2d99d84f4e6a02e90` completed six text schema cases, then stopped on Hindi at 1,977 ms with a generic native-request-failed result. This older report does not establish the underlying HTTP failure code. Arabic and Chinese replies were in English despite passing the response schema. The failed report and its raw successful responses remain preserved; they were not relabelled or overwritten.

The ROOT prompt now repeats an explicit instruction in the requested language after the separate user text and requests one short sentence. The model still has a 64-token limit and the same 2,000 ms deadline; exhausted output is rejected, not repaired or translated. Prompt instructions do not grant tools or account access and remain advisory controls rather than an authorisation boundary.

The shared transport now preserves only bounded exact supervisor status/code pairs: HTTP 504 execution-timeout and the four fixed HTTP 502 model failure codes. Arbitrary error bodies remain excluded from reports. The operator records those codes, stops on the first failure and never retries. This diagnostic change does not retroactively diagnose the older Hindi failure.

## Final runtime results

| Check | Result | Measured maximum |
| --- | --- | --- |
| Native signed HTTPS ROOT text, ten locales plus two access/instruction fixtures | 12/12 execution cases passed | 1,685 ms |
| Original visual acceptance pack, same native HTTPS worker | 31/31 execution cases passed | 1,051.867 ms |
| Local loopback hardware benchmark, five image and five four-frame requests | 10/10 passed | 826.637 ms |

Text minimum was 529 ms; visual minimum was 404.598 ms. The sampled Arabic and Chinese replies use their requested scripts after the correction. The two access fixtures declined to claim private revenue access, account verification or purchases. These observations are limited samples; product, category and multilingual accuracy flags and activation approval remain false. The hardware benchmark excludes the external proxy, application SQL admission and browser path.

Final report SHA-256 values, independently compared byte-for-byte with persistent backups:

- Text: `10fe4c5f3d79f0f54b43791e5a41fd524df5f183d4ed2538ce267340085b2ddd`.
- Visual: `632e47a26f563fac240e4d8102c26e8d790fef2114986fea9066a4ec1360060f`.
- Hardware: `f347a6d35b332bab7b2ca4925297e2b11e6beb2560278a27eed4214ee409dfab`.

Local regression checks passed: 19 Node tests covering health, operator failures, ROOT SQL/authorisation/deadlines and existing Selling transport; 24 Python contract/prompt/supervisor tests. Responses in these local tests are declared fixtures and do not substitute for the native results above.

## Integration and cleanup

The exact application commit reached READY on a Preview deployment, target null. Baseline workflow 39963099319 and video workflow 39963099311 succeeded. Browser workflow 39963099255 was still running at this checkpoint; its completion must be checked separately.

The Preview navigation reached Vercel protection. Automatic approval review rejected creation of a temporary authenticated access link because it would expand access to the protected deployment without sufficiently specific authorisation. No workaround, protection change or Preview execution flag activation followed. Signed-in browser-to-API-to-SQL native save/reload/review is still unverified. Existing local SQL integration fixtures passed, but are not genuine Preview acceptance.

Reports and original failure evidence were backed up before shutdown. Original model files and previous backups were preserved. The native processes were terminated and independently checked absent; the per-run service key and local operator copy were revoked. The temporary console was disabled, the inference HTTP port removed, and paid compute stopped. Provider readback showed both compute and container storage Not running and total $0/hour. Retained model/evidence storage remains separate from compute charges.

Next work: obtain specifically scoped access to the protected PR708 Preview, verify its identity/database isolation again, then run one controlled signed-in native request through save, reload and review. Keep text disabled outside that bounded test and retain existing spend limits and cleanup requirements. No customer release, human language approval, merge or Production action is authorised by this report.
