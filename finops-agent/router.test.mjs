import assert from "node:assert/strict";
import test from "node:test";
import { decideRoute, jevRequest, parseRoutePacket } from "./router.mjs";

const readyPacket = () => parseRoutePacket({
  schemaVersion: 1,
  requestId: "aws|P-123|2026-10-02T12:00:00.000Z",
  reviewedAt: "2026-10-02T12:00:00.000Z",
  caseId: "aws|P-123",
  problemId: "P-123",
  providerSlug: "aws",
  providerServiceId: "amazon-rds",
  problemClosed: true,
  reviewStatus: "validated",
  reviewCurrent: true,
  scopeConfirmed: true,
  customerTelemetryAvailable: true,
  observedAvailabilityPercent: 98.1,
  slaTargetPercent: 99.9,
  missingRequirementsCount: 0,
  providerReportStatus: "matched",
  davisImpact: "Service availability degradation",
});

const jevAnswer = (choice, confidence = 0.92, probability = 0.94) => ({
  model: "openjev",
  answers: { route: { type: "choice", choice, confidence, probabilities: { [choice]: probability } } },
  usage: { input_tokens: 150, output_tokens: 10 },
});

const layaAnswer = (overrides = {}) => ({
  model: "laya-rl-agent",
  routing: { model: "typed-decisions", reason: "explicit" },
  answers: { route: {
    type: "choice", choice: "prepare_provider_draft", confidence: 0.87,
    answer_confidence: 0.94, abstention: "passed", abstention_threshold: 0.85,
    probabilities: { prepare_provider_draft: 0.94, internal_only: 0.02, human_review: 0.04 },
    ...overrides,
  } },
  usage: { input_tokens: 120, output_tokens: 0 },
});

test("Jev receives only bounded decision features and cannot submit a claim", async () => {
  const packet = readyPacket();
  let request;
  const result = await decideRoute(packet, async (value) => {
    request = value;
    return jevAnswer("prepare_provider_draft");
  });
  assert.equal(result.route, "prepare_provider_draft");
  assert.equal(result.providerSubmission, "not_sent");
  assert.equal(result.creditEligibility, "undetermined");
  assert.equal(request.model, "openjev");
  assert.deepEqual(request, jevRequest(packet));
  assert.equal(JSON.stringify(request).includes(packet.problemId), false);
  assert.equal(JSON.stringify(request).includes(packet.caseId), false);
});

test("an operator exclusion and an open problem do not spend a Jev call", async () => {
  let calls = 0;
  const callJev = async () => { calls++; return jevAnswer("prepare_provider_draft"); };
  const excluded = await decideRoute({ ...readyPacket(), reviewStatus: "dismissed" }, callJev);
  const open = await decideRoute({ ...readyPacket(), problemClosed: false }, callJev);
  assert.equal(calls, 0);
  assert.equal(excluded.route, "internal_only");
  assert.equal(open.route, "human_review");
});

test("stale review, unconfirmed scope, and missing evidence fail to human review", async () => {
  for (const change of [
    { reviewCurrent: false },
    { scopeConfirmed: false },
    { customerTelemetryAvailable: false },
    { observedAvailabilityPercent: 99.95 },
    { missingRequirementsCount: 1 },
  ]) {
    const result = await decideRoute({ ...readyPacket(), ...change }, async () => {
      throw new Error("Jev should not be called");
    });
    assert.equal(result.route, "human_review");
    assert.equal(result.source, "policy");
  }
});

test("uncertain, invalid, and failed Jev decisions fail to human review", async () => {
  for (const answer of [
    jevAnswer("prepare_provider_draft", 0.6, 0.94),
    jevAnswer("prepare_provider_draft", 0.92, 0.6),
    jevAnswer("submit_claim"),
    { answers: { route: { type: "choice", choice: "prepare_provider_draft" } } },
  ]) {
    const result = await decideRoute(readyPacket(), async () => answer);
    assert.equal(result.route, "human_review");
    assert.equal(result.providerSubmission, "not_sent");
  }
  const unavailable = await decideRoute(readyPacket(), async () => { throw new Error("network"); });
  assert.equal(unavailable.route, "human_review");
  assert.equal(unavailable.reason, "jev_unavailable_or_invalid");
});

test("Laya uses its selected-answer probability and verified abstention result", async () => {
  let request;
  const accepted = await decideRoute(readyPacket(), async (body) => {
    request = body;
    return layaAnswer();
  }, "typed-decisions", "laya");
  assert.equal(request.model, "typed-decisions");
  assert.equal(request.min_confidence, 0.85);
  assert.equal(accepted.route, "prepare_provider_draft");
  assert.equal(accepted.source, "laya");
  assert.equal(accepted.confidence, 0.94);
  assert.equal(accepted.confidenceMetric, "answer_confidence");
  assert.equal(accepted.entropyConfidence, 0.87);
  assert.equal(accepted.model, "laya-typed-decisions");
  assert.equal(accepted.creditEligibility, "undetermined");
  assert.equal(accepted.providerSubmission, "not_sent");
});

test("Laya checkpoint drift, abstention, malformed probabilities, and invalid configuration fail closed", async () => {
  const strictWireResponse = layaAnswer();
  delete strictWireResponse.routing;
  delete strictWireResponse.answers.route.answer_confidence;
  const cases = [
    layaAnswer({ abstention: "abstained", low_confidence: true,
      answer_confidence: 0.7, probabilities: { prepare_provider_draft: 0.7, internal_only: 0.1, human_review: 0.2 } }),
    layaAnswer({ abstention: "unevaluated" }),
    layaAnswer({ answer_confidence: 0.99 }),
    layaAnswer({ probabilities: { prepare_provider_draft: 0.94, internal_only: 0.02 } }),
    { ...layaAnswer(), routing: { model: "english" } },
    strictWireResponse,
  ];
  for (const answer of cases) {
    const result = await decideRoute(readyPacket(), async () => answer, "typed-decisions", "laya");
    assert.equal(result.route, "human_review");
    assert.equal(result.providerSubmission, "not_sent");
  }
  const wrongModel = await decideRoute(readyPacket(), async () => layaAnswer(), "openjev", "laya");
  assert.equal(wrongModel.route, "human_review");
});

test("rejects malformed packets before a provider call", () => {
  assert.throws(() => parseRoutePacket({ ...readyPacket(), providerSlug: "../other" }), /Invalid providerSlug/);
  assert.throws(() => parseRoutePacket({ ...readyPacket(), observedAvailabilityPercent: 200 }), /observedAvailabilityPercent/);
  assert.throws(() => parseRoutePacket({ ...readyPacket(), reviewStatus: "approved-credit" }), /reviewStatus/);
});
