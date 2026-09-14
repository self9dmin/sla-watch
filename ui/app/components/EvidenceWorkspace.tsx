import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Slo } from "@dynatrace-sdk/client-service-level-objectives";
import { Button } from "@dynatrace/strato-components/buttons";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import type {
  EvidenceDecisionStatus,
  EvidenceLookbackHours,
  ProblemRecord,
  ProviderScopeAssignmentRecord,
  ServiceRecord,
  SlaProviderResponse,
  SmartscapeScopeEdge,
} from "../types";
import type { ServiceTelemetryMap } from "../data/serviceTelemetry";
import {
  buildEvidenceCandidates,
  evidenceDecisionInputError,
  evidenceDecisionValue,
  MAX_EVIDENCE_DECISION_NOTE_LENGTH,
  type EvidenceCandidate,
} from "../data/evidenceCandidates";
import { resolveEffectiveContractTerms } from "../data/contractOverrides";
import { formatEvidenceLookback } from "../data/lookback";
import {
  correlateProviderNoticesToCandidate,
} from "../data/providerNoticeCorrelation";
import { summarizeServiceTelemetry } from "../data/serviceTelemetry";
import { formatObjectiveTimeframe } from "../data/serviceObjectives";
import {
  createCoverageReviewPath,
  createEvidenceReviewPath,
  createIncidentReviewPath,
} from "../data/reviewRoutes";
import {
  buildIncidentReviewCases,
  incidentReviewCaseForProblem,
  type IncidentReviewCase,
} from "../data/incidentReviewCases";
import { formatDavisImpact } from "../data/problems";
import {
  buildEvidenceReviewArtifact,
  evidenceReviewArtifactFilename,
  formatEvidenceFollowUpSummary,
  type EvidenceObjectiveSnapshot,
} from "../data/evidenceReviewArtifact";
import {
  evidenceReviewStatePresentation,
  resolveEvidenceReviewState,
  type EvidenceReviewState,
  type EvidenceReviewStateResult,
} from "../data/evidenceReviewState";
import { useContractOverrides } from "../hooks/useContractOverrides";
import { useEvidenceDecisions } from "../hooks/useEvidenceDecisions";
import {
  useObjectiveEvaluations,
  type ObjectiveEvaluation,
} from "../hooks/useObjectiveEvaluations";
import { useProviderNoticeSource } from "../hooks/useProviderNoticeSource";
import { useServiceObjectives } from "../hooks/useServiceObjectives";
import { ProviderNotices } from "./ProviderNotices";

type Tone = "neutral" | "warning" | "positive";
type EvidenceView = "candidates" | "provider-reports";
type EvidenceQueueFilter = "all" | EvidenceReviewState;

const EVIDENCE_CASE_PAGE_SIZE = 20;
const EVIDENCE_QUEUE_FILTERS: Array<{
  value: EvidenceQueueFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "needs-review", label: "Needs review" },
  { value: "needs-evidence", label: "Needs evidence" },
  { value: "ready-for-follow-up", label: "Ready" },
  { value: "excluded", label: "Excluded" },
];

type EvidenceWorkspaceProps = {
  view: EvidenceView;
  provider?: SlaProviderResponse;
  providerSlug: string;
  providerLabelKey: string;
  problems: ProblemRecord[];
  services: ServiceRecord[];
  topology: SmartscapeScopeEdge[];
  assignments: ProviderScopeAssignmentRecord[];
  serviceTelemetry: ServiceTelemetryMap;
  serviceTelemetryLoading: boolean;
  serviceTelemetryError?: Error;
  lookbackHours: EvidenceLookbackHours;
  loading: boolean;
  error?: Error;
};

const StatusPill = ({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) => <span className={`status-pill status-pill-${tone}`}>{children}</span>;

const formatDateTime = (value?: string): string => {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Unavailable"
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed);
};

const formatUtcDateTime = (value?: string): string => {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Unavailable"
    : `${new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(parsed)} UTC`;
};

const formatPercent = (value: number | null): string =>
  value === null ? "Not published" : `${value}%`;

const formatMappingBasis = (candidate: EvidenceCandidate): string =>
  candidate.mappingBasis === "confirmed-scope"
    ? "Confirmed SLA match"
    : candidate.mappingBasis === "provider-tag"
      ? "Provider tag"
      : candidate.mappingBasis === "smartscape-observed"
        ? "Observed topology"
        : "Smartscape candidate";

const CandidateState = ({ state }: { state: EvidenceReviewState }) => {
  const presentation = evidenceReviewStatePresentation(state);
  return <StatusPill tone={presentation.tone}>{presentation.label}</StatusPill>;
};

const formatCount = (value: number): string =>
  Math.round(value).toLocaleString();

const formatAvailability = (requests: number, failures: number): string => {
  if (requests <= 0) return "No request data";
  const value = Math.max(0, (1 - failures / requests) * 100);
  return `${value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;
};

const objectiveState = (status?: string): string => {
  if (status === "SUCCESS") return "On target";
  if (status === "WARNING") return "At risk";
  if (status === "FAILURE") return "Below target";
  return "No result";
};

const EvidenceObjectiveRow = ({
  service,
  objective,
  evaluation,
  loading,
  error,
}: {
  service: ServiceRecord;
  objective?: Slo;
  evaluation?: ObjectiveEvaluation;
  loading: boolean;
  error?: string;
}) => {
  const target = objective?.criteria[0]?.target;
  const result = evaluation?.result;
  const observed = typeof result?.value === "number"
    ? `${result.value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`
    : "No result";

  return (
    <li>
      <span>
        <strong>{service.name}</strong>
        <small>{objective
          ? formatObjectiveTimeframe(objective.criteria[0]?.timeframeFrom)
          : "No managed objective"}</small>
      </span>
      <span>
        <strong>{loading
          ? "Checking"
          : error
            ? "Unavailable"
            : objective
              ? objectiveState(result?.status)
              : "Not created"}</strong>
        <small>{objective
          ? `${observed} observed · ${typeof target === "number" ? `${target}% target` : "target unavailable"}`
          : "Use Performance to add one when useful."}</small>
      </span>
    </li>
  );
};

const objectiveForService = (
  objectives: Slo[],
  serviceId: string,
): Slo | undefined => {
  const tag = `service:${serviceId.trim().toLowerCase()}`;
  return objectives.find((objective) =>
    objective.tags?.some((value) => value.trim().toLowerCase() === tag));
};

const CandidateDetail = ({
  reviewCase,
  reviewState,
  provider,
  settings,
  contractSettings,
  topology,
  serviceTelemetry,
  serviceTelemetryLoading,
  serviceTelemetryError,
  lookbackHours,
}: {
  reviewCase: IncidentReviewCase;
  reviewState: EvidenceReviewStateResult;
  provider: SlaProviderResponse;
  settings: ReturnType<typeof useEvidenceDecisions>;
  contractSettings: ReturnType<typeof useContractOverrides>;
  topology: SmartscapeScopeEdge[];
  serviceTelemetry: ServiceTelemetryMap;
  serviceTelemetryLoading: boolean;
  serviceTelemetryError?: Error;
  lookbackHours: EvidenceLookbackHours;
}) => {
  const candidate = reviewCase.candidates[0];
  const [note, setNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledgedEvidence, setAcknowledgedEvidence] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string>();
  const [artifactFeedback, setArtifactFeedback] = useState<string>();
  const affectedEntityIds = useMemo(
    () => Array.from(new Set(
      reviewCase.problems.flatMap((problem) => problem.affectedEntityIds),
    )),
    [reviewCase.problems],
  );
  const serviceIds = useMemo(
    () => reviewCase.affectedServices.map((service) => service.id),
    [reviewCase.affectedServices],
  );
  const providerReports = useProviderNoticeSource(
    provider.provider.slug,
    lookbackHours,
  );
  const managedObjectives = useServiceObjectives({
    enabled: serviceIds.length > 0,
    providerSlug: provider.provider.slug,
    pageSize: 50,
  });
  const relevantObjectives = useMemo(() => Array.from(new Map(
    serviceIds.flatMap((serviceId) => {
      const objective = objectiveForService(
        managedObjectives.objectives,
        serviceId,
      );
      return objective ? [[objective.id, objective] as const] : [];
    }),
  ).values()), [managedObjectives.objectives, serviceIds]);
  const objectiveEvaluations = useObjectiveEvaluations(relevantObjectives);
  const currentDecision = reviewState.currentDecision;
  const partialDecision = reviewState.state === "mixed";
  const decision = currentDecision ?? reviewState.storedDecisions[0];
  const decisionIsCurrent = Boolean(currentDecision);

  useEffect(() => {
    setNote(decision?.decisionNote ?? "");
    setAcknowledged(
      decisionIsCurrent && decision?.status === "validated",
    );
    setAcknowledgedEvidence(
      decisionIsCurrent ? decision?.acknowledgedEvidence ?? [] : [],
    );
    setSaveError(undefined);
    setArtifactFeedback(undefined);
  }, [
    reviewCase.key,
    decision?.acknowledgedEvidence,
    decision?.decisionNote,
    decision?.status,
    decisionIsCurrent,
  ]);

  const providerRequiredEvidence = provider.provider.claimProcess?.requiredEvidence;
  const requiredEvidence = useMemo(
    () => providerRequiredEvidence ?? [],
    [providerRequiredEvidence],
  );
  const save = async (status: EvidenceDecisionStatus) => {
    const inputError = evidenceDecisionInputError({
      status,
      note,
      acknowledged,
      requiredEvidence,
      acknowledgedEvidence,
    });
    if (inputError) {
      setSaveError(inputError);
      return;
    }
    setSaveError(undefined);
    try {
      const result = await settings.saveDecisions(
        reviewCase.candidates.map((item) => evidenceDecisionValue(
          item,
          provider.provider.slug,
          status,
          note,
          acknowledgedEvidence,
        )),
      );
      if (result.failures.length > 0)
        throw new Error(`${result.savedDecisionKeys.length} Problem decision${result.savedDecisionKeys.length === 1 ? " was" : "s were"} saved. ${result.failures.length} failed.`);
      if (result.refreshError) throw new Error(result.refreshError);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The evidence decision could not be saved.",
      );
    }
  };

  const resetDecision = async () => {
    if (reviewState.storedDecisions.length === 0 || settings.mutating || !window.confirm(`Reset the saved decision for ${reviewCase.problems.length} Problem${reviewCase.problems.length === 1 ? "" : "s"} in this case?`)) return;
    setSaveError(undefined);
    try {
      await settings.deleteDecisions(reviewState.storedDecisions);
      setNote("");
      setAcknowledged(false);
      setAcknowledgedEvidence([]);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The evidence decision could not be reset.",
      );
    }
  };

  const affectedServices = reviewCase.affectedServices.length > 0
    ? reviewCase.affectedServices.map((service) => service.name).join(", ")
    : `${affectedEntityIds.length} affected entity ID${affectedEntityIds.length === 1 ? "" : "s"}`;
  const providerServices = reviewCase.providerServiceNames.length > 0
    ? reviewCase.providerServiceNames.join(", ")
    : "Provider-level terms";
  const reviewTimes = reviewState.storedDecisions.flatMap((item) => {
    const value = item.lastModifiedTime ?? item.reviewedAt;
    const parsed = value ? Date.parse(value) : Number.NaN;
    return Number.isFinite(parsed) ? [parsed] : [];
  });
  const reviewTime = reviewTimes.length > 0
    ? new Date(Math.max(...reviewTimes)).toISOString()
    : undefined;
  const serviceId = reviewCase.affectedServices[0]?.id ?? affectedEntityIds[0];
  const providerServiceId = reviewCase.providerServiceIds[0] ?? "*";
  const terms = useMemo(() => resolveEffectiveContractTerms(
    provider,
    contractSettings.overrides,
    {
      providerSlug: provider.provider.slug,
      providerServiceId,
      serviceId,
    },
  ), [contractSettings.overrides, provider, providerServiceId, serviceId]);
  const termsSourceLabel = terms.source === "sla.directory" ? "Published terms" : "Custom terms";
  const incidentPath = createIncidentReviewPath({
    providerSlug: provider.provider.slug,
    problemId: candidate.problem.id,
    caseId: reviewCase.key,
  });
  const evidencePath = createEvidenceReviewPath({
    providerSlug: provider.provider.slug,
    problemId: candidate.problem.id,
    caseId: reviewCase.key,
  });
  const coveragePath = createCoverageReviewPath({
    providerSlug: provider.provider.slug,
    problemId: candidate.problem.id,
    serviceId,
    providerServiceId,
    returnTo: evidencePath,
  });
  const reportParams = new URLSearchParams({
    provider: provider.provider.slug,
    view: "provider-reports",
    problem: candidate.problem.id,
    case: reviewCase.key,
  });
  const telemetry = useMemo(
    () => summarizeServiceTelemetry(serviceTelemetry, serviceIds),
    [serviceIds, serviceTelemetry],
  );
  const telemetryAvailable = serviceIds.some((id) =>
    serviceTelemetry.has(id.trim().toLowerCase()),
  );
  const noticeMatches = useMemo(
    () => correlateProviderNoticesToCandidate(
      providerReports.response?.notices ?? [],
      topology,
      {
        affectedServiceIds: affectedEntityIds,
        providerServiceIds: reviewCase.providerServiceIds,
        startedAt: reviewCase.startedAt,
        endedAt: reviewCase.endedAt,
      },
    ),
    [
      affectedEntityIds,
      providerReports.response?.notices,
      reviewCase.endedAt,
      reviewCase.providerServiceIds,
      reviewCase.startedAt,
      topology,
    ],
  );
  const providerReport = noticeMatches[0];
  const publicReport = providerReport && (
    providerReport.notice.source === "provider-public" ||
    providerReport.notice.source === "gcp-public"
  );
  const providerServiceIds = new Set(reviewCase.providerServiceIds);
  const publishedExclusions = Array.from(new Set([
    ...(provider.provider.exclusions ?? []),
    ...provider.services
      .filter((service) => providerServiceIds.has(service.id))
      .flatMap((service) => service.exclusions ?? []),
  ].map((item) => item.trim()).filter(Boolean)));
  const effectiveAcknowledgedEvidence = currentDecision?.status === "validated" &&
    currentDecision.acknowledgedEvidence.length === 0
    ? requiredEvidence
    : acknowledgedEvidence;
  const requiredEvidenceComplete = requiredEvidence.every((item) =>
    effectiveAcknowledgedEvidence.includes(item),
  );
  const structuralGaps = [
    !reviewCase.candidates.every((item) => item.scopeConfirmed) ? "Confirm the provider-service scope." : null,
    reviewCase.problems.some((problem) => !problem.startedAt) ? "Confirm each impact start time." : null,
    affectedEntityIds.length === 0
      ? "Identify at least one affected Dynatrace entity."
      : null,
  ].filter((item): item is string => Boolean(item));
  const missingRequiredEvidence = requiredEvidence.filter((item) =>
    !effectiveAcknowledgedEvidence.includes(item),
  );
  const packageGaps = [
    ...structuralGaps,
    ...missingRequiredEvidence.map((item) => `Confirm externally: ${item}`),
  ];
  const readyEnough = packageGaps.length === 0;
  const objectiveServices = reviewCase.affectedServices.slice(0, 3);
  const davisImpact = formatDavisImpact(reviewCase.problems);
  const objectiveSnapshots = useMemo<EvidenceObjectiveSnapshot[]>(
    () => reviewCase.affectedServices.map((service) => {
      const objective = objectiveForService(
        managedObjectives.objectives,
        service.id,
      );
      const evaluation = objective
        ? objectiveEvaluations[objective.id]
        : undefined;
      return {
        serviceId: service.id,
        serviceName: service.name,
        objectiveId: objective?.id ?? null,
        objectiveName: objective?.name ?? null,
        timeframe: objective
          ? formatObjectiveTimeframe(objective.criteria[0]?.timeframeFrom)
          : null,
        targetPercent: objective?.criteria[0]?.target ?? null,
        observedPercent: typeof evaluation?.result?.value === "number"
          ? evaluation.result.value
          : null,
        evaluationStatus: managedObjectives.loading
          ? "checking"
          : managedObjectives.error
            ? "unavailable"
            : objective
              ? evaluation?.state === "loading"
                ? "checking"
                : objectiveState(evaluation?.result?.status)
              : "not-configured",
      };
    }),
    [
      managedObjectives.error,
      managedObjectives.loading,
      managedObjectives.objectives,
      objectiveEvaluations,
      reviewCase.affectedServices,
    ],
  );
  const objectivesIncomplete = managedObjectives.loading ||
    Boolean(managedObjectives.error) ||
    managedObjectives.totalCount > managedObjectives.objectives.length;
  const providerReportState = providerReports.loading
    ? "checking" as const
    : providerReport
      ? "matched" as const
      : providerReports.error
        ? "unavailable" as const
        : providerReports.configuredSourceRequired
          ? "not-configured" as const
          : "not-matched" as const;
  const artifact = useMemo(() => buildEvidenceReviewArtifact({
    provider,
    reviewCase,
    candidate,
    state: reviewState.state,
    decision: currentDecision,
    terms,
    telemetry,
    telemetryAvailable,
    lookbackHours,
    objectives: objectiveSnapshots,
    objectivesIncomplete,
    providerReport,
    providerReportState,
    exclusions: publishedExclusions,
    requiredEvidence,
    acknowledgedEvidence: effectiveAcknowledgedEvidence,
    structuralGaps,
    davisImpact,
  }), [
    candidate,
    currentDecision,
    davisImpact,
    effectiveAcknowledgedEvidence,
    lookbackHours,
    objectiveSnapshots,
    objectivesIncomplete,
    provider,
    providerReport,
    providerReportState,
    publishedExclusions,
    requiredEvidence,
    reviewCase,
    reviewState.state,
    structuralGaps,
    telemetry,
    telemetryAvailable,
    terms,
  ]);
  const customerImpactReady = Boolean(reviewCase.startedAt) &&
    affectedEntityIds.length > 0;

  const copyFollowUpSummary = async () => {
    setArtifactFeedback(undefined);
    const summary = formatEvidenceFollowUpSummary(artifact);
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(summary);
      setArtifactFeedback("Follow-up summary copied.");
    } catch {
      setArtifactFeedback(
        "The browser blocked clipboard access. Download the evidence review instead.",
      );
    }
  };

  const downloadArtifact = () => {
    setArtifactFeedback(undefined);
    try {
      const currentArtifact = buildEvidenceReviewArtifact({
        provider,
        reviewCase,
        candidate,
        state: reviewState.state,
        decision: currentDecision,
        terms,
        telemetry,
        telemetryAvailable,
        lookbackHours,
        objectives: objectiveSnapshots,
        objectivesIncomplete,
        providerReport,
        providerReportState,
        exclusions: publishedExclusions,
        requiredEvidence,
        acknowledgedEvidence: effectiveAcknowledgedEvidence,
        structuralGaps,
        davisImpact,
      });
      const blob = new Blob(
        [JSON.stringify(currentArtifact, null, 2)],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = evidenceReviewArtifactFilename(currentArtifact);
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setArtifactFeedback("Evidence review downloaded.");
    } catch {
      setArtifactFeedback("The evidence review could not be downloaded.");
    }
  };

  const toggleEvidence = (item: string) => {
    setAcknowledgedEvidence((current) => current.includes(item)
      ? current.filter((value) => value !== item)
      : [...current, item]);
  };

  return (
    <article className={`candidate-detail candidate-detail-${reviewState.state}`}>
      <div className="candidate-detail-heading">
        <div>
          <span className="candidate-id">
            {reviewCase.problems.length} Dynatrace Problem{reviewCase.problems.length === 1 ? "" : "s"}
            {` · ${reviewCase.providerServiceNames.join(", ") || candidate.problem.category}`}
          </span>
          <Heading level={3}>{reviewCase.problems.length > 1
            ? `${providerServices} impact review`
            : candidate.problem.title}</Heading>
        </div>
        <CandidateState state={reviewState.state} />
      </div>

      <section className="evidence-readiness" aria-labelledby="evidence-readiness-title">
        <div className="evidence-readiness-heading">
          <div>
            <strong id="evidence-readiness-title">Review readiness</strong>
            <span>What is ready, optional, and still missing.</span>
          </div>
          <StatusPill tone={readyEnough ? "positive" : "warning"}>
            {readyEnough
              ? "No required gaps"
              : `${packageGaps.length} required gap${packageGaps.length === 1 ? "" : "s"}`}
          </StatusPill>
        </div>
        <dl className="evidence-readiness-grid">
          <div className={reviewCase.candidates.every((item) => item.scopeConfirmed) ? "ready" : "attention"}>
            <dt>Coverage</dt>
            <dd>{reviewCase.candidates.every((item) => item.scopeConfirmed) ? "Confirmed" : "Needs action"}</dd>
            <small>{formatMappingBasis(candidate)}</small>
          </div>
          <div className={customerImpactReady ? "ready" : "attention"}>
            <dt>Customer impact</dt>
            <dd>{customerImpactReady ? "Collected" : "Needs evidence"}</dd>
            <small>{telemetryAvailable ? "Request telemetry included" : "Dynatrace Problem evidence only"}</small>
          </div>
          <div className="ready">
            <dt>Terms</dt>
            <dd>Available</dd>
            <small>{termsSourceLabel}</small>
          </div>
          <div className="optional">
            <dt>Provider corroboration <span>Optional</span></dt>
            <dd>{providerReportState === "checking"
              ? "Checking"
              : providerReportState === "matched"
                ? "Matched"
                : providerReportState === "not-configured"
                  ? "Not connected"
                  : providerReportState === "unavailable"
                    ? "Unavailable"
                    : "No overlap"}</dd>
            <small>Never overrides customer evidence</small>
          </div>
          <div className={requiredEvidenceComplete ? "ready" : "attention"}>
            <dt>Required items</dt>
            <dd>{requiredEvidence.length === 0
              ? "None published"
              : requiredEvidenceComplete
                ? "Confirmed"
                : `${missingRequiredEvidence.length} missing`}</dd>
            <small>{requiredEvidence.length === 0
              ? "No provider checklist"
              : "Confirmed externally by an operator"}</small>
          </div>
        </dl>
      </section>

      <section
        className="candidate-review-panel"
        id="candidate-decision"
        aria-label="Human review decision"
      >
        <div className="candidate-review-heading">
          <div>
            <strong>Decision</strong>
            <span>Record the next operational outcome. Nothing is submitted.</span>
          </div>
          {decision ? (
            <span className="candidate-reviewed-at">
              {reviewTime ? `Updated ${formatDateTime(reviewTime)}` : "Saved"}
            </span>
          ) : null}
        </div>
        {currentDecision ? (
          <div className={`candidate-completion candidate-completion-${currentDecision.status}`} role="status">
            <strong>{currentDecision.status === "validated"
              ? "Ready for provider follow-up"
              : currentDecision.status === "not-ready"
                ? "Needs evidence"
                : "Excluded from provider follow-up"}</strong>
            <span>{currentDecision.status === "validated"
              ? `Review is complete for ${reviewCase.problems.length} Problem${reviewCase.problems.length === 1 ? "" : "s"}. The provider agreement owner can use the evidence review for follow-up.`
              : currentDecision.status === "not-ready"
                ? "The case remains open with its confirmed items and note."
                : `${reviewCase.problems.length} Problem${reviewCase.problems.length === 1 ? " remains" : "s remain"} in Dynatrace and will not appear as provider follow-up work.`}</span>
            <small>Nothing has been sent.</small>
            {currentDecision.decisionNote ? <small>Note: {currentDecision.decisionNote}</small> : null}
            <Button size="condensed" disabled={!settings.canWrite || settings.mutating} onClick={() => void resetDecision()}>
              Reopen review
            </Button>
          </div>
        ) : (
          <>
            {partialDecision ? (
              <div className="candidate-decision-stale" role="status">
                This case has mixed or stale Problem decisions. Saving applies one current decision to all {reviewCase.problems.length} Problems.
              </div>
            ) : null}
            <label className="candidate-review-note">
              <span>Decision note (required for Needs evidence and Excluded)</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                maxLength={MAX_EVIDENCE_DECISION_NOTE_LENGTH}
                placeholder="Add a concise operational reason. Do not paste confidential agreement text."
                disabled={!settings.canWrite || settings.mutating}
              />
            </label>
            {readyEnough ? (
              <label className="candidate-acknowledgement">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  disabled={!settings.canWrite || settings.mutating}
                />
                <span>
                  I reviewed the provider relationship, included Problems,
                  customer impact, terms, and externally confirmed requirements.
                </span>
              </label>
            ) : null}
            {saveError ? <div className="candidate-decision-error" role="alert">{saveError}</div> : null}
            {settings.error ? (
              <div className="candidate-decision-error" role="status">
                Review decisions are unavailable. Existing evidence remains read-only.
              </div>
            ) : null}
            <div className="candidate-review-actions">
              {readyEnough ? (
                <Button
                  variant="emphasized"
                  color="primary"
                  size="condensed"
                  disabled={!settings.canWrite || settings.mutating || !acknowledged}
                  onClick={() => void save("validated")}
                >
                  {settings.mutating ? "Saving" : "Mark ready for follow-up"}
                </Button>
              ) : !reviewCase.candidates.every((item) => item.scopeConfirmed) ? (
                <Button as={Link} to={coveragePath} variant="emphasized" color="primary" size="condensed">
                  Resolve coverage
                </Button>
              ) : (
                <Button
                  variant="emphasized"
                  color="primary"
                  size="condensed"
                  onClick={() => document.getElementById("candidate-requirements")?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                >
                  Review missing evidence
                </Button>
              )}
              <Button
                size="condensed"
                disabled={!settings.canWrite || settings.mutating}
                onClick={() => void save("not-ready")}
              >
                Save as needs evidence
              </Button>
              <Button
                size="condensed"
                disabled={!settings.canWrite || settings.mutating}
                onClick={() => void save("dismissed")}
              >
                Exclude from follow-up
              </Button>
              {!settings.loading && !settings.canWrite ? (
                <span>Read-only. App Settings write access is required.</span>
              ) : null}
            </div>
          </>
        )}
        <div className="candidate-artifact-actions">
          <span>Portable review artifact</span>
          <Button size="condensed" onClick={() => void copyFollowUpSummary()}>
            Copy follow-up summary
          </Button>
          <Button size="condensed" onClick={downloadArtifact}>
            Download evidence review
          </Button>
          {artifactFeedback ? <small role="status" aria-live="polite">{artifactFeedback}</small> : null}
        </div>
      </section>

      <details
        className="candidate-supporting-evidence"
        open={reviewState.state === "needs-review" || reviewState.state === "needs-evidence" || reviewState.state === "mixed"}
      >
        <summary>Evidence details</summary>
        <div className="candidate-supporting-evidence-body">
          <dl className="candidate-facts">
            <div>
              <dt>Observed impact</dt>
              <dd>{formatUtcDateTime(reviewCase.startedAt)}</dd>
            </div>
            <div>
              <dt>Affected services</dt>
              <dd title={affectedServices}>{affectedServices}</dd>
            </div>
            <div>
              <dt>Provider service</dt>
              <dd title={providerServices}>{providerServices}</dd>
            </div>
            <div>
              <dt>Davis impact</dt>
              <dd title={davisImpact}>{davisImpact}</dd>
            </div>
          </dl>

          <section className="candidate-match" aria-label="Why this case appears">
            <div>
              <strong>Why these records are together</strong>
              <p>{reviewCase.groupingEvidence}</p>
            </div>
            <StatusPill tone={reviewCase.candidates.every((item) => item.scopeConfirmed) ? "positive" : "warning"}>
              {reviewCase.problems.length > 1 ? "Correlated case" : formatMappingBasis(candidate)}
            </StatusPill>
            <nav aria-label="Case references">
              <Link to={incidentPath}>Open incident</Link>
              <Link to={coveragePath}>Review coverage</Link>
              <Link to={`/directory?provider=${encodeURIComponent(provider.provider.slug)}`}>Review terms</Link>
            </nav>
          </section>

          <section className="candidate-package" aria-labelledby="candidate-package-title">
            <div className="candidate-package-heading">
              <div>
                <strong id="candidate-package-title">Evidence review</strong>
                <span>Customer-observed evidence and applicable terms. This is not a claim.</span>
              </div>
              <StatusPill tone={readyEnough ? "positive" : "warning"}>
                {readyEnough ? "Complete" : `${packageGaps.length} missing`}
              </StatusPill>
            </div>
            <dl className="candidate-package-facts">
              <div><dt>Observed window (UTC)</dt><dd>{formatUtcDateTime(reviewCase.startedAt)} to {reviewCase.endedAt ? formatUtcDateTime(reviewCase.endedAt) : "Ongoing"}</dd></div>
              <div><dt>SLA match basis</dt><dd>{formatMappingBasis(candidate)}</dd></div>
              <div><dt>Terms source</dt><dd>{termsSourceLabel}</dd></div>
              <div><dt>Filing window</dt><dd>{terms.filingDeadlineDays === null ? "Not published" : `${terms.filingDeadlineDays} ${terms.businessDays ? "business" : "calendar"} days`}</dd></div>
              <div><dt>Claim method</dt><dd>{terms.claimMethod ?? "Not published"}</dd></div>
              <div><dt>Maximum credit</dt><dd>{formatPercent(terms.maxCreditPercent)}</dd></div>
            </dl>
            <details className="candidate-problem-records">
              <summary>Supporting Dynatrace Problems ({reviewCase.problems.length})</summary>
              <ul>
                {reviewCase.problems.map((problem) => (
                  <li key={problem.id}>
                    <span>
                      <strong>{problem.title}</strong>
                      <small>
                        <Link to={createIncidentReviewPath({
                          providerSlug: provider.provider.slug,
                          problemId: problem.id,
                          caseId: reviewCase.key,
                        })}>{problem.id}</Link>
                        {` · ${problem.category}`}
                      </small>
                    </span>
                    <time>{formatUtcDateTime(problem.startedAt)}</time>
                  </li>
                ))}
              </ul>
            </details>
            <div className="candidate-evidence-grid">
              <section className="candidate-evidence-block" aria-label="Customer evidence">
                <div className="candidate-evidence-heading">
                  <strong>Customer evidence</strong>
                  <span>{formatEvidenceLookback(lookbackHours)}</span>
                </div>
                <dl className="candidate-evidence-facts">
                  <div><dt>Requests</dt><dd>{serviceTelemetryLoading ? "Checking" : telemetryAvailable ? formatCount(telemetry.requestCount) : "No data"}</dd></div>
                  <div><dt>Failed</dt><dd>{serviceTelemetryLoading ? "Checking" : telemetryAvailable ? formatCount(telemetry.failureCount) : "No data"}</dd></div>
                  <div><dt>Availability</dt><dd>{serviceTelemetryLoading ? "Checking" : telemetryAvailable ? formatAvailability(telemetry.requestCount, telemetry.failureCount) : "No data"}</dd></div>
                </dl>
                {serviceTelemetryError ? <span className="candidate-evidence-warning">Request telemetry is unavailable. Keep another customer-impact signal with the review.</span> : !serviceTelemetryLoading && !telemetryAvailable ? <span className="candidate-evidence-warning">No request telemetry was returned. The Dynatrace Problem remains customer evidence.</span> : null}
              </section>
              <section className="candidate-evidence-block" aria-label="Dynatrace objectives">
                <div className="candidate-evidence-heading">
                  <strong>Dynatrace objectives</strong>
                  <Link to={`/performance?provider=${encodeURIComponent(provider.provider.slug)}`}>Open Performance</Link>
                </div>
                {objectiveServices.length > 0 ? (
                  <ul className="candidate-objective-list">
                    {objectiveServices.map((service) => {
                      const objective = objectiveForService(
                        managedObjectives.objectives,
                        service.id,
                      );
                      return <EvidenceObjectiveRow
                        key={service.id}
                        service={service}
                        objective={objective}
                        evaluation={objective ? objectiveEvaluations[objective.id] : undefined}
                        loading={managedObjectives.loading}
                        error={managedObjectives.error}
                      />;
                    })}
                  </ul>
                ) : (
                  <span className="candidate-evidence-note">No affected Dynatrace service was resolved for objective lookup.</span>
                )}
                {reviewCase.affectedServices.length > objectiveServices.length ? (
                  <span className="candidate-evidence-note">Showing 3 of {reviewCase.affectedServices.length} affected services. The download includes every loaded objective snapshot.</span>
                ) : null}
                {managedObjectives.totalCount > managedObjectives.objectives.length ? (
                  <span className="candidate-evidence-warning">The objective inventory is partial. Open Performance for the full list.</span>
                ) : null}
              </section>
              <section className="candidate-evidence-block" aria-label="Optional provider corroboration">
                <div className="candidate-evidence-heading">
                  <strong>Provider corroboration <span>Optional</span></strong>
                  <Link to={`/evidence?${reportParams.toString()}`}>Review corroboration</Link>
                </div>
                {providerReports.loading ? (
                  <span className="candidate-evidence-note">Checking the configured provider source.</span>
                ) : providerReport ? (
                  <div className="candidate-provider-match">
                    <span>
                      <strong>{providerReport.notice.title}</strong>
                      <small>{providerReport.basis === "exact-resource"
                        ? `Exact runtime overlap${providerReport.matchedServiceNames.length > 0 ? `: ${providerReport.matchedServiceNames.join(", ")}` : ""}.`
                        : "The provider service and incident window overlap."}{publicReport ? " This is a public, non-customer-specific report." : ""}</small>
                    </span>
                    <StatusPill tone={providerReport.basis === "exact-resource" ? "positive" : "neutral"}>
                      {providerReport.basis === "exact-resource" ? "Exact match" : "Supporting match"}
                    </StatusPill>
                  </div>
                ) : (
                  <span className="candidate-evidence-note">
                    {providerReports.configuredSourceRequired
                      ? "No account-specific source is connected. This optional evidence does not invalidate customer-observed impact."
                      : providerReports.error
                        ? "The provider source is unavailable. This optional evidence does not invalidate customer-observed impact."
                        : "No provider report overlaps this incident. Provider silence does not invalidate customer-observed impact."}
                  </span>
                )}
              </section>
            </div>
            <details className="candidate-package-disclosure">
              <summary>Published exclusions ({publishedExclusions.length})</summary>
              {publishedExclusions.length > 0 ? (
                <ul>{publishedExclusions.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : (
                <span>No provider or service exclusions are published for this scope.</span>
              )}
            </details>
            <div
              className="candidate-package-requirements"
              id="candidate-requirements"
              tabIndex={-1}
            >
              <strong>Provider requirements to confirm externally</strong>
              {requiredEvidence.length > 0 ? (
                <div className="candidate-evidence-checklist">
                  {requiredEvidence.map((item) => (
                    <label key={item}>
                      <input
                        type="checkbox"
                        checked={effectiveAcknowledgedEvidence.includes(item)}
                        onChange={() => toggleEvidence(item)}
                        disabled={!settings.canWrite || settings.mutating || Boolean(currentDecision)}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <span>No evidence checklist is published in the provider record.</span>
              )}
              <span>Checking an item records an operator confirmation. It does not upload or store the source material.</span>
            </div>
            <div className="candidate-evidence-status-grid" aria-label="Evidence source status">
              <section>
                <strong>Collected automatically</strong>
                <ul>{artifact.requirements.collectedAutomatically.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
              <section>
                <strong>Confirmed externally</strong>
                {artifact.requirements.confirmedExternally.length > 0
                  ? <ul>{artifact.requirements.confirmedExternally.map((item) => <li key={item}>{item}</li>)}</ul>
                  : <span>None confirmed</span>}
              </section>
              <section className={artifact.requirements.missing.length > 0 ? "attention" : "ready"}>
                <strong>Missing</strong>
                {artifact.requirements.missing.length > 0
                  ? <ul>{artifact.requirements.missing.map((item) => <li key={item}>{item}</li>)}</ul>
                  : <span>Nothing required is missing</span>}
              </section>
            </div>
          </section>
        </div>
      </details>
    </article>
  );
};

const CandidateWorkspace = ({
  provider,
  providerSlug,
  providerLabelKey,
  problems,
  services,
  topology,
  assignments,
  serviceTelemetry,
  serviceTelemetryLoading,
  serviceTelemetryError,
  lookbackHours,
  loading,
  error,
}: Omit<EvidenceWorkspaceProps, "view">) => {
  const location = useLocation();
  const routeParams = new URLSearchParams(location.search);
  const requestedProblemId = routeParams.get("problem");
  const requestedCaseId = routeParams.get("case");
  const lastRequestedSelection = useRef<string | null>(null);
  const settings = useEvidenceDecisions();
  const contractSettings = useContractOverrides();
  const candidates = useMemo(
    () =>
      buildEvidenceCandidates({
        provider,
        problems,
        services,
        topology,
        assignments,
        providerLabelKey,
      }),
    [assignments, problems, provider, providerLabelKey, services, topology],
  );
  const decisionByKey = useMemo(
    () =>
      new Map(
        settings.decisions
          .filter((decision) => decision.providerSlug === providerSlug)
          .map((decision) => [decision.decisionKey, decision]),
      ),
    [providerSlug, settings.decisions],
  );
  const reviewCases = useMemo(() => buildIncidentReviewCases({
    providerSlug,
    problems: candidates.map((candidate) => candidate.problem),
    candidates,
    services,
    contractOverrides: contractSettings.overrides,
    allowGrouping: !contractSettings.loading &&
      !contractSettings.error &&
      contractSettings.canRead,
  }), [
    candidates,
    contractSettings.canRead,
    contractSettings.error,
    contractSettings.loading,
    contractSettings.overrides,
    providerSlug,
    services,
  ]);
  const [selectedKey, setSelectedKey] = useState<string>();
  const [queueQuery, setQueueQuery] = useState("");
  const [queueFilter, setQueueFilter] = useState<EvidenceQueueFilter>("all");
  const [page, setPage] = useState(1);
  const queueInitialized = useRef(false);
  const caseStateByKey = useMemo(() => new Map(
    reviewCases.map((reviewCase) => [
      reviewCase.key,
      resolveEvidenceReviewState(reviewCase, decisionByKey),
    ]),
  ), [decisionByKey, reviewCases]);
  const filteredCases = useMemo(() => {
    const query = queueQuery.trim().toLowerCase();
    return reviewCases.filter((reviewCase) => {
      const state = caseStateByKey.get(reviewCase.key)?.state ?? "needs-review";
      const filterMatches = queueFilter === "all" ||
        (queueFilter === "needs-review"
          ? state === "needs-review" || state === "mixed"
          : state === queueFilter);
      if (!filterMatches) return false;
      if (!query) return true;
      const searchable = [
        reviewCase.key,
        ...reviewCase.problems.flatMap((problem) => [
          problem.id,
          problem.title,
          problem.category,
        ]),
        ...reviewCase.affectedServices.flatMap((service) => [
          service.id,
          service.name,
        ]),
        ...reviewCase.providerServiceIds,
        ...reviewCase.providerServiceNames,
      ].join(" ").toLowerCase();
      return searchable.includes(query);
    });
  }, [caseStateByKey, queueFilter, queueQuery, reviewCases]);
  const pageCount = Math.max(
    1,
    Math.ceil(filteredCases.length / EVIDENCE_CASE_PAGE_SIZE),
  );
  const visibleCases = useMemo(
    () => filteredCases.slice(
      (page - 1) * EVIDENCE_CASE_PAGE_SIZE,
      page * EVIDENCE_CASE_PAGE_SIZE,
    ),
    [filteredCases, page],
  );

  useEffect(() => {
    if (
      (requestedCaseId || requestedProblemId) &&
      `${requestedCaseId ?? ""}|${requestedProblemId ?? ""}` !== lastRequestedSelection.current
    ) {
      const requested = reviewCases.find((reviewCase) =>
        reviewCase.key === requestedCaseId) ??
        (requestedProblemId
          ? incidentReviewCaseForProblem(reviewCases, requestedProblemId)
          : undefined);
      if (requested) {
        lastRequestedSelection.current = `${requestedCaseId ?? ""}|${requestedProblemId ?? ""}`;
        const requestedIndex = reviewCases.findIndex((reviewCase) =>
          reviewCase.key === requested.key);
        setQueueQuery("");
        setQueueFilter("all");
        setPage(Math.floor(requestedIndex / EVIDENCE_CASE_PAGE_SIZE) + 1);
        setSelectedKey(requested.key);
        return;
      }
    }
    if (
      visibleCases.length > 0 &&
      !visibleCases.some((reviewCase) => reviewCase.key === selectedKey)
    ) setSelectedKey(visibleCases[0].key);
    if (reviewCases.length === 0) setSelectedKey(undefined);
  }, [
    requestedCaseId,
    requestedProblemId,
    reviewCases,
    selectedKey,
    visibleCases,
  ]);

  useEffect(() => {
    if (!queueInitialized.current) {
      queueInitialized.current = true;
      return;
    }
    setPage(1);
  }, [providerSlug, queueFilter, queueQuery]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const selected =
    visibleCases.find((reviewCase) => reviewCase.key === selectedKey) ??
    visibleCases[0];
  const readyForFollowUp = reviewCases.filter(
    (reviewCase) => caseStateByKey.get(reviewCase.key)?.state === "ready-for-follow-up",
  ).length;
  const excluded = reviewCases.filter(
    (reviewCase) => caseStateByKey.get(reviewCase.key)?.state === "excluded",
  ).length;
  const needsEvidence = reviewCases.filter(
    (reviewCase) => caseStateByKey.get(reviewCase.key)?.state === "needs-evidence",
  ).length;
  const needsReview = reviewCases.length - readyForFollowUp - needsEvidence - excluded;

  if (error) {
    return (
      <div className="evidence-empty evidence-error">
        <strong>Dynatrace evidence is incomplete.</strong>
        <span>
          The Problem query failed. Review case generation is paused so a missing
          read is not presented as an empty result.
        </span>
      </div>
    );
  }
  if (loading || settings.loading || contractSettings.loading) {
    return (
      <div className="evidence-empty" role="status">
        <strong>Building the evidence queue</strong>
        <span>Comparing Problems, coverage, terms, and saved review decisions.</span>
      </div>
    );
  }
  if (!provider) {
    return (
      <div className="evidence-empty">
        <strong>Provider terms are unavailable.</strong>
        <span>Restore the directory record before reviewing cases.</span>
        <Button as={Link} to={`/directory?provider=${encodeURIComponent(providerSlug)}`} size="condensed">Review terms</Button>
      </div>
    );
  }
  if (settings.error || settings.incomplete || !settings.canRead) {
    return (
      <div className="evidence-empty evidence-error">
        <strong>Saved review status is unavailable.</strong>
        <span>
          The evidence is unchanged, but the app cannot safely show or update
          case decisions until the complete review history is available.
        </span>
        {settings.error ? (
          <Button size="condensed" onClick={() => void settings.refetch()}>
            Try again
          </Button>
        ) : null}
      </div>
    );
  }
  if (reviewCases.length === 0) {
    return (
      <div className="evidence-empty">
        <strong>No review cases in this window.</strong>
        <span>
          No provider-review case in the last {formatEvidenceLookback(lookbackHours)} overlaps
           an observed or confirmed provider scope, provider tag, or Smartscape suggestion for
          {` ${provider.provider.name}`}.
        </span>
        <div className="evidence-empty-actions">
          <Button as={Link} to={`/?provider=${encodeURIComponent(providerSlug)}`} size="condensed">Review coverage</Button>
          <Button as={Link} to={`/incidents?provider=${encodeURIComponent(providerSlug)}`} size="condensed">Open incidents</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="evidence-candidates-view">
      <dl className="evidence-candidate-summary" aria-label="Evidence review case status">
        <div><dt>Needs review</dt><dd>{needsReview}</dd></div>
        <div><dt>Needs evidence</dt><dd>{needsEvidence}</dd></div>
        <div><dt>Ready for follow-up</dt><dd>{readyForFollowUp}</dd></div>
        <div><dt>Excluded</dt><dd>{excluded}</dd></div>
      </dl>
      <div className="evidence-candidate-layout">
        <aside className="candidate-queue" aria-label="Provider impact review cases">
          <div className="candidate-queue-heading">
            <strong>Review cases</strong>
            <span>{reviewCases.length} · {candidates.length} Problems</span>
          </div>
          <div className="candidate-queue-tools">
            <label>
              <span className="visually-hidden">Search review cases</span>
              <input
                type="search"
                value={queueQuery}
                onChange={(event) => setQueueQuery(event.target.value)}
                placeholder="Find a case, Problem, or service"
              />
            </label>
            <div className="candidate-queue-filters" role="group" aria-label="Filter review cases">
              {EVIDENCE_QUEUE_FILTERS.map((filter) => {
                const count = filter.value === "all"
                  ? reviewCases.length
                  : filter.value === "needs-review"
                    ? needsReview
                    : filter.value === "needs-evidence"
                      ? needsEvidence
                      : filter.value === "ready-for-follow-up"
                        ? readyForFollowUp
                        : excluded;
                return (
                  <button
                    type="button"
                    key={filter.value}
                    className={queueFilter === filter.value ? "active" : ""}
                    aria-pressed={queueFilter === filter.value}
                    onClick={() => setQueueFilter(filter.value)}
                  >
                    {filter.label} <span>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="candidate-queue-list">
            {visibleCases.map((reviewCase) => {
              const state = caseStateByKey.get(reviewCase.key) ??
                resolveEvidenceReviewState(reviewCase, decisionByKey);
              const candidate = reviewCase.candidates[0];
              const title = reviewCase.problems.length > 1
                ? `${reviewCase.providerServiceNames.join(", ") || provider?.provider.name || providerSlug} impact review`
                : candidate.problem.title;
              return (
                <button
                  type="button"
                  key={reviewCase.key}
                  className={`candidate-queue-item${selected?.key === reviewCase.key ? " selected" : ""}`}
                  onClick={() => setSelectedKey(reviewCase.key)}
                  aria-pressed={selected?.key === reviewCase.key}
                >
                  <span>
                    <strong>{title}</strong>
                    <small>{reviewCase.problems.length} Problem{reviewCase.problems.length === 1 ? "" : "s"} · {reviewCase.affectedServices.length} service{reviewCase.affectedServices.length === 1 ? "" : "s"}</small>
                  </span>
                  <CandidateState state={state.state} />
                </button>
              );
            })}
            {filteredCases.length === 0 ? (
              <div className="candidate-queue-empty">
                <strong>No matching review cases</strong>
                <span>Clear the search or choose another status.</span>
              </div>
            ) : null}
          </div>
          <div className="candidate-queue-footer" aria-label="Review case pages">
            <span>{filteredCases.length > 0
              ? `Showing ${(page - 1) * EVIDENCE_CASE_PAGE_SIZE + 1}–${Math.min(page * EVIDENCE_CASE_PAGE_SIZE, filteredCases.length)} of ${filteredCases.length}`
              : "Showing 0 of 0"}</span>
            <div>
              <Button
                size="condensed"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <span>Page {page} of {pageCount}</span>
              <Button
                size="condensed"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </aside>
        {selected ? (
          <CandidateDetail
            reviewCase={selected}
            reviewState={caseStateByKey.get(selected.key) ??
              resolveEvidenceReviewState(selected, decisionByKey)}
            provider={provider}
            settings={settings}
            contractSettings={contractSettings}
            topology={topology}
            serviceTelemetry={serviceTelemetry}
            serviceTelemetryLoading={serviceTelemetryLoading}
            serviceTelemetryError={serviceTelemetryError}
            lookbackHours={lookbackHours}
          />
        ) : null}
      </div>
    </div>
  );
};

export const EvidenceWorkspace = ({
  view,
  ...props
}: EvidenceWorkspaceProps) => {
  const location = useLocation();
  const routeParams = new URLSearchParams(location.search);
  const problemId = routeParams.get("problem");
  const caseId = routeParams.get("case") ?? undefined;
  const candidatePath = problemId
    ? createEvidenceReviewPath({ providerSlug: props.providerSlug, problemId, caseId })
    : `/evidence?provider=${encodeURIComponent(props.providerSlug)}`;
  const reportParams = new URLSearchParams({
    provider: props.providerSlug,
    view: "provider-reports",
  });
  if (problemId) reportParams.set("problem", problemId);
  if (caseId) reportParams.set("case", caseId);

  return <Surface className="panel-card evidence-workspace">
    <div className="evidence-workspace-heading">
      <div>
        <Heading level={2}>Evidence</Heading>
        <Paragraph>
          Review customer impact, record the SRE decision, and prepare a portable follow-up.
        </Paragraph>
      </div>
    </div>
    <nav className="evidence-view-tabs" aria-label="Evidence views">
      <Link
        className={view === "candidates" ? "evidence-view-tab active" : "evidence-view-tab"}
        to={candidatePath}
        aria-current={view === "candidates" ? "page" : undefined}
      >
        Review cases
      </Link>
      <Link
        className={view === "provider-reports" ? "evidence-view-tab active" : "evidence-view-tab"}
        to={`/evidence?${reportParams.toString()}`}
        aria-current={view === "provider-reports" ? "page" : undefined}
      >
        Provider corroboration
      </Link>
    </nav>
    {view === "provider-reports" ? (
      <ProviderNotices
        providerSlug={props.providerSlug}
        lookbackHours={props.lookbackHours}
        topology={props.topology}
        embedded
      />
    ) : (
      <CandidateWorkspace {...props} />
    )}
    <div className="evidence-boundary">
      <strong>Review boundary</strong>
      <span>
        Review readiness records an SRE decision only. Nothing is submitted.
        The provider determines fault, eligibility, and any service credit.
      </span>
    </div>
  </Surface>;
};
