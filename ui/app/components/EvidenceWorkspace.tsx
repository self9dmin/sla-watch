import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { formatEvidenceLookback } from "../data/lookback";
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

const formatMappingBasis = (candidate: EvidenceCandidate): string =>
  candidate.mappingBasis === "confirmed-scope"
    ? "Confirmed scope"
    : candidate.mappingBasis === "provider-tag"
      ? "Provider tag"
      : "Smartscape candidate";

const CandidateState = ({
  decision,
}: {
  decision?: EvidenceDecisionRecord;
}) => {
  if (decision?.status === "validated")
    return <StatusPill tone="positive">Validated</StatusPill>;
  if (decision?.status === "dismissed")
    return <StatusPill tone="neutral">Dismissed</StatusPill>;
  return <StatusPill tone="warning">Needs review</StatusPill>;
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

  const affectedServices = candidate.affectedServices.length > 0
    ? candidate.affectedServices.map((service) => service.name).join(", ")
    : `${candidate.problem.affectedEntityIds.length} affected entity ID${candidate.problem.affectedEntityIds.length === 1 ? "" : "s"}`;
  const providerServices = candidate.providerServiceNames.length > 0
    ? candidate.providerServiceNames.join(", ")
    : "Provider-level terms";
  const reviewTime = decision?.lastModifiedTime ?? decision?.reviewedAt;

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
          <Link to={`/incidents?problem=${encodeURIComponent(candidate.problem.id)}`}>Open incident</Link>
          <Link to="/">Review coverage</Link>
          <Link to="/directory">Review terms</Link>
        </nav>
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
        {!decisionIsCurrent && decision ? (
          <div className="candidate-decision-stale" role="status">
            Coverage changed after the previous decision. Review and save it again.
          </div>
        ) : null}
        <label className="candidate-review-note">
          <span>Review note (required to dismiss)</span>
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
            disabled={!settings.canWrite || settings.mutating}
          />
          <span>
            I reviewed the service scope and current terms. This decision does
            not establish provider fault or credit eligibility.
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
            disabled={!settings.canWrite || settings.mutating || !acknowledged}
            onClick={() => void save("validated")}
          >
            {settings.mutating ? "Saving" : "Validate"}
          </Button>
          <Button
            size="condensed"
            disabled={!settings.canWrite || settings.mutating}
            onClick={() => void save("dismissed")}
          >
            Dismiss
          </Button>
          {!settings.loading && !settings.canWrite ? (
            <span>Read-only. App Settings write access is required.</span>
          ) : null}
        </div>
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
      candidates.length > 0 &&
      !candidates.some((candidate) => candidate.key === selectedKey)
    ) setSelectedKey(candidates[0].key);
    if (candidates.length === 0) setSelectedKey(undefined);
  }, [candidates, selectedKey]);

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
        <Button as={Link} to="/directory" size="condensed">Review terms</Button>
      </div>
    );
  }
  if (candidates.length === 0) {
    return (
      <div className="evidence-empty">
        <strong>No provider-review candidates were found.</strong>
        <span>
          No Problem in the last {formatEvidenceLookback(lookbackHours)} overlaps
          a confirmed provider scope, provider tag, or Smartscape suggestion for
          {` ${provider.provider.name}`}.
        </span>
        <div className="evidence-empty-actions">
          <Button as={Link} to="/" size="condensed">Review coverage</Button>
          <Button as={Link} to="/incidents" size="condensed">Open incidents</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="evidence-candidates-view">
      <dl className="evidence-candidate-summary" aria-label="Evidence candidate status">
        <div><dt>Needs review</dt><dd>{needsReview}</dd></div>
        <div><dt>Validated</dt><dd>{validated}</dd></div>
        <div><dt>Dismissed</dt><dd>{dismissed}</dd></div>
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
}: EvidenceWorkspaceProps) => (
  <Surface className="panel-card evidence-workspace">
    <div className="evidence-workspace-heading">
      <div>
        <Heading level={2}>Evidence</Heading>
        <Paragraph>
          Review findings from Dynatrace, provider reports, and current terms.
        </Paragraph>
      </div>
    </div>
    <nav className="evidence-view-tabs" aria-label="Evidence views">
      <Link
        className={view === "candidates" ? "evidence-view-tab active" : "evidence-view-tab"}
        to="/evidence"
        aria-current={view === "candidates" ? "page" : undefined}
      >
        Review candidates
      </Link>
      <Link
        className={view === "provider-reports" ? "evidence-view-tab active" : "evidence-view-tab"}
        to="/evidence?view=provider-reports"
        aria-current={view === "provider-reports" ? "page" : undefined}
      >
        Provider reports
      </Link>
    </nav>
    {view === "provider-reports" ? (
      <ProviderNotices
        providerSlug={props.providerSlug}
        lookbackHours={props.lookbackHours}
        embedded
      />
    ) : (
      <CandidateWorkspace {...props} />
    )}
    <div className="evidence-boundary">
      <strong>Review boundary</strong>
      <span>
        Validation records an SRE decision only. The provider determines fault,
        eligibility, and any service credit.
      </span>
    </div>
  </Surface>
);
