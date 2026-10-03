# SAL FinOps Agent rollout status

Status recorded 2026-10-02 EDT (2026-10-03 UTC). This is an evidence log, not a declaration that the decision path is live.

## Release source

- Production tenant: `https://sal98008.apps.dynatrace.com/`, existing app ID `my.sla`.
- Canonical GitHub repository: `self9dmin/sla-watch`. Its `main` was `f1c9e6c2f4d6730276e85dc9e25ba7cc4e8a69a7` at staging. The installed app was `0.0.76`.
- The `0.0.78` release checkout combines the uncommitted production-app work from `C:\temp\DTapp\projects\SLA-workspace\sla` with the FinOps pilot from `C:\temp\Codex\sla-watch`. Neither source checkout was overwritten.
- In the release checkout, typecheck, 12 FinOps tests, 211 repository tests, lint, build, bundle analysis, and an App Toolkit production-tenant dry run passed. A dry run does not deploy the app.

## Verified private route and local inference

- A dedicated SAL EdgeConnect configuration named `sla-finops-router-local` is online on version `1.744.0`. Its sole host pattern is `sla-finops-router.internal`; the host mapping targets Docker Desktop's `host.docker.internal`.
- The dedicated EdgeConnect container uses an outbound connection and a configuration file stored outside Git. The local gateway still binds only to `127.0.0.1:8787` and requires a bearer token for decision and feedback requests. SAL's Verify URL test returned HTTP 200 and the gateway's configured health body through EdgeConnect.
- Laya `0.3.24` and its pinned Apache-2.0 `typed-decisions` checkpoint served locally on CPU at `127.0.0.1:8000`. The gateway used the explicit Laya dialect and exported metadata-only OTLP to the local Bindplane receiver at `127.0.0.1:14318`. Phoenix feedback remained disabled.
- Synthetic request `SYNTH-SAL-FINOPS-001|2026-10-03T03:18:58.221Z` returned `human_review`, source `laya`, reason `laya_uncertain`, `providerSubmission=not_sent`, and `traceExported=true`. Its request hash was `608c24b8d27ca3635a58ca4c`, trace ID `5af3b0e8f005c7e78f1a1727eec74428`, and span ID `627540fef4ff8682`. `traceExported` means Bindplane intake accepted the span, not that Phoenix retained it.
- A read-only Phoenix SQL query for that exact trace and span returned zero rows. The live Bindplane configuration remains revision 31 and its filter omits the `sla-finops-router` scope. No Phoenix evaluation or human annotation was attempted.

## Pending before a live case

1. Complete the owner-only Credential Vault token record for the gateway. SAL's Vault UI requires AppEngine scope and `Allow access without app context` for a Workflow. It defaults application access to `All applications`, so a strictly Workflow-only Vault scope has not been verified. Browser password-field protection prevents automated entry of the token, and no credential record has been saved.
2. Save and roll out a reviewed Bindplane revision that admits only the gateway's redacted `finops.route` spans, while preserving existing lab traffic and excluding case content. Confirm collector health and that the synthetic trace appears in Phoenix with the same request hash, trace ID, and span ID.
3. Deploy the two standard Dynatrace Workflows with exact business-event filters for `sla.finops.review.ready` and `sla.finops.feedback`. The route Workflow needs the private EdgeConnect URL and the Vault credential ID. The feedback Workflow and gateway feedback switch must stay inactive until the gateway, Grail, and Phoenix identity check passes.
4. Deploy `my.sla` version `0.0.78` only after the route Workflow and token are ready, then smoke-test a synthetic candidate, human evidence review, manual queue, Grail route event, FinOps Agent row, Phoenix span, synthetic human outcome, Phoenix annotation, and Grail feedback event. Keep automatic queueing and automatic lane assignment off.
5. Make the local Laya and gateway processes durable under the PC owner's account, and document the PC availability requirement. The current foreground processes are only for a bounded synthetic test. Do not treat the private EdgeConnect connection alone as a working production service.

Provider eligibility stays `undetermined`; provider submission stays `not_sent`. The model cannot file a claim. A filed event is a person's attestation with a provider channel and receipt or ticket reference. No real customer case content was sent to Phoenix or a hosted inference API in this staging work.
