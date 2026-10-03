import { currentFinopsReviewIsValid, type ReviewGateRequest } from "../api/finopsReviewGate";

const request: ReviewGateRequest = {
  providerSlug: "synthetic",
  problemId: "SYNTH-PROBLEM-1",
  providerServiceId: "synthetic-service",
  reviewedAt: "2026-10-03T12:40:00.000Z",
  triggerMode: "manual",
  autoAssignLane: false,
};
const routing = { items: [], totalCount: 0 };
const decision = {
  decisionKey: "synthetic|synth-problem-1",
  providerSlug: "synthetic",
  problemId: "SYNTH-PROBLEM-1",
  providerServiceIds: ["synthetic-service"],
  reviewedAt: request.reviewedAt,
  status: "validated",
};
const decisions = { items: [{ value: decision }], totalCount: 1 };

describe("FinOps current review gate", () => {
  it("accepts one current validated review for a manually queued case with both automatic controls off", () => {
    expect(currentFinopsReviewIsValid(request, routing, decisions)).toBe(true);
  });

  it("rejects stale, duplicate, contradictory, or incomplete settings", () => {
    expect(currentFinopsReviewIsValid(request, routing, { ...decisions, items: [{ value: { ...decision, reviewedAt: "2026-10-02T12:40:00.000Z" } }] })).toBe(false);
    expect(currentFinopsReviewIsValid(request, routing, { items: [{ value: decision }, { value: decision }], totalCount: 2 })).toBe(false);
    expect(currentFinopsReviewIsValid(request, routing, { ...decisions, items: [{ value: { ...decision, providerServiceIds: ["other"] } }] })).toBe(false);
    expect(currentFinopsReviewIsValid(request, routing, { ...decisions, nextPageKey: "more" })).toBe(false);
    expect(currentFinopsReviewIsValid(request, routing, { ...decisions, error: { message: "partial" } })).toBe(false);
    expect(currentFinopsReviewIsValid({ ...request, providerServiceId: "*" }, routing, decisions)).toBe(false);
  });

  it("keeps automatic queueing and lane assignment independently off", () => {
    expect(currentFinopsReviewIsValid({ ...request, triggerMode: "automatic" }, routing, decisions)).toBe(false);
    expect(currentFinopsReviewIsValid({ ...request, autoAssignLane: true }, routing, decisions)).toBe(false);
    expect(currentFinopsReviewIsValid({ ...request, triggerMode: "automatic" }, {
      items: [{ value: { configurationKey: "workspace", autoQueueAfterReady: true, autoAssignLane: false } }],
      totalCount: 1,
    }, decisions)).toBe(true);
    expect(currentFinopsReviewIsValid(request, {
      items: [{ value: { configurationKey: "workspace", autoQueueAfterReady: false, autoAssignLane: true } }],
      totalCount: 1,
    }, decisions)).toBe(false);
  });
});
