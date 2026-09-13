import type {
  EvidenceDecisionRecord,
  ProblemRecord,
  ProviderScopeAssignmentRecord,
  ServiceRecord,
  SmartscapeScopeEdge,
} from "../types";
import type { EvidenceCandidate } from "./evidenceCandidates";
import { canonicalProviderSlug, providerDisplayName, sortProviderSlugs } from "./providers";
import { providerTagValues } from "./providerTags";

export type RootCauseRelation =
  | "provider-linked"
  | "other-provider"
  | "unscoped"
  | "incomplete"
  | "unavailable";

export type RootCauseAssessment = {
  relation: RootCauseRelation;
  label: string;
  detail: string;
  linkedProviderSlugs: string[];
};

export type IncidentBulkReviewItem = {
  problem: ProblemRecord;
  candidate?: EvidenceCandidate;
  decision?: EvidenceDecisionRecord;
  assessment: RootCauseAssessment;
  contextComplete: boolean;
};

export type RootCauseReviewGroup = {
  rootCauseEntityId: string;
  rootCauseEntityName: string;
  problemIds: string[];
};

const sameEntityId = (left: string | undefined, right: string): boolean =>
  Boolean(left && left.trim().toLowerCase() === right.trim().toLowerCase());

export const formatSmartscapeEntityType = (value: string): string => {
  const normalized = value.split(".").at(-1)?.replace(/[_-]+/g, " ").trim();
  if (!normalized || normalized.toLowerCase() === "unknown") return "Entity";
  return normalized.replace(/\b\w/g, (character) => character.toUpperCase());
};

const linkedProvidersForRootCause = ({
  problem,
  services,
  topology,
  assignments,
  providerLabelKey,
}: {
  problem: ProblemRecord;
  services: ServiceRecord[];
  topology: SmartscapeScopeEdge[];
  assignments: ProviderScopeAssignmentRecord[];
  providerLabelKey: string;
}): string[] => {
  const rootCauseId = problem.rootCause?.id;
  if (!rootCauseId) return [];

  const assigned = assignments.flatMap((assignment) =>
    assignment.enabled &&
    (sameEntityId(assignment.serviceEntityId, rootCauseId) ||
      sameEntityId(assignment.runtimeEntityId, rootCauseId))
      ? [assignment.providerSlug]
      : [],
  );
  const observed = topology.flatMap((edge) => {
    if (
      !sameEntityId(edge.serviceNodeId, rootCauseId) &&
      !sameEntityId(edge.serviceClassicId, rootCauseId) &&
      !sameEntityId(edge.targetNodeId, rootCauseId) &&
      !sameEntityId(edge.targetClassicId, rootCauseId)
    ) return [];
    const slug = canonicalProviderSlug(edge.providerSlug);
    return slug ? [slug] : [];
  });
  const tagged = services.flatMap((service) =>
    sameEntityId(service.id, rootCauseId)
      ? providerTagValues(service.tags, providerLabelKey)
      : [],
  );

  return sortProviderSlugs([...assigned, ...observed, ...tagged]);
};

export const assessProblemRootCause = ({
  problem,
  providerSlug,
  providerName,
  services,
  topology,
  assignments,
  providerLabelKey,
  contextComplete = true,
}: {
  problem: ProblemRecord;
  providerSlug: string;
  providerName: string;
  services: ServiceRecord[];
  topology: SmartscapeScopeEdge[];
  assignments: ProviderScopeAssignmentRecord[];
  providerLabelKey: string;
  contextComplete?: boolean;
}): RootCauseAssessment => {
  if (!problem.rootCause) {
    return {
      relation: "unavailable",
      label: "Root cause unavailable",
      detail: "Dynatrace did not return a root-cause Smartscape entity for this Problem.",
      linkedProviderSlugs: [],
    };
  }
  if (!contextComplete) {
    return {
      relation: "incomplete",
      label: "Provider relation unavailable",
      detail: "Root cause was returned, but coverage or topology is incomplete. Review this Problem individually.",
      linkedProviderSlugs: [],
    };
  }

  const selectedProviderSlug = canonicalProviderSlug(providerSlug) ?? providerSlug.toLowerCase();
  const linkedProviderSlugs = linkedProvidersForRootCause({
    problem,
    services,
    topology,
    assignments,
    providerLabelKey,
  });
  if (linkedProviderSlugs.includes(selectedProviderSlug)) {
    return {
      relation: "provider-linked",
      label: `${providerName} link found`,
      detail: `Coverage or provider-native topology connects this root-cause entity to ${providerName}. Review it individually.`,
      linkedProviderSlugs,
    };
  }
  if (linkedProviderSlugs.length > 0) {
    const names = linkedProviderSlugs.map(providerDisplayName).join(", ");
    return {
      relation: "other-provider",
      label: `${names} link found`,
      detail: `The loaded topology connects this root-cause entity to ${names}, not ${providerName}.`,
      linkedProviderSlugs,
    };
  }
  return {
    relation: "unscoped",
    label: `No ${providerName} link found`,
    detail: `No loaded coverage, provider tag, or provider-native topology connects this root-cause entity to ${providerName}. This is a triage aid, not proof.`,
    linkedProviderSlugs,
  };
};

export const bulkDismissalEligibility = (
  item: IncidentBulkReviewItem,
): { eligible: boolean; reason: string } => {
  if (item.problem.status.toUpperCase() !== "CLOSED")
    return { eligible: false, reason: "Only closed Problems can be reviewed in bulk." };
  if (!item.candidate)
    return { eligible: false, reason: "No provider-review candidate exists." };
  if (!item.candidate.scopeConfirmed)
    return { eligible: false, reason: "Confirm the provider scope first." };
  if (item.decision)
    return { eligible: false, reason: "This Problem already has a review decision." };
  if (!item.contextComplete)
    return { eligible: false, reason: "Provider relationship data is incomplete." };
  if (item.assessment.relation === "provider-linked")
    return { eligible: false, reason: "The root cause is linked to this provider." };
  if (!item.problem.rootCause)
    return {
      eligible: true,
      reason: "Available for manual bulk review. Dynatrace did not return a root cause.",
    };
  if (
    item.assessment.relation !== "other-provider" &&
    item.assessment.relation !== "unscoped"
  ) return { eligible: false, reason: "Review this provider relationship individually." };
  return {
    eligible: true,
    reason: "Closed candidate with a root cause outside the confirmed provider relationship.",
  };
};

export const createRootCauseReviewGroups = (
  items: IncidentBulkReviewItem[],
): RootCauseReviewGroup[] => {
  const grouped = new Map<string, RootCauseReviewGroup>();
  items.forEach((item) => {
    if (!bulkDismissalEligibility(item).eligible || !item.problem.rootCause) return;
    const key = item.problem.rootCause.id.trim().toLowerCase();
    const current = grouped.get(key) ?? {
      rootCauseEntityId: item.problem.rootCause.id,
      rootCauseEntityName: item.problem.rootCause.name,
      problemIds: [],
    };
    current.problemIds.push(item.problem.id);
    grouped.set(key, current);
  });
  return Array.from(grouped.values())
    .filter((group) => group.problemIds.length > 1)
    .sort((left, right) =>
      right.problemIds.length - left.problemIds.length ||
      left.rootCauseEntityName.localeCompare(right.rootCauseEntityName),
    );
};

export const createBulkDismissalNote = ({
  problem,
  assessment,
  providerName,
}: {
  problem: ProblemRecord;
  assessment: RootCauseAssessment;
  providerName: string;
}): string => {
  const rootCause = problem.rootCause;
  if (!rootCause)
    return `Manual bulk review marked this Problem not provider-related to ${providerName}. Dynatrace did not return a root-cause entity, so this decision was not inferred from root-cause data.`;
  const entity = `${rootCause.name} (${formatSmartscapeEntityType(rootCause.type)})`;
  if (assessment.relation === "other-provider") {
    const providers = assessment.linkedProviderSlugs.map(providerDisplayName).join(", ");
    return `Bulk triage marked this Problem not provider-related to ${providerName}. Dynatrace identified ${entity} as the root cause, and loaded topology links it to ${providers}.`;
  }
  return `Bulk triage marked this Problem not provider-related to ${providerName}. Dynatrace identified ${entity} as the root cause, with no confirmed ${providerName} relationship in loaded coverage or topology.`;
};
