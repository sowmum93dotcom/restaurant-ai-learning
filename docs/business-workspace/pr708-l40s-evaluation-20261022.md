# PR #708 — fresh L40S evaluation, 22 October 2026

Status: native hardware evaluation passed. ROOT application-to-GPU-to-saved-result-to-user-review acceptance is NOT complete. Draft PR retained; no merge or Production change.

## Authorisation and resource
Owner ceiling: $100 cumulative evaluation expenditure including earlier spending; $2.50 per GPU-hour. The owner deployed exactly one L40S replacement through Safari after the agent's paid-start action was rejected by automatic approval review.
- Pod: massive_lavender_scorpion, r50cslfgj1dvd7; OC-AU-1 Secure Cloud.
- NVIDIA L40S, 46,068 MiB; driver 595.91.07; 16 vCPU, 94 GB RAM, 50 GB temporary disk.
- Actual image: runpod/pytorch:1.4.0-cu1281-torch280-ubuntu2404. PyTorch 2.8.0+cu128; CUDA available; GPU tensor sum 1024.0.
- GPU $1.09/hour plus temporary disk $0.007/hour, displayed rounded total $1.10/hour.
- Same original Global volume dizzy_indigo_worm at /workspace. Original model, incomplete shard backup, earlier reports and source files were preserved. No new volume or model download.

## Fresh verification
Source commit 849b374f30fac31c2d410aeaf8895fdda29bd2a8 was cloned on the pod. All 29 Python runtime software tests passed; these tests are fixtures, distinct from the subsequent GPU measurements.
The original publisher-derived manifest SHA-256 remains e2c07fc24e1523d0987dfb6b082020c0eb74a04eb622f36c153fd97c5d254ae2.
All 13 model files were copied from existing Global storage and independently hashed as the restricted demeos-ai user. Read-only checks passed. Pinned snapshot ebb281ec70b05090aa6165b016eac8ec08e71b17.
The exact runtime code hash is 896e7aa734ddd2f7a8a35da257cd1ca61956a26854fb9966fb107baaa50e4ed1, unchanged from the reviewed executor.
Sequential Global reads were slow. A bounded eight-reader operator copy improved staging; no inference code or deadline changed. Its final root-context read-only check correctly rejected root's write access; the separate restricted-user integrity check then passed every file. This operator check rejection is preserved in demeos-parallel.log and is not a weights mismatch.
The genuine service ran as demeos-ai with the existing outbound syscall restrictions and authenticated, signed requests. No hosted inference provider or database/Blob/provider credentials were supplied to the model.

## Actual measurements
These are authenticated LOOPBACK hardware measurements on the fresh L40S, not external HTTPS or ROOT application latency. The 2,000 ms execution limit was unchanged.
| Evaluation | Passed | Minimum client ms | Maximum client ms |
| --- | ---: | ---: | ---: |
| Synthetic single-image/four-frame hardware benchmark | 10/10 | 140.00385400140658 | 487.5985819962807 |
| Repository-controlled image/language/instruction-conflict execution pack | 31/31 | 189.68950302223675 | 583.0772659974173 |
Peak allocated VRAM across these runs: 9,060,421,120 bytes. Health returned ready true, busy false, and the exact reviewed model/code/weights hashes.
Product accuracy, fluent multilingual quality, fine-detail accuracy, complete category coverage, cold end-to-end performance and human review remain pending. No success or review record was fabricated in ROOT.

## Preserved raw evidence
Global directory: /workspace/demeos-evaluation-20261022/l40s-r50cslfgj1dvd7/
- demeos-l40s-benchmark.json
- demeos-l40s-acceptance.json
- demeos-integrity.json
- demeos-health.json
- demeos-run-summary.json
- demeos-runtime-tests.log, demeos-prepare.log, demeos-parallel.log, demeos-server-checked.log, demeos-evaluate.log
- evidence-sha256.json
- credential-free runtime-source-849b374.tar.gz and operator recovery scripts.
All ten evidence files were copied, read back and hash-compared; saved JSON files were parsed successfully. No service secret was archived. The attempted browser archive export did not synchronize into the local workspace, so no downloadable bundle is claimed.

## ROOT and remaining boundary
Signed-in ROOT Preview opened and listed the authorised Mango and Preview acceptance product 19 Oct through explicit Selling-share consent. Existing personal work history remained visible. Branch Preview PGHOST matched its isolation guard. Visual execution remained false; the separate ROOT visual flag was not enabled. No new ROOT native result or review was saved.
The owner-deployed pod exposes only HTTP 8888 (Jupyter) and TCP SSH. It does not expose the native service port 18081. RunPod's Edit Pod screen explicitly warns that editing a running pod resets it and loses container data. The edit was cancelled. No public runtime port, credential, Preview enable setting or deployment was changed.
Remaining: configure the authenticated HTTPS route on this SAME allocation after reviewing the reset/public-exposure step; restore the reviewed runtime, rotate the per-run service secret, verify Preview/Production isolation, conduct the genuine ROOT private-media -> signed native GPU -> private saved result -> accept/correct/reject/reload journey, revoke temporary access, and stop compute. Do not create another GPU resource or increase the deadline to make it pass.

## Shutdown and cost evidence
After evidence preservation, the native supervisor was signalled to terminate, and the provider Stop Pod action completed. Independent RunPod Details showed compute Not running, container storage Not running, total $0.00/hour, with the original Global volume still attached. All eight RunPod allocations displayed $0.00/hour.
Fresh Vast reload confirmed instance 56929706 Inactive, original 80 GB disk retained at $0.017/hour. No Vast start was executed.
Displayed balances: RunPod $24.03 before / $23.46 after; Vast $23.41 before / $23.39 after. Displayed deduction during this work: $0.59, comprising $0.57 RunPod and $0.02 Vast retained-resource deductions. Against the verified sole $35 RunPod and $25 Vast deposits, displayed cumulative deductions are $13.15. These are balance differences, NOT a settled itemised invoice: RunPod reports delayed billing and retained storage continues. Remaining nominal cap is $86.85 before delayed charges.

## Later provider read-back and pending connection edit
A subsequent stopped-pod screenshot showed RunPod $23.42 while Vast remained $23.39. Thus the latest displayed cumulative deduction is $13.19, with $0.63 displayed during this work ($0.61 RunPod plus $0.02 Vast); the earlier $13.15 read was not settled billing. Delayed charges and retained storage still prevent a final invoice claim.
The same STOPPED pod's Edit Pod form is prepared with HTTP ports 8888,18081, unchanged TCP 22, image, disk and Global volume. Save has NOT been selected. No network exposure or paid restart has been applied. The proposed runtime remains subject to bearer/HMAC authentication, exact model provenance and the separate Preview-only ROOT grant. User action/confirmation is needed for public exposure and paid restart; do not create another pod.

## Confirmed connection configuration
After the owner's explicit instruction to continue, saved HTTP ports 8888,18081 on the same stopped pod r50cslfgj1dvd7. Reopened Edit Pod and independently read back 8888,18081; TCP remains 22, disk 50 GB, image unchanged. The pod is still stopped. No new resource, service startup, Preview enable setting or Production change. Paid Start remains subject to the earlier automatic-review handoff boundary; the owner is being shown the same pod's Start for $1.09/hr button.
