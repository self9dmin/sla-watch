import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@dynatrace/strato-components/buttons";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import type {
  EvidenceDecisionRecord,
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
  evidenceDecisionMatchesCandidate,
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
import { useContractOverrides } from "../hooks/useContractOverrides";
import { useEvidenceDecisions } from "../hooks/useEvidenceDecisions";
import { useObjectiveEvaluations } from "../hooks/useObjectiveEvaluations";
import { useProviderNoticeSource } from "../hooks/useProviderNoticeSource";
import { useServiceObjectives } from "../hooks/useServiceObjectives";
import { ProviderNotices } from "./ProviderNotices";

type Tone = "neutral" | "warning" | "positive";
type EvidenceView = "candidates" | "provider-reports";

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

const formatPercent = (value: number | null): string =>
  value === null ? "Not published" : `${value}%`;

const formatMappingBasis = (candidate: EvidenceCandidate): string =>
  candidate.mappingBasis === "confirmed-scope"
    ? "Confirmed scope"
    : candidate.mappingBasis === "provider-tag"
      ? "Provider tag"
      : candidate.mappingBasis === "smartscape-observed"
        ? "Observed topology"
        : "Smartscape candidate";

const CandidateState = ({
  decision,
  status,
  partial = false,
}: {
  decision?: EvidenceDecisionRecord;
  status?: EvidenceDecisionStatus;
  partial?: boolean;
}) => {
  const effectiveStatus = status ?? decision?.status;
  if (partial) return <StatusPill tone="warning">Mixed review</StatusPill>;
  if (effectiveStatus === "validated")
    return <StatusPill tone="positive">Package ready</StatusPill>;
  if (effectiveStatus === "not-ready")
    return <StatusPill tone="warning">Not ready</StatusPill>;
  if (effectiveStatus === "dismissed")
    return <StatusPill tone="neutral">Not provider-related</StatusPill>;
  return <StatusPill tone="warning">Potential SLA impact</StatusPill>;
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
  providerSlug,
}: {
  service: ServiceRecord;
  providerSlug: string;
}) => {
  const objectives = useServiceObjectives({
    enabled: Boolean(service.id),
    providerSlug,
    serviceClassicId: service.id,
    pageSize: 1,
  });
  const objective = objectives.objectives[0];
  const selectedObjectives = useMemo(
    () => objective ? [objective] : [],
    [objective],
  );
  const evaluations = useObjectiveEvaluations(selectedObjectives);
  const evaluation = objective ? evaluations[objective.id] : undefined;
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
        <strong>{objectives.loading
          ? "Checking"
          : objectives.error
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

const CandidateDetail = ({
  reviewCase,
  decisions,
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
  decisions: EvidenceDecisionRecord[];
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
  const providerReports = useProviderNoticeSource(
    provider.provider.slug,
    lookbackHours,
  );
  const currentDecisions = reviewCase.candidates.flatMap((item) => {
    const decision = decisions.find((record) => record.decisionKey === item.key);
    return decision && evidenceDecisionMatchesCandidate(decision, item)
      ? [decision]
      : [];
  });
  const currentStatuses = Array.from(new Set(
    currentDecisions.map((decision) => decision.status),
  ));
  const decisionIsCurrent = currentDecisions.length === reviewCase.candidates.length &&
    currentStatuses.length === 1;
  const currentDecision = decisionIsCurrent ? currentDecisions[0] : undefined;
  const partialDecision = decisions.length > 0 && !currentDecision;
  const decision = currentDecision ?? decisions[0];

  useEffect(() => {
    setNote(decision?.decisionNote ?? "");
    setAcknowledged(
      decisionIsCurrent && decision?.status === "validated",
    );
    setAcknowledgedEvidence(
      decisionIsCurrent ? decision?.acknowledgedEvidence ?? [] : [],
    );
    setSaveError(undefined);
  }, [
    reviewCase.key,
    decision?.acknowledgedEvidence,
    decision?.decisionNote,
    decision?.status,
    decisionIsCurrent,
  ]);

  const requiredEvidence = provider.provider.claimProcess?.requiredEvidence ?? [];
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
    if (decisions.length === 0 || settings.mutating || !window.confirm(`Reset the saved decision for ${reviewCase.problems.length} Problem${reviewCase.problems.length === 1 ? "" : "s"} in this case?`)) return;
    setSaveError(undefined);
    try {
      await settings.deleteDecisions(decisions);
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

  const affectedEntityIds = Array.from(new Set(
    reviewCase.problems.flatMap((problem) => problem.affectedEntityIds),
  ));
  const affectedServices = reviewCase.affectedServices.length > 0
    ? reviewCase.affectedServices.map((service) => service.name).join(", ")
    : `${affectedEntityIds.length} affected entity ID${affectedEntityIds.length === 1 ? "" : "s"}`;
  const providerServices = reviewCase.providerServiceNames.length > 0
    ? reviewCase.providerServiceNames.join(", ")
    : "Provider-level terms";
  const reviewTimes = decisions.flatMap((item) => {
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
  const serviceIds = useMemo(
    () => reviewCase.affectedServices.length > 0
      ? reviewCase.affectedServices.map((service) => service.id)
      : affectedEntityIds,
    [affectedEntityIds, reviewCase.affectedServices],
  );
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
  const packageGaps = [
    !reviewCase.candidates.every((item) => item.scopeConfirmed) ? "Confirm the provider-service scope." : null,
    reviewCase.problems.some((problem) => !problem.startedAt) ? "Confirm each impact start time." : null,
    affectedEntityIds.length === 0
      ? "Identify at least one affected Dynatrace entity."
      : null,
    !requiredEvidenceComplete
      ? "Confirm each published evidence requirement below."
      : null,
  ].filter((item): item is string => Boolean(item));
  const readyEnough = packageGaps.length === 0;
  const objectiveServices = reviewCase.affectedServices.slice(0, 3);

  const toggleEvidence = (item: string) => {
    setAcknowledgedEvidence((current) => current.includes(item)
      ? current.filter((value) => value !== item)
      : [...current, item]);
  };

  return (
    <article className="candidate-detail">
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
        <CandidateState
          status={currentDecision?.status}
          partial={partialDecision}
        />
      </div>

      <dl className="candidate-facts">
        <div>
          <dt>Observed impact</dt>
          <dd>{formatDateTime(reviewCase.startedAt)}</dd>
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
          <dt>Problem records</dt>
          <dd>{reviewCase.problems.length} included · {reviewCase.active ? "active impact" : "closed window"}</dd>
        </div>
      </dl>

      <section className="candidate-match" aria-label="Why this candidate appears">
        <div>
          <strong>Why these records are together</strong>
          <p>{reviewCase.groupingEvidence}</p>
        </div>
        <StatusPill tone={reviewCase.candidates.every((item) => item.scopeConfirmed) ? "positive" : "warning"}>
          {reviewCase.problems.length > 1 ? "Correlated case" : formatMappingBasis(candidate)}
        </StatusPill>
        <nav aria-label="Candidate references">
          <Link to={incidentPath}>Open incident</Link>
          <Link to={coveragePath}>Review coverage</Link>
          <Link to={`/directory?provider=${encodeURIComponent(provider.provider.slug)}`}>Review terms</Link>
        </nav>
      </section>

      <section className="candidate-package" aria-labelledby="candidate-package-title">
        <div className="candidate-package-heading">
          <div>
            <strong id="candidate-package-title">Claim package</strong>
            <span>Prepared from the current Dynatrace evidence and applicable terms.</span>
          </div>
          <StatusPill tone={readyEnough ? "positive" : "warning"}>
            {readyEnough ? "Ready for decision" : "Needs evidence"}
          </StatusPill>
        </div>
        <dl className="candidate-package-facts">
          <div><dt>Observed window</dt><dd>{formatDateTime(reviewCase.startedAt)} to {reviewCase.endedAt ? formatDateTime(reviewCase.endedAt) : "ongoing"}</dd></div>
          <div><dt>Coverage basis</dt><dd>{formatMappingBasis(candidate)}</dd></div>
          <div><dt>Terms source</dt><dd>{terms.source}</dd></div>
          <div><dt>Filing window</dt><dd>{terms.filingDeadlineDays === null ? "Not published" : `${terms.filingDeadlineDays} ${terms.businessDays ? "business" : "calendar"} days`}</dd></div>
          <div><dt>Claim method</dt><dd>{terms.claimMethod ?? "Not published"}</dd></div>
          <div><dt>Maximum credit</dt><dd>{formatPercent(terms.maxCreditPercent)}</dd></div>
        </dl>
        {reviewCase.problems.length > 1 ? (
          <details className="candidate-problem-records" open>
            <summary>Supporting Dynatrace Problems ({reviewCase.problems.length})</summary>
            <ul>
              {reviewCase.problems.map((problem) => (
                <li key={problem.id}>
                  <span><strong>{problem.title}</strong><small>{problem.id} · {problem.category}</small></span>
                  <time>{formatDateTime(problem.startedAt)}</time>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <div className="candidate-evidence-grid">
        <section className="candidate-evidence-block" aria-label="Customer evidence">
          <div className="candidate-evidence-heading">
            <strong>Customer evidence</strong>
            <span>{formatEvidenceLookback(lookbackHours)}</span>
          </div>
          <dl className="candidate-evidence-facts">
            <div><dt>Requests</dt><dd>{serviceTelemetryLoading ? "Checking" : telemetryAvailable ? formatCount(telemetry.requestCount) : "No data"}</dd></div>
            <div><dt>Failed requests</dt><dd>{serviceTelemetryLoading ? "Checking" : telemetryAvailable ? formatCount(telemetry.failureCount) : "No data"}</dd></div>
            <div><dt>Observed availability</dt><dd>{serviceTelemetryLoading ? "Checking" : telemetryAvailable ? formatAvailability(telemetry.requestCount, telemetry.failureCount) : "No data"}</dd></div>
          </dl>
          {serviceTelemetryError ? <span className="candidate-evidence-warning">Request telemetry is unavailable. Use the Dynatrace Problem and attach other customer-impact evidence before filing.</span> : !serviceTelemetryLoading && !telemetryAvailable ? <span className="candidate-evidence-warning">No request telemetry was returned for the affected services. The Dynatrace Problem remains evidence, but add another impact signal before filing.</span> : null}
        </section>
        <section className="candidate-evidence-block" aria-label="Dynatrace objectives">
          <div className="candidate-evidence-heading">
            <strong>Dynatrace objectives</strong>
            <Link to={`/performance?provider=${encodeURIComponent(provider.provider.slug)}`}>Open Performance</Link>
          </div>
          {objectiveServices.length > 0 ? (
            <ul className="candidate-objective-list">
              {objectiveServices.map((service) => (
                <EvidenceObjectiveRow
                  key={service.id}
                  service={service}
                  providerSlug={provider.provider.slug}
                />
              ))}
            </ul>
          ) : (
            <span className="candidate-evidence-note">No affected Dynatrace service was resolved for objective lookup.</span>
          )}
          {reviewCase.affectedServices.length > objectiveServices.length ? (
            <span className="candidate-evidence-note">Showing 3 of {reviewCase.affectedServices.length} affected services. Open Performance for the full objective inventory.</span>
          ) : null}
        </section>
        <section className="candidate-evidence-block" aria-label="Correlated provider report">
          <div className="candidate-evidence-heading">
            <strong>Provider report</strong>
            <Link to={`/evidence?${reportParams.toString()}`}>Review reports</Link>
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
        <div className="candidate-package-requirements">
          <strong>Provider evidence checklist</strong>
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
          <span>Check an item only after it is present in the package. Nothing is submitted from this screen.</span>
        </div>
        {packageGaps.length > 0 ? (
          <ul className="candidate-package-gaps">
            {packageGaps.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : null}
        {!reviewCase.candidates.every((item) => item.scopeConfirmed) ? (
          <Button as={Link} to={coveragePath} size="condensed">Resolve coverage</Button>
        ) : null}
      </section>

      <section className="candidate-review-panel" aria-label="Human review decision">
        <div className="candidate-review-heading">
          <strong>Decision</strong>
          {decision ? (
            <span className="candidate-reviewed-at">
              {reviewTime ? `Updated ${formatDateTime(reviewTime)}` : "Saved"}
            </span>
          ) : null}
        </div>
        {currentDecision ? (
          <div className={`candidate-completion candidate-completion-${currentDecision.status}`} role="status">
            <strong>{currentDecision.status === "validated"
              ? "Claim package ready"
              : currentDecision.status === "not-ready"
                ? "Saved as not ready"
                : "Review complete: not provider-related"}</strong>
            <span>{currentDecision.status === "validated"
              ? `Your review is complete for ${reviewCase.problems.length} Problem${reviewCase.problems.length === 1 ? "" : "s"}. Nothing has been sent. A contract owner can use this package for provider follow-up.`
              : currentDecision.status === "not-ready"
                ? "The case stays in the review queue with its current checklist and note. Nothing has been sent."
                : reviewCase.problems.length === 1
                  ? "Nothing has been sent. The Problem remains available in Dynatrace, but is excluded from provider follow-up."
                  : `Nothing has been sent. The ${reviewCase.problems.length} Problems remain available in Dynatrace, but are excluded from provider follow-up.`}</span>
            {currentDecision.decisionNote ? <small>Note: {currentDecision.decisionNote}</small> : null}
            <Button size="condensed" disabled={!settings.canWrite || settings.mutating} onClick={() => void resetDecision()}>
              Reopen review
            </Button>
          </div>
        ) : (
          <>
            {partialDecision ? (
              <div className="candidate-decision-stale" role="status">
                This case has partial, mixed, or stale Problem decisions. Saving below applies one decision to all {reviewCase.problems.length} Problems in the case.
              </div>
            ) : null}
            <label className="candidate-review-note">
              <span>Review note (required for Not ready and Not provider-related)</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                maxLength={MAX_EVIDENCE_DECISION_NOTE_LENGTH}
                placeholder="Add a concise operational reason. Do not paste confidential contract text."
                disabled={!settings.canWrite || settings.mutating}
              />
            </label>
            <label className="candidate-acknowledgement">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                disabled={!settings.canWrite || settings.mutating || !readyEnough}
              />
              <span>
                I reviewed the provider relationship, all included Problems,
                observed impact, current terms, and provider-required evidence.
                Nothing will be sent.
              </span>
            </label>
            {saveError ? <div className="candidate-decision-error" role="alert">{saveError}</div> : null}
            {settings.error ? (
              <div className="candidate-decision-error" role="status">
                Evidence decisions are unavailable. Existing evidence remains read-only.
              </div>
            ) : null}
            <div className="candidate-review-actions">
              <Button
                variant="emphasized"
                color="primary"
                size="condensed"
                disabled={!settings.canWrite || settings.mutating || !acknowledged || !readyEnough}
                onClick={() => void save("validated")}
              >
                {settings.mutating ? "Saving" : "Mark package ready"}
              </Button>
              <Button
                size="condensed"
                disabled={!settings.canWrite || settings.mutating}
                onClick={() => void save("not-ready")}
              >
                Save as not ready
              </Button>
              <Button
                size="condensed"
                disabled={!settings.canWrite || settings.mutating}
                onClick={() => void save("dismissed")}
              >
                Not provider-related
              </Button>
              {!settings.loading && !settings.canWrite ? (
                <span>Read-only. App Settings write access is required.</span>
              ) : null}
            </div>
          </>
        )}
      </section>
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

  const currentDecisionFor = (candidate: EvidenceCandidate) => {
    const decision = decisionByKey.get(candidate.key);
    return decision && evidenceDecisionMatchesCandidate(decision, candidate)
      ? decision
      : undefined;
  };
  const stateForCase = (reviewCase: IncidentReviewCase) => {
    const current = reviewCase.candidates.flatMap((candidate) => {
      const decision = currentDecisionFor(candidate);
      return decision ? [decision] : [];
    });
    const statuses = Array.from(new Set(current.map((decision) => decision.status)));
    const complete = current.length === reviewCase.candidates.length && statuses.length === 1;
    const hasAnyDecision = reviewCase.candidates.some((candidate) =>
      decisionByKey.has(candidate.key));
    return {
      status: complete ? statuses[0] : undefined,
      partial: hasAnyDecision && !complete,
    };
  };

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
        setSelectedKey(requested.key);
        return;
      }
    }
    if (
      reviewCases.length > 0 &&
      !reviewCases.some((reviewCase) => reviewCase.key === selectedKey)
    ) setSelectedKey(reviewCases[0].key);
    if (reviewCases.length === 0) setSelectedKey(undefined);
  }, [requestedCaseId, requestedProblemId, reviewCases, selectedKey]);

  const selected =
    reviewCases.find((reviewCase) => reviewCase.key === selectedKey) ??
    reviewCases[0];
  const validated = reviewCases.filter(
    (reviewCase) => stateForCase(reviewCase).status === "validated",
  ).length;
  const dismissed = reviewCases.filter(
    (reviewCase) => stateForCase(reviewCase).status === "dismissed",
  ).length;
  const notReady = reviewCases.filter(
    (reviewCase) => stateForCase(reviewCase).status === "not-ready",
  ).length;
  const needsReview = reviewCases.length - validated - notReady - dismissed;

  if (error) {
    return (
      <div className="evidence-empty evidence-error">
        <strong>Dynatrace evidence is incomplete.</strong>
        <span>
          The Problem query failed. Candidate generation is paused so a missing
          read is not presented as an empty result.
        </span>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="evidence-empty" role="status">
        <strong>Building the evidence queue</strong>
        <span>Comparing Problems with the current provider coverage.</span>
      </div>
    );
  }
  if (!provider) {
    return (
      <div className="evidence-empty">
        <strong>Provider terms are unavailable.</strong>
        <span>Restore the directory record before reviewing candidates.</span>
        <Button as={Link} to={`/directory?provider=${encodeURIComponent(providerSlug)}`} size="condensed">Review terms</Button>
      </div>
    );
  }
  if (reviewCases.length === 0) {
    return (
      <div className="evidence-empty">
        <strong>Review complete for this window.</strong>
        <span>
          No provider-review candidate in the last {formatEvidenceLookback(lookbackHours)} overlaps
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
      <dl className="evidence-candidate-summary" aria-label="Evidence candidate status">
        <div><dt>Needs review</dt><dd>{needsReview}</dd></div>
        <div><dt>Not ready</dt><dd>{notReady}</dd></div>
        <div><dt>Package ready</dt><dd>{validated}</dd></div>
        <div><dt>Not provider-related</dt><dd>{dismissed}</dd></div>
      </dl>
      <div className="evidence-candidate-layout">
        <aside className="candidate-queue" aria-label="Provider impact review cases">
          <div className="candidate-queue-heading">
            <strong>Review cases</strong>
            <span>{reviewCases.length} · {candidates.length} Problems</span>
          </div>
          <div className="candidate-queue-list">
            {reviewCases.slice(0, 30).map((reviewCase) => {
              const state = stateForCase(reviewCase);
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
                  <CandidateState
                    status={state.status}
                    partial={state.partial}
                  />
                </button>
              );
            })}
          </div>
        </aside>
        {selected ? (
          <CandidateDetail
            reviewCase={selected}
            decisions={selected.candidates.flatMap((candidate) => {
              const decision = decisionByKey.get(candidate.key);
              return decision ? [decision] : [];
            })}
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
          Assemble the provider follow-up package, then record the SRE decision.
        </Paragraph>
      </div>
    </div>
    <nav className="evidence-view-tabs" aria-label="Evidence views">
      <Link
        className={view === "candidates" ? "evidence-view-tab active" : "evidence-view-tab"}
        to={candidatePath}
        aria-current={view === "candidates" ? "page" : undefined}
      >
        Review candidates
      </Link>
      <Link
        className={view === "provider-reports" ? "evidence-view-tab active" : "evidence-view-tab"}
        to={`/evidence?${reportParams.toString()}`}
        aria-current={view === "provider-reports" ? "page" : undefined}
      >
        Provider reports
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
        Package readiness records an SRE decision only. Nothing is submitted.
        The provider determines fault, eligibility, and any service credit.
      </span>
    </div>
  </Surface>;
};
