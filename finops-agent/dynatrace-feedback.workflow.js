// Paste into a Run JavaScript task in a standard Workflow triggered by
// business event type sla.finops.feedback. Use the same gateway and credential.
import { execution } from "@dynatrace-sdk/automation-utils";
import { businessEventsClient, credentialVaultClient } from "@dynatrace-sdk/client-classic-environment-v2";

const FEEDBACK_URL = "http://sla-finops-router.internal:8787/feedback";
const BRIDGE_CREDENTIAL_ID = "CREDENTIALS_VAULT-REPLACE_ME";

export default async function () {
  const ex = await execution();
  const event = ex.params.event;
  if (event?.["event.type"] !== "sla.finops.feedback") throw new Error("Unexpected trigger event.");
  if (!/^[0-9a-f]{24}$/.test(event.finops_request_hash) ||
      !/^[0-9a-f]{32}$/.test(event.finops_trace_id) ||
      !/^[0-9a-f]{16}$/.test(event.finops_span_id) ||
      !["prepare_provider_draft", "internal_only", "human_review"].includes(event.finops_correct_route))
    throw new Error("Invalid human outcome.");
  const credential = await credentialVaultClient.getCredentialsDetails({ id: BRIDGE_CREDENTIAL_ID });
  const response = await fetch(FEEDBACK_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${credential.token}`, "content-type": "application/json" },
    body: JSON.stringify({
      requestHash: event.finops_request_hash,
      traceId: event.finops_trace_id,
      spanId: event.finops_span_id,
      recommendedRoute: event.finops_recommended_route,
      correctRoute: event.finops_correct_route,
    }),
  });
  if (!response.ok) throw new Error(`FinOps feedback returned HTTP ${response.status}.`);
  const result = await response.json();
  if (!result.annotated) throw new Error("Phoenix did not confirm the annotation.");
  const disposition = event.finops_correct_route === "prepare_provider_draft" ? "continued"
    : event.finops_correct_route === "internal_only" ? "disqualified" : "needs_review";
  await businessEventsClient.ingest({
    type: "application/json; charset=utf-8",
    body: {
      "event.type": "sla.finops.feedback.recorded",
      "event.provider": "sla-review",
      finops_case_id: event.finops_case_id,
      finops_request_id: event.finops_request_id,
      finops_request_hash: event.finops_request_hash,
      finops_trace_id: event.finops_trace_id,
      finops_span_id: event.finops_span_id,
      finops_correct_route: event.finops_correct_route,
      finops_disposition: disposition,
      finops_route_correct: result.correct,
    },
  });
  return { spanId: event.finops_span_id, annotated: true, disposition, correct: result.correct };
}
