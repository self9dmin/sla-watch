import { prioritizeProblems } from "../ui/app/data/incidentPrioritization";
import type { ProblemRecord } from "../ui/app/types";

const problem = (
  id: string,
  status: string,
  startedAt: string,
): ProblemRecord => ({
  id,
  title: id,
  status,
  category: "ERROR",
  affectedEntityIds: [],
  affectedEntities: [],
  hasRootCause: false,
  startedAt,
});

describe("incident prioritization", () => {
  it("orders active Problems before candidates and newer remaining records", () => {
    const problems = [
      problem("new-closed", "CLOSED", "2026-09-12T10:00:00Z"),
      problem("candidate", "CLOSED", "2026-09-10T10:00:00Z"),
      problem("active", "ACTIVE", "2026-09-09T10:00:00Z"),
      problem("old-closed", "CLOSED", "2026-09-08T10:00:00Z"),
    ];

    expect(prioritizeProblems(problems, new Set(["candidate"])).map(({ id }) => id))
      .toEqual(["active", "candidate", "new-closed", "old-closed"]);
  });

  it("keeps the source order when priority and timestamps are equal", () => {
    const problems = [
      problem("first", "CLOSED", ""),
      problem("second", "CLOSED", ""),
    ];

    expect(prioritizeProblems(problems, new Set()).map(({ id }) => id))
      .toEqual(["first", "second"]);
  });
});
