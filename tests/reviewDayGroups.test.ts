import { groupReviewCasesByDay } from "../ui/app/data/reviewDayGroups";
import type { IncidentReviewCase } from "../ui/app/data/incidentReviewCases";

const reviewCase = (
  id: string,
  startedAt: string,
  endedAt: string | undefined,
  rootCauseId?: string,
  serviceId = "SERVICE-1",
): IncidentReviewCase => ({
  key: `case:${id}`,
  problems: [{
    id,
    title: "Failure rate increase",
    status: endedAt ? "CLOSED" : "ACTIVE",
    category: "ERROR",
    affectedEntityIds: [serviceId],
    affectedEntities: [],
    hasRootCause: Boolean(rootCauseId),
    rootCause: rootCauseId ? { id: rootCauseId, name: rootCauseId, type: "service" } : undefined,
    startedAt,
    endedAt,
  }],
  candidates: [],
  affectedServices: [{ id: serviceId, name: serviceId, type: "SERVICE", tags: [] }],
  providerServiceIds: ["rds"],
  providerServiceNames: ["Amazon RDS"],
  startedAt,
  endedAt,
  active: !endedAt,
  groupingBasis: "single",
  groupingEvidence: "One Problem.",
});

describe("review day groups", () => {
  it("presents same-service cases together without changing case boundaries or double counting overlapping windows", () => {
    const first = reviewCase("P-1", "2026-10-02T12:00:00Z", "2026-10-02T13:00:00Z");
    const second = reviewCase("P-2", "2026-10-02T12:30:00Z", "2026-10-02T13:30:00Z");
    const groups = groupReviewCasesByDay([first, second]);
    expect(groups).toHaveLength(1);
    expect(groups[0].cases).toEqual([first, second]);
    expect(groups[0].problemCount).toBe(2);
    expect(groups[0].observedWindowMinutes).toBe(90);
    expect(groups[0].rootCauseName).toBeUndefined();
  });

  it("separates different root causes, services, and dates", () => {
    const groups = groupReviewCasesByDay([
      reviewCase("P-1", "2026-10-02T12:00:00Z", "2026-10-02T12:05:00Z", "RCA-1"),
      reviewCase("P-2", "2026-10-02T16:00:00Z", "2026-10-02T16:05:00Z", "RCA-2"),
      reviewCase("P-3", "2026-10-02T18:00:00Z", "2026-10-02T18:05:00Z", "RCA-1", "SERVICE-2"),
      reviewCase("P-4", "2026-10-03T12:00:00Z", undefined, "RCA-1"),
    ]);
    expect(groups).toHaveLength(4);
    expect(groups[3].unmeasuredProblems).toBe(1);
  });
});
