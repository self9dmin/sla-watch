// Paste into a Run JavaScript task in a standard Workflow triggered by the
// business event type sla.finops.review.ready. Set the credential ID below.
import { execution } from "@dynatrace-sdk/automation-utils";
import { businessEventsClient, credentialVaultClient } from "@dynatrace-sdk/client-classic-environment-v2";
import { appSettingsObjectsClient } from "@dynatrace-sdk/client-app-settings-v2";

const ROUTER_URL = "http://private-router.example.invalid:8787/route";
const BRIDGE_CREDENTIAL_ID = "CREDENTIALS_VAULT-REPLACE_ME";

export default async function () {
  const ex = await execution();
  const event = ex.params.event;
  if (event?.["event.type"] !== "sla.finops.review.ready") throw new Error("Unexpected trigger event.");
  const packet = JSON.parse(event["finops.packet"]);
  if (packet.requestId !== event["finops.request_id"] ||
      packet.reviewedAt !== event["finops.reviewed_at"] ||
      !["manual", "automatic"].includes(event["finops.trigger_mode"]) ||
      typeof event["finops.auto_assign_lane"] !== "boolean")
    throw new Error("Ready event identity or routing controls are invalid.");
  if (packet.schemaVersion !== 1 || !packet.problemClosed ||
      packet.reviewStatus !== "validated" || !packet.reviewCurrent ||
      !packet.scopeConfirmed || !packet.customerTelemetryAvailable ||
      packet.missingRequirementsCount !== 0 ||
      packet.requestId !== `${packet.caseId}|${packet.reviewedAt}`)
    throw new Error("Ready event does not contain one complete current review.");
  const routing = await appSettingsObjectsClient.getAppSettingsObjects({
    schemaId: "finops-routing", addFields: "value", pageSize: 2,
  });
  if (routing.error || routing.nextPageKey || routing.totalCount > 1 ||
      !Array.isArray(routing.items) || routing.items.length !== routing.totalCount)
    throw new Error("Current FinOps routing settings are unavailable or ambiguous.");
  const controls = routing.items.length === 0
    ? { autoQueueAfterReady: false, autoAssignLane: false }
    : routing.items[0].value;
  if (routing.items.length > 0 &&
      (controls?.configurationKey !== "workspace" ||
       typeof controls.autoQueueAfterReady !== "boolean" ||
       typeof controls.autoAssignLane !== "boolean"))
    throw new Error("Current FinOps routing settings are invalid.");
  if ((event["finops.trigger_mode"] === "automatic" && !controls.autoQueueAfterReady) ||
      event["finops.auto_assign_lane"] !== controls.autoAssignLane)
    throw new Error("Automatic routing or lane assignment is not currently enabled.");
  const decisions = await appSettingsObjectsClient.getAppSettingsObjects({
    schemaId: "evidence-decisions", addFields: "value", pageSize: 500,
  });
  if (decisions.error || decisions.nextPageKey ||
      !Array.isArray(decisions.items) || decisions.items.length !== decisions.totalCount)
    throw new Error("Current evidence decisions are unavailable or incomplete.");
  const current = decisions.items.filter(({ value }) =>
    value?.decisionKey === `${packet.providerSlug}|${packet.problemId}`.toLowerCase());
  const decision = current.length === 1 ? current[0].value : null;
  if (!decision || decision.status !== "validated" ||
      decision.reviewedAt !== packet.reviewedAt ||
      decision.providerSlug !== packet.providerSlug ||
      decision.problemId !== packet.problemId ||
      !Array.isArray(decision.providerServiceIds) ||
      decision.providerServiceIds.length !== 1 ||
      decision.providerServiceIds[0] !== packet.providerServiceId)
    throw new Error("The reviewed evidence decision is stale or contradictory.");
  const credential = await credentialVaultClient.getCredentialsDetails({ id: BRIDGE_CREDENTIAL_ID });
  const response = await fetch(ROUTER_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${credential.token}`, "content-type": "application/json" },
    body: JSON.stringify(packet),
  });
  if (!response.ok) throw new Error(`FinOps router returned HTTP ${response.status}.`);
  const result = await response.json();
  if (!result.traceExported || result.providerSubmission !== "not_sent" ||
      !/^[0-9a-f]{24}$/.test(result.requestHash) ||
      !/^[0-9a-f]{32}$/.test(result.traceId) || !/^[0-9a-f]{16}$/.test(result.spanId) ||
      !["prepare_provider_draft", "internal_only", "human_review"].includes(result.route))
    throw new Error("Router audit contract failed.");
  const assignedLane = event["finops.auto_assign_lane"] && ["jev", "laya"].includes(result.source)
    ? result.route === "prepare_provider_draft" ? "finops"
      : result.route === "internal_only" ? "operations" : "unassigned"
    : "unassigned";
  await businessEventsClient.ingest({
    type: "application/json; charset=utf-8",
    body: {
      "event.type": "sla.finops.route",
      "event.provider": "sla-review",
      finops_request_id: packet.requestId,
      finops_case_id: packet.caseId,
      finops_request_hash: result.requestHash,
      finops_problem_id: packet.problemId,
      finops_provider: packet.providerSlug,
      finops_route: result.route,
      finops_case_status: "routed",
      finops_assigned_lane: assignedLane,
      finops_trigger_mode: event["finops.trigger_mode"],
      finops_reason: result.reason,
      finops_model: result.model ?? "policy",
      finops_confidence: result.confidence,
      finops_trace_id: result.traceId,
      finops_span_id: result.spanId,
      finops_reviewed_at: event["finops.reviewed_at"],
      finops_provider_submission: "not_sent",
      finops_credit_eligibility: "undetermined",
    },
  });
  return { caseId: packet.caseId, route: result.route, traceId: result.traceId };
}
