import type { EvidenceCandidate } from "./evidenceCandidates";
import type { IncidentReviewCase } from "./incidentReviewCases";

export type ProviderProductWorkItem = {
  key: string;
  name: string;
  cases: IncidentReviewCase[];
  problemCount: number;
  affectedServiceCount: number;
};

export type CoverageWorkItem = {
  candidates: EvidenceCandidate[];
  problemCount: number;
  affectedServiceCount: number;
  leadingCandidate?: EvidenceCandidate;
  leadingService?: { id: string; name: string; problemCount: number };
};

/** Navigation only. A product work item never merges Problem evidence or human decisions. */
export const groupReviewCasesByProduct = (cases: IncidentReviewCase[]): ProviderProductWorkItem[] => {
  const groups = new Map<string, IncidentReviewCase[]>();
  cases.forEach((reviewCase) => {
    if (!reviewCase.candidates.every((candidate) => candidate.scopeConfirmed) ||
        reviewCase.providerServiceIds.length !== 1 ||
        reviewCase.providerServiceIds[0] === "*") return;
    const key = reviewCase.providerServiceIds[0].toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), reviewCase]);
  });
  return [...groups].map(([key, groupedCases]) => ({
    key,
    name: groupedCases[0].providerServiceNames[0] ?? key,
    cases: groupedCases,
    problemCount: new Set(groupedCases.flatMap((item) => item.problems.map((problem) => problem.id))).size,
    affectedServiceCount: new Set(groupedCases.flatMap((item) => item.affectedServices.map((service) => service.id))).size,
  })).sort((left, right) => right.problemCount - left.problemCount || left.name.localeCompare(right.name));
};

/** Provider identity alone creates one coverage task, regardless of Problem volume. */
export const buildCoverageWorkItem = (candidates: EvidenceCandidate[]): CoverageWorkItem | null => {
  const unresolved = candidates.filter((candidate) => !candidate.scopeConfirmed);
  if (unresolved.length === 0) return null;
  const byService = new Map<string, { id: string; name: string; problemIds: Set<string> }>();
  unresolved.forEach((candidate) => candidate.affectedServices.forEach((service) => {
    const entry = byService.get(service.id) ?? { id: service.id, name: service.name, problemIds: new Set<string>() };
    entry.problemIds.add(candidate.problem.id);
    byService.set(service.id, entry);
  }));
  const leading = [...byService.values()].sort((left, right) =>
    right.problemIds.size - left.problemIds.size || left.name.localeCompare(right.name))[0];
  const leadingCandidate = leading
    ? unresolved.find((candidate) => candidate.affectedServices.some((service) => service.id === leading.id))
    : unresolved[0];
  return {
    candidates: unresolved,
    problemCount: new Set(unresolved.map((candidate) => candidate.problem.id)).size,
    affectedServiceCount: byService.size,
    leadingCandidate,
    leadingService: leading && { id: leading.id, name: leading.name, problemCount: leading.problemIds.size },
  };
};
