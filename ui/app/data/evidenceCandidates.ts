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
  resolveProviderServiceCandidates,
  serviceEntityIdForEdge,
} from "./providerScopeAssignments";

export const EVIDENCE_DECISIONS_SCHEMA_ID = "evidence-decisions";
export const MAX_EVIDENCE_DECISION_NOTE_LENGTH = 500;

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

const stringList = (value: unknown, maximum: number): string[] =>
  Array.isArray(value)
    ? Array.from(new Set(value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)))
        .slice(0, maximum)
    : [];

const comparableList = (values: string[]): string[] =>
  Array.from(
    new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean)),
  ).sort();

const sameValues = (left: string[], right: string[]): boolean => {
  const normalizedLeft = comparableList(left);
  const normalizedRight = comparableList(right);
  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index]);
};

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
  const status = row.status === "validated" ||
    row.status === "not-ready" ||
    row.status === "dismissed"
    ? row.status
    : null;
  const mappingBasis = row.mappingBasis === "confirmed-scope" ||
    row.mappingBasis === "provider-tag" ||
    row.mappingBasis === "smartscape-observed" ||
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
    decisionKey: createEvidenceDecisionKey(providerSlug, problemId),
    providerSlug,
    problemId,
    problemTitle,
    problemCategory,
    problemStatus,
    problemStartedAt: requiredText(row.problemStartedAt),
    problemEndedAt: requiredText(row.problemEndedAt),
    rootCauseEntityId: requiredText(row.rootCauseEntityId),
    rootCauseEntityName: requiredText(row.rootCauseEntityName),
    rootCauseEntityType: requiredText(row.rootCauseEntityType),
    affectedEntityIds: stringList(row.affectedEntityIds, 100),
    affectedEntityNames: stringList(row.affectedEntityNames, 100),
    providerServiceIds: stringList(row.providerServiceIds, 50),
    providerServiceNames: stringList(row.providerServiceNames, 50),
    mappingBasis,
    mappingEvidence,
    status,
    acknowledgedEvidence: stringList(row.acknowledgedEvidence, 50),
    decisionNote:
      requiredText(row.decisionNote)?.slice(
        0,
        MAX_EVIDENCE_DECISION_NOTE_LENGTH,
      ) ?? null,
    reviewedAt,
  };
};

export const evidenceDecisionMatchesCandidate = (
  decision: EvidenceDecisionValue,
  candidate: EvidenceCandidate,
): boolean =>
  decision.decisionKey === candidate.key &&
  createEvidenceDecisionKey(decision.providerSlug, decision.problemId) ===
    candidate.key &&
  decision.problemStatus.toUpperCase() === candidate.problem.status.toUpperCase() &&
  decision.mappingBasis === candidate.mappingBasis &&
  sameValues(decision.affectedEntityIds, candidate.problem.affectedEntityIds) &&
  sameValues(decision.providerServiceIds, candidate.providerServiceIds) &&
  (!decision.rootCauseEntityId ||
    decision.rootCauseEntityId.trim().toLowerCase() ===
      candidate.problem.rootCause?.id.trim().toLowerCase());

export const evidenceDecisionInputError = ({
  status,
  note,
  acknowledged,
  requiredEvidence = [],
  acknowledgedEvidence = [],
}: {
  status: EvidenceDecisionValue["status"];
  note: string;
  acknowledged: boolean;
  requiredEvidence?: string[];
  acknowledgedEvidence?: string[];
}): string | null => {
  if (note.trim().length > MAX_EVIDENCE_DECISION_NOTE_LENGTH)
    return `Keep the review note to ${MAX_EVIDENCE_DECISION_NOTE_LENGTH} characters or fewer.`;
  if (status === "validated" && !acknowledged)
    return "Confirm the review boundary before marking this case ready for follow-up.";
  if (
    status === "validated" &&
    requiredEvidence.some((item) => !acknowledgedEvidence.includes(item))
  ) return "Confirm each provider requirement before marking this case ready for follow-up.";
  if (status === "not-ready" && note.trim().length === 0)
    return "Add a short note describing what evidence is still needed.";
  if (status === "dismissed" && note.trim().length === 0)
    return "Add a short reason before excluding this case from provider follow-up.";
  return null;
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
    const relevantTopology = topology.filter(
      (edge) =>
        affectedIds.has(serviceEntityIdForEdge(edge)) &&
        edge.providerSlug === providerSlug,
    );
    const suggested = relevantTopology
      .flatMap((edge) => {
        const candidate = inferProviderServiceCandidate(edge, provider);
        return candidate ? [{ ...candidate, serviceEntityId: serviceEntityIdForEdge(edge) }] : [];
      });

    if (confirmed.length === 0 && tagged.length === 0 && suggested.length === 0)
      return [];

    const topologyServiceIds = new Set(
      relevantTopology.map(serviceEntityIdForEdge),
    );
    const topologyResolutions = resolveProviderServiceCandidates(
      relevantTopology,
      provider,
    );
    const observed = suggested.length > 0 && Array.from(topologyServiceIds).every((serviceId) => {
      const resolution = topologyResolutions.get(serviceId);
      return Boolean(
        resolution &&
        !resolution.ambiguous &&
        resolution.candidate?.confidence === "observed",
      );
    });
    const mappingBasis: EvidenceMappingBasis = confirmed.length > 0
      ? "confirmed-scope"
      : tagged.length > 0
        ? "provider-tag"
        : observed
          ? "smartscape-observed"
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
      ? `${confirmed.length} operator-confirmed SLA match${confirmed.length === 1 ? "" : "es"} overlap the affected services.`
      : mappingBasis === "provider-tag"
        ? `${tagged.length} affected service${tagged.length === 1 ? " has" : "s have"} the explicit ${providerLabelKey}:${providerSlug} tag.`
        : mappingBasis === "smartscape-observed"
          ? `${suggested.length} Smartscape relationship${suggested.length === 1 ? " identifies" : "s identify"} one provider service from provider-native runtime metadata.`
          : `${suggested.length} Smartscape runtime relationship${suggested.length === 1 ? " suggests" : "s suggest"} this provider. The provider service remains ambiguous or requires confirmation.`;

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
  acknowledgedEvidence: string[] = [],
  reviewedAt = new Date().toISOString(),
): EvidenceDecisionValue => ({
  decisionKey: createEvidenceDecisionKey(providerSlug, candidate.problem.id),
  providerSlug: providerSlug.toLowerCase(),
  problemId: candidate.problem.id,
  problemTitle: candidate.problem.title,
  problemCategory: candidate.problem.category,
  problemStatus: candidate.problem.status,
  problemStartedAt: candidate.problem.startedAt ?? null,
  problemEndedAt: candidate.problem.endedAt ?? null,
  rootCauseEntityId: candidate.problem.rootCause?.id ?? null,
  rootCauseEntityName: candidate.problem.rootCause?.name ?? null,
  rootCauseEntityType: candidate.problem.rootCause?.type ?? null,
  affectedEntityIds: stringList(candidate.problem.affectedEntityIds, 100),
  affectedEntityNames: stringList(
    candidate.affectedServices.map((service) => service.name),
    100,
  ),
  providerServiceIds: stringList(candidate.providerServiceIds, 50),
  providerServiceNames: stringList(candidate.providerServiceNames, 50),
  mappingBasis: candidate.mappingBasis,
  mappingEvidence: candidate.mappingEvidence,
  status,
  acknowledgedEvidence: stringList(acknowledgedEvidence, 50),
  decisionNote:
    decisionNote.trim().slice(0, MAX_EVIDENCE_DECISION_NOTE_LENGTH) || null,
  reviewedAt,
});
