import React from "react";
import { Link } from "react-router-dom";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";
import type { ProblemRecord, ServiceRecord, SlaClaimProcess, SlaProviderResponse } from "../types";

type Tone = "neutral" | "warning" | "positive";

type IncidentReviewProps = {
  provider?: SlaProviderResponse;
  problems: ProblemRecord[];
  services: ServiceRecord[];
  lookbackHours: number;
  loading: boolean;
  error?: Error;
};

type WindowReference = {
  title: string;
  detail: string;
  tone: Tone;
  deadline?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const StatusPill = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => <span className={`status-pill status-pill-${tone}`}>{children}</span>;

const parseDate = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value?: string): string => {
  const parsed = parseDate(value);
  return parsed ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed) : "Timestamp unavailable";
};

const formatDate = (value: Date): string => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(value);

const addBusinessDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  let remaining = Math.max(0, Math.round(days));
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const weekday = result.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return result;
};

const businessDaysUntil = (from: Date, to: Date): number => {
  if (to.getTime() <= from.getTime()) return 0;
  const cursor = new Date(from);
  let count = 0;
  while (cursor.getTime() < to.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
};

const getWindowReference = (problem: ProblemRecord, claimProcess: SlaClaimProcess | null | undefined, now = new Date()): WindowReference => {
  const deadlineDays = claimProcess?.deadlineDays;
  const anchor = parseDate(problem.endedAt ?? problem.startedAt);
  if (!claimProcess || deadlineDays === null || deadlineDays === undefined || deadlineDays <= 0) {
    return { title: "Filing window not published", detail: "The selected directory record does not include a filing window.", tone: "neutral" };
  }
  if (!anchor) {
    return { title: "Impact window required", detail: "Add or verify the Problem timestamps before using the directory filing window as a planning reference.", tone: "warning" };
  }

  const deadline = claimProcess.businessDays ? addBusinessDays(anchor, deadlineDays) : new Date(anchor.getTime() + deadlineDays * DAY_MS);
  const remaining = claimProcess.businessDays ? businessDaysUntil(now, deadline) : Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS);
  const unit = claimProcess.businessDays ? "business" : "calendar";
  const anchorLabel = problem.endedAt ? "observed end" : "observed start";
  const basis = claimProcess.deadlineBasis ? ` ${formatStatus(claimProcess.deadlineBasis)}.` : "";
  const planningNote = problem.endedAt ? "" : " This is a planning date from the observed start because an end time is not available.";

  if (remaining < 0 || (!claimProcess.businessDays && deadline.getTime() < now.getTime())) {
    return {
      title: "Directory window date passed",
      detail: `The directory record places the reference date on ${formatDate(deadline)}.${planningNote} Confirm current provider terms before filing.`,
      tone: "warning",
      deadline,
    };
  }

  return {
    title: `${remaining} ${unit} day${remaining === 1 ? "" : "s"} remaining`,
    detail: `Reference date ${formatDate(deadline)}, calculated from the ${anchorLabel} using the directory record.${basis}${planningNote} This is not a vendor decision.`,
    tone: remaining <= 7 ? "warning" : "positive",
    deadline,
  };
};

const formatUptime = (uptime: number | null | undefined): string => uptime === null || uptime === undefined ? "Not published" : `${uptime}%`;

const formatStatus = (status: string): string => status.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

const ReviewProblem = ({ problem, serviceNames, claimProcess }: { problem: ProblemRecord; serviceNames: string[]; claimProcess?: SlaClaimProcess | null }) => {
  const active = problem.status.toUpperCase() === "ACTIVE";
  const reference = getWindowReference(problem, claimProcess);
  const hasTimeline = Boolean(problem.startedAt || problem.endedAt);
  return (
    <article className="review-problem">
      <div className="review-problem-header">
        <div>
          <Text className="eyebrow">Observed Problem</Text>
          <h3>{problem.title}</h3>
          <span className="review-problem-id">{problem.id} · {formatStatus(problem.category)}</span>
        </div>
        <StatusPill tone={active ? "warning" : "neutral"}>{active ? "Active" : "Closed"}</StatusPill>
      </div>
      <div className="review-problem-meta">
        <div><span>Affected service boundary</span><strong>{serviceNames.length > 0 ? serviceNames.join(", ") : `${problem.affectedEntityIds.length || "No"} entity ID${problem.affectedEntityIds.length === 1 ? "" : "s"} returned`}</strong></div>
        <div><span>Root cause signal</span><strong>{problem.hasRootCause ? "Entity linked" : "Not returned"}</strong></div>
      </div>
      <div className="review-problem-grid">
        <div className="review-timeline-block">
          <Text className="eyebrow">Observed impact window</Text>
          {hasTimeline ? (
            <>
              <div className="review-timeline-labels"><span>{formatDateTime(problem.startedAt)}</span><span>{problem.endedAt ? formatDateTime(problem.endedAt) : "Ongoing or end unavailable"}</span></div>
              <div className={`review-timeline-track${active ? " ongoing" : ""}`} aria-label={`Observed impact from ${formatDateTime(problem.startedAt)} to ${problem.endedAt ? formatDateTime(problem.endedAt) : "ongoing"}`}><span /></div>
            </>
          ) : <div className="review-inline-empty">Problem timestamps were not returned by the tenant query.</div>}
        </div>
        <div className={`review-window review-window-${reference.tone}`}>
          <Text className="eyebrow">Filing window reference</Text>
          <strong>{reference.title}</strong>
          <span>{reference.detail}</span>
        </div>
      </div>
      <p className="review-disclaimer">Detection is tenant evidence. Confirm affected services, the actual impact window, exclusions, and the current provider terms before filing.</p>
    </article>
  );
};

export const IncidentReview = ({ provider, problems, services, lookbackHours, loading, error }: IncidentReviewProps) => {
  const serviceNamesById = new Map(services.map((service) => [service.id, service.name]));
  const providerRecord = provider?.provider;
  const policy = providerRecord?.defaultCreditPolicy;
  const claimProcess = providerRecord?.claimProcess;
  const maxCredit = providerRecord?.maxCreditPercent ?? policy?.maxCreditPercent;

  return (
    <div className="review-shell">
      <section className="review-intro">
        <div>
          <Text className="eyebrow">Incident review</Text>
          <Heading level={2}>Compare observed Problems with provider terms.</Heading>
          <Paragraph>Use the tenant record, the selected directory contract, and the observed impact window to decide what needs human review. The vendor remains the authority on eligibility and credits.</Paragraph>
        </div>
        <div className="review-intro-actions">
          <StatusPill tone={provider ? "positive" : "warning"}>{provider ? `${providerRecord?.name} contract loaded` : "Provider contract unavailable"}</StatusPill>
          {providerRecord?.slaUrl ? <a className="inline-action" href={providerRecord.slaUrl} target="_blank" rel="noreferrer">Open provider terms</a> : <Link className="inline-action" to="/directory">Open provider directory</Link>}
        </div>
      </section>

      <div className="review-notice"><strong>Assessment boundary</strong><span>This view shows observed tenant evidence and published directory terms. It does not establish provider fault, eligibility, or an approved credit.</span></div>

      <div className="review-summary-grid">
        <Surface className="panel-card review-panel review-scope-panel">
          <div className="panel-heading-row"><div><Text className="eyebrow">Tenant evidence</Text><Heading level={3}>Review scope</Heading></div><StatusPill tone={problems.length > 0 ? "warning" : "neutral"}>{problems.length} observed</StatusPill></div>
          <div className="review-stat-grid"><div><span>Lookback</span><strong>{lookbackHours} hours</strong></div><div><span>Active Problems</span><strong>{problems.filter((problem) => problem.status.toUpperCase() === "ACTIVE").length}</strong></div><div><span>Service entities</span><strong>{services.length}</strong></div><div><span>Directory services</span><strong>{provider?.services.length ?? "n/a"}</strong></div></div>
          {error ? <div className="error-box">Problem query incomplete: {error.message}</div> : <p className="review-muted">Observed Problems are symptoms in the selected tenant window. A provider relationship still requires service identity and customer-side evidence.</p>}
        </Surface>

        <Surface className="panel-card review-panel review-terms-panel">
          <div className="panel-heading-row"><div><Text className="eyebrow">Provider record</Text><Heading level={3}>Published terms</Heading></div><StatusPill tone={provider ? "positive" : "neutral"}>{provider ? formatStatus(providerRecord?.status ?? "available") : "Unavailable"}</StatusPill></div>
          {providerRecord ? (
            <>
              <div className="review-term-grid"><div><span>Uptime target</span><strong>{formatUptime(providerRecord.uptime)}</strong></div><div><span>Maximum published credit</span><strong>{maxCredit === null || maxCredit === undefined ? "Not published" : `${maxCredit}%`}</strong></div><div><span>Credit application</span><strong>{providerRecord.hasAutomaticCredits === true || policy?.automatic === true ? "Automatic record" : "Provider review"}</strong></div><div><span>Last verified</span><strong>{providerRecord.lastVerified}</strong></div></div>
              {policy?.creditTiers.length ? <div className="review-policy-block"><span className="review-field-label">Published credit tiers</span><div className="review-tier-list">{policy.creditTiers.map((tier) => <span key={`${tier.below}-${tier.credit}`}>Below {tier.below}%: {tier.credit}%</span>)}</div></div> : <div className="review-inline-empty">No credit tiers are published in this directory record.</div>}
            </>
          ) : <div className="review-inline-empty">Load the provider directory before comparing contract terms.</div>}
        </Surface>
      </div>

      <div className="review-details-grid">
        <Surface className="panel-card review-panel">
          <div className="panel-heading-row"><div><Text className="eyebrow">Submission planning</Text><Heading level={3}>Provider filing window</Heading></div><StatusPill tone={claimProcess?.deadlineDays ? "positive" : "neutral"}>{claimProcess?.deadlineDays ? `${claimProcess.deadlineDays} ${claimProcess.businessDays ? "business" : "calendar"} days` : "Not published"}</StatusPill></div>
          {claimProcess ? <div className="review-detail-list"><div><span>Basis</span><strong>{claimProcess.deadlineBasis ? formatStatus(claimProcess.deadlineBasis) : "Provider incident terms"}</strong></div><div><span>Submission method</span><strong>{claimProcess.method ?? "Not published"}</strong></div><div><span>Provider review time</span><strong>{claimProcess.reviewDays ? `${claimProcess.reviewDays} business days` : "Not published"}</strong></div></div> : <div className="review-inline-empty">The directory record does not include a filing process. Confirm the provider policy before using this workflow.</div>}
          {claimProcess?.url ? <a className="inline-action" href={claimProcess.url} target="_blank" rel="noreferrer">Open submission guidance</a> : null}
        </Surface>

        <Surface className="panel-card review-panel">
          <div className="panel-heading-row"><div><Text className="eyebrow">Evidence preparation</Text><Heading level={3}>Provider-required evidence</Heading></div><StatusPill tone={claimProcess?.requiredEvidence.length ? "positive" : "neutral"}>{claimProcess?.requiredEvidence.length ? `${claimProcess.requiredEvidence.length} items` : "Not published"}</StatusPill></div>
          {claimProcess?.requiredEvidence.length ? <ul className="review-evidence-list">{claimProcess.requiredEvidence.map((item) => <li key={item}>{item}</li>)}</ul> : <div className="review-inline-empty">No evidence checklist is available from the selected directory record.</div>}
          {providerRecord?.exclusions?.length ? <details className="review-exclusions"><summary>Published exclusions ({providerRecord.exclusions.length})</summary><ul className="review-evidence-list">{providerRecord.exclusions.slice(0, 6).map((item) => <li key={item}>{item}</li>)}</ul></details> : null}
        </Surface>
      </div>

      <Surface className="panel-card review-panel review-problems-panel">
        <div className="panel-heading-row"><div><Text className="eyebrow">Dynatrace evidence</Text><Heading level={3}>Observed Problems</Heading><Paragraph>Use the timeline and provider terms as a review aid. A detected Problem does not by itself identify the provider or create a claim.</Paragraph></div><StatusPill tone={problems.some((problem) => problem.status.toUpperCase() === "ACTIVE") ? "warning" : "neutral"}>{problems.some((problem) => problem.status.toUpperCase() === "ACTIVE") ? "Active evidence" : "No active evidence"}</StatusPill></div>
        {loading ? <div className="review-empty"><strong>Reading Problems...</strong><span>Waiting for the selected tenant window to return its evidence.</span></div> : problems.length === 0 ? <div className="review-empty"><strong>No Problems found in the last {lookbackHours} hours.</strong><span>When a Problem is detected, this tab will show its observed window, affected service boundary, provider terms, and a planning reference where the directory publishes one.</span></div> : <div className="review-problem-list">{problems.slice(0, 12).map((problem) => <ReviewProblem key={problem.id} problem={problem} serviceNames={problem.affectedEntityIds.map((id) => serviceNamesById.get(id)).filter((name): name is string => Boolean(name))} claimProcess={claimProcess} />)}</div>}
      </Surface>
    </div>
  );
};
