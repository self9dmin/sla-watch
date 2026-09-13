import { evidenceDecisionValue, type EvidenceCandidate } from "../ui/app/data/evidenceCandidates";
import {
  evidenceReviewStatePresentation,
  resolveEvidenceReviewState,
} from "../ui/app/data/evidenceReviewState";
import type { IncidentReviewCase } from "../ui/app/data/incidentReviewCases";
import type { EvidenceDecisionRecord, ProblemRecord, ServiceRecord } from "../ui/app/types";

const service: ServiceRecord = {
  id: "SERVICE-CHECKOUT",
  name: "Checkout",
  type: "SERVICE",
  tags: [],
};

const candidate = (id: string): EvidenceCandidate => {
  const problem: ProblemRecord = {
    id,
    title: "Failure rate increase",
    status: "CLOSED",
    category: "ERROR",
    affectedEntityIds: [service.id],
    affectedEntities: [{ id: service.id, name: service.name, type: "service" }],
    hasRootCause: false,
    startedAt: "2026-09-12T10:00:00.000Z",
    endedAt: "2026-09-12T10:05:00.000Z",
  };
  return {
    key: `aws|${id.toLowerCase()}`,
    problem,
    affectedServices: [service],
    providerServiceIds: ["ec2"],
    providerServiceNames: ["Amazon EC2"],
    mappingBasis: "confirmed-scope",
    mappingEvidence: "Operator-confirmed provider coverage.",
    scopeConfirmed: true,
  };
};

const first = candidate("P-1");
const second = candidate("P-2");
const reviewCase: IncidentReviewCase = {
  key: "case-1",
  problems: [first.problem, second.problem],
  candidates: [first, second],
  affectedServices: [service],
  providerServiceIds: ["ec2"],
  providerServiceNames: ["Amazon EC2"],
  startedAt: first.problem.startedAt,
  endedAt: second.problem.endedAt,
  active: false,
  groupingBasis: "affected-service",
  groupingEvidence: "The Problems share one provider service, customer service, and review window.",
};

const decision = (
  value: EvidenceCandidate,
  status: "validated" | "not-ready" | "dismissed",
): EvidenceDecisionRecord => ({
  ...evidenceDecisionValue(value, "aws", status, status === "validated" ? "" : "Operator note"),
  objectId: `object-${value.problem.id}`,
  version: "1",
});

describe("evidence review state", () => {
  it("uses one honest state across an entire grouped case", () => {
    expect(resolveEvidenceReviewState(reviewCase, new Map()).state).toBe("needs-review");

    const oneSaved = new Map([[first.key, decision(first, "validated")]]);
    expect(resolveEvidenceReviewState(reviewCase, oneSaved).state).toBe("mixed");

    const ready = new Map([
      [first.key, decision(first, "validated")],
      [second.key, decision(second, "validated")],
    ]);
    expect(resolveEvidenceReviewState(reviewCase, ready).state).toBe("ready-for-follow-up");

    const needsEvidence = new Map([
      [first.key, decision(first, "not-ready")],
      [second.key, decision(second, "not-ready")],
    ]);
    expect(resolveEvidenceReviewState(reviewCase, needsEvidence).state).toBe("needs-evidence");

    const excluded = new Map([
      [first.key, decision(first, "dismissed")],
      [second.key, decision(second, "dismissed")],
    ]);
    expect(resolveEvidenceReviewState(reviewCase, excluded).state).toBe("excluded");
  });

  it("does not treat a stale saved decision as current", () => {
    const stale = decision(first, "validated");
    stale.providerServiceIds = ["lambda"];
    const result = resolveEvidenceReviewState(reviewCase, new Map([[first.key, stale]]));

    expect(result.state).toBe("mixed");
    expect(result.currentDecisions).toHaveLength(0);
    expect(result.storedDecisions).toHaveLength(1);
  });

  it("presents persisted enum values with operator-facing language", () => {
    expect(evidenceReviewStatePresentation("ready-for-follow-up").label).toBe("Ready for follow-up");
    expect(evidenceReviewStatePresentation("excluded").label).toBe("Excluded");
  });
});
