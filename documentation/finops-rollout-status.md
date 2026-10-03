# SAL FinOps Agent rollout status

Status recorded 2026-10-02 EDT (2026-10-03 UTC). This is an evidence log, not a declaration that the decision path is live.

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

## Pending before a live case

1. Complete the owner-only Credential Vault token record for the gateway. SAL's Vault UI requires AppEngine scope and `Allow access without app context` for a Workflow. It defaults application access to `All applications`, so a strictly Workflow-only Vault scope has not been verified. Browser password-field protection prevents automated entry of the token, and no credential record has been saved.
2. Confirm the revision 32 collector and Phoenix path remain healthy after the change. The gateway-to-Phoenix synthetic check passed; the gateway-to-Grail-to-Phoenix identity check remains pending until the route Workflow writes Grail's event.
3. Deploy the two standard Dynatrace Workflows with exact business-event filters for `sla.finops.review.ready` and `sla.finops.feedback`. The route Workflow needs the private EdgeConnect URL and the Vault credential ID. The feedback Workflow and gateway feedback switch must stay inactive until the gateway, Grail, and Phoenix identity check passes.
4. Deploy `my.sla` version `0.0.78` only after the route Workflow and token are ready, then smoke-test a synthetic candidate, human evidence review, manual queue, Grail route event, FinOps Agent row, Phoenix span, synthetic human outcome, Phoenix annotation, and Grail feedback event. Keep automatic queueing and automatic lane assignment off.
5. Make the local Laya and gateway processes durable under the PC owner's account, and document the PC availability requirement. The current foreground processes are only for a bounded synthetic test. Do not treat the private EdgeConnect connection alone as a working production service.

Provider eligibility stays `undetermined`; provider submission stays `not_sent`. The model cannot file a claim. A filed event is a person's attestation with a provider channel and receipt or ticket reference. No real customer case content was sent to Phoenix or a hosted inference API in this staging work.
