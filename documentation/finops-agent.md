# Automate: FinOps routing pilot

## What runs where

1. SLA Review reads Dynatrace Problems, coverage, objectives, terms, and customer telemetry. Discovery creates a candidate in the app. It never starts Jev. A person marks one complete package ready. The app queues `sla.finops.review.ready` manually, or immediately after that save if the workspace has explicitly enabled automatic queueing.
2. A standard Dynatrace Workflow, triggered by that business event, runs `finops-agent/dynatrace-route.workflow.js`. It calls the SLA app's `finopsReviewGate` function to re-read the current evidence decision and routing controls in the app's settings context. Only then does it call the router gateway through EdgeConnect and ingest `sla.finops.route` back into Grail.
3. The gateway applies fixed evidence gates and, for a complete case, calls a **locally hosted Jev-compatible decision API**. The preferred pilot is Laya's `typed-decisions` checkpoint through its `/v1/systemone` server. The gateway emits a metadata-only OTLP route span. Bindplane can forward it to local Phoenix only after its trace allowlist is reviewed. No hosted inference endpoint is allowed.
4. The Automate view displays the recommendation and its work lane. Automatic lane assignment can be disabled independently and defaults to off. A reviewer selects the correct route and sends `sla.finops.feedback`. A second Dynatrace Workflow first verifies the original route identifiers and recommendation in Grail, then annotates the corresponding Phoenix span with a human correctness label and score. The gateway's feedback switch defaults to off and should be enabled only after the cross-system identity check. After Phoenix confirms the write, the Workflow emits `sla.finops.feedback.recorded` with a disposition of `continued`, `disqualified`, or `needs_review`.
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
| `OTLP_TRACES_ENDPOINT` | Loopback Bindplane OTLP HTTP `/v1/traces` endpoint. Required. |
| `PHOENIX_BASE_URL` | Local Phoenix URL used for later span annotations. Required. |
| `PHOENIX_API_KEY` | Optional Phoenix bearer key. Required if Phoenix authentication is enabled. |
| `FINOPS_FEEDBACK_ENABLED` | `1` permits human-outcome annotations after cross-system identity verification. Default off. |
| `FINOPS_ROUTER_PORT` | Gateway port, default `8787`. |

Start with `node finops-agent/server.mjs`. It binds to `127.0.0.1` by default. Configure a private EdgeConnect hostname and verify that the collector can reach the local gateway before enabling a Workflow. Keep the hostname and Credential Vault ID in the tenant's private configuration, outside this repository. The gateway requires its bearer token for `/route` and `/feedback`.

For Jev, the gateway requires `answers.route` with a supported choice, finite `confidence` at least 0.85, and selected probability at least 0.8. For Laya, set `JEV_DIALECT=laya`, `JEV_MODEL=typed-decisions`, and **leave `LAYA_JEV_STRICT=0`**. Laya's strict projection removes `routing` and `answer_confidence`, which the adapter uses to verify the checkpoint and gate on the selected-answer probability. The adapter sends `min_confidence=0.85`, requires `abstention=passed`, `routing.model=typed-decisions`, a complete three-route probability distribution, and `answer_confidence` at least 0.85 matching the selected probability. Laya's `confidence` is a separate entropy score and is recorded without applying Jev's cutoff to it. All thresholds are uncalibrated pilot values. Errors, malformed responses, abstention, and low confidence route to `human_review`.

### Isolated Laya pilot runtime

Keep the Laya virtual environment and Hugging Face cache outside every Git checkout. Laya `0.3.24` from PyPI requires Python `>=3.10`. The official `convaiinnovations/laya` checkpoint card reports Apache 2.0, and the selected `typed-decisions` files total **846,195,716 bytes** at revision `55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`. A CPU-only runtime is sufficient for a bounded pilot but may have higher latency. No weights belong in this repository.

Use only a pinned local cache for inference, with `LAYA_HOST=127.0.0.1`, `LAYA_PORT=8000`, `LAYA_MODELS=typed-decisions`, `LAYA_PRELOAD=1`, `LAYA_DEVICE=cpu`, `LAYA_REVISION=55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`, `HF_HUB_CACHE` pointing to the private local cache, `HF_HUB_OFFLINE=1`, and `LAYA_JEV_STRICT=0`. Run `python -m laya.serve` from the isolated environment for bounded synthetic tests. The gateway remains on loopback and requires its bearer token.

## Bindplane and Phoenix integration

Bindplane is the local OTLP intake and routing layer. Phoenix stores the route span and the later human annotation for evaluation. The gateway's `traceExported: true` means Bindplane accepted its OTLP HTTP request. It does **not** confirm that Bindplane forwarded the span or that Phoenix stored it. The route response contains `requestHash`, `traceId`, and `spanId`. Grail stores the raw `finops_request_id` plus these three values. Phoenix receives the opaque request hash (the first 24 hex characters of SHA-256 of the request ID), trace and span IDs, route, reason, model, confidence, and policy metadata. It does not receive the raw case or request ID, provider label, observed availability, SLA target, prompt, or evidence text. Match the hash and both IDs against Grail before treating the decision as captured. The feedback endpoint writes its annotation directly to Phoenix using the route span ID; it does not pass through Bindplane. The production Workflow checks that the human feedback refers to one matching original Grail route before it calls this endpoint.

Configure a local Bindplane collector to receive the gateway's OTLP spans and forward only the `sla-finops-router` scope to local Phoenix. Review its trace allowlist and provenance mapping before enabling the route. Existing native telemetry and subscription cost rules remain separate. The router's local model decision is not an API charge; record its model ID and local compute basis without inventing a dollar cost.

Before setting `FINOPS_FEEDBACK_ENABLED=1`, use one synthetic request to match the gateway request ID to Grail and its hash, trace ID, and span ID to Phoenix. Then verify a human outcome annotation and a matching `sla.finops.feedback.recorded` event. Keep execution IDs and trace IDs in a private rollout record.

## Dynatrace setup

1. Deploy the updated app and grant `openpipeline:bizevents:ingest` and `storage:bizevents:read` to the app and relevant users. Give only setup operators `automation:workflows:read/write`; the write grant covers Dynatrace Workflows broadly. The `finops-routing` App Settings object controls automatic queueing and automatic work-lane assignment. Both default to off and fail closed if settings cannot be read. Business event ingestion may incur Dynatrace license usage.
2. In **Coverage**, verify an unambiguous provider-native resource match or explicitly confirm its provider product. In **Automate**, select its product, account, and region, then inspect the linked resources, dependent services, common terms target, and 30-day customer request preview. Confirm **Create product scope objective** only when every linked service has valid traffic and no existing native SLO overlaps it. The app uses one deterministic product/account/region ID and will not create an objective on page load. This customer screening SLO is not a provider SLA or claim unit.
3. Configure EdgeConnect to reach the gateway through a private HTTPS `.internal` host and add that host in **Settings > General > External requests**. The EdgeConnect control channel is outbound and authenticated; the gateway requires a bearer token for route and feedback calls. The app's Workflow form accepts the origin only, with no path or token.
4. Create an owner-only Credential Vault token record for `FINOPS_ROUTER_TOKEN`. Enable AppEngine scope and **Allow access without app context** for the Workflow actor. In Dynatrace apps with access, select only the Workflows app (`dynatrace.automations`) instead of the all-applications default. Contextless access remains a separate capability and is not equivalent to Workflow-only authorization.
5. In **Automate**, inspect the earlier FinOps Agent Workflows and the proposed replacement. Choose the expected local Laya or Jev-compatible response source, enter the private EdgeConnect origin and Credential Vault **record ID**, and choose **Prepare Workflow drafts**. The app creates one private, undeployed tenant-wide pair for `sla.finops.review.ready` and `sla.finops.feedback`, not a Workflow per service or resource. It does not install, start, or switch the local model. The route task checks that the response source matches the selected local interface; a policy fallback may only route to human review. If one draft already exists, the app creates only the missing one. A title collision or an edited task requires inspection in Workflows. Never deploy the new event triggers while the earlier pair remains active.
6. Inspect both drafts in Dynatrace Workflows before deployment. Verify the event matchers, Run JavaScript tasks, EdgeConnect host, actor, Credential Vault access, and business-event ingest grants. The route Workflow actor needs permission to run the SLA app's `finopsReviewGate` function. That function reads `finops-routing` and `evidence-decisions` in the app's settings context and rejects disabled automatic controls, a missing or superseded evidence decision, and incomplete results. The Run JavaScript runtime may lack `@dynatrace-sdk/client-app-settings-v2`; use the app function for that check. Deploying is a separate action in Workflows and activates the configured event trigger.
7. Verify one synthetic case: candidate, human evidence review complete, manual trigger, Workflow execution, `sla.finops.route` in Grail, Automate row, and the matching OTLP span in Phoenix. After the identity check, enable feedback, record a synthetic human outcome, and confirm a `finops_route_correctness` Phoenix annotation and `sla.finops.feedback.recorded` in Grail. Keep automatic queueing and lane assignment off for the pilot. Retire the old pair of event triggers before deploying the replacement pair, then repeat the synthetic check after deployment. Do not record a filed claim without a person's real external provider channel and receipt or ticket reference.

The Workflow source scripts remain in `finops-agent/dynatrace-route.workflow.js` and `finops-agent/dynatrace-feedback.workflow.js`. The app bundles generated copies from those files; run `npm run sync:finops-workflows` after editing either source. `npm run check:finops-workflows` fails when they differ. Runtime host and Credential Vault IDs are inserted only into private Workflow drafts, not committed to the repository.

Read the resulting events with:

```dql
fetch bizevents, from:-30d
| filter event.provider == "sla-review"
  and in(event.type, "sla.finops.review.ready", "sla.finops.route", "sla.finops.feedback", "sla.finops.feedback.recorded", "sla.finops.filed")
| fields timestamp, event.type, finops_request_id, finops_request_hash, finops_case_id, finops_problem_id, finops_provider, finops_route, finops_disposition, finops_trace_id, finops_span_id, finops_filing_reference
| sort timestamp desc
```

## Limits of the live local-host pilot

- The app queues only cases with one closed Problem, one affected service, one provider service, confirmed scope, collected customer availability below an applicable SLA target, and no missing requirements. This avoids comparing blended telemetry with a single SLA target. The lookback metric remains a screening signal, not a contract-period credit calculation.
- A ready event is a snapshot. The route Workflow calls the SLA app's review gate, which re-reads the saved evidence decision and routing settings before the gateway, and rejects a superseded review or a disabled automatic control. It does not independently recompute telemetry or authenticate the business event origin, so its output remains a recommendation requiring human review. Before any provider submission capability, add a trusted origin and current-evidence check.
- Before relying on filed records for a controlled production process, restrict disposition and filing actions to a contract-owner role and verify the `continued` state on the server side. The current UI enforces the transition for normal use, while business-event ingestion alone is not an authorization boundary.
- Repeated queueing can produce repeated decisions. Add a durable idempotency key before high-volume operation.
- Automatic lane assignment is a field in the app's routing event, not assignment to a named person or a provider claim. Final disposition is always a human outcome. A filed record is a human attestation backed by an external reference, not proof that the provider accepted the claim.
- Phoenix receives a route trace and a later human annotation. A trace by itself is not an accuracy evaluation. Track labeled-case accuracy, false provider drafts, abstention rate, latency, and model/version drift before adjusting thresholds.
- The Laya checkpoint's confidence thresholds and calibration remain pilot assumptions. Keep uncalibrated or abstained decisions in `human_review`, and verify one complete gateway-to-Grail-to-Phoenix trace plus a later human annotation before evaluating model quality.
- The `openjev/openjev` weights cited by the earlier pilot use CC BY-NC 4.0. Laya's package and selected official checkpoint report Apache 2.0. Verify legal and security review for any production use; the checkpoint's published benchmark does not validate this SLA routing task.
- The first Workflow begins after an operator queues a reviewed case. A direct Davis Problem trigger with automatic SLA relevance filtering is not implemented. The app already reads and groups relevant Problems; a future direct trigger needs a trusted check against current SLA mappings and evidence state.
- Installation and scope verification are environment-specific release checks. Record their results in private operations notes, not in this public repository.

## References

- [Dynatrace event triggers](https://docs.dynatrace.com/docs/analyze-explore-automate/workflows/build/trigger/event-trigger)
- [Dynatrace Workflow JavaScript, external requests, and Credential Vault](https://docs.dynatrace.com/docs/analyze-explore-automate/workflows/default-workflow-actions/run-javascript-workflow-action)
- [Dynatrace EdgeConnect](https://docs.dynatrace.com/docs/ingest-from/edgeconnect)
- [Dynatrace business event SDK](https://developer.dynatrace.com/develop/sdks/client-classic-environment-v2/)
- [Phoenix annotations](https://arize.com/docs/phoenix/tracing/concepts-tracing/concepts-annotations)
- [Laya upstream repository and serving guidance](https://github.com/NandhaKishorM/laya)
- [Official Laya checkpoint and license](https://huggingface.co/convaiinnovations/laya)
- [OpenJev model card and serving instructions](https://huggingface.co/openjev/openjev)
