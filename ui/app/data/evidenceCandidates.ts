import type {
  EvidenceDecisionValue,
  EvidenceMappingBasis,
  ProblemRecord,
  ProviderScopeAssignmentRecord,
  ServiceRecord,
  SlaProviderResponse,
  SmartscapeScopeEdge,
} from "../types";
import { providerTagValue } from "./providerTags";
import {
  inferProviderServiceCandidate,
  serviceEntityIdForEdge,
} from "./providerScopeAssignments";

export const EVIDENCE_DECISIONS_SCHEMA_ID = "evidence-decisions";

export type EvidenceCandidate = {
  key: string;
  problem: ProblemRecord;
  affectedServices: ServiceRecord[];
  providerServiceIds: string[];
  providerServiceNames: string[];
  mappingBasis: EvidenceMappingBasis;
  mappingEvidence: string;
  scopeConfirmed: boolean;
};

const requiredText = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

export const createEvidenceDecisionKey = (
  providerSlug: string,
  problemId: string,
): string => `${providerSlug.trim().toLowerCase()}|${problemId.trim().toLowerCase()}`;

export const normalizeEvidenceDecision = (
  value: unknown,
): EvidenceDecisionValue | null => {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const providerSlug = requiredText(row.providerSlug)?.toLowerCase();
  const problemId = requiredText(row.problemId);
  const problemTitle = requiredText(row.problemTitle);
  const problemCategory = requiredText(row.problemCategory);
  const problemStatus = requiredText(row.problemStatus);
  const mappingEvidence = requiredText(row.mappingEvidence);
  const reviewedAt = requiredText(row.reviewedAt);
  const status = row.status === "validated" || row.status === "dismissed"
    ? row.status
    : null;
  const mappingBasis = row.mappingBasis === "confirmed-scope" ||
    row.mappingBasis === "provider-tag" ||
    row.mappingBasis === "smartscape-candidate"
    ? row.mappingBasis
    : null;

  if (
    !providerSlug ||
    !problemId ||
    !problemTitle ||
    !problemCategory ||
    !problemStatus ||
    !mappingEvidence ||
    !reviewedAt ||
    !status ||
    !mappingBasis
  ) return null;

  return {
    decisionKey:
      requiredText(row.decisionKey) ??
      createEvidenceDecisionKey(providerSlug, problemId),
    providerSlug,
    problemId,
    problemTitle,
    problemCategory,
    problemStatus,
    problemStartedAt: requiredText(row.problemStartedAt),
    problemEndedAt: requiredText(row.problemEndedAt),
    affectedEntityIds: stringList(row.affectedEntityIds),
    affectedEntityNames: stringList(row.affectedEntityNames),
    providerServiceIds: stringList(row.providerServiceIds),
    providerServiceNames: stringList(row.providerServiceNames),
    mappingBasis,
    mappingEvidence,
    status,
    decisionNote: requiredText(row.decisionNote),
    reviewedAt,
  };
};

export const buildEvidenceCandidates = ({
  provider,
  problems,
  services,
  topology,
  assignments,
  providerLabelKey,
}: {
  provider?: SlaProviderResponse;
  problems: ProblemRecord[];
  services: ServiceRecord[];
  topology: SmartscapeScopeEdge[];
  assignments: ProviderScopeAssignmentRecord[];
  providerLabelKey: string;
}): EvidenceCandidate[] => {
  if (!provider) return [];
  const providerSlug = provider.provider.slug.toLowerCase();
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const providerServiceById = new Map(
    provider.services.map((service) => [service.id, service.name]),
  );

  return problems.flatMap((problem) => {
    const affectedIds = new Set(problem.affectedEntityIds);
    const affectedServices = problem.affectedEntityIds
      .map((id) => serviceById.get(id))
      .filter((service): service is ServiceRecord => Boolean(service));
    const confirmed = assignments.filter(
      (assignment) =>
        assignment.enabled &&
        assignment.providerSlug === providerSlug &&
        affectedIds.has(assignment.serviceEntityId),
    );
    const tagged = affectedServices.filter((service) =>
      service.tags.some(
        (tag) =>
          providerTagValue(tag, providerLabelKey, providerSlug) === providerSlug,
      ),
    );
    const suggested = topology
      .filter(
        (edge) =>
          affectedIds.has(serviceEntityIdForEdge(edge)) &&
          edge.providerSlug === providerSlug,
      )
      .flatMap((edge) => {
        const candidate = inferProviderServiceCandidate(edge, provider);
        return candidate ? [candidate] : [];
      });

    if (confirmed.length === 0 && tagged.length === 0 && suggested.length === 0)
      return [];

    const mappingBasis: EvidenceMappingBasis = confirmed.length > 0
      ? "confirmed-scope"
      : tagged.length > 0
        ? "provider-tag"
        : "smartscape-candidate";
    const providerServiceIds = Array.from(
      new Set(
        (confirmed.length > 0
          ? confirmed.map((item) => item.providerServiceId)
          : suggested.map((item) => item.providerServiceId)
        ).filter(Boolean),
      ),
    );
    const providerServiceNames = providerServiceIds.map(
      (id) =>
        confirmed.find((item) => item.providerServiceId === id)
          ?.providerServiceName ??
        suggested.find((item) => item.providerServiceId === id)
          ?.providerServiceName ??
        providerServiceById.get(id) ??
        id,
    );
    const mappingEvidence = mappingBasis === "confirmed-scope"
      ? `${confirmed.length} operator-confirmed scope mapping${confirmed.length === 1 ? "" : "s"} overlap the affected services.`
      : mappingBasis === "provider-tag"
        ? `${tagged.length} affected service${tagged.length === 1 ? " has" : "s have"} the explicit ${providerLabelKey}:${providerSlug} tag.`
        : `${suggested.length} Smartscape runtime relationship${suggested.length === 1 ? " suggests" : "s suggest"} this provider. Coverage confirmation is still required.`;

    return [{
      key: createEvidenceDecisionKey(providerSlug, problem.id),
      problem,
      affectedServices,
      providerServiceIds,
      providerServiceNames,
      mappingBasis,
      mappingEvidence,
      scopeConfirmed: mappingBasis !== "smartscape-candidate",
    }];
  }).sort((left, right) => {
    const leftActive = left.problem.status.toUpperCase() === "ACTIVE" ? 1 : 0;
    const rightActive = right.problem.status.toUpperCase() === "ACTIVE" ? 1 : 0;
    if (leftActive !== rightActive) return rightActive - leftActive;
    return (Date.parse(right.problem.startedAt ?? "") || 0) -
      (Date.parse(left.problem.startedAt ?? "") || 0);
  });
};

export const evidenceDecisionValue = (
  candidate: EvidenceCandidate,
  providerSlug: string,
  status: EvidenceDecisionValue["status"],
  decisionNote: string,
  reviewedAt = new Date().toISOString(),
): EvidenceDecisionValue => ({
  decisionKey: candidate.key,
  providerSlug: providerSlug.toLowerCase(),
  problemId: candidate.problem.id,
  problemTitle: candidate.problem.title,
  problemCategory: candidate.problem.category,
  problemStatus: candidate.problem.status,
  problemStartedAt: candidate.problem.startedAt ?? null,
  problemEndedAt: candidate.problem.endedAt ?? null,
  affectedEntityIds: candidate.problem.affectedEntityIds,
  affectedEntityNames: candidate.affectedServices.map((service) => service.name),
  providerServiceIds: candidate.providerServiceIds,
  providerServiceNames: candidate.providerServiceNames,
  mappingBasis: candidate.mappingBasis,
  mappingEvidence: candidate.mappingEvidence,
  status,
  decisionNote: decisionNote.trim() || null,
  reviewedAt,
});
