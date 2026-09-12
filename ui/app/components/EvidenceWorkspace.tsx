import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@dynatrace/strato-components/buttons";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import type {
  EvidenceDecisionRecord,
  EvidenceLookbackHours,
  ProblemRecord,
  ProviderScopeAssignmentRecord,
  ServiceRecord,
  SlaProviderResponse,
  SmartscapeScopeEdge,
} from "../types";
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
  createCoverageReviewPath,
  createEvidenceReviewPath,
  createIncidentReviewPath,
} from "../data/reviewRoutes";
import { useContractOverrides } from "../hooks/useContractOverrides";
import { useEvidenceDecisions } from "../hooks/useEvidenceDecisions";
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
}: {
  decision?: EvidenceDecisionRecord;
}) => {
  if (decision?.status === "validated")
    return <StatusPill tone="positive">Package ready</StatusPill>;
  if (decision?.status === "dismissed")
    return <StatusPill tone="neutral">Not provider-related</StatusPill>;
  return <StatusPill tone="warning">Not ready</StatusPill>;
};

const CandidateDetail = ({
  candidate,
  decision,
  provider,
  settings,
}: {
  candidate: EvidenceCandidate;
  decision?: EvidenceDecisionRecord;
  provider: SlaProviderResponse;
  settings: ReturnType<typeof useEvidenceDecisions>;
}) => {
  const [note, setNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const contractSettings = useContractOverrides();
  const decisionIsCurrent = decision
    ? evidenceDecisionMatchesCandidate(decision, candidate)
    : false;
  const currentDecision = decisionIsCurrent ? decision : undefined;

  useEffect(() => {
    setNote(decision?.decisionNote ?? "");
    setAcknowledged(
      decisionIsCurrent && decision?.status === "validated",
    );
    setSaveError(undefined);
  }, [candidate.key, decision?.decisionNote, decision?.status, decisionIsCurrent]);

  const save = async (status: "validated" | "dismissed") => {
    const inputError = evidenceDecisionInputError({
      status,
      note,
      acknowledged,
    });
    if (inputError) {
      setSaveError(inputError);
      return;
    }
    setSaveError(undefined);
    try {
      await settings.saveDecision(
        evidenceDecisionValue(
          candidate,
          provider.provider.slug,
          status,
          note,
        ),
      );
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The evidence decision could not be saved.",
      );
    }
  };

  const resetDecision = async () => {
    if (!decision || settings.mutating || !window.confirm(`Reset the saved decision for ${candidate.problem.id}?`)) return;
    setSaveError(undefined);
    try {
      await settings.deleteDecision(decision);
      setNote("");
      setAcknowledged(false);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The evidence decision could not be reset.",
      );
    }
  };

  const affectedServices = candidate.affectedServices.length > 0
    ? candidate.affectedServices.map((service) => service.name).join(", ")
    : `${candidate.problem.affectedEntityIds.length} affected entity ID${candidate.problem.affectedEntityIds.length === 1 ? "" : "s"}`;
  const providerServices = candidate.providerServiceNames.length > 0
    ? candidate.providerServiceNames.join(", ")
    : "Provider-level terms";
  const reviewTime = decision?.lastModifiedTime ?? decision?.reviewedAt;
  const serviceId = candidate.affectedServices[0]?.id ?? candidate.problem.affectedEntityIds[0];
  const providerServiceId = candidate.providerServiceIds[0] ?? "*";
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
  });
  const evidencePath = createEvidenceReviewPath({
    providerSlug: provider.provider.slug,
    problemId: candidate.problem.id,
  });
  const coveragePath = createCoverageReviewPath({
    providerSlug: provider.provider.slug,
    problemId: candidate.problem.id,
    serviceId,
    returnTo: evidencePath,
  });
  const readyEnough = Boolean(
    candidate.scopeConfirmed &&
    candidate.problem.startedAt &&
    candidate.problem.affectedEntityIds.length > 0,
  );
  const requiredEvidence = provider.provider.claimProcess?.requiredEvidence ?? [];

  return (
    <article className="candidate-detail">
      <div className="candidate-detail-heading">
        <div>
          <span className="candidate-id">
            {candidate.problem.id} · {candidate.problem.category}
          </span>
          <Heading level={3}>{candidate.problem.title}</Heading>
        </div>
        <CandidateState decision={currentDecision} />
      </div>

      <dl className="candidate-facts">
        <div>
          <dt>Observed impact</dt>
          <dd>{formatDateTime(candidate.problem.startedAt)}</dd>
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
          <dt>Problem state</dt>
          <dd>{candidate.problem.status}</dd>
        </div>
      </dl>

      <section className="candidate-match" aria-label="Why this candidate appears">
        <div>
          <strong>Why this appears</strong>
          <p>{candidate.mappingEvidence}</p>
        </div>
        <StatusPill tone={candidate.scopeConfirmed ? "positive" : "warning"}>
          {formatMappingBasis(candidate)}
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
            {readyEnough ? "Ready for decision" : "Missing coverage"}
          </StatusPill>
        </div>
        <dl className="candidate-package-facts">
          <div><dt>Observed window</dt><dd>{formatDateTime(candidate.problem.startedAt)} to {candidate.problem.endedAt ? formatDateTime(candidate.problem.endedAt) : "ongoing"}</dd></div>
          <div><dt>Coverage basis</dt><dd>{formatMappingBasis(candidate)}</dd></div>
          <div><dt>Terms source</dt><dd>{terms.source}</dd></div>
          <div><dt>Filing window</dt><dd>{terms.filingDeadlineDays === null ? "Not published" : `${terms.filingDeadlineDays} ${terms.businessDays ? "business" : "calendar"} days`}</dd></div>
          <div><dt>Claim method</dt><dd>{terms.claimMethod ?? "Not published"}</dd></div>
          <div><dt>Maximum credit</dt><dd>{formatPercent(terms.maxCreditPercent)}</dd></div>
        </dl>
        <div className="candidate-package-requirements">
          <strong>Provider-required evidence</strong>
          {requiredEvidence.length > 0 ? (
            <ul>{requiredEvidence.map((item) => <li key={item}>{item}</li>)}</ul>
          ) : (
            <span>No evidence checklist is published in the provider record.</span>
          )}
          <span>Provider reports are optional supporting evidence. A missing report does not invalidate observed customer impact.</span>
        </div>
        {!readyEnough ? (
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
            <strong>{currentDecision.status === "validated" ? "Claim package ready" : "Review complete: not provider-related"}</strong>
            <span>{currentDecision.status === "validated"
              ? "Your review is complete. Nothing has been sent. A contract owner can use this package for provider follow-up."
              : "Nothing has been sent. This Problem remains available in Dynatrace, but it is excluded from provider follow-up."}</span>
            {currentDecision.decisionNote ? <small>Note: {currentDecision.decisionNote}</small> : null}
            <Button size="condensed" disabled={!settings.canWrite || settings.mutating} onClick={() => void resetDecision()}>
              Reopen review
            </Button>
          </div>
        ) : (
          <>
            {!decisionIsCurrent && decision ? (
              <div className="candidate-decision-stale" role="status">
                Coverage changed after the previous decision. Review and save it again.
              </div>
            ) : null}
            <label className="candidate-review-note">
              <span>Review note (required when not provider-related)</span>
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
                I reviewed the provider relationship, observed impact, current
                terms, and provider-required evidence. Nothing will be sent.
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
  lookbackHours,
  loading,
  error,
}: Omit<EvidenceWorkspaceProps, "view">) => {
  const location = useLocation();
  const requestedProblemId = new URLSearchParams(location.search).get("problem");
  const lastRequestedProblem = useRef<string | null>(null);
  const settings = useEvidenceDecisions();
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
  const [selectedKey, setSelectedKey] = useState<string>();

  useEffect(() => {
    if (
      requestedProblemId &&
      requestedProblemId !== lastRequestedProblem.current
    ) {
      const requested = candidates.find(
        (candidate) => candidate.problem.id === requestedProblemId,
      );
      if (requested) {
        lastRequestedProblem.current = requestedProblemId;
        setSelectedKey(requested.key);
        return;
      }
    }
    if (
      candidates.length > 0 &&
      !candidates.some((candidate) => candidate.key === selectedKey)
    ) setSelectedKey(candidates[0].key);
    if (candidates.length === 0) setSelectedKey(undefined);
  }, [candidates, requestedProblemId, selectedKey]);

  const selected =
    candidates.find((candidate) => candidate.key === selectedKey) ??
    candidates[0];
  const currentDecisionFor = (candidate: EvidenceCandidate) => {
    const decision = decisionByKey.get(candidate.key);
    return decision && evidenceDecisionMatchesCandidate(decision, candidate)
      ? decision
      : undefined;
  };
  const validated = candidates.filter(
    (candidate) => currentDecisionFor(candidate)?.status === "validated",
  ).length;
  const dismissed = candidates.filter(
    (candidate) => currentDecisionFor(candidate)?.status === "dismissed",
  ).length;
  const needsReview = candidates.length - validated - dismissed;

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
  if (candidates.length === 0) {
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
        <div><dt>Not ready</dt><dd>{needsReview}</dd></div>
        <div><dt>Package ready</dt><dd>{validated}</dd></div>
        <div><dt>Not provider-related</dt><dd>{dismissed}</dd></div>
      </dl>
      <div className="evidence-candidate-layout">
        <aside className="candidate-queue" aria-label="Provider review candidates">
          <div className="candidate-queue-heading">
            <strong>Candidates</strong>
            <span>{candidates.length}</span>
          </div>
          <div className="candidate-queue-list">
            {candidates.slice(0, 30).map((candidate) => {
              const decision = decisionByKey.get(candidate.key);
              return (
                <button
                  type="button"
                  key={candidate.key}
                  className={`candidate-queue-item${selected?.key === candidate.key ? " selected" : ""}`}
                  onClick={() => setSelectedKey(candidate.key)}
                  aria-pressed={selected?.key === candidate.key}
                >
                  <span>
                    <strong>{candidate.problem.title}</strong>
                    <small>{candidate.problem.id} · {formatMappingBasis(candidate)}</small>
                  </span>
                  <CandidateState
                    decision={
                      decision && evidenceDecisionMatchesCandidate(decision, candidate)
                        ? decision
                        : undefined
                    }
                  />
                </button>
              );
            })}
          </div>
        </aside>
        {selected ? (
          <CandidateDetail
            candidate={selected}
            decision={decisionByKey.get(selected.key)}
            provider={provider}
            settings={settings}
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
  const problemId = new URLSearchParams(location.search).get("problem");
  const candidatePath = problemId
    ? createEvidenceReviewPath({ providerSlug: props.providerSlug, problemId })
    : `/evidence?provider=${encodeURIComponent(props.providerSlug)}`;
  const reportParams = new URLSearchParams({
    provider: props.providerSlug,
    view: "provider-reports",
  });
  if (problemId) reportParams.set("problem", problemId);

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
