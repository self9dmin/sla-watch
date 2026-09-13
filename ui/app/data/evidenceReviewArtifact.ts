import type {
  EffectiveContractTerms,
  EvidenceDecisionRecord,
  EvidenceLookbackHours,
  ProviderNotice,
  SlaProviderResponse,
} from "../types";
import type { EvidenceCandidate } from "./evidenceCandidates";
import type { EvidenceReviewState } from "./evidenceReviewState";
import type { IncidentReviewCase } from "./incidentReviewCases";
import type { CandidateProviderNoticeMatch } from "./providerNoticeCorrelation";
import type { ServiceTelemetry } from "./serviceTelemetry";

export type EvidenceObjectiveSnapshot = {
  serviceId: string;
  serviceName: string;
  objectiveId: string | null;
  objectiveName: string | null;
  timeframe: string | null;
  targetPercent: number | null;
  observedPercent: number | null;
  evaluationStatus: string;
};

type EvidenceReviewArtifactInput = {
  generatedAt?: string;
  provider: SlaProviderResponse;
  reviewCase: IncidentReviewCase;
  candidate: EvidenceCandidate;
  state: EvidenceReviewState;
  decision?: EvidenceDecisionRecord;
  terms: EffectiveContractTerms;
  telemetry: ServiceTelemetry;
  telemetryAvailable: boolean;
  lookbackHours: EvidenceLookbackHours;
  objectives: EvidenceObjectiveSnapshot[];
  objectivesIncomplete: boolean;
  providerReport?: CandidateProviderNoticeMatch;
  providerReportState: "checking" | "matched" | "not-configured" | "not-matched" | "unavailable";
  exclusions: string[];
  requiredEvidence: string[];
  acknowledgedEvidence: string[];
  structuralGaps: string[];
  davisImpact: string;
};

const utcValue = (value?: string): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const availabilityPercent = (
  telemetry: ServiceTelemetry,
  available: boolean,
): number | null => {
  if (!available || telemetry.requestCount <= 0) return null;
  return Math.max(
    0,
    (1 - telemetry.failureCount / telemetry.requestCount) * 100,
  );
};

const noticeSnapshot = (
  match: CandidateProviderNoticeMatch | undefined,
  state: EvidenceReviewArtifactInput["providerReportState"],
) => {
  const notice: ProviderNotice | undefined = match?.notice;
  return {
    optional: true,
    status: state,
    matchBasis: match?.basis ?? null,
    id: notice?.id ?? null,
    title: notice?.title ?? null,
    source: notice?.source ?? null,
    sourceScope: notice?.sourceScope ?? null,
    startedAtUtc: utcValue(notice?.startTime),
    endedAtUtc: utcValue(notice?.endTime),
    locations: notice?.locations ?? [],
    affectedResources: (notice?.affectedResources ?? []).map((resource) => ({
      id: resource.id,
      arn: resource.arn ?? null,
      accountId: resource.accountId ?? null,
      status: resource.status ?? null,
    })),
  };
};

export const buildEvidenceReviewArtifact = ({
  generatedAt = new Date().toISOString(),
  provider,
  reviewCase,
  candidate,
  state,
  decision,
  terms,
  telemetry,
  telemetryAvailable,
  lookbackHours,
  objectives,
  objectivesIncomplete,
  providerReport,
  providerReportState,
  exclusions,
  requiredEvidence,
  acknowledgedEvidence,
  structuralGaps,
  davisImpact,
}: EvidenceReviewArtifactInput) => {
  const confirmedExternally = requiredEvidence.filter((item) =>
    acknowledgedEvidence.includes(item),
  );
  const missingRequirements = requiredEvidence
    .filter((item) => !acknowledgedEvidence.includes(item))
    .map((item) => `Provider requirement: ${item}`);
  const collectedAutomatically = [
    `${reviewCase.problems.length} Dynatrace Problem record${reviewCase.problems.length === 1 ? "" : "s"}`,
    reviewCase.startedAt ? "Observed incident window in UTC" : null,
    reviewCase.problems.some((problem) => problem.affectedEntityIds.length > 0)
      ? "Affected Dynatrace entity identifiers"
      : null,
    candidate.scopeConfirmed ? "Provider coverage relationship" : null,
    telemetryAvailable ? "Dynatrace request telemetry" : null,
    "Effective provider terms",
    objectives.some((objective) => objective.objectiveId)
      ? "Dynatrace objective snapshot"
      : null,
    providerReport ? "Optional provider corroboration" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    schemaVersion: "1.0",
    artifactType: "evidence-review",
    generatedAt: utcValue(generatedAt) ?? generatedAt,
    provider: {
      slug: provider.provider.slug,
      name: provider.provider.name,
      serviceIds: reviewCase.providerServiceIds,
      serviceNames: reviewCase.providerServiceNames,
    },
    review: {
      caseId: reviewCase.key,
      state,
      decisionStatus: decision?.status ?? null,
      decisionNote: decision?.decisionNote ?? null,
      reviewedAtUtc: utcValue(decision?.reviewedAt),
    },
    incidentWindow: {
      timezone: "UTC",
      startedAtUtc: utcValue(reviewCase.startedAt),
      endedAtUtc: utcValue(reviewCase.endedAt),
      ongoing: !reviewCase.endedAt,
    },
    coverage: {
      basis: candidate.mappingBasis,
      evidence: candidate.mappingEvidence,
      confirmed: reviewCase.candidates.every((item) => item.scopeConfirmed),
    },
    dynatrace: {
      davisImpact,
      affectedServices: reviewCase.affectedServices.map((service) => ({
        id: service.id,
        name: service.name,
        type: service.type,
      })),
      problems: reviewCase.problems.map((problem) => ({
        id: problem.id,
        title: problem.title,
        status: problem.status,
        category: problem.category,
        startedAtUtc: utcValue(problem.startedAt),
        endedAtUtc: utcValue(problem.endedAt),
        affectedEntityIds: problem.affectedEntityIds,
        affectedEntities: problem.affectedEntities,
        rootCause: problem.rootCause ?? null,
        affectedUsersCount: problem.affectedUsersCount ?? null,
        impactLevel: problem.impactLevel ?? null,
      })),
    },
    customerImpact: {
      lookbackHours,
      telemetry: {
        status: telemetryAvailable ? "collected" : "not-returned",
        requestCount: telemetryAvailable ? telemetry.requestCount : null,
        failedRequestCount: telemetryAvailable ? telemetry.failureCount : null,
        observedAvailabilityPercent: availabilityPercent(
          telemetry,
          telemetryAvailable,
        ),
      },
      objectives: {
        status: objectivesIncomplete ? "partial" : "complete",
        items: objectives,
      },
    },
    terms: {
      source: terms.source,
      availabilityTargetPercent: terms.availabilityTarget,
      filingDeadlineDays: terms.filingDeadlineDays,
      deadlineBasis: terms.deadlineBasis,
      businessDays: terms.businessDays,
      claimMethod: terms.claimMethod,
      maximumCreditPercent: terms.maxCreditPercent,
      appliedOverrideKeys: terms.appliedOverrides.map((override) =>
        override.overrideKey),
    },
    providerCorroboration: noticeSnapshot(
      providerReport,
      providerReportState,
    ),
    exclusions,
    requirements: {
      collectedAutomatically,
      confirmedExternally,
      missing: [...structuralGaps, ...missingRequirements],
    },
    boundary:
      "This artifact records customer-observed evidence and an operator review. It is not a submitted claim and does not establish provider fault, eligibility, or credit.",
  } as const;
};

export type EvidenceReviewArtifact = ReturnType<
  typeof buildEvidenceReviewArtifact
>;

const listLine = (values: readonly string[]): string =>
  values.length > 0 ? values.join("; ") : "None";

const percent = (value: number | null): string =>
  value === null ? "Not available" : `${value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;

const reviewStateLabel = (state: EvidenceReviewState): string => {
  if (state === "ready-for-follow-up") return "Ready for follow-up";
  if (state === "needs-evidence") return "Needs evidence";
  if (state === "excluded") return "Excluded from provider follow-up";
  if (state === "mixed") return "Mixed review";
  return "Needs review";
};

export const formatEvidenceFollowUpSummary = (
  artifact: EvidenceReviewArtifact,
): string => {
  const windowEnd = artifact.incidentWindow.ongoing
    ? "Ongoing"
    : artifact.incidentWindow.endedAtUtc ?? "Not available";
  const telemetry = artifact.customerImpact.telemetry;
  const objectiveLines = artifact.customerImpact.objectives.items.map((item) =>
    `${item.serviceName}: ${item.objectiveName ?? "No managed objective"}` +
    (item.objectiveName
      ? `, ${percent(item.observedPercent)} observed, ${percent(item.targetPercent)} target (${item.evaluationStatus})`
      : ""));
  const corroboration = artifact.providerCorroboration;

  return [
    "Evidence follow-up summary",
    `Provider: ${artifact.provider.name}`,
    `Review case: ${artifact.review.caseId}`,
    `Review state: ${reviewStateLabel(artifact.review.state)}`,
    `Incident window (UTC): ${artifact.incidentWindow.startedAtUtc ?? "Not available"} to ${windowEnd}`,
    `Dynatrace Problems: ${artifact.dynatrace.problems.map((problem) => problem.id).join(", ")}`,
    `Affected services: ${artifact.dynatrace.affectedServices.map((service) => service.name).join(", ") || "No service returned"}`,
    `Provider scope: ${artifact.provider.serviceNames.join(", ") || "Provider-level"}`,
    `Coverage: ${artifact.coverage.confirmed ? "Confirmed" : "Needs review"} (${artifact.coverage.basis})`,
    `Davis impact: ${artifact.dynatrace.davisImpact}`,
    `Customer telemetry: ${telemetry.status === "collected"
      ? `${telemetry.requestCount?.toLocaleString()} requests, ${telemetry.failedRequestCount?.toLocaleString()} failed, ${percent(telemetry.observedAvailabilityPercent)} availability`
      : "Not returned"}`,
    `Objectives: ${objectiveLines.length > 0 ? objectiveLines.join("; ") : "No affected service returned"}`,
    `Terms: ${percent(artifact.terms.availabilityTargetPercent)} target, ${artifact.terms.filingDeadlineDays ?? "unpublished"} ${artifact.terms.businessDays ? "business" : "calendar"} days, ${artifact.terms.claimMethod ?? "claim method unpublished"}, source ${artifact.terms.source}`,
    `Provider corroboration (optional): ${corroboration.status}${corroboration.title ? `, ${corroboration.title}` : ""}`,
    `Collected automatically: ${listLine(artifact.requirements.collectedAutomatically)}`,
    `Confirmed externally: ${listLine(artifact.requirements.confirmedExternally)}`,
    `Missing: ${listLine(artifact.requirements.missing)}`,
    `Published exclusions: ${listLine(artifact.exclusions)}`,
    `Operator note: ${artifact.review.decisionNote ?? "None"}`,
    artifact.boundary,
  ].join("\n");
};

export const evidenceReviewArtifactFilename = (
  artifact: EvidenceReviewArtifact,
): string => {
  const date = artifact.generatedAt.slice(0, 10) || "undated";
  const provider = artifact.provider.slug.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const reviewCase = artifact.review.caseId.toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `evidence-review-${provider || "provider"}-${reviewCase || "case"}-${date}.json`;
};
