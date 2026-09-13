import type {
  ContractOverrideRecord,
  ProblemRecord,
  ServiceRecord,
} from "../types";
import { getOverrideScopeIds } from "./contractOverrides";
import type { EvidenceCandidate } from "./evidenceCandidates";

const CASE_LINK_GAP_MS = 45 * 60 * 1000;
const CASE_MAX_SPAN_MS = 6 * 60 * 60 * 1000;

export type IncidentReviewCase = {
  key: string;
  problems: ProblemRecord[];
  candidates: EvidenceCandidate[];
  affectedServices: ServiceRecord[];
  providerServiceIds: string[];
  providerServiceNames: string[];
  startedAt?: string;
  endedAt?: string;
  active: boolean;
  groupingBasis: "single" | "affected-service" | "root-cause";
  groupingEvidence: string;
};

type CaseMember = {
  problem: ProblemRecord;
  candidate?: EvidenceCandidate;
};

const normalized = (value: string): string => value.trim().toLowerCase();

const timestamp = (value?: string): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const memberStart = (member: CaseMember): number | null =>
  timestamp(member.problem.startedAt);

const memberEnd = (member: CaseMember): number | null =>
  timestamp(member.problem.endedAt) ?? memberStart(member);

const intersects = (left: string[], right: string[]): boolean => {
  const rightValues = new Set(right.map(normalized));
  return left.some((value) => rightValues.has(normalized(value)));
};

const affectedServiceIds = (member: CaseMember): string[] =>
  member.candidate?.affectedServices.length
    ? member.candidate.affectedServices.map((service) => service.id)
    : member.problem.affectedEntityIds;

const sameRootCause = (left: CaseMember, right: CaseMember): boolean => {
  const leftId = left.problem.rootCause?.id;
  const rightId = right.problem.rootCause?.id;
  return Boolean(leftId && rightId && normalized(leftId) === normalized(rightId));
};

const sameAffectedService = (left: CaseMember, right: CaseMember): boolean =>
  intersects(affectedServiceIds(left), affectedServiceIds(right));

const providerServiceKey = (candidate?: EvidenceCandidate): string | null => {
  if (!candidate?.scopeConfirmed || candidate.providerServiceIds.length !== 1)
    return null;
  return normalized(candidate.providerServiceIds[0]);
};

const overrideAppliesOn = (
  override: ContractOverrideRecord,
  candidate: EvidenceCandidate,
): boolean => {
  const date = candidate.problem.startedAt?.slice(0, 10);
  if (!date) return true;
  return override.effectiveFrom <= date &&
    (!override.effectiveTo || override.effectiveTo >= date);
};

const contractScopeKey = (
  candidate: EvidenceCandidate,
  providerSlug: string,
  overrides: ContractOverrideRecord[],
): string | null => {
  const serviceIds = candidate.affectedServices.length > 0
    ? candidate.affectedServices.map((service) => service.id)
    : candidate.problem.affectedEntityIds;
  const providerServiceId = candidate.providerServiceIds[0];
  const relevant = overrides.filter((override) =>
    override.enabled &&
    normalized(override.providerSlug) === normalized(providerSlug) &&
    (override.providerServiceId === "*" || override.providerServiceId === providerServiceId) &&
    overrideAppliesOn(override, candidate));
  // A host or location override can change the claim boundary even when the
  // Problem only returns a service. Keep that Problem independent until the
  // exact runtime scope is reviewed.
  if (relevant.some((override) => override.scopeKind === "host" || override.scopeKind === "location"))
    return null;
  const providerKeys = relevant
    .filter((override) => override.scopeKind === "provider")
    .map((override) => override.overrideKey)
    .sort();
  const signatures = (serviceIds.length > 0 ? serviceIds : [""]).map((serviceId) => [
    ...providerKeys,
    ...relevant
      .filter((override) => override.scopeKind === "service" &&
        getOverrideScopeIds(override).includes(serviceId))
      .map((override) => override.overrideKey),
  ].sort().join("\u001f"));
  return new Set(signatures).size === 1 ? signatures[0] || "public-terms" : null;
};

const groupingKey = (
  member: CaseMember,
  providerSlug: string,
  overrides: ContractOverrideRecord[],
  allowGrouping: boolean,
): string | null => {
  if (!allowGrouping || !member.candidate || memberStart(member) === null)
    return null;
  const serviceKey = providerServiceKey(member.candidate);
  const termsKey = contractScopeKey(member.candidate, providerSlug, overrides);
  return serviceKey && termsKey ? `${serviceKey}|${termsKey}` : null;
};

const canJoin = (members: CaseMember[], next: CaseMember): boolean => {
  const firstStart = memberStart(members[0]);
  const latestEnd = Math.max(...members.map((member) => memberEnd(member) ?? 0));
  const nextStart = memberStart(next);
  const nextEnd = memberEnd(next);
  if (firstStart === null || nextStart === null || nextEnd === null) return false;
  if (nextStart > latestEnd + CASE_LINK_GAP_MS) return false;
  if (Math.max(latestEnd, nextEnd) - firstStart > CASE_MAX_SPAN_MS) return false;
  return members.some((member) =>
    sameRootCause(member, next) || sameAffectedService(member, next));
};

const uniqueBy = <T,>(values: T[], key: (value: T) => string): T[] =>
  Array.from(new Map(values.map((value) => [normalized(key(value)), value])).values());

const caseFromMembers = (
  members: CaseMember[],
  serviceById: Map<string, ServiceRecord>,
): IncidentReviewCase => {
  const ordered = [...members].sort((left, right) =>
    (memberStart(left) ?? 0) - (memberStart(right) ?? 0) ||
    left.problem.id.localeCompare(right.problem.id));
  const problems = ordered.map((member) => member.problem);
  const candidates = ordered.flatMap((member) => member.candidate ? [member.candidate] : []);
  const affectedServices = uniqueBy(
    ordered.flatMap((member) => member.candidate?.affectedServices.length
      ? member.candidate.affectedServices
      : member.problem.affectedEntityIds.flatMap((id) => {
          const service = serviceById.get(id);
          return service ? [service] : [];
        })),
    (service) => service.id,
  );
  const providerServiceIds = uniqueBy(
    candidates.flatMap((candidate) => candidate.providerServiceIds),
    (value) => value,
  );
  const providerServiceNames = uniqueBy(
    candidates.flatMap((candidate) => candidate.providerServiceNames),
    (value) => value,
  );
  const starts = problems.flatMap((problem) => {
    const value = timestamp(problem.startedAt);
    return value === null ? [] : [value];
  });
  const active = problems.some((problem) => problem.status.toUpperCase() === "ACTIVE");
  const ends = active ? [] : problems.flatMap((problem) => {
    const value = timestamp(problem.endedAt);
    return value === null ? [] : [value];
  });
  const rootCauseIds = uniqueBy(
    problems.flatMap((problem) => problem.rootCause ? [problem.rootCause.id] : []),
    (value) => value,
  );
  const groupingBasis = members.length === 1
    ? "single"
    : rootCauseIds.length === 1 && problems.every((problem) => problem.rootCause)
      ? "root-cause"
      : "affected-service";
  const serviceLabel = providerServiceNames.join(", ") || "the same provider scope";
  const groupingEvidence = members.length === 1
    ? "This case contains one Dynatrace Problem."
    : groupingBasis === "root-cause"
      ? `${members.length} Problems resolve to ${serviceLabel}, share one Dynatrace root cause, and occurred in one review window.`
      : `${members.length} Problems resolve to ${serviceLabel}, affect at least one shared service, and occurred in one review window.`;
  const anchor = problems[0]?.id ?? "unknown";
  const scope = providerServiceIds[0] ?? "unmatched";

  return {
    key: candidates.length > 0
      ? `case:${normalized(scope)}:${normalized(anchor)}`
      : `problem:${normalized(anchor)}`,
    problems,
    candidates,
    affectedServices,
    providerServiceIds,
    providerServiceNames,
    startedAt: starts.length > 0 ? new Date(Math.min(...starts)).toISOString() : undefined,
    endedAt: ends.length > 0 ? new Date(Math.max(...ends)).toISOString() : undefined,
    active,
    groupingBasis,
    groupingEvidence,
  };
};

export const buildIncidentReviewCases = ({
  providerSlug,
  problems,
  candidates,
  services,
  contractOverrides = [],
  allowGrouping = true,
}: {
  providerSlug: string;
  problems: ProblemRecord[];
  candidates: EvidenceCandidate[];
  services: ServiceRecord[];
  contractOverrides?: ContractOverrideRecord[];
  allowGrouping?: boolean;
}): IncidentReviewCase[] => {
  const candidateByProblemId = new Map(
    candidates.map((candidate) => [candidate.problem.id, candidate]),
  );
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const members = problems.map<CaseMember>((problem) => ({
    problem,
    candidate: candidateByProblemId.get(problem.id),
  }));
  const grouped: CaseMember[][] = [];
  const buckets = new Map<string, CaseMember[]>();

  members.forEach((member) => {
    const key = groupingKey(member, providerSlug, contractOverrides, allowGrouping);
    if (!key) {
      grouped.push([member]);
      return;
    }
    const bucket = buckets.get(key) ?? [];
    bucket.push(member);
    buckets.set(key, bucket);
  });

  buckets.forEach((bucket) => {
    const ordered = [...bucket].sort((left, right) =>
      (memberStart(left) ?? 0) - (memberStart(right) ?? 0) ||
      left.problem.id.localeCompare(right.problem.id));
    let current: CaseMember[] = [];
    ordered.forEach((member) => {
      if (current.length === 0 || canJoin(current, member)) {
        current.push(member);
        return;
      }
      grouped.push(current);
      current = [member];
    });
    if (current.length > 0) grouped.push(current);
  });

  return grouped
    .map((group) => caseFromMembers(group, serviceById))
    .sort((left, right) => {
      if (left.active !== right.active) return left.active ? -1 : 1;
      if ((left.candidates.length > 0) !== (right.candidates.length > 0))
        return left.candidates.length > 0 ? -1 : 1;
      return (timestamp(right.startedAt) ?? 0) - (timestamp(left.startedAt) ?? 0);
    });
};

export const incidentReviewCaseForProblem = (
  cases: IncidentReviewCase[],
  problemId: string,
): IncidentReviewCase | undefined => cases.find((reviewCase) =>
  reviewCase.problems.some((problem) => problem.id === problemId));
