import {
  BATCH_REVIEW_CONFIRMATION,
  buildBatchReviewTargets,
} from "../ui/app/data/batchEvidenceReview";
import { evidenceDecisionValue, type EvidenceCandidate } from "../ui/app/data/evidenceCandidates";
import { resolveEvidenceReviewState } from "../ui/app/data/evidenceReviewState";
import type { IncidentReviewCase } from "../ui/app/data/incidentReviewCases";
import type {
  EvidenceDecisionRecord,
  ProblemRecord,
  ServiceRecord,
} from "../ui/app/types";

const checkout: ServiceRecord = { id: "SERVICE-CHECKOUT", name: "Checkout", type: "SERVICE", tags: [] };
const catalog: ServiceRecord = { id: "SERVICE-CATALOG", name: "Catalog", type: "SERVICE", tags: [] };

const reviewCase = (
  id: string,
  {
    service = checkout,
    productId = "rds",
    startedAt = "2026-10-02T12:00:00.000Z",
    affectedEntityIds = [service.id],
  }: {
    service?: ServiceRecord;
    productId?: string;
    startedAt?: string;
    affectedEntityIds?: string[];
  } = {},
): IncidentReviewCase => {
  const problem: ProblemRecord = {
    id,
    title: "Failure rate increase",
    status: "CLOSED",
    category: "ERROR",
    affectedEntityIds,
    affectedEntities: [],
    hasRootCause: false,
    startedAt,
    endedAt: "2026-10-02T12:05:00.000Z",
  };
  const candidate: EvidenceCandidate = {
    key: `aws|${id.toLowerCase()}`,
    problem,
    affectedServices: [service],
    providerServiceIds: [productId],
    providerServiceNames: [productId],
    mappingBasis: "confirmed-scope",
    mappingEvidence: "Confirmed provider relationship.",
    scopeConfirmed: true,
  };
  return {
    key: `case:${productId}:${id}`,
    problems: [problem],
    candidates: [candidate],
    affectedServices: [service],
    providerServiceIds: [productId],
    providerServiceNames: [productId],
    startedAt,
    endedAt: problem.endedAt,
    active: false,
    groupingBasis: "single",
    groupingEvidence: "One Problem.",
  };
};

const stateMap = (
  cases: IncidentReviewCase[],
  decisions: EvidenceDecisionRecord[] = [],
) => {
  const byKey = new Map(decisions.map((decision) => [decision.decisionKey, decision]));
  return new Map(cases.map((item) => [item.key, resolveEvidenceReviewState(item, byKey)]));
};

const savedDecision = (item: IncidentReviewCase): EvidenceDecisionRecord => ({
  ...evidenceDecisionValue(item.candidates[0], "aws", "not-ready", "More evidence needed."),
  objectId: `object-${item.key}`,
  version: "1",
});

const targets = (
  anchor: IncidentReviewCase,
  cases: IncidentReviewCase[],
  decisions: EvidenceDecisionRecord[] = [],
) => buildBatchReviewTargets({
  anchor,
  cases,
  states: stateMap([anchor, ...cases], decisions),
  providerSlug: "aws",
});

describe("batch evidence review eligibility", () => {
  it("offers separate unresolved episodes with identical product and service while keeping terms per episode", () => {
    const anchor = reviewCase("P-1");
    const later = reviewCase("P-2", { startedAt: "2026-10-03T12:00:00.000Z" });
    const rows = targets(anchor, [anchor, later]);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.reviewCase.key)).toEqual([anchor.key, later.key]);
    expect(rows.every((row) => row.eligible)).toBe(true);
    expect(BATCH_REVIEW_CONFIRMATION).toMatch(/do not establish one provider outage/);
    expect(BATCH_REVIEW_CONFIRMATION).toMatch(/account, region, or agreement/);
    expect(BATCH_REVIEW_CONFIRMATION).toMatch(/Custom terms may differ/);
  });

  it("excludes saved and stale decisions rather than overwriting them", () => {
    const anchor = reviewCase("P-1");
    const saved = reviewCase("P-2");
    const stale = reviewCase("P-3");
    const staleDecision = savedDecision(stale);
    staleDecision.providerServiceIds = ["ec2"];

    const rows = targets(anchor, [saved, stale], [savedDecision(saved), staleDecision]);
    expect(rows.map((row) => row.eligible)).toEqual([true, false, false]);
    expect(rows[1].reason).toMatch(/saved, stale, or mixed/);
    expect(rows[2].reason).toMatch(/saved, stale, or mixed/);
    const savedAnchorRows = targets(saved, [anchor], [savedDecision(saved)]);
    expect(savedAnchorRows.map((row) => row.eligible)).toEqual([false, true]);
    expect(savedAnchorRows[0].reason).toMatch(/will not be changed/);
  });

  it("uses a completed current anchor to scope other episodes without selecting it", () => {
    const completed = reviewCase("P-26105");
    const other = reviewCase("P-26104");
    const completedDecision: EvidenceDecisionRecord = {
      ...evidenceDecisionValue(completed.candidates[0], "aws", "validated", "", ["AWS Account ID"]),
      objectId: "completed-review",
      version: "1",
    };
    const rows = targets(completed, [completed, other], [completedDecision]);

    expect(rows.map((row) => row.eligible)).toEqual([false, true]);
    expect(rows[0].reason).toMatch(/saved human decision/);
  });

  it("does not use a stale completed anchor to authorize other episodes", () => {
    const completed = reviewCase("P-26105");
    const other = reviewCase("P-26104");
    const staleDecision: EvidenceDecisionRecord = {
      ...evidenceDecisionValue(completed.candidates[0], "aws", "validated", ""),
      objectId: "stale-review",
      version: "1",
      providerServiceIds: ["ec2"],
    };
    const rows = targets(completed, [other], [staleDecision]);

    expect(rows.map((row) => row.eligible)).toEqual([false, false]);
    expect(rows[1].reason).toMatch(/selected episode is not eligible/i);
  });

  it("rejects a different provider product or affected Dynatrace service", () => {
    const anchor = reviewCase("P-1");
    const otherProduct = reviewCase("P-2", { productId: "ec2" });
    const otherService = reviewCase("P-3", { service: catalog });
    const rows = targets(anchor, [otherProduct, otherService]);

    expect(rows.map((row) => row.eligible)).toEqual([true, false, false]);
    expect(rows[1].reason).toMatch(/different provider product/);
    expect(rows[2].reason).toMatch(/different Dynatrace service/);
  });

  it("requires start times, affected entities, and complete Problem-to-candidate evidence", () => {
    const anchor = reviewCase("P-1");
    const noTime = reviewCase("P-2", { startedAt: "invalid" });
    const noEntities = reviewCase("P-3", { affectedEntityIds: [] });
    const noCandidate = { ...reviewCase("P-4"), candidates: [] };
    const wrongProvider = reviewCase("P-5");
    wrongProvider.candidates[0].key = "azure|p-5";
    const rows = targets(anchor, [noTime, noEntities, noCandidate, wrongProvider]);

    expect(rows.map((row) => row.eligible)).toEqual([true, false, false, false, false]);
    expect(rows[1].reason).toMatch(/start time/);
    expect(rows[2].reason).toMatch(/affected entity/);
    expect(rows[3].reason).toMatch(/Problem or provider evidence/);
    expect(rows[4].reason).toMatch(/Problem or provider evidence/);
  });

  it("fails closed when the saved review state is unavailable", () => {
    const anchor = reviewCase("P-1");
    const later = reviewCase("P-2");
    const rows = buildBatchReviewTargets({
      anchor,
      cases: [later],
      states: stateMap([anchor]),
      providerSlug: "aws",
    });
    expect(rows.map((row) => row.eligible)).toEqual([true, false]);
    expect(rows[1].reason).toMatch(/unavailable/);
  });
});
