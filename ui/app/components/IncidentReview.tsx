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
  type IncidentBulkReviewItem,
} from "../data/incidentTriage";
import {
  EVIDENCE_LOOKBACK_OPTIONS,
  formatEvidenceLookback,
} from "../data/lookback";
import {
  buildIncidentReviewCases,
  incidentReviewCaseForProblem,
  type IncidentReviewCase,
} from "../data/incidentReviewCases";
import {
  createCoverageReviewPath,
  createEvidenceReviewPath,
  createIncidentReviewPath,
} from "../data/reviewRoutes";
import { useProviderScopeAssignments } from "../hooks/useProviderScopeAssignments";
import { useEvidenceDecisions } from "../hooks/useEvidenceDecisions";
import { useContractOverrides } from "../hooks/useContractOverrides";
import { formatDavisImpact, summarizeDavisImpact } from "../data/problems";
import {
  evidenceReviewStatePresentation,
  resolveEvidenceReviewState,
  type EvidenceReviewStateResult,
} from "../data/evidenceReviewState";

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

const PAGE_SIZE = 16;
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
  reviewCase,
  triageItems,
  providerSlug,
  providerName,
  matchingLoading,
  reviewState,
  reviewStateLoading,
  reviewStateUnavailable,
}: {
  reviewCase: IncidentReviewCase;
  triageItems: IncidentBulkReviewItem[];
  providerSlug: string;
  providerName: string;
  matchingLoading: boolean;
  reviewState: EvidenceReviewStateResult;
  reviewStateLoading: boolean;
  reviewStateUnavailable: boolean;
}) => {
  const problem = reviewCase.problems[0];
  const candidate = reviewCase.candidates[0];
  const affectedServices = reviewCase.affectedServices.length
    ? reviewCase.affectedServices.map((service) => service.name).join(", ")
    : "No affected service returned";
  const providerServices = reviewCase.providerServiceNames.length
    ? reviewCase.providerServiceNames.join(", ")
    : "Not matched";
  const rootCauses = Array.from(new Map(
    reviewCase.problems.flatMap((item) => item.rootCause
      ? [[item.rootCause.id.toLowerCase(), item.rootCause] as const]
      : []),
  ).values());
  const rootCauseLabel = rootCauses.length === 0
    ? "Not returned"
    : rootCauses.length === 1
      ? rootCauses[0].name
      : `${rootCauses.length} distinct signals`;
  const hasAffectedServiceScope = reviewCase.affectedServices.length > 0;
  const allCandidatesConfirmed = reviewCase.candidates.length === reviewCase.problems.length &&
    reviewCase.candidates.every((item) => item.scopeConfirmed);
  const reviewPresentation = evidenceReviewStatePresentation(reviewState.state);
  const nextTone: Tone = matchingLoading || reviewStateLoading || reviewStateUnavailable
    ? "neutral"
    : candidate && reviewState.state !== "needs-review"
      ? reviewPresentation.tone
      : candidate
      ? allCandidatesConfirmed
        ? "positive"
        : "warning"
      : hasAffectedServiceScope
        ? "warning"
        : "neutral";
  const nextLabel = matchingLoading || reviewStateLoading
    ? "Checking coverage"
    : reviewStateUnavailable
      ? "Review unavailable"
    : candidate && reviewState.state !== "needs-review"
      ? reviewPresentation.label
      : candidate
      ? allCandidatesConfirmed
        ? "Ready for evidence"
        : "Review suggested match"
      : hasAffectedServiceScope
        ? "Coverage needed"
        : "No service scope";
  const nextDetail = matchingLoading
    ? "Comparing affected services with Coverage and provider-native topology."
    : reviewStateLoading
      ? "Reading the saved Evidence review before showing the next action."
    : reviewStateUnavailable
      ? "Saved Evidence decisions could not be read, so this case is not presented as unreviewed or complete."
    : candidate && reviewState.state === "ready-for-follow-up"
      ? "The Evidence review is complete and ready to copy or download for provider follow-up. Nothing has been submitted."
    : candidate && reviewState.state === "needs-evidence"
      ? "The SRE saved this case for more evidence before provider follow-up."
    : candidate && reviewState.state === "excluded"
      ? "The SRE excluded this case from provider follow-up. The saved decision remains available in Evidence."
    : candidate && reviewState.state === "mixed"
      ? "Some Problems in this case have a saved decision and others still need review."
    : candidate
      ? reviewCase.groupingEvidence
      :
      (hasAffectedServiceScope
        ? `No affected service currently overlaps ${providerName} coverage. Confirm the boundary before treating this Problem as provider evidence.`
         : "Dynatrace did not return an affected service that SLA Review can compare with provider coverage.");
  const incidentPath = createIncidentReviewPath({
    providerSlug,
    problemId: problem.id,
    caseId: reviewCase.key,
  });
  const evidencePath = createEvidenceReviewPath({
    providerSlug,
    problemId: problem.id,
    caseId: reviewCase.key,
  });
  const coveragePath = createCoverageReviewPath({
    providerSlug,
    problemId: problem.id,
    serviceId: reviewCase.affectedServices[0]?.id,
    providerServiceId: reviewCase.providerServiceIds[0],
    returnTo: incidentPath,
  });
  const title = reviewCase.problems.length > 1
    ? `${providerServices} impact review`
    : problem.title;
  const categories = Array.from(new Set(
    reviewCase.problems.map((item) => formatStatus(item.category)),
  )).join(", ");
  const relatedTriage = triageItems.filter((item) =>
    reviewCase.problems.some((caseProblem) => caseProblem.id === item.problem.id));
  const providerLinkedRootCauses = relatedTriage.filter(
    (item) => item.assessment.relation === "provider-linked",
  ).length;
  const davisImpact = formatDavisImpact(reviewCase.problems);

  return (
    <article className="incident-detail">
      <div className="incident-detail-heading">
        <div>
          <span>
            {reviewCase.problems.length} Dynatrace Problem{reviewCase.problems.length === 1 ? "" : "s"}
            {categories ? ` · ${categories}` : ""}
          </span>
          <Heading level={3}>{title}</Heading>
        </div>
        <StatusPill tone={candidate && !reviewStateLoading && !reviewStateUnavailable
          ? reviewPresentation.tone
          : candidate || reviewCase.active
            ? "warning"
            : "neutral"}>
          {candidate
            ? reviewStateLoading
              ? "Loading review"
              : reviewStateUnavailable
                ? "Review unavailable"
              : reviewPresentation.label
            : reviewCase.active
              ? "Active"
              : formatStatus(problem.status)}
        </StatusPill>
      </div>

      <dl className="incident-detail-facts">
        <div>
          <dt>Davis impact</dt>
          <dd title={davisImpact}>{davisImpact}</dd>
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
          <dt>Root-cause signals</dt>
          <dd title={rootCauseLabel}>{rootCauseLabel}</dd>
        </div>
      </dl>

      <section className="incident-root-cause-context" aria-label="Dynatrace case correlation">
        <div>
          <strong>{reviewCase.problems.length > 1 ? "Grouped review case" : "Independent review case"}</strong>
          <span>{reviewCase.groupingEvidence}
            {providerLinkedRootCauses > 0
              ? ` ${providerLinkedRootCauses} Problem${providerLinkedRootCauses === 1 ? " has" : "s have"} a provider-linked root-cause signal.`
              : ""}
          </span>
        </div>
      </section>

      <section className={`incident-next-step incident-next-step-${nextTone}`}>
        <StatusPill tone={nextTone}>{nextLabel}</StatusPill>
        <div>
          <strong>{candidate && reviewStateUnavailable
            ? "Saved review unavailable"
            : candidate
            ? reviewState.state === "excluded"
              ? "Excluded from follow-up"
              : reviewState.state === "ready-for-follow-up"
                ? "Evidence review complete"
                : "Provider relevance found"
            : "Provider relevance not established"}</strong>
          <span>{nextDetail}</span>
        </div>
        {!matchingLoading && !reviewStateLoading && !reviewStateUnavailable && candidate ? (
          <Button
            as={Link}
            to={evidencePath}
            size="condensed"
            variant="emphasized"
          >
            {reviewState.state === "needs-review" ? "Review evidence" : "Open evidence review"}
          </Button>
        ) : !matchingLoading && !reviewStateLoading && !reviewStateUnavailable && !candidate && hasAffectedServiceScope ? (
          <Button as={Link} to={coveragePath} size="condensed">
            Resolve coverage
          </Button>
        ) : null}
      </section>

      {reviewCase.problems.length > 1 ? (
        <details className="incident-case-members" open>
          <summary>Included Problems ({reviewCase.problems.length})</summary>
          <ul>
            {reviewCase.problems.map((item) => (
              <li key={item.id}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.id} · {formatStatus(item.category)}</small>
                </span>
                <time>{formatDateTime(item.startedAt)}</time>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <section className="incident-observed-window" aria-label="Observed Problem window">
        <span>Observed window</span>
        <strong>{formatDateTime(reviewCase.startedAt)}</strong>
        <small>
          {reviewCase.endedAt
            ? `to ${formatDateTime(reviewCase.endedAt)}`
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
  const routeParams = new URLSearchParams(location.search);
  const requestedProblemId = routeParams.get("problem");
  const requestedCaseId = routeParams.get("case");
  const [selectedId, setSelectedId] = useState<string | null>(requestedCaseId);
  const [page, setPage] = useState(1);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [confirmingBulkReview, setConfirmingBulkReview] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{
    tone: "positive" | "warning";
    message: string;
  }>();
  const lastRequestedSelection = useRef<string | null>(null);
  const scopeSettings = useProviderScopeAssignments();
  const evidenceSettings = useEvidenceDecisions();
  const contractSettings = useContractOverrides();
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
  const serviceIds = useMemo(
    () => new Set(services.map((service) => service.id)),
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
  const reviewCases = useMemo(
    () => buildIncidentReviewCases({
      providerSlug,
      problems,
      candidates,
      services,
      contractOverrides: contractSettings.overrides,
      allowGrouping: !contractSettings.loading &&
        !contractSettings.error &&
        contractSettings.canRead,
    }),
    [
      candidates,
      contractSettings.canRead,
      contractSettings.error,
      contractSettings.loading,
      contractSettings.overrides,
      problems,
      providerSlug,
      services,
    ],
  );
  const reviewStateLoading = evidenceSettings.loading || contractSettings.loading;
  const reviewStateUnavailable = !evidenceSettings.loading && (
    Boolean(evidenceSettings.error) ||
    evidenceSettings.incomplete ||
    !evidenceSettings.canRead
  );
  const reviewStateByCase = useMemo(
    () => new Map(reviewCases.map((reviewCase) => [
      reviewCase.key,
      resolveEvidenceReviewState(reviewCase, decisionByKey),
    ])),
    [decisionByKey, reviewCases],
  );
  const orderedCases = useMemo(
    () => [...reviewCases].sort((left, right) => {
      const leftState = reviewStateByCase.get(left.key)?.state;
      const rightState = reviewStateByCase.get(right.key)?.state;
      const score = (reviewCase: IncidentReviewCase, state?: string) =>
        (reviewCase.active ? 16 : 0) +
        (reviewCase.candidates.length > 0 && state !== "ready-for-follow-up" && state !== "excluded" ? 8 : 0) +
        (reviewCase.candidates.length > 0 ? 4 : 0);
      const difference = score(right, rightState) - score(left, leftState);
      if (difference !== 0) return difference;
      const userDifference = (summarizeDavisImpact(right.problems).maximumAffectedUsers ?? -1) -
        (summarizeDavisImpact(left.problems).maximumAffectedUsers ?? -1);
      if (userDifference !== 0) return userDifference;
      return (Date.parse(right.startedAt ?? "") || 0) -
        (Date.parse(left.startedAt ?? "") || 0);
    }),
    [reviewCases, reviewStateByCase],
  );
  const pageCount = Math.max(1, Math.ceil(orderedCases.length / PAGE_SIZE));
  const visibleCases = useMemo(
    () =>
      orderedCases.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE,
      ),
    [orderedCases, page],
  );
  const selectedCase =
    visibleCases.find((reviewCase) => reviewCase.key === selectedId) ??
    visibleCases[0] ??
    orderedCases[0];
  const activeProblems = problems.filter(
    (problem) => problem.status.toUpperCase() === "ACTIVE",
  ).length;
  const activeCases = reviewCases.filter((reviewCase) => reviewCase.active).length;
  const affectedServiceCount = new Set(
    problems
      .flatMap((problem) => problem.affectedEntityIds)
      .filter((id) => serviceIds.has(id)),
  ).size;
  const eligibilityByCase = useMemo(() => new Map(reviewCases.map((reviewCase) => {
    const candidateItems = reviewCase.candidates.flatMap((candidate) => {
      const item = triageItemByProblem.get(candidate.problem.id);
      return item ? [item] : [];
    });
    if (candidateItems.length !== reviewCase.problems.length)
      return [reviewCase.key, { eligible: false, reason: "Every Problem in the case must have confirmed provider coverage." }] as const;
    if (candidateItems.length > MAX_BULK_REVIEW)
      return [reviewCase.key, { eligible: false, reason: `This case exceeds the ${MAX_BULK_REVIEW}-Problem bulk review limit.` }] as const;
    const blocked = candidateItems
      .map((item) => eligibilityByProblem.get(item.problem.id))
      .find((eligibility) => !eligibility?.eligible);
    return [reviewCase.key, blocked ?? { eligible: true, reason: "Available for bulk review." }] as const;
  })), [eligibilityByProblem, reviewCases, triageItemByProblem]);
  const eligibleBulkCount = Array.from(eligibilityByCase.values())
    .filter((eligibility) => eligibility.eligible).length;
  const unresolvedCandidateCases = reviewCases.filter((reviewCase) => {
    const state = reviewStateByCase.get(reviewCase.key)?.state;
    return reviewCase.candidates.length > 0 &&
      state !== "ready-for-follow-up" && state !== "excluded";
  }).length;
  const providerRelevantCases = reviewCases.filter(
    (reviewCase) => reviewCase.candidates.length > 0,
  ).length;
  const selectedCases = reviewCases.filter((reviewCase) =>
    selectedCaseIds.has(reviewCase.key));
  const selectedBulkItems = triageItems.filter(
    (item): item is IncidentBulkReviewItem & { candidate: EvidenceCandidate } =>
      selectedCases.some((reviewCase) =>
        reviewCase.problems.some((problem) => problem.id === item.problem.id)) &&
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
    if (requestedCaseId || requestedProblemId) {
      const requested = orderedCases.find((reviewCase) =>
        reviewCase.key === requestedCaseId) ??
        (requestedProblemId
          ? incidentReviewCaseForProblem(orderedCases, requestedProblemId)
          : undefined);
      const requestedIndex = requested
        ? orderedCases.findIndex((reviewCase) => reviewCase.key === requested.key)
        : -1;
      if (requestedIndex >= 0) {
        const requestedPage = Math.floor(requestedIndex / PAGE_SIZE) + 1;
        const selectionSignature = [
          requestedCaseId ?? "",
          requestedProblemId ?? "",
          requested?.key ?? "",
          requestedPage,
          orderedCases.length,
        ].join("|");
        if (selectionSignature !== lastRequestedSelection.current) {
          lastRequestedSelection.current = selectionSignature;
          setSelectedId(requested?.key ?? null);
          setPage(requestedPage);
          return;
        }
      }
    } else {
      lastRequestedSelection.current = null;
    }
    if (orderedCases.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!visibleCases.some((reviewCase) => reviewCase.key === selectedId))
      setSelectedId(visibleCases[0]?.key ?? orderedCases[0].key);
  }, [orderedCases, requestedCaseId, requestedProblemId, selectedId, visibleCases]);

  useEffect(() => {
    setSelectedCaseIds((current) => {
      const remaining = Array.from(current).filter(
        (caseId) => eligibilityByCase.get(caseId)?.eligible,
      );
      if (remaining.length === current.size) return current;
      return new Set(remaining);
    });
  }, [eligibilityByCase]);

  useEffect(() => {
    setSelectionMode(false);
    setSelectedCaseIds(new Set());
    setConfirmingBulkReview(false);
    setBulkFeedback(undefined);
  }, [lookbackHours, providerSlug]);

  const closeBulkReview = () => {
    setSelectionMode(false);
    setConfirmingBulkReview(false);
    setSelectedCaseIds(new Set());
  };

  const setCaseSelected = (reviewCase: IncidentReviewCase, checked: boolean) => {
    setBulkFeedback(undefined);
    setConfirmingBulkReview(false);
    setSelectedCaseIds((current) => {
      const next = new Set(current);
      const selectedProblemCount = reviewCases
        .filter((item) => next.has(item.key))
        .reduce((total, item) => total + item.problems.length, 0);
      if (checked && selectedProblemCount + reviewCase.problems.length <= MAX_BULK_REVIEW)
        next.add(reviewCase.key);
      else if (!checked) next.delete(reviewCase.key);
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
      setSelectedCaseIds(new Set(
        reviewCases
          .filter((reviewCase) => reviewCase.problems.some((problem) =>
            failedProblemIds.includes(problem.id)))
          .map((reviewCase) => reviewCase.key),
      ));
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
          label="Active cases"
          value={loading ? "Checking" : activeCases.toLocaleString()}
          detail={`${activeProblems.toLocaleString()} open Dynatrace Problems`}
          tone={activeCases > 0 ? "warning" : "neutral"}
        />
        <IncidentFact
          label="Needs evidence review"
          value={matchingLoading || reviewStateLoading
            ? "Checking"
            : reviewStateUnavailable
              ? "Unavailable"
            : unresolvedCandidateCases.toLocaleString()}
          detail={reviewStateUnavailable
            ? "Saved review decisions could not be read"
            : `${candidates.length.toLocaleString()} Problems grouped into ${providerRelevantCases.toLocaleString()} provider-relevant cases`}
          tone={reviewStateUnavailable
            ? "neutral"
            : unresolvedCandidateCases > 0
              ? "warning"
              : "positive"}
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
                Related Problems are organized into potential provider-impact cases.
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
                  ? "Provider relationships or existing review decisions are incomplete. Review cases individually."
                  : eligibleBulkCount === 0
                    ? "No closed confirmed case is available for manual bulk review."
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
            A case combines Problems only when provider service, Dynatrace scope,
            and time support one review. Open Problems for full investigation.
            Evidence keeps every included Problem for traceability.
          </span>
        </div>
      </div>

      {selectionMode ? (
        <section className="incident-bulk-review" aria-label="Bulk incident review">
          <div>
            <strong>{confirmingBulkReview
              ? `Mark ${selectedCases.length} case${selectedCases.length === 1 ? "" : "s"} not provider-related?`
              : `${selectedCases.length} case${selectedCases.length === 1 ? "" : "s"} selected · ${selectedBulkItems.length} Problems`}</strong>
            <span>{confirmingBulkReview
              ? selectedWithoutRootCauseCount > 0
                ? `${selectedWithoutRootCauseCount} selected Problem${selectedWithoutRootCauseCount === 1 ? " has" : "s have"} no returned root cause. Each receives its own audited decision. This is your classification, not proof, and nothing is submitted.`
                : "Each Problem receives its own audited decision. Dynatrace root cause is a triage aid, not proof, and nothing is submitted."
              : `Select closed review cases containing up to ${MAX_BULK_REVIEW} Problems. A missing root cause does not block manual review. Active, provider-linked, incomplete, and previously reviewed cases stay individual.`}</span>
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
                onClick={() => setSelectedCaseIds(new Set())}
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
      ) : reviewStateUnavailable ? (
        <div className="error-box incidents-error">
          Saved Evidence decisions are unavailable. Problem context remains visible, but review statuses and actions are paused.
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
          <section className="incidents-browser" aria-label="Provider impact review cases">
            <div className="incident-tile-grid">
              {visibleCases.map((reviewCase) => {
                const problem = reviewCase.problems[0];
                const candidate = reviewCase.candidates[0];
                const reviewState = reviewStateByCase.get(reviewCase.key) ??
                  resolveEvidenceReviewState(reviewCase, decisionByKey);
                const reviewPresentation = evidenceReviewStatePresentation(reviewState.state);
                const eligibility = eligibilityByCase.get(reviewCase.key) ?? {
                  eligible: false,
                  reason: "This case is not available for bulk review.",
                };
                const checked = selectedCaseIds.has(reviewCase.key);
                const decisionLabel = candidate
                  ? reviewStateLoading
                    ? "Loading review"
                    : reviewStateUnavailable
                      ? "Review unavailable"
                    : reviewPresentation.label
                  : reviewCase.active
                    ? "Active"
                    : formatStatus(problem.status);
                const decisionTone: Tone = candidate && !reviewStateLoading && !reviewStateUnavailable
                  ? reviewPresentation.tone
                  : reviewCase.active || candidate
                    ? "warning"
                    : "neutral";
                const title = reviewCase.problems.length > 1
                  ? `${reviewCase.providerServiceNames.join(", ") || providerName} impact review`
                  : problem.title;
                const rootCauseCount = new Set(reviewCase.problems.flatMap((item) =>
                  item.rootCause ? [item.rootCause.id.toLowerCase()] : [])).size;
                const affectedUsers = summarizeDavisImpact(reviewCase.problems).maximumAffectedUsers;
                return (
                  <div
                    className={`incident-tile-wrapper${checked ? " checked" : ""}`}
                    key={reviewCase.key}
                  >
                    {selectionMode ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${title} for bulk review`}
                        checked={checked}
                        disabled={
                          confirmingBulkReview ||
                          bulkSaving ||
                          !eligibility.eligible ||
                          (!checked && selectedBulkItems.length + reviewCase.problems.length > MAX_BULK_REVIEW)
                        }
                        title={eligibility.reason}
                        onChange={(event) =>
                          setCaseSelected(reviewCase, event.target.checked)}
                      />
                    ) : null}
                    <button
                      type="button"
                      className={`incident-tile${selectedCase?.key === reviewCase.key ? " active" : ""}${candidate ? " candidate" : ""}${selectionMode ? " selecting" : ""}`}
                      onClick={() => setSelectedId(reviewCase.key)}
                      aria-pressed={selectedCase?.key === reviewCase.key}
                    >
                      <span className="incident-tile-heading">
                        <strong>{title}</strong>
                        <StatusPill tone={decisionTone}>{decisionLabel}</StatusPill>
                      </span>
                      <span className="incident-tile-meta">
                        {reviewCase.problems.length} Problem{reviewCase.problems.length === 1 ? "" : "s"}
                        {` · ${reviewCase.affectedServices.length} service${reviewCase.affectedServices.length === 1 ? "" : "s"}`}
                        {affectedUsers === undefined ? "" : ` · ${affectedUsers.toLocaleString()} users`}
                        {candidate ? ` · ${reviewCase.providerServiceNames.join(", ") || "Provider match"}` : ""}
                      </span>
                      <span className="incident-tile-root" title={reviewCase.groupingEvidence}>
                        {reviewCase.groupingBasis === "root-cause"
                          ? "Shared Dynatrace root cause"
                          : reviewCase.groupingBasis === "affected-service"
                            ? "Shared affected service and review window"
                            : rootCauseCount > 0
                              ? "Root-cause signal available"
                              : "Root cause unavailable"}
                      </span>
                      <span className="incident-tile-time">
                        {formatDateTime(reviewCase.startedAt)}
                        {reviewCase.endedAt ? ` to ${formatDateTime(reviewCase.endedAt)}` : ""}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="incident-pagination" aria-label="Review case pages">
              <span>{orderedCases.length.toLocaleString()} cases · page {page} of {pageCount}</span>
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
          {selectedCase ? (
            <IncidentDetail
              reviewCase={selectedCase}
              triageItems={triageItems}
              providerSlug={provider?.provider.slug ?? "provider"}
              providerName={provider?.provider.name ?? "the selected provider"}
              matchingLoading={matchingLoading}
              reviewState={reviewStateByCase.get(selectedCase.key) ??
                resolveEvidenceReviewState(selectedCase, decisionByKey)}
              reviewStateLoading={reviewStateLoading}
              reviewStateUnavailable={reviewStateUnavailable}
            />
          ) : null}
        </div>
      )}
    </Surface>
  );
};
