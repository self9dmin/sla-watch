# SAL FinOps Agent rollout status

Status updated 2026-10-03 EDT. This is an evidence log, not a declaration that the complete decision and feedback path is live.

## Release source

- Production tenant: `https://sal98008.apps.dynatrace.com/`, existing app ID `my.sla`.
- Canonical GitHub repository: `self9dmin/sla-watch`. Its `main` was `f1c9e6c2f4d6730276e85dc9e25ba7cc4e8a69a7` at staging. The installed app was `0.0.76`.
- The `0.0.78` release checkout combines the uncommitted production-app work from `C:\temp\DTapp\projects\SLA-workspace\sla` with the FinOps pilot from `C:\temp\Codex\sla-watch`. Neither source checkout was overwritten.
- In the release checkout, typecheck, 12 FinOps tests, 211 repository tests, lint, build, bundle analysis, and an App Toolkit production-tenant dry run passed. A dry run does not deploy the app.
- On 2026-10-02, the production dependency audit found high-severity `GHSA-vfj7-8cjw-p6xm` in `braces` through Dynatrace's `devkit` dependency tree. The advisory listed no patched version. Neither `braces`, `micromatch`, nor `@dynatrace/devkit` appeared in the generated UI or function bundle metafiles or external imports. CI has a temporary exception only for this exact five-package advisory tree, only while those packages are absent from both bundles, expiring 2026-11-01 UTC. Any changed or new advisory, failed audit request, missing bundle proof, or expired exception fails the gate. This is a build-dependency risk decision, not a claim that the package is fixed.

## Verified private route and local inference

- A dedicated SAL EdgeConnect configuration named `sla-finops-router-local` is online on version `1.744.0`. Its sole host pattern is `sla-finops-router.internal`; the host mapping targets Docker Desktop's `host.docker.internal`.
- The dedicated EdgeConnect container uses an outbound connection and a configuration file stored outside Git. The local gateway still binds only to `127.0.0.1:8787` and requires a bearer token for decision and feedback requests. SAL's Verify URL test returned HTTP 200 and the gateway's configured health body through EdgeConnect.
- Laya `0.3.24` and its pinned Apache-2.0 `typed-decisions` checkpoint served locally on CPU at `127.0.0.1:8000`. The gateway used the explicit Laya dialect and exported metadata-only OTLP to the local Bindplane receiver at `127.0.0.1:14318`. Phoenix feedback remained disabled.
- Synthetic request `SYNTH-SAL-FINOPS-001|2026-10-03T03:18:58.221Z` returned `human_review`, source `laya`, reason `laya_uncertain`, `providerSubmission=not_sent`, and `traceExported=true`. Its request hash was `608c24b8d27ca3635a58ca4c`, trace ID `5af3b0e8f005c7e78f1a1727eec74428`, and span ID `627540fef4ff8682`. `traceExported` means Bindplane intake accepted the span, not that Phoenix retained it.
- Before the Bindplane change, a read-only Phoenix SQL query for that exact trace and span returned zero rows. Revision 31 omitted the `sla-finops-router` scope.
- Bindplane revision 32 was then deployed to its one connected collector. The reviewed diff added only the exact router scope to the Phoenix trace allowlist, local-compute provenance for that scope, and an exception to the lab's personal user-ID rule for this service span. The collector reported Connected on version 32.
- Synthetic request `SYNTH-SAL-FINOPS-002|2026-10-03T03:29:34.207Z` returned `human_review`, source `laya`, reason `laya_uncertain`, and `providerSubmission=not_sent`. Its request hash was `f8a113889dd3eb7e32f8ae2f`, trace ID `50d1266f22bb6922cb68164fa1921181`, and span ID `d06b93eab9d6418c`. A read-only Phoenix SQL query found exactly one span with all three identifiers, route `human_review`, source `sla-finops-router`, cost basis `local-compute-no-api-charge`, and no `user.id`. This verifies gateway to Bindplane to Phoenix for synthetic metadata only. Grail and the Dynatrace Workflow have not been exercised for this request, so the three-system identity check remains open. No Phoenix evaluation or human annotation was attempted.

## Production rollout progress on 2026-10-03

- PR #1 merged into the canonical `self9dmin/sla-watch` `main` at `d05eba645f30fecd7f1ab0358d2fcd70415783c3`. The release checkout tree matched that merge. App Toolkit reported `my.sla` version `0.0.78` deployed to SAL. Browser verification remains outstanding because Chrome browser control timed out.
- The user saved owner-only AppEngine Token credential `CREDENTIALS_VAULT-C740FD8630E9FF9D`. Metadata confirmed `allowContextlessRequests=true` and `allowedEntities=[]` (the Vault's all-applications selection). The saved value differed from the earlier local token. With the user's explicit approval, the local DPAPI-encrypted gateway token was replaced with that saved value, and the old encrypted value was backed up outside Git. The gateway alone was restarted. An authorized empty packet returned HTTP 400 at the input gate, confirming the new bearer token was accepted without model inference.
- Standard route Workflow `db52f637-58ca-48b1-98ad-4b27f19389ae` and feedback Workflow `834284af-beed-4faa-8d62-acf4345dfc53` were created with exact business-event filters. The feedback Workflow is undeployed. The route trigger is currently **disabled** after synthetic execution `54adc602-dc78-4b22-ab1f-5ce9cc26e86e` stopped before the gateway: SAL Run JavaScript did not provide `@dynatrace-sdk/client-app-settings-v2`. No route event or three-system identity proof came from that run.
- The follow-up `0.0.79` source adds an SLA app function to re-read current evidence and routing controls inside the app context. The Workflow calls that function before the gateway. Typecheck, lint, 214 tests, build, bundle analysis, and the production dependency audit passed locally. The audit still relies on the narrowly gated `braces` exception described above. This source has not yet been merged or deployed.
- A dedicated Windows Scheduled Task now runs the gateway under the PC owner's account; a separate enabled logon task is prepared for Laya. The existing Laya process remains healthy without a restart. These local tasks require this PC, the user's logon, Docker Desktop, and the network to stay available.

## Pending before a live case

1. Merge and deploy `0.0.79`, update the route Workflow script, and prove its app-function review gate works for both an absent and a current synthetic evidence decision.
2. Re-enable only the route Workflow after the synthetic validation, then verify one decision's request ID and request hash, trace ID, and span ID across gateway, Grail, and Phoenix. Keep automatic queueing and automatic lane assignment off.
3. Only after the identity check, deliberately enable local Phoenix feedback and the feedback Workflow, then verify one synthetic human outcome annotation and `sla.finops.feedback.recorded` in Grail. Do not use real customer case content in Phoenix without explicit local data-handling approval.
4. Verify the app UI in Chrome and the production Problems-read scope, and record the PC availability requirement for operators. Chrome browser control was unavailable at this update.

Provider eligibility stays `undetermined`; provider submission stays `not_sent`. The model cannot file a claim. A filed event is a person's attestation with a provider channel and receipt or ticket reference. No real customer case content was sent to Phoenix or a hosted inference API in this staging work.
