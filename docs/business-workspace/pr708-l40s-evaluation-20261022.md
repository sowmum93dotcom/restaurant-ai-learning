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

## Restarted same pod and bounded application-route review
The owner manually restarted r50cslfgj1dvd7 with HTTP ports 8888,18081. The fresh container reuses the original Global source. A 32-reader copy reported ENOMEM; it was replaced by the proven eight-reader method into a new temporary destination, preserving both original files and the partial local copy. The eight-reader restoration completed in 748.0498993396759 seconds. All 13 files independently passed the restricted demeos-ai read-only verification again, with the same e2c07fc24e1523d0987dfb6b082020c0eb74a04eb622f36c153fd97c5d254ae2 manifest. Local authenticated health returned ready true and the exact reviewed code/model hashes. Provider HTTP Service 18081 reports Ready.
A fresh per-run secret was installed privately and configured only for this branch Preview; no model, database, cloud or provider credentials were disclosed. PGHOST again equals its test guard and differs from Production. Neon independently identifies br-flat-snow-zatzl87u as non-primary demeos-pr708-selling-preview. Baseline saved ROOT native results: zero. Actual browser Customer mode hides Selling integration and has a separate empty history; returning to Business restores the existing saved correction.
The GPU operator's default Python urllib client received HTTPS 403, fixed edge body error code 1010, while local authenticated health succeeded. That client polling was stopped; no browser identity spoofing, security disablement or successful HTTPS inference is claimed. The actual Vercel application transport remains to be tested.

### Review ID pr708-l40s-controlled-benchmark-20261022
AI-assisted operator review for the next bounded isolated Preview test only. Reviewed the fresh 10/10 and 31/31 native loopback measurements above, repeated model integrity, unchanged runtime code, the existing licence/security records, exact authenticated provider TLS origin and branch/Production database separation. This permits measuring the actual Vercel-to-GPU route under the owner's current $100 cumulative and $2.50/GPU-hour ceilings; it is NOT an HTTPS latency pass, human language approval or customer/Production release. Use a fresh benchmark review identifier so the bounded evaluation has a distinct configuration identity. Keep the original 2,000 ms limit, authorised test media and one-job/20-hourly budget. Stop on a genuine application failure, retain its evidence, and disable temporary execution and stop compute when the bounded evaluation ends. No original product, media, history, backup or model data may be removed.

## Actual Vercel route and first product failures
Temporary Preview redeployment dpl_2HFaTUkYNZwCxfa6DK5SLGyGNQ79 was independently confirmed READY, target null (Preview), on the existing branch/source e0ba25b. ROOT's own authenticated Vercel-to-native health preflight succeeded in 894 ms. This is connection evidence, not inference acceptance. No user-agent spoofing or provider security setting change was used.
Mango was correctly rejected before GPU admission: its legacy ready image has no processedHash or processedSizeBytes. Its original data was preserved. The existing Preview acceptance product 19 Oct has a ready 111,866-byte, 1254x1254 image with the required recorded checksum. Its first controlled request created claim 8839d651-4cc4-48b3-a1f3-937baf16b529 but returned unavailable without a validated output or ROOT saved native work. The active reservation was retained by the deadline safeguards; no success was invented.
Both temporary Preview enable settings were disabled during diagnosis. At 19:02:31 UTC the dedicated native service was terminated and nvidia-smi returned no compute processes. Only then was that exact expired claim reconciled to a failed audit event, preserving its hourly job count and all prior records. No blanket reservation reset or data deletion occurred.

## Targeted timing repair and controlled retest boundary
The authorisation path called getKnownBusiness repeatedly, which also queried campaign/customer aggregates unrelated to visual authorisation. A fresh ownership-filtered SQL snapshot now reads the current product/profile and the same bounded media selection together; every permission/revision check still reads current database state. ROOT uses this path only for visual delegation; legacy deterministic sharing keeps its existing compatibility. Foreign ownership, media changes and ownership revoked during execution remain denied. No new table, migration, executor, model, registry, dashboard, permission grant, hosted inference or deadline increase was introduced.
Preview-only fixed stage timings contain only stage names, elapsed milliseconds and fixed execution codes, never supplied text, media URLs, IDs or secrets. These distinguish media signing/fetch, scope recheck and validated GPU return in the next genuine run.
Validation: 30 focused ROOT/private-runtime/visual checks and 32 ownership/persistence checks passed. These include real local SQL and protocol tests with explicitly labelled model fixtures; they are not fresh GPU acceptance. The changed application path still requires a new bounded live request and saved-result/review evidence before completion can be claimed.

## Final transport checkpoint — incomplete acceptance, compute stopped

Continue the owner-approved architecture: one shared DEMEOS-controlled ROOT intelligence system, separate applications and authorisation/data ownership, existing 171-category registry and guarded search. This checkpoint does not redesign it or declare the assignment complete. PR #708 remains open and draft; no merge or Production deployment was performed.

The fresh atomic scope repair was followed by two further genuine ROOT requests against the existing verified acceptance product. The second timed out at 2,269 ms overall (scope rechecked at 907 ms). Combining SQL ledger admission/cache into one round trip and charging admission time against the unchanged deadline reduced the third request to 2,083 ms overall (scope rechecked at 727 ms), still a failure. Expired admissions never start GPU work; a final permission check crossing the deadline cannot persist success. The one-job and 20-jobs/hour rules remain. The third failed reservation, f3f88b98-d527-416f-84e8-157f8cf96e22, is still active in SQL; closing that exact expired claim and adding its failure audit was rejected by automatic approval review, which requires explicit approval for that write. It must not be blanket-reset or treated as a running GPU.

HTTP/1.1 connection reuse alone did not solve the external path. Native code f325db5f7606acdabcd57c7f9efbe7baa672bffabb461900c22e9feef1acd06b returned HTTP 400 for the first external case at 2,376.505 ms; no model duration was present in that failed report. Bounded gzip transport was then committed as f52c317d245c14b11ae7ee0f1080b65d970ae8c1, exact native runtime hash 7368e842310e3f1cd76ba711936ed955964519c0b7b41c0ebbddcc91c44befa3. This authenticates compressed wire bytes before bounded decoding, preserving the original image, checksum and 2,000 ms deadline. It passed 31 Python protocol fixtures on both operator and GPU hosts, plus 19 focused Node checks. Fixtures are not native acceptance.

The full-size original camping image still failed current external Node clients. Node 24 returned HTTP 504 execution-timeout at 2,049.539 ms. A separate warm request returned genuine, provenance-validated native output, `Tent beside lake fire`, with model duration 205.811 ms and peak VRAM 8,964,444,672 bytes, but end-to-end time was 2,235.595 ms. Therefore its acceptance status is false. The matching original-image loopback comparison completed in 270.091 ms (model 207.633 ms). These measurements identify transport overhead as material; they do not establish its exact internal cause or approve quality. Only the first controlled case was run in each external comparison; do not claim a new 31-case HTTPS pass. Raw operator reports are in pr708-evidence-20261022 beside this document.

A smaller derived-image diagnostic was prepared to investigate transfer size. Automatic approval review rejected continuation because it changes the required acceptance media. That diagnostic is not accepted evidence and no derivative was substituted into ROOT. Explicit approval is required before proceeding with smaller representations; originals must remain preserved and derivative/source hashes must be recorded separately.

The dedicated native processes were terminated; a fresh nvidia-smi process query was empty at 20:09:53 UTC. Nineteen additional credential-free reports/logs/recovery helpers were copied to the existing Global https-session-20261022 directory and SHA256-verified by read-back; transport-checkpoint-sha256.json records them. The provider Stop action was then completed and independently verified: all eight existing RunPod pods show $0.00/hour, the L40S shows Compute Not running and Container storage Not running. The original dizzy_indigo_worm Global mount remains /workspace, now 13 GB and 225 objects. The preserved Vast instance 56929706 remains Inactive, with 18/80 GB retained disk. No resource was deleted or duplicated.

Both branch Preview execution flags are false, verified through the connector and rendered ROOT availability. The per-run Preview credential was rotated after testing. Deployment dpl_BDZoVK9UWwp5CxpfT5fYd5A6KH9g was READY with target null and branch commit f52c317; subsequent evidence commits remain Preview only. The standalone workspace still functions with model execution honestly unavailable.

### Costs observed after shutdown

| Item | Exact displayed value / verified rate |
| --- | --- |
| L40S GPU during evaluation | $1.09/hour |
| Temporary container disk during evaluation | $0.007/hour; combined $1.097/hour, UI rounds $1.10 |
| RunPod compute after stopping | $0.00/hour |
| Last observed RunPod balance | $21.21 |
| Last observed Vast balance | $23.36 |
| Verified original deposits | $35 RunPod + $25 Vast = $60 |
| Cumulative displayed deductions, including previous spending | $60 - $21.21 - $23.36 = $15.43 |
| Retained Vast disk rate | $0.017/hour; data retained intentionally |

Balances are delayed, cent-rounded provider displays, not a settled itemised invoice or exact isolated-session charge. Global/retained storage can continue charging after GPU shutdown. No new payment was made. The observed deductions remain below the owner's $100 cumulative ceiling and the active GPU rate below $2.50/hour.

### Owner acceptance matrix

| Required capability | Actual evidence | Remaining gap |
| --- | --- | --- |
| ROOT independent application | Existing /root-ai login, personal workspace, supplied-text analysis and saved review work in Preview | Independent general native model tools and separate external-user live acceptance remain incomplete |
| Authorised DEMEOS vendor | Actual owned product selection and deterministic share; fresh ownership/media revision checks and SQL tests | Native saved vendor result still fails deadline |
| Customer request | Real Customer request saved, corrected and retrieved through ROOT; SQL work d224c931-6762-4443-9331-7eeb703c1741, revision 2, corrected | Deterministic category evidence only, not model reasoning or commerce availability |
| Existing Marketing Search Engine | ROOT imports the existing category interpreter and authoritative 171-category registry; no duplicate registry/search engine | Full ROOT-to-semantic-search/guarded-ranking user journey not demonstrated |
| B2B/B2C separation | Actual Business and Customer histories differ; Customer hides Selling integration; existing access tests pass | Broader multi-application live journeys still required |
| External-user isolation | Personal identity/audience workspace derivation and foreign/revoked-owner denial tests | A separate real external account live test was not performed; do not equate owner Customer mode with external identity |
| Native GPU and saved retrieval | Original model integrity verified; genuine loopback and external HTTPS output measured | SQL confirms zero saved ROOT works with modelExecuted=true; GPU-to-save/review is incomplete |
| End-to-end recorded evidence | Customer deterministic save/correction/retrieval captured in screenshots and SQL; failed native flow retained | All eight requirements are not yet passed; no customer or Production release |

Customer request: `On-Demand Groceries: I need apples and carrots for dinner. ROOT customer Preview acceptance 22 October.` The saved correction is `Customer Preview test: apples and carrots requested. Category match only; no model or availability claim.` Opening the saved work retrieved that exact correction. Switching Business restored only the prior Business work; switching Customer restored only the Customer work and kept Selling hidden. These are real Preview persistence checks, expressly not native inference evidence. See pr708-evidence-20261022/application-infrastructure-checkpoint.json and root-customer-review-retrieved.jpg.
