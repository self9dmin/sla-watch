export const ROUTER_POLICY_VERSION = "finops-1";

const ROUTES = new Set(["prepare_provider_draft", "internal_only", "human_review"]);
const MODEL_CONFIDENCE_MIN = 0.85;
const SELECTED_PROBABILITY_MIN = 0.8;
const PROVIDER_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

const requiredText = (value, name, max = 160) => {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new TypeError(`${name} must be a nonempty string of at most ${max} characters.`);
  return value.trim();
};

const requiredBoolean = (value, name) => {
  if (typeof value !== "boolean") throw new TypeError(`${name} must be a boolean.`);
  return value;
};

const finiteNumber = (value, name, min, max) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new TypeError(`${name} must be a number from ${min} to ${max}.`);
  return value;
};

/** A bounded, metadata-only packet assembled by the Dynatrace workflow. */
export function parseRoutePacket(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("The route packet must be an object.");
  if (value.schemaVersion !== 1) throw new TypeError("Unsupported route packet version.");
  const providerSlug = requiredText(value.providerSlug, "providerSlug", 64);
  if (!PROVIDER_SLUG.test(providerSlug)) throw new TypeError("Invalid providerSlug.");
  const reviewStatus = requiredText(value.reviewStatus, "reviewStatus", 32);
  if (!["validated", "not-ready", "dismissed", "unreviewed"].includes(reviewStatus))
    throw new TypeError("Invalid reviewStatus.");
  const reportStatus = requiredText(value.providerReportStatus, "providerReportStatus", 32);
  if (!["matched", "not-matched", "not-configured", "unavailable"].includes(reportStatus))
    throw new TypeError("Invalid providerReportStatus.");
  const packet = {
    schemaVersion: 1,
    requestId: requiredText(value.requestId, "requestId", 360),
    reviewedAt: requiredText(value.reviewedAt, "reviewedAt", 40),
    caseId: requiredText(value.caseId, "caseId"),
    problemId: requiredText(value.problemId, "problemId"),
    providerSlug,
    providerServiceId: requiredText(value.providerServiceId, "providerServiceId"),
    problemClosed: requiredBoolean(value.problemClosed, "problemClosed"),
    reviewStatus,
    reviewCurrent: requiredBoolean(value.reviewCurrent, "reviewCurrent"),
    scopeConfirmed: requiredBoolean(value.scopeConfirmed, "scopeConfirmed"),
    customerTelemetryAvailable: requiredBoolean(value.customerTelemetryAvailable, "customerTelemetryAvailable"),
    observedAvailabilityPercent: value.observedAvailabilityPercent === null
      ? null : finiteNumber(value.observedAvailabilityPercent, "observedAvailabilityPercent", 0, 100),
    slaTargetPercent: value.slaTargetPercent === null
      ? null : finiteNumber(value.slaTargetPercent, "slaTargetPercent", 0, 100),
    missingRequirementsCount: finiteNumber(value.missingRequirementsCount, "missingRequirementsCount", 0, 100),
    providerReportStatus: reportStatus,
    davisImpact: requiredText(value.davisImpact, "davisImpact", 120),
  };
  if (Number.isNaN(Date.parse(packet.reviewedAt)) ||
      packet.requestId !== `${packet.caseId}|${packet.reviewedAt}`)
    throw new TypeError("Route request identity does not match the review.");
  return packet;
}

export function hardGate(packet) {
  if (packet.reviewStatus === "dismissed") return "operator_excluded";
  if (!packet.problemClosed) return "problem_open";
  if (packet.reviewStatus !== "validated") return "operator_review_required";
  if (!packet.reviewCurrent) return "review_stale";
  if (!packet.scopeConfirmed) return "scope_unconfirmed";
  if (!packet.customerTelemetryAvailable || packet.observedAvailabilityPercent === null)
    return "customer_telemetry_missing";
  if (packet.slaTargetPercent === null) return "sla_target_missing";
  if (packet.observedAvailabilityPercent >= packet.slaTargetPercent) return "screening_target_not_breached";
  if (packet.missingRequirementsCount > 0) return "requirements_missing";
  return null;
}

export function jevRequest(packet, model = "openjev", dialect = "jev") {
  return {
    model,
    ...(dialect === "laya" ? { min_confidence: MODEL_CONFIDENCE_MIN } : {}),
    state: {
      provider: packet.providerSlug,
      provider_service_id: packet.providerServiceId,
      observed_customer_availability_percent: packet.observedAvailabilityPercent,
      applicable_sla_target_percent: packet.slaTargetPercent,
      provider_report_status: packet.providerReportStatus,
      davis_impact: packet.davisImpact,
      note: "Provider reports and customer impact are separate evidence. This is a routing recommendation, not a finding of provider fault or credit eligibility.",
    },
    questions: {
      route: {
        type: "choice",
        instructions: "Which internal next step best fits the evidence? Choose human_review when attribution or applicability remains ambiguous.",
        criteria: {
          prepare_provider_draft: "Prepare an evidence package for a contract owner's review of possible provider follow-up. Do not send it.",
          internal_only: "Keep the case in the internal operations process; provider follow-up is not supported by these facts.",
          human_review: "A person needs to inspect the evidence before choosing either path.",
        },
      },
    },
  };
}

/** A local decision model recommends a lane. Policy controls the action and fails to human review. */
export async function decideRoute(packet, callJev, model = "openjev", dialect = "jev") {
  const gate = hardGate(packet);
  if (gate) return {
    route: gate === "operator_excluded" ? "internal_only" : "human_review",
    reason: gate,
    source: "policy",
    confidence: null,
    model: null,
    creditEligibility: "undetermined",
    providerSubmission: "not_sent",
    policyVersion: ROUTER_POLICY_VERSION,
  };
  try {
    if (!["jev", "laya"].includes(dialect) || (dialect === "laya" && model !== "typed-decisions"))
      throw new TypeError("Unsupported local decision model configuration.");
    const response = await callJev(jevRequest(packet, model, dialect));
    const answer = response?.answers?.route;
    const route = answer?.choice;
    const probability = answer?.probabilities?.[route];
    const confidence = dialect === "laya" ? answer?.answer_confidence : answer?.confidence;
    if (answer?.type !== "choice" || !ROUTES.has(route) ||
        typeof confidence !== "number" || !Number.isFinite(confidence) ||
        typeof probability !== "number" || !Number.isFinite(probability) ||
        confidence < 0 || confidence > 1 || probability < 0 || probability > 1)
      throw new TypeError("The local model returned an invalid route answer.");
    if (dialect === "laya") {
      const probabilities = answer.probabilities;
      const values = [...ROUTES].map((name) => probabilities?.[name]);
      if (typeof response.model !== "string" || !response.model ||
          response?.routing?.model !== model ||
          Object.keys(probabilities ?? {}).length !== ROUTES.size ||
          values.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) ||
          Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 0.01 ||
          Math.abs(confidence - probability) > 0.001 ||
          typeof answer.confidence !== "number" || !Number.isFinite(answer.confidence) ||
          answer.confidence < 0 || answer.confidence > 1 ||
          answer.abstention_threshold !== MODEL_CONFIDENCE_MIN ||
          !["passed", "abstained"].includes(answer.abstention) ||
          (answer.abstention === "passed" && answer.low_confidence === true) ||
          (answer.abstention === "abstained" && answer.low_confidence !== true))
        throw new TypeError("Laya returned an invalid or unverified route answer.");
    }
    const accepted = confidence >= MODEL_CONFIDENCE_MIN && probability >= SELECTED_PROBABILITY_MIN &&
      (dialect !== "laya" || answer.abstention === "passed");
    return {
      route: accepted ? route : "human_review",
      reason: accepted ? `${dialect}_choice` : `${dialect}_uncertain`,
      source: dialect,
      confidence,
      confidenceMetric: dialect === "laya" ? "answer_confidence" : "jev_confidence",
      entropyConfidence: dialect === "laya" ? answer.confidence : null,
      selectedProbability: probability,
      model: dialect === "laya" ? `laya-${response.routing.model}`
        : typeof response.model === "string" ? response.model : model,
      modelDialect: dialect,
      inputTokens: Number.isSafeInteger(response?.usage?.input_tokens) ? response.usage.input_tokens : null,
      creditEligibility: "undetermined",
      providerSubmission: "not_sent",
      policyVersion: ROUTER_POLICY_VERSION,
    };
  } catch {
    return {
      route: "human_review",
      reason: `${dialect}_unavailable_or_invalid`,
      source: "policy",
      confidence: null,
      model: null,
      creditEligibility: "undetermined",
      providerSubmission: "not_sent",
      policyVersion: ROUTER_POLICY_VERSION,
    };
  }
}
