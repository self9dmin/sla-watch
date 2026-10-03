import { buildCoverageWorkItem, groupReviewCasesByProduct } from "../ui/app/data/reviewWorkItems";
import type { EvidenceCandidate } from "../ui/app/data/evidenceCandidates";
import type { IncidentReviewCase } from "../ui/app/data/incidentReviewCases";
import type { ProblemRecord, ServiceRecord } from "../ui/app/types";

const service: ServiceRecord = { id: "SERVICE-1", name: "Checkout", type: "SERVICE", tags: [] };
const problem = (id: number): ProblemRecord => ({
  id: `P-${id}`,
  title: "Failure rate increase",
  status: "CLOSED",
  category: "ERROR",
  affectedEntityIds: [service.id],
  affectedEntities: [],
  hasRootCause: false,
  startedAt: "2026-10-01T10:00:00.000Z",
  endedAt: "2026-10-01T10:05:00.000Z",
});
const candidate = (id: number, productId = "*"): EvidenceCandidate => ({
  key: `aws|p-${id}`,
  problem: problem(id),
  affectedServices: [service],
  providerServiceIds: [productId],
  providerServiceNames: [productId === "*" ? "AWS" : "Amazon RDS"],
  mappingBasis: "confirmed-scope",
  mappingEvidence: "Provider relationship observed.",
  scopeConfirmed: productId !== "*",
});
const reviewCase = (id: number): IncidentReviewCase => {
  const item = candidate(id, "rds");
  return {
    key: `case:rds:p-${id}`,
    problems: [item.problem],
    candidates: [item],
    affectedServices: [service],
    providerServiceIds: ["rds"],
    providerServiceNames: ["Amazon RDS"],
    startedAt: item.problem.startedAt,
    endedAt: item.problem.endedAt,
    active: false,
    groupingBasis: "single",
    groupingEvidence: "Independent Problem.",
  };
};

describe("review work items", () => {
  it("surfaces one coverage task for many unresolved Problems on one service", () => {
    const item = buildCoverageWorkItem(Array.from({ length: 100 }, (_, index) => candidate(index + 1)));
    expect(item).toMatchObject({
      problemCount: 100,
      affectedServiceCount: 1,
      leadingService: { id: service.id, problemCount: 100 },
    });
  });

  it("organizes exact matches by product without merging case decisions", () => {
    const cases = [reviewCase(1), reviewCase(2), reviewCase(3)];
    const workItems = groupReviewCasesByProduct(cases);
    expect(workItems).toHaveLength(1);
    expect(workItems[0]).toMatchObject({ key: "rds", problemCount: 3, affectedServiceCount: 1 });
    expect(workItems[0].cases).toEqual(cases);
    expect(groupReviewCasesByProduct([{ ...cases[0], candidates: [candidate(1)] }])).toEqual([]);
  });
});
