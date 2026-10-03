import type { ProblemRecord } from "../types";
import type { IncidentReviewCase } from "./incidentReviewCases";

export type ReviewDayGroup = {
  key: string;
  cases: IncidentReviewCase[];
  dayLabel: string;
  serviceName: string;
  rootCauseName?: string;
  problemCount: number;
  observedWindowMinutes: number;
  unmeasuredProblems: number;
};

const localDay = (value: string): { key: string; label: string; start: number; end: number } | null => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    label: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    start,
    end,
  };
};

const rootCauseForCase = (reviewCase: IncidentReviewCase): { key: string; name?: string } => {
  const ids = new Set(reviewCase.problems.map((problem) => problem.rootCause?.id?.trim().toLowerCase()).filter(Boolean));
  if (ids.size !== 1 || reviewCase.problems.some((problem) => !problem.rootCause?.id)) return { key: "unverified" };
  return { key: [...ids][0]!, name: reviewCase.problems[0].rootCause?.name || [...ids][0] };
};

const uniqueProblems = (cases: IncidentReviewCase[]): ProblemRecord[] => Array.from(
  new Map(cases.flatMap((reviewCase) => reviewCase.problems).map((problem) => [problem.id, problem])).values(),
);

const windowCoverage = (
  problems: ProblemRecord[],
  dayStart: number,
  dayEnd: number,
): { minutes: number; unmeasured: number } => {
  const intervals: Array<[number, number]> = [];
  let unmeasured = 0;
  problems.forEach((problem) => {
    const start = problem.startedAt ? Date.parse(problem.startedAt) : Number.NaN;
    const end = problem.endedAt ? Date.parse(problem.endedAt) : Number.NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      unmeasured += 1;
      return;
    }
    const clippedStart = Math.max(start, dayStart);
    const clippedEnd = Math.min(end, dayEnd);
    if (clippedEnd > clippedStart) intervals.push([clippedStart, clippedEnd]);
  });
  intervals.sort((left, right) => left[0] - right[0]);
  let total = 0;
  let latestEnd = Number.NEGATIVE_INFINITY;
  intervals.forEach(([start, end]) => {
    total += Math.max(0, end - Math.max(start, latestEnd));
    latestEnd = Math.max(latestEnd, end);
  });
  return { minutes: Math.round(total / 60_000), unmeasured };
};

// A day group only organizes the queue. It never changes the underlying cases or their decisions.
export const groupReviewCasesByDay = (cases: IncidentReviewCase[]): ReviewDayGroup[] => {
  const groups = new Map<string, ReviewDayGroup>();
  cases.forEach((reviewCase) => {
    const day = reviewCase.startedAt ? localDay(reviewCase.startedAt) : null;
    const singleService = reviewCase.affectedServices.length === 1;
    const singleProviderService = reviewCase.providerServiceIds.length === 1;
    const rootCause = rootCauseForCase(reviewCase);
    const key = day && singleService && singleProviderService
      ? [day.key, reviewCase.providerServiceIds[0].toLowerCase(), reviewCase.affectedServices[0].id.toLowerCase(), rootCause.key].join("|")
      : `single|${reviewCase.key}`;
    const existing = groups.get(key);
    if (existing) {
      existing.cases.push(reviewCase);
      return;
    }
    groups.set(key, {
      key,
      cases: [reviewCase],
      dayLabel: day?.label ?? "Date unavailable",
      serviceName: singleService ? reviewCase.affectedServices[0].name : "Multiple or unresolved services",
      rootCauseName: rootCause.name,
      problemCount: 0,
      observedWindowMinutes: 0,
      unmeasuredProblems: 0,
    });
  });
  return [...groups.values()].map((group) => {
    const problems = uniqueProblems(group.cases);
    const firstDay = group.cases[0].startedAt ? localDay(group.cases[0].startedAt) : null;
    const coverage = firstDay
      ? windowCoverage(problems, firstDay.start, firstDay.end)
      : { minutes: 0, unmeasured: problems.length };
    return {
      ...group,
      problemCount: problems.length,
      observedWindowMinutes: coverage.minutes,
      unmeasuredProblems: coverage.unmeasured,
    };
  });
};
