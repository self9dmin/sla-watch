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
  type EvidenceCandidate,
} from "../data/evidenceCandidates";
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

type Tone = "neutral" | "warning" | "positive";

type IncidentReviewProps = {
  provider?: SlaProviderResponse;
  providerLabelKey: string;
  problems: ProblemRecord[];
  services: ServiceRecord[];
  topology: SmartscapeScopeEdge[];
  topologyLoading: boolean;
  topologyError?: Error;
  lookbackHours: EvidenceLookbackHours;
  onLookbackChange: (value: EvidenceLookbackHours) => void;
  loading: boolean;
  error?: Error;
};

const PAGE_SIZE = 8;

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
}: {
  problem: ProblemRecord;
  candidate?: EvidenceCandidate;
  serviceIds: string[];
  serviceNames: string[];
  providerSlug: string;
  providerName: string;
  matchingLoading: boolean;
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
          {active ? "Active" : "Closed"}
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
          <dd>{problem.hasRootCause ? "Entity identified" : "Not returned"}</dd>
        </div>
        <div>
          <dt>Problem state</dt>
          <dd>{formatStatus(problem.status)}</dd>
        </div>
      </dl>

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
  lookbackHours,
  onLookbackChange,
  loading,
  error,
}: IncidentReviewProps) => {
  const location = useLocation();
  const requestedProblemId = new URLSearchParams(location.search).get("problem");
  const [selectedId, setSelectedId] = useState<string | null>(requestedProblemId);
  const [page, setPage] = useState(1);
  const lastRequestedProblem = useRef<string | null>(null);
  const scopeSettings = useProviderScopeAssignments();
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
  const candidateProblemIds = useMemo(
    () => new Set(candidatesByProblem.keys()),
    [candidatesByProblem],
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
  const matchingLoading = topologyLoading || scopeSettings.loading;
  const matchingError = topologyError ?? scopeSettings.error;

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
          label="Evidence candidates"
          value={matchingLoading ? "Checking" : candidates.length.toLocaleString()}
          detail={`${provider?.provider.name ?? "provider"} coverage overlap`}
          tone={candidates.length > 0 ? "positive" : "neutral"}
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
                return (
                  <button
                    type="button"
                    className={`incident-tile${selectedProblem?.id === problem.id ? " active" : ""}${candidate ? " candidate" : ""}`}
                    key={problem.id}
                    onClick={() => setSelectedId(problem.id)}
                    aria-pressed={selectedProblem?.id === problem.id}
                  >
                    <span className="incident-tile-heading">
                      <strong>{problem.title}</strong>
                      <StatusPill tone={active ? "warning" : candidate ? "positive" : "neutral"}>
                        {active ? "Active" : candidate ? "Candidate" : "Closed"}
                      </StatusPill>
                    </span>
                    <span className="incident-tile-meta">
                      {problem.id} · {formatStatus(problem.category)}
                      {candidate ? " · Provider match" : ""}
                    </span>
                    <span className="incident-tile-time">
                      {formatDateTime(problem.startedAt)}
                    </span>
                  </button>
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
            />
          ) : null}
        </div>
      )}
    </Surface>
  );
};
