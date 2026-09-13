import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { openApp } from "@dynatrace-sdk/navigation";
import { Button } from "@dynatrace/strato-components/buttons";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { DynatraceIntelligenceSignetIcon } from "@dynatrace/strato-icons";
import type {
  EvidenceLookbackHours,
  ProblemRecord,
  ServiceRecord,
  SlaProviderResponse,
  SmartscapeScopeEdge,
} from "../types";
import {
  buildEvidenceCandidates,
  evidenceDecisionMatchesCandidate,
  evidenceDecisionValue,
  type EvidenceCandidate,
} from "../data/evidenceCandidates";
import {
  assessProblemRootCause,
  bulkDismissalEligibility,
  createBulkDismissalNote,
  createRootCauseReviewGroups,
  formatSmartscapeEntityType,
  type IncidentBulkReviewItem,
  type RootCauseAssessment,
  type RootCauseReviewGroup,
} from "../data/incidentTriage";
import {
  EVIDENCE_LOOKBACK_OPTIONS,
  formatEvidenceLookback,
} from "../data/lookback";
import { prioritizeProblems } from "../data/incidentPrioritization";
import {
  createCoverageReviewPath,
  createEvidenceReviewPath,
  createIncidentReviewPath,
} from "../data/reviewRoutes";
import { useProviderScopeAssignments } from "../hooks/useProviderScopeAssignments";
import { useEvidenceDecisions } from "../hooks/useEvidenceDecisions";

type Tone = "neutral" | "warning" | "positive";

type IncidentReviewProps = {
  provider?: SlaProviderResponse;
  providerLabelKey: string;
  problems: ProblemRecord[];
  services: ServiceRecord[];
  topology: SmartscapeScopeEdge[];
  topologyLoading: boolean;
  topologyError?: Error;
  providerContextIncomplete: boolean;
  lookbackHours: EvidenceLookbackHours;
  onLookbackChange: (value: EvidenceLookbackHours) => void;
  loading: boolean;
  error?: Error;
};

const PAGE_SIZE = 8;
const MAX_BULK_REVIEW = 50;

const StatusPill = ({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) => <span className={`status-pill status-pill-${tone}`}>{children}</span>;

const formatStatus = (status: string): string =>
  status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

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

const IncidentFact = ({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: Tone;
}) => (
  <div className="overview-fact">
    <span>{label}</span>
    <strong className={`overview-fact-value overview-fact-value-${tone}`}>
      {value}
    </strong>
    <small>{detail}</small>
  </div>
);

const candidateByProblem = (
  candidates: EvidenceCandidate[],
): Map<string, EvidenceCandidate> =>
  new Map(candidates.map((candidate) => [candidate.problem.id, candidate]));

const IncidentDetail = ({
  problem,
  candidate,
  serviceIds,
  serviceNames,
  providerSlug,
  providerName,
  matchingLoading,
  rootCauseAssessment,
  rootCauseGroup,
  onSelectRootCauseGroup,
}: {
  problem: ProblemRecord;
  candidate?: EvidenceCandidate;
  serviceIds: string[];
  serviceNames: string[];
  providerSlug: string;
  providerName: string;
  matchingLoading: boolean;
  rootCauseAssessment: RootCauseAssessment;
  rootCauseGroup?: RootCauseReviewGroup;
  onSelectRootCauseGroup: (group: RootCauseReviewGroup) => void;
}) => {
  const active = problem.status.toUpperCase() === "ACTIVE";
  const affectedServices = candidate?.affectedServices.length
    ? candidate.affectedServices.map((service) => service.name).join(", ")
    : serviceNames.length > 0
      ? serviceNames.join(", ")
      : "No affected service returned";
  const providerServices = candidate?.providerServiceNames.length
    ? candidate.providerServiceNames.join(", ")
    : "Not matched";
  const rootCause = problem.rootCause;
  const rootCauseLabel = rootCause?.name ?? "Not returned";
  const rootCauseType = rootCause
    ? formatSmartscapeEntityType(rootCause.type)
    : "No root-cause entity";
  const hasAffectedServiceScope = serviceNames.length > 0;
  const nextTone: Tone = matchingLoading
    ? "neutral"
    : candidate
      ? candidate.scopeConfirmed
        ? "positive"
        : "warning"
      : hasAffectedServiceScope
        ? "warning"
        : "neutral";
  const nextLabel = matchingLoading
    ? "Checking coverage"
    : candidate
      ? candidate.scopeConfirmed
        ? "Ready for evidence"
        : "Review suggested match"
      : hasAffectedServiceScope
        ? "Coverage needed"
        : "No service scope";
  const nextDetail = matchingLoading
    ? "Comparing affected services with Coverage and provider-native topology."
    : candidate?.mappingEvidence ??
      (hasAffectedServiceScope
        ? `No affected service currently overlaps ${providerName} coverage. Confirm the boundary before treating this Problem as provider evidence.`
         : "Dynatrace did not return an affected service that SLA Review can compare with provider coverage.");
  const incidentPath = createIncidentReviewPath({ providerSlug, problemId: problem.id });
  const evidencePath = createEvidenceReviewPath({ providerSlug, problemId: problem.id });
  const coveragePath = createCoverageReviewPath({
    providerSlug,
    problemId: problem.id,
    serviceId: serviceIds[0],
    providerServiceId: candidate?.providerServiceIds[0],
    returnTo: incidentPath,
  });

  return (
    <article className="incident-detail">
      <div className="incident-detail-heading">
        <div>
          <span>{problem.id} · {formatStatus(problem.category)}</span>
          <Heading level={3}>{problem.title}</Heading>
        </div>
        <StatusPill tone={active ? "warning" : "neutral"}>
          {formatStatus(problem.status)}
        </StatusPill>
      </div>

      <dl className="incident-detail-facts">
        <div>
          <dt>Affected services</dt>
          <dd title={affectedServices}>{affectedServices}</dd>
        </div>
        <div>
          <dt>Provider service</dt>
          <dd title={providerServices}>{providerServices}</dd>
        </div>
        <div>
          <dt>Root cause</dt>
          <dd title={rootCauseLabel}>{rootCauseLabel}</dd>
        </div>
        <div>
          <dt>Provider relationship</dt>
          <dd title={rootCauseAssessment.detail}>{rootCauseAssessment.label}</dd>
        </div>
      </dl>

      <section className="incident-root-cause-context" aria-label="Dynatrace root-cause context">
        <div>
          <strong>{rootCause ? rootCauseType : rootCauseAssessment.label}</strong>
          <span>{rootCauseAssessment.detail}</span>
        </div>
        {rootCauseGroup ? (
          <Button
            size="condensed"
            onClick={() => onSelectRootCauseGroup(rootCauseGroup)}
          >
            Review {rootCauseGroup.problemIds.length} together
          </Button>
        ) : null}
      </section>

      <section className={`incident-next-step incident-next-step-${nextTone}`}>
        <StatusPill tone={nextTone}>{nextLabel}</StatusPill>
        <div>
          <strong>{candidate ? "Provider relevance found" : "Provider relevance not established"}</strong>
          <span>{nextDetail}</span>
        </div>
        {!matchingLoading && candidate ? (
          <Button
            as={Link}
            to={evidencePath}
            size="condensed"
            variant="emphasized"
          >
            Review evidence
          </Button>
        ) : !matchingLoading && hasAffectedServiceScope ? (
          <Button as={Link} to={coveragePath} size="condensed">
            Resolve coverage
          </Button>
        ) : null}
      </section>

      <section className="incident-observed-window" aria-label="Observed Problem window">
        <span>Observed window</span>
        <strong>{formatDateTime(problem.startedAt)}</strong>
        <small>
          {problem.endedAt
            ? `to ${formatDateTime(problem.endedAt)}`
            : "Ongoing or end unavailable"}
        </small>
      </section>
    </article>
  );
};

export const IncidentReview = ({
  provider,
  providerLabelKey,
  problems,
  services,
  topology,
  topologyLoading,
  topologyError,
  providerContextIncomplete,
  lookbackHours,
  onLookbackChange,
  loading,
  error,
}: IncidentReviewProps) => {
  const location = useLocation();
  const requestedProblemId = new URLSearchParams(location.search).get("problem");
  const [selectedId, setSelectedId] = useState<string | null>(requestedProblemId);
  const [page, setPage] = useState(1);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedProblemIds, setSelectedProblemIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [confirmingBulkReview, setConfirmingBulkReview] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{
    tone: "positive" | "warning";
    message: string;
  }>();
  const lastRequestedProblem = useRef<string | null>(null);
  const scopeSettings = useProviderScopeAssignments();
  const evidenceSettings = useEvidenceDecisions();
  const providerSlug = provider?.provider.slug ?? "provider";
  const providerName = provider?.provider.name ?? "the selected provider";
  const matchingLoading = topologyLoading || scopeSettings.loading;
  const matchingError = topologyError ?? scopeSettings.error;
  const relationshipContextComplete = !matchingLoading &&
    !matchingError &&
    !providerContextIncomplete &&
    !scopeSettings.incomplete;
  const bulkReviewContextComplete = relationshipContextComplete &&
    !evidenceSettings.loading &&
    !evidenceSettings.error &&
    !evidenceSettings.incomplete &&
    evidenceSettings.canRead;
  const serviceNamesById = useMemo(
    () => new Map(services.map((service) => [service.id, service.name])),
    [services],
  );
  const candidates = useMemo(
    () =>
      buildEvidenceCandidates({
        provider,
        problems,
        services,
        topology,
        assignments: scopeSettings.assignments,
        providerLabelKey,
      }),
    [
      problems,
      provider,
      providerLabelKey,
      scopeSettings.assignments,
      services,
      topology,
    ],
  );
  const candidatesByProblem = useMemo(
    () => candidateByProblem(candidates),
    [candidates],
  );
  const decisionByKey = useMemo(
    () => new Map(
      evidenceSettings.decisions
        .filter((decision) => decision.providerSlug === providerSlug)
        .map((decision) => [decision.decisionKey, decision]),
    ),
    [evidenceSettings.decisions, providerSlug],
  );
  const triageItems = useMemo<IncidentBulkReviewItem[]>(
    () => problems.map((problem) => {
      const candidate = candidatesByProblem.get(problem.id);
      const storedDecision = candidate ? decisionByKey.get(candidate.key) : undefined;
      const decision = candidate && storedDecision &&
        evidenceDecisionMatchesCandidate(storedDecision, candidate)
        ? storedDecision
        : undefined;
      return {
        problem,
        candidate,
        decision,
        assessment: assessProblemRootCause({
          problem,
          providerSlug,
          providerName,
          services,
          topology,
          assignments: scopeSettings.assignments,
          providerLabelKey,
          contextComplete: relationshipContextComplete,
        }),
        contextComplete: bulkReviewContextComplete,
      };
    }),
    [
      candidatesByProblem,
      decisionByKey,
      problems,
      providerLabelKey,
      providerName,
      providerSlug,
      bulkReviewContextComplete,
      relationshipContextComplete,
      scopeSettings.assignments,
      services,
      topology,
    ],
  );
  const triageItemByProblem = useMemo(
    () => new Map(triageItems.map((item) => [item.problem.id, item])),
    [triageItems],
  );
  const eligibilityByProblem = useMemo(
    () => new Map(
      triageItems.map((item) => [item.problem.id, bulkDismissalEligibility(item)]),
    ),
    [triageItems],
  );
  const reviewGroups = useMemo(
    () => createRootCauseReviewGroups(triageItems),
    [triageItems],
  );
  const reviewGroupByProblem = useMemo(() => {
    const groups = new Map<string, RootCauseReviewGroup>();
    reviewGroups.forEach((group) =>
      group.problemIds.forEach((problemId) => groups.set(problemId, group)),
    );
    return groups;
  }, [reviewGroups]);
  const candidateProblemIds = useMemo(
    () => new Set(
      triageItems
        .filter((item) => item.candidate &&
          item.decision?.status !== "validated" &&
          item.decision?.status !== "dismissed")
        .map((item) => item.problem.id),
    ),
    [triageItems],
  );
  const orderedProblems = useMemo(
    () => prioritizeProblems(problems, candidateProblemIds),
    [candidateProblemIds, problems],
  );
  const pageCount = Math.max(1, Math.ceil(orderedProblems.length / PAGE_SIZE));
  const visibleProblems = useMemo(
    () =>
      orderedProblems.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE,
      ),
    [orderedProblems, page],
  );
  const selectedProblem =
    visibleProblems.find((problem) => problem.id === selectedId) ??
    visibleProblems[0] ??
    orderedProblems[0];
  const selectedCandidate = selectedProblem
    ? candidatesByProblem.get(selectedProblem.id)
    : undefined;
  const selectedTriageItem = selectedProblem
    ? triageItemByProblem.get(selectedProblem.id)
    : undefined;
  const selectedRootCauseAssessment = selectedTriageItem?.assessment ?? {
    relation: "unavailable" as const,
    label: "Root cause unavailable",
    detail: "Dynatrace did not return a root-cause Smartscape entity for this Problem.",
    linkedProviderSlugs: [],
  };
  const selectedServiceNames = selectedProblem
    ? selectedProblem.affectedEntityIds
        .map((id) => serviceNamesById.get(id))
        .filter((name): name is string => Boolean(name))
    : [];
  const selectedServiceIds = selectedProblem
    ? selectedProblem.affectedEntityIds.filter((id) => serviceNamesById.has(id))
    : [];
  const activeProblems = problems.filter(
    (problem) => problem.status.toUpperCase() === "ACTIVE",
  ).length;
  const affectedServiceCount = new Set(
    problems
      .flatMap((problem) => problem.affectedEntityIds)
      .filter((id) => serviceNamesById.has(id)),
  ).size;
  const eligibleBulkCount = Array.from(eligibilityByProblem.values())
    .filter((eligibility) => eligibility.eligible).length;
  const unresolvedCandidateCount = triageItems.filter(
    (item) => item.candidate &&
      item.decision?.status !== "validated" &&
      item.decision?.status !== "dismissed",
  ).length;
  const selectedBulkItems = triageItems.filter(
    (item): item is IncidentBulkReviewItem & { candidate: EvidenceCandidate } =>
      selectedProblemIds.has(item.problem.id) &&
      Boolean(item.candidate) &&
      eligibilityByProblem.get(item.problem.id)?.eligible === true,
  ).slice(0, MAX_BULK_REVIEW);
  const selectedWithoutRootCauseCount = selectedBulkItems.filter(
    (item) => !item.problem.rootCause,
  ).length;

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (
      requestedProblemId &&
      requestedProblemId !== lastRequestedProblem.current
    ) {
      const requestedIndex = orderedProblems.findIndex(
        (problem) => problem.id === requestedProblemId,
      );
      if (requestedIndex >= 0) {
        lastRequestedProblem.current = requestedProblemId;
        setSelectedId(requestedProblemId);
        setPage(Math.floor(requestedIndex / PAGE_SIZE) + 1);
        return;
      }
    }
    if (orderedProblems.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!visibleProblems.some((problem) => problem.id === selectedId))
      setSelectedId(visibleProblems[0]?.id ?? orderedProblems[0].id);
  }, [orderedProblems, requestedProblemId, selectedId, visibleProblems]);

  useEffect(() => {
    setSelectedProblemIds((current) => {
      const remaining = Array.from(current).filter(
        (problemId) => eligibilityByProblem.get(problemId)?.eligible,
      );
      if (remaining.length === current.size) return current;
      return new Set(remaining);
    });
  }, [eligibilityByProblem]);

  useEffect(() => {
    setSelectionMode(false);
    setSelectedProblemIds(new Set());
    setConfirmingBulkReview(false);
    setBulkFeedback(undefined);
  }, [lookbackHours, providerSlug]);

  const closeBulkReview = () => {
    setSelectionMode(false);
    setConfirmingBulkReview(false);
    setSelectedProblemIds(new Set());
  };

  const selectRootCauseGroup = (group: RootCauseReviewGroup) => {
    setSelectionMode(true);
    setConfirmingBulkReview(false);
    setBulkFeedback(undefined);
    setSelectedProblemIds(new Set(group.problemIds.slice(0, MAX_BULK_REVIEW)));
  };

  const setProblemSelected = (problemId: string, checked: boolean) => {
    setBulkFeedback(undefined);
    setConfirmingBulkReview(false);
    setSelectedProblemIds((current) => {
      const next = new Set(current);
      if (checked && next.size < MAX_BULK_REVIEW) next.add(problemId);
      else if (!checked) next.delete(problemId);
      return next;
    });
  };

  const saveBulkDismissals = async () => {
    if (
      selectedBulkItems.length === 0 ||
      bulkSaving ||
      !evidenceSettings.canWrite
    ) return;
    setBulkSaving(true);
    setBulkFeedback(undefined);
    try {
      const result = await evidenceSettings.saveDecisions(
        selectedBulkItems.map((item) => evidenceDecisionValue(
          item.candidate,
          providerSlug,
          "dismissed",
          createBulkDismissalNote({
            problem: item.problem,
            assessment: item.assessment,
            providerName,
          }),
        )),
      );
      const failedKeys = new Set(
        result.failures.map((failure) => failure.decisionKey),
      );
      const failedProblemIds = selectedBulkItems
        .filter((item) => failedKeys.has(item.candidate.key))
        .map((item) => item.problem.id);
      setSelectedProblemIds(new Set(failedProblemIds));
      setConfirmingBulkReview(false);
      if (result.failures.length > 0 || result.refreshError) {
        const saved = result.savedDecisionKeys.length;
        const failed = result.failures.length;
        setBulkFeedback({
          tone: "warning",
          message: result.refreshError && failed === 0
            ? `${saved} decision${saved === 1 ? " was" : "s were"} saved, but the queue could not refresh. Reload before continuing.`
            : `${saved} decision${saved === 1 ? "" : "s"} saved. ${failed} failed and remain selected for retry.`,
        });
      } else {
        const saved = result.savedDecisionKeys.length;
        setBulkFeedback({
          tone: "positive",
          message: `${saved} Problem${saved === 1 ? " was" : "s were"} marked not provider-related. Evidence now reflects each decision.`,
        });
        setSelectionMode(false);
      }
    } catch (saveError) {
      setBulkFeedback({
        tone: "warning",
        message: saveError instanceof Error
          ? saveError.message
          : "The selected decisions could not be saved.",
      });
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <Surface className="panel-card incidents-panel">
      <div className="incidents-heading">
        <div>
          <Heading level={2}>Incidents</Heading>
          <Paragraph>
            Triage Dynatrace Problems and identify those relevant to
            {` ${provider?.provider.name ?? "the selected provider"}`}.
          </Paragraph>
        </div>
        <StatusPill tone={activeProblems > 0 ? "warning" : "neutral"}>
          {loading
            ? "Loading Problems"
            : `${problems.length.toLocaleString()} observed`}
        </StatusPill>
      </div>

      <div className="overview-facts incidents-facts" aria-label="Incident status">
        <IncidentFact
          label="Active"
          value={loading ? "Checking" : activeProblems.toLocaleString()}
          detail="open Dynatrace Problems"
          tone={activeProblems > 0 ? "warning" : "neutral"}
        />
        <IncidentFact
          label="Needs evidence review"
          value={matchingLoading || evidenceSettings.loading
            ? "Checking"
            : unresolvedCandidateCount.toLocaleString()}
          detail={`${candidates.length.toLocaleString()} provider-relevant total`}
          tone={unresolvedCandidateCount > 0 ? "warning" : "positive"}
        />
        <IncidentFact
          label="Affected services"
          value={loading ? "Checking" : affectedServiceCount.toLocaleString()}
          detail="unique services in this window"
          tone={affectedServiceCount > 0 ? "positive" : "neutral"}
        />
        <div className="overview-fact incidents-lookback">
          <label htmlFor="incidents-lookback">Lookback</label>
          <select
            id="incidents-lookback"
            aria-label="Incident evidence lookback"
            value={lookbackHours}
            onChange={(event) =>
              onLookbackChange(
                Number(event.target.value) as EvidenceLookbackHours,
              )
            }
          >
            {EVIDENCE_LOOKBACK_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <small>shared workspace window</small>
        </div>
      </div>

      <div className="incidents-problem-context">
        <div className="scope-map-toolbar">
          <div className="scope-map-title">
            <DynatraceIntelligenceSignetIcon />
            <div>
              <strong id="dynatrace-problems-title">Dynatrace Problems</strong>
              <span>
                Dynatrace Intelligence identifies impact and root cause.
              </span>
            </div>
          </div>
          <div className="scope-map-toolbar-actions">
            <Button
              size="condensed"
              disabled={
                matchingLoading ||
                evidenceSettings.loading ||
                !evidenceSettings.canWrite ||
                eligibleBulkCount === 0 ||
                bulkSaving
              }
              title={!evidenceSettings.canWrite
                ? "App Settings write access is required for review decisions."
                : !bulkReviewContextComplete
                  ? "Provider relationships or existing review decisions are incomplete. Review Problems individually."
                : eligibleBulkCount === 0
                  ? "No closed confirmed candidate is available for manual bulk review."
                  : undefined}
              onClick={() => {
                if (selectionMode) closeBulkReview();
                else {
                  setSelectionMode(true);
                  setBulkFeedback(undefined);
                }
              }}
            >
              {selectionMode ? "Done selecting" : `Select multiple (${eligibleBulkCount})`}
            </Button>
            <Button
              size="condensed"
              onClick={() => openApp("dynatrace.davis.problems")}
            >
              <Button.Prefix>
                <DynatraceIntelligenceSignetIcon />
              </Button.Prefix>
              Open Problems
            </Button>
          </div>
        </div>
        <div className="scope-map-boundary">
          <strong>How it is used</strong>
          <span>
            SLA Review prioritizes active and provider-relevant Problems. Open
            Problems for full investigation; move to Evidence only after a
            provider relationship is found.
          </span>
        </div>
      </div>

      {selectionMode ? (
        <section className="incident-bulk-review" aria-label="Bulk incident review">
          <div>
            <strong>{confirmingBulkReview
              ? `Mark ${selectedBulkItems.length} not provider-related?`
              : `${selectedBulkItems.length} selected`}</strong>
            <span>{confirmingBulkReview
              ? selectedWithoutRootCauseCount > 0
                ? `${selectedWithoutRootCauseCount} selected Problem${selectedWithoutRootCauseCount === 1 ? " has" : "s have"} no returned root cause. Each receives its own audited decision. This is your classification, not proof, and nothing is submitted.`
                : "Each Problem receives its own audited decision. Dynatrace root cause is a triage aid, not proof, and nothing is submitted."
              : `Select up to ${MAX_BULK_REVIEW} closed candidates. A missing root cause does not block manual review. Active, provider-linked, incomplete, and previously reviewed Problems stay individual.`}</span>
          </div>
          <div className="incident-bulk-actions">
            {confirmingBulkReview ? (
              <Button
                size="condensed"
                disabled={bulkSaving}
                onClick={() => setConfirmingBulkReview(false)}
              >
                Back
              </Button>
            ) : (
              <Button
                size="condensed"
                disabled={selectedBulkItems.length === 0 || bulkSaving}
                onClick={() => setSelectedProblemIds(new Set())}
              >
                Clear
              </Button>
            )}
            <Button
              size="condensed"
              variant="emphasized"
              disabled={selectedBulkItems.length === 0 || bulkSaving}
              onClick={() => {
                if (confirmingBulkReview) void saveBulkDismissals();
                else setConfirmingBulkReview(true);
              }}
            >
              {bulkSaving
                ? "Saving decisions"
                : confirmingBulkReview
                  ? `Confirm ${selectedBulkItems.length} decisions`
                  : "Mark not provider-related"}
            </Button>
          </div>
        </section>
      ) : null}

      {bulkFeedback ? (
        <div
          className={`incident-bulk-feedback incident-bulk-feedback-${bulkFeedback.tone}`}
          role={bulkFeedback.tone === "warning" ? "alert" : "status"}
        >
          {bulkFeedback.message}
        </div>
      ) : null}

      {error ? (
        <div className="error-box incidents-error">
          The Problem query is incomplete. Check the current user's event access.
        </div>
      ) : matchingError ? (
        <div className="error-box incidents-error">
          Provider matching is incomplete. The Problem list remains available.
        </div>
      ) : null}

      {loading && problems.length === 0 ? (
        <div className="incidents-empty" role="status">
          <strong>Reading Dynatrace Problems</strong>
          <span>Loading the selected tenant window.</span>
        </div>
      ) : problems.length === 0 ? (
        <div className="incidents-empty">
          <strong>No Problems in the last {formatEvidenceLookback(lookbackHours)}</strong>
          <span>Open Problems to investigate a different timeframe or filter.</span>
        </div>
      ) : (
        <div className="incidents-layout">
          <section className="incidents-browser" aria-label="Observed Problems">
            <div className="incident-tile-grid">
              {visibleProblems.map((problem) => {
                const candidate = candidatesByProblem.get(problem.id);
                const active = problem.status.toUpperCase() === "ACTIVE";
                const triageItem = triageItemByProblem.get(problem.id);
                const decision = triageItem?.decision;
                const assessment = triageItem?.assessment;
                const eligibility = eligibilityByProblem.get(problem.id) ?? {
                  eligible: false,
                  reason: "This Problem is not available for bulk review.",
                };
                const checked = selectedProblemIds.has(problem.id);
                const group = reviewGroupByProblem.get(problem.id);
                const decisionLabel = decision?.status === "validated"
                  ? "Package ready"
                  : decision?.status === "not-ready"
                    ? "Not ready"
                    : decision?.status === "dismissed"
                      ? "Not provider-related"
                      : active
                        ? "Active"
                        : candidate
                          ? "Candidate"
                          : formatStatus(problem.status);
                const decisionTone: Tone = active || decision?.status === "not-ready"
                  ? "warning"
                  : decision?.status === "validated"
                    ? "positive"
                  : candidate && !decision
                    ? "positive"
                    : "neutral";
                return (
                  <div
                    className={`incident-tile-wrapper${checked ? " checked" : ""}`}
                    key={problem.id}
                  >
                    {selectionMode ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${problem.id} for bulk review`}
                        checked={checked}
                        disabled={
                          confirmingBulkReview ||
                          bulkSaving ||
                          !eligibility.eligible ||
                          (!checked && selectedBulkItems.length >= MAX_BULK_REVIEW)
                        }
                        title={eligibility.reason}
                        onChange={(event) =>
                          setProblemSelected(problem.id, event.target.checked)}
                      />
                    ) : null}
                    <button
                      type="button"
                      className={`incident-tile${selectedProblem?.id === problem.id ? " active" : ""}${candidate ? " candidate" : ""}${selectionMode ? " selecting" : ""}`}
                      onClick={() => setSelectedId(problem.id)}
                      aria-pressed={selectedProblem?.id === problem.id}
                    >
                      <span className="incident-tile-heading">
                        <strong>{problem.title}</strong>
                        <StatusPill tone={decisionTone}>{decisionLabel}</StatusPill>
                      </span>
                      <span className="incident-tile-meta">
                        {problem.id} · {formatStatus(problem.category)}
                        {candidate ? " · Provider match" : ""}
                      </span>
                      <span className="incident-tile-root" title={assessment?.detail}>
                        {problem.rootCause
                          ? `${problem.rootCause.name} · ${assessment?.label ?? "Relation unavailable"}`
                          : assessment?.label ?? "Root cause unavailable"}
                        {group ? ` · ${group.problemIds.length} share root cause` : ""}
                      </span>
                      <span className="incident-tile-time">
                        {formatDateTime(problem.startedAt)}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="incident-pagination" aria-label="Problem pages">
              <span>Page {page} of {pageCount}</span>
              <div>
                <Button
                  size="condensed"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="condensed"
                  disabled={page >= pageCount}
                  onClick={() =>
                    setPage((current) => Math.min(pageCount, current + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </section>
          {selectedProblem ? (
            <IncidentDetail
              problem={selectedProblem}
              candidate={selectedCandidate}
              serviceIds={selectedServiceIds}
              serviceNames={selectedServiceNames}
              providerSlug={provider?.provider.slug ?? "provider"}
              providerName={provider?.provider.name ?? "the selected provider"}
              matchingLoading={matchingLoading}
              rootCauseAssessment={selectedRootCauseAssessment}
              rootCauseGroup={selectedProblem && evidenceSettings.canWrite
                ? reviewGroupByProblem.get(selectedProblem.id)
                : undefined}
              onSelectRootCauseGroup={selectRootCauseGroup}
            />
          ) : null}
        </div>
      )}
    </Surface>
  );
};
