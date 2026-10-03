# FinOps Agent pilot

## What runs where

1. SLA Review reads Dynatrace Problems, coverage, objectives, terms, and customer telemetry. Discovery creates a candidate in the app. It never starts Jev. A person marks one complete package ready. The app queues `sla.finops.review.ready` manually, or immediately after that save if the workspace has explicitly enabled automatic queueing.
2. A standard Dynatrace Workflow, triggered by that business event, runs `finops-agent/dynatrace-route.workflow.js`. It calls the router gateway through EdgeConnect, then ingests `sla.finops.route` back into Grail.
3. The gateway applies fixed evidence gates and, for a complete case, calls a **locally hosted Jev-compatible decision API**. The preferred pilot is Laya's `typed-decisions` checkpoint through its `/v1/systemone` server. The gateway emits a metadata-only OTLP route span. Bindplane can forward it to local Phoenix only after its trace allowlist is reviewed. No hosted inference endpoint is allowed.
4. The FinOps Agent view displays the recommendation and its work lane. Automatic lane assignment can be disabled independently and defaults to off. A reviewer selects the correct route and sends `sla.finops.feedback`. A second Dynatrace Workflow annotates the corresponding Phoenix span with a human correctness label and score **only after** the gateway's feedback switch is deliberately enabled following request-hash, trace-ID, and span-ID verification across Grail and Phoenix. The switch is off by default. After Phoenix confirms the write, the Workflow emits `sla.finops.feedback.recorded` with a disposition of `continued`, `disqualified`, or `needs_review`.
5. Only after `continued`, a person can record an external provider filing with its channel and receipt or ticket reference. SLA Review writes `sla.finops.filed` to Grail and displays **Filed, operator recorded**. It does not perform the provider submission.

The gateway returns `creditEligibility: undetermined` and `providerSubmission: not_sent` for every route. `prepare_provider_draft` means the contract owner may prepare a provider-specific package. It does not send a claim or decide eligibility. Provider submission needs a separate approval and provider-specific integration.

| Stage | Entered by | Next allowed action |
| --- | --- | --- |
| Candidate | Dynatrace Problem plus an SLA match in the app | Human evidence review |
| Ready | Human validated a complete, closed, single-service package | Manual queue or enabled automatic queue |
| Routed | Local model recommendation recorded in Grail; Phoenix receipt verified separately | Human outcome; optional suggested work lane |
| Disqualified | Human selected internal-only | No filing control |
| Continued | Human selected provider draft path | Optional draft handoff and external provider submission |
| Filed, operator recorded | Human supplied external receipt and channel | Track provider response and actual credit separately |

A second local model could draft a provider-specific narrative after `continued`, but no drafting endpoint or provider-specific filing channel is configured in this pilot. The decision model never produces the filed state.

## Local gateway

Node 24 or later is required. Set these environment variables in the gateway runtime:

| Variable | Meaning |
| --- | --- |
| `FINOPS_ROUTER_TOKEN` | Random bearer secret shared with the Dynatrace Credential Vault record. |
| `JEV_ENDPOINT` | Loopback-only Jev-compatible `/v1/systemone` URL. For Laya use `http://127.0.0.1:8000/v1/systemone`. Required. |
| `JEV_MODEL` | Explicit model ID sent to the local server. Set `typed-decisions` for Laya; default `openjev` for the Jev dialect. |
| `JEV_DIALECT` | `laya` for the explicit Laya adapter or `jev` for the original wire contract. Default `jev`. |
| `JEV_API_KEY` | Optional bearer key if the local decision service requires it. |
| `OTLP_TRACES_ENDPOINT` | Bindplane OTLP HTTP `/v1/traces` endpoint. In the inspected local Bindplane v31 configuration, use `http://127.0.0.1:14318/v1/traces`. Required. |
| `PHOENIX_BASE_URL` | Local Phoenix URL used for later span annotations. Required. |
| `PHOENIX_API_KEY` | Optional Phoenix bearer key. Required if Phoenix authentication is enabled. |
| `FINOPS_FEEDBACK_ENABLED` | `1` permits human-outcome annotations after cross-system identity verification. Default off. |
| `FINOPS_ROUTER_PORT` | Gateway port, default `8787`. |

Start with `node finops-agent/server.mjs`. It binds to `127.0.0.1` by default. On this Windows Docker Desktop host, the dedicated EdgeConnect container reaches the loopback-bound gateway through `host.docker.internal:8787`. In SAL, the exact host pattern is `sla-finops-router.internal`, mapped to `host.docker.internal`. A container on Docker's host network could not reach the Windows service at `127.0.0.1`, while `host.docker.internal` did. SAL's Verify URL test returned HTTP 200 for `http://sla-finops-router.internal:8787/health` after this mapping was saved. The gateway still requires its bearer token for `/route` and `/feedback`.

For Jev, the gateway requires `answers.route` with a supported choice, finite `confidence` at least 0.85, and selected probability at least 0.8. For Laya, set `JEV_DIALECT=laya`, `JEV_MODEL=typed-decisions`, and **leave `LAYA_JEV_STRICT=0`**. Laya's strict projection removes `routing` and `answer_confidence`, which the adapter uses to verify the checkpoint and gate on the selected-answer probability. The adapter sends `min_confidence=0.85`, requires `abstention=passed`, `routing.model=typed-decisions`, a complete three-route probability distribution, and `answer_confidence` at least 0.85 matching the selected probability. Laya's `confidence` is a separate entropy score and is recorded without applying Jev's cutoff to it. All thresholds are uncalibrated pilot values. Errors, malformed responses, abstention, and low confidence route to `human_review`.

### Isolated Laya pilot runtime

The local pilot uses `C:\temp\laya-local-pilot\.venv` and an isolated Hugging Face cache outside every Git checkout. Laya `0.3.24` was installed from PyPI. Its package requires Python `>=3.10`; the local environment uses Python `3.12.14`. The official `convaiinnovations/laya` checkpoint card reports Apache 2.0, and the selected `typed-decisions` files total **846,195,716 bytes** at revision `55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`. The installed PyTorch `2.14.1+cpu` has no CUDA support, so this pilot runs on CPU despite the host's GPU. Local disk use measured about 0.66 GiB for the virtual environment, 0.79 GiB for the checkpoint cache, and 0.63 GiB for uv's install cache. No weights belong in this repository.

Use only the pinned local cache for inference, with `LAYA_HOST=127.0.0.1`, `LAYA_PORT=8000`, `LAYA_MODELS=typed-decisions`, `LAYA_PRELOAD=1`, `LAYA_DEVICE=cpu`, `LAYA_REVISION=55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`, `HF_HUB_CACHE=C:\temp\laya-local-pilot\hf-cache`, `HF_HUB_OFFLINE=1`, and `LAYA_JEV_STRICT=0`. Start `C:\temp\laya-local-pilot\.venv\Scripts\python.exe -m laya.serve` only for a bounded synthetic test. Keep Ollama untouched. The gateway remains on loopback and requires its bearer token.

## Bindplane and Phoenix integration

Bindplane is the local OTLP intake and routing layer. Phoenix stores the route span and the later human annotation for evaluation. The gateway's `traceExported: true` means Bindplane accepted its OTLP HTTP request. It does **not** confirm that Bindplane forwarded the span or that Phoenix stored it. The route response contains `requestHash`, `traceId`, and `spanId`. Grail stores the raw `finops_request_id` plus these three values. Phoenix receives only `finops.request_hash` (the first 24 hex characters of SHA-256 of the request ID), trace ID, and span ID, never the raw case or request ID. Match all three, recomputing the hash from Grail's request ID, before treating the decision as captured. The feedback endpoint writes its annotation directly to Phoenix using the route span ID; it does not pass through Bindplane and is disabled by default.

The inspected live `personal-ai-lab-local` Bindplane configuration was v31 on one connected Windows collector. It receives OTLP HTTP at `127.0.0.1:14318`, exports traces to Phoenix at `127.0.0.1:6006`, and has a strict span allowlist. That allowlist does not include this gateway's instrumentation scope, `sla-finops-router`, so its current route spans would be dropped. Add that exact scope to the trace filter, then add an explicit normalization rule for this scope with `app.telemetry.source = sla-finops-router`, `app.lane = sla-finops`, and `telemetry.canonical = true`. Keep the existing native telemetry and subscription cost rules separate. The router's local model decision is not an API charge; record its model ID and local compute basis without inventing a dollar cost.

Before changing the live Bindplane collector, preserve revision 31 and make the filter change as a reviewed revision. Send one manually reviewed synthetic test case. Check `finops_request_id` in Grail against the gateway request, recompute its `requestHash`, and match the hash, trace ID, and span ID in Phoenix. Only then set `FINOPS_FEEDBACK_ENABLED=1` and submit a synthetic human outcome. Confirm the Phoenix annotation and `sla.finops.feedback.recorded` event. Until this end-to-end check passes, feedback remains off.

## Dynatrace setup

1. Deploy the updated app and grant `openpipeline:bizevents:ingest` and `storage:bizevents:read` to the app and relevant users. The `finops-routing` App Settings object controls automatic queueing and automatic work-lane assignment. Both default to off and fail closed if settings cannot be read. Business event ingestion may incur Dynatrace license usage.
2. Configure EdgeConnect to reach the gateway's exact internal host. The verified SAL mapping uses `http://sla-finops-router.internal:8787` to the loopback-bound gateway through Docker Desktop. Add that exact host in **Settings > General > External requests**. The EdgeConnect control channel is outbound and authenticated; the gateway requires a bearer token for route and feedback calls.
3. Create a Credential Vault token record for `FINOPS_ROUTER_TOKEN`. Enable AppEngine scope and **Allow access without app context**; give the Workflow actor access.
4. Create a **standard Workflow** with a business event trigger filtered to `event.type == "sla.finops.review.ready"`. Add a Run JavaScript task using `dynatrace-route.workflow.js`. Verify the EdgeConnect URL and replace `BRIDGE_CREDENTIAL_ID`. Pin the `@dynatrace-sdk/client-classic-environment-v2` and `@dynatrace-sdk/automation-utils` SDK major versions in the task. The Workflow actor needs business event write access and Credential Vault read access.
5. Create a second standard Workflow triggered by `event.type == "sla.finops.feedback"`. Add a Run JavaScript task using `dynatrace-feedback.workflow.js` and the same gateway host and credential.
6. Verify one synthetic case: candidate, human ready decision, manual trigger, Workflow execution, `sla.finops.route` in Grail, FinOps Agent row, and the matching OTLP span in Phoenix. After the identity check, enable feedback, record a synthetic human outcome, and confirm a `finops_route_correctness` Phoenix annotation and `sla.finops.feedback.recorded` in Grail. Keep automatic queueing and lane assignment off for the pilot. Do not record a filed claim without a person's real external provider channel and receipt or ticket reference.

Read the resulting events with:

```dql
fetch bizevents, from:-30d
| filter event.provider == "sla-review"
  and in(event.type, "sla.finops.review.ready", "sla.finops.route", "sla.finops.feedback", "sla.finops.feedback.recorded", "sla.finops.filed")
| fields timestamp, event.type, finops_request_id, finops_request_hash, finops_case_id, finops_problem_id, finops_provider, finops_route, finops_disposition, finops_trace_id, finops_span_id, finops_filing_reference
| sort timestamp desc
```

## Pilot limits before production enablement

- The app queues only cases with one closed Problem, one affected service, one provider service, confirmed scope, collected customer availability below an applicable SLA target, and no missing requirements. This avoids comparing blended telemetry with a single SLA target. The lookback metric remains a screening signal, not a contract-period credit calculation.
- A ready event is a snapshot. A later evidence change does not revoke it. Before any provider submission capability, the Workflow must re-read the current App Settings evidence decision and reject stale or forged events. The current gateway cannot independently verify a Dynatrace business event's origin.
- Before production, restrict disposition and filing actions to a contract-owner role and verify the `continued` state on the server side. The current UI enforces the transition for normal use, while business-event ingestion alone is not an authorization boundary.
- Repeated queueing can produce repeated decisions. Add a durable idempotency key before high-volume operation.
- Automatic lane assignment is a field in the app's routing event, not assignment to a named person or a provider claim. Final disposition is always a human outcome. A filed record is a human attestation backed by an external reference, not proof that the provider accepted the claim.
- Phoenix receives a route trace and a later human annotation. A trace by itself is not an accuracy evaluation. Track labeled-case accuracy, false provider drafts, abstention rate, latency, and model/version drift before adjusting thresholds.
- No Jev service was observed locally. Laya `0.3.24` loaded the pinned typed-decisions checkpoint on CPU. The original isolated synthetic test returned `answer_confidence=0.4207`, `abstention=abstained`, and a gateway `human_review` route. During the SAL rollout staging, a second synthetic request reached the local Laya gateway and Bindplane intake; it also routed to `human_review`. Bindplane revision 31 still dropped that scope, so Phoenix did not contain the span. Startup warned that a separate `choice:11+` temperature was clamped, so treat checkpoint calibration as unverified. The gateway-to-Grail-to-Phoenix identity check and human annotation remain unverified. See [the rollout status](finops-rollout-status.md) for the current deployment state.
- The `openjev/openjev` weights cited by the earlier pilot use CC BY-NC 4.0. Laya's package and selected official checkpoint report Apache 2.0. Verify legal and security review for any production use; the checkpoint's published benchmark does not validate this SLA routing task.
- The first Workflow begins after an operator queues a reviewed case. A direct Davis Problem trigger with automatic SLA relevance filtering is not implemented. The app already reads and groups relevant Problems; a future direct trigger needs a trusted check against current SLA mappings and evidence state.
- The production SLA app remained at version `0.0.76` at the start of this rollout. The Problems-read scope fix is in the staged release, not yet a verified production deployment. See [the rollout status](finops-rollout-status.md).

## References

- [Dynatrace event triggers](https://docs.dynatrace.com/docs/analyze-explore-automate/workflows/build/trigger/event-trigger)
- [Dynatrace Workflow JavaScript, external requests, and Credential Vault](https://docs.dynatrace.com/docs/analyze-explore-automate/workflows/default-workflow-actions/run-javascript-workflow-action)
- [Dynatrace EdgeConnect](https://docs.dynatrace.com/docs/ingest-from/edgeconnect)
- [Dynatrace business event SDK](https://developer.dynatrace.com/develop/sdks/client-classic-environment-v2/)
- [Phoenix annotations](https://arize.com/docs/phoenix/tracing/concepts-tracing/concepts-annotations)
- [Laya upstream repository and serving guidance](https://github.com/NandhaKishorM/laya)
- [Official Laya checkpoint and license](https://huggingface.co/convaiinnovations/laya)
- [OpenJev model card and serving instructions](https://huggingface.co/openjev/openjev)
