import type { ProblemRecord } from "../types";

export const prioritizeProblems = (
  problems: readonly ProblemRecord[],
  candidateProblemIds: ReadonlySet<string>,
): ProblemRecord[] =>
  problems
    .map((problem, index) => ({ problem, index }))
    .sort((left, right) => {
      const leftActive = left.problem.status.toUpperCase() === "ACTIVE" ? 1 : 0;
      const rightActive = right.problem.status.toUpperCase() === "ACTIVE" ? 1 : 0;
      if (leftActive !== rightActive) return rightActive - leftActive;

      const leftCandidate = candidateProblemIds.has(left.problem.id) ? 1 : 0;
      const rightCandidate = candidateProblemIds.has(right.problem.id) ? 1 : 0;
      if (leftCandidate !== rightCandidate) return rightCandidate - leftCandidate;

      const leftStart = Date.parse(left.problem.startedAt ?? "") || 0;
      const rightStart = Date.parse(right.problem.startedAt ?? "") || 0;
      if (leftStart !== rightStart) return rightStart - leftStart;

      return left.index - right.index;
    })
    .map(({ problem }) => problem);
