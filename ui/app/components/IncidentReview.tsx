import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import type { ContractContext, EffectiveContractTerms, EvidenceLookbackHours, ProblemRecord, ServiceRecord, SlaClaimProcess, SlaProviderResponse, SmartscapeScopeEdge } from "../types";
import { resolveEffectiveContractTerms } from "../data/contractOverrides";
import { EVIDENCE_LOOKBACK_OPTIONS, formatEvidenceLookback } from "../data/lookback";
import { inferProviderServiceCandidate, isServiceScopeAssignment, resolveUniqueProviderServiceCandidate, runtimeEntityIdForEdge, serviceEntityIdForEdge, type IncidentProviderServiceCandidate } from "../data/providerScopeAssignments";
import { useContractOverrides } from "../hooks/useContractOverrides";
import { useProviderScopeAssignments } from "../hooks/useProviderScopeAssignments";

type Tone = "neutral" | "warning" | "positive";

type IncidentReviewProps = {
  provider?: SlaProviderResponse;
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

type WindowReference = {
  title: string;
  detail: string;
  tone: Tone;
};

type ContractScopeChoice = {
  key: string;
  label: string;
  context: Omit<ContractContext, "providerSlug" | "providerServiceId">;
};

type MappingSource = "confirmed" | "observed" | "candidate" | "none";

type ResolvedIncidentMapping = {
  providerServiceId: string;
  scopeKey: string;
  source: MappingSource;
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
  return parsed ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed) : "Unavailable";
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

const formatStatus = (status: string): string => status.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

const getDeadlineAnchor = (claimProcess: SlaClaimProcess): "start" | "end" | "provider" => {
  const basis = (claimProcess.deadlineBasis ?? "").toLowerCase();
  if (/billing|cycle|invoice/.test(basis)) return "provider";
  if (/incident|outage|impact|service/.test(basis) && /end|close|resolve|finish/.test(basis)) return "end";
  if (/incident|outage|impact|service/.test(basis) && /start|begin|open/.test(basis)) return "start";
  return "provider";
};

const getWindowReference = (problem: ProblemRecord, claimProcess: SlaClaimProcess | null | undefined, now = new Date()): WindowReference => {
  const deadlineDays = claimProcess?.deadlineDays;
  if (!claimProcess || deadlineDays === null || deadlineDays === undefined || deadlineDays <= 0) {
    return { title: "Filing window not published", detail: "Confirm the current provider terms before filing.", tone: "neutral" };
  }
  const anchorMode = getDeadlineAnchor(claimProcess);
  if (anchorMode === "provider") {
    const basis = claimProcess.deadlineBasis ? formatStatus(claimProcess.deadlineBasis) : "the provider's stated basis";
    const unit = claimProcess.businessDays ? "business" : "calendar";
    return { title: `${deadlineDays} ${unit} days published`, detail: `The directory uses ${basis}. Tenant Problem timestamps cannot establish the remaining time.`, tone: "neutral" };
  }
  const anchorValue = anchorMode === "end" ? problem.endedAt : problem.startedAt;
  const anchor = parseDate(anchorValue);
  if (!anchor) {
    return { title: anchorMode === "end" ? "Impact end required" : "Impact start required", detail: "Verify the observed Problem timestamp before calculating a planning date.", tone: "warning" };
  }

  const deadline = claimProcess.businessDays ? addBusinessDays(anchor, deadlineDays) : new Date(anchor.getTime() + deadlineDays * DAY_MS);
  const remaining = claimProcess.businessDays ? businessDaysUntil(now, deadline) : Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS);
  const unit = claimProcess.businessDays ? "business" : "calendar";
  if (remaining < 0 || (!claimProcess.businessDays && deadline.getTime() < now.getTime())) {
    return { title: "Directory window date passed", detail: `Reference date ${formatDate(deadline)}. Confirm current provider terms.`, tone: "warning" };
  }
  return {
    title: `${remaining} ${unit} day${remaining === 1 ? "" : "s"} remaining`,
    detail: `Planning date ${formatDate(deadline)}, calculated from the observed ${anchorMode}. This is not a provider decision.`,
    tone: remaining <= 7 ? "warning" : "positive",
  };
};

const IncidentDetail = ({
  problem,
  serviceNames,
  provider,
  contractTerms,
  providerServiceId,
  scopeKey,
  scopeChoices,
  contractLoading,
  contractError,
  mappingLoading,
  mappingSource,
  mappingDetail,
}: {
  problem: ProblemRecord;
  serviceNames: string[];
  provider?: SlaProviderResponse;
  contractTerms?: EffectiveContractTerms;
  providerServiceId: string;
  scopeKey: string;
  scopeChoices: ContractScopeChoice[];
  contractLoading: boolean;
  contractError: boolean;
  mappingLoading: boolean;
  mappingSource: MappingSource;
  mappingDetail: string;
}) => {
  const providerRecord = provider?.provider;
  const publicClaimProcess = providerRecord?.claimProcess;
  const claimProcess: SlaClaimProcess | null = contractTerms ? {
    deadlineDays: contractTerms.filingDeadlineDays,
    deadlineBasis: contractTerms.deadlineBasis,
    businessDays: contractTerms.businessDays,
    method: contractTerms.claimMethod,
    url: publicClaimProcess?.url ?? null,
    requiredEvidence: publicClaimProcess?.requiredEvidence ?? [],
    reviewDays: publicClaimProcess?.reviewDays ?? null,
    creditApplication: publicClaimProcess?.creditApplication ?? null,
  } : publicClaimProcess ?? null;
  const policy = providerRecord?.defaultCreditPolicy;
  const maxCredit = contractTerms?.maxCreditPercent ?? providerRecord?.maxCreditPercent ?? policy?.maxCreditPercent;
  const active = problem.status.toUpperCase() === "ACTIVE";
  const reference = getWindowReference(problem, claimProcess);
  const boundary = serviceNames.length > 0
    ? serviceNames.join(", ")
    : problem.affectedEntityIds.length > 0
      ? `${problem.affectedEntityIds.length} entity ID${problem.affectedEntityIds.length === 1 ? "" : "s"} returned`
      : "No service boundary returned";
  const providerServiceLabel = mappingLoading
    ? "Checking Coverage"
    : providerServiceId === "*"
      ? `${providerRecord?.name ?? "Provider"} (provider-wide)`
      : provider?.services.find((service) => service.id === providerServiceId)?.name ?? providerServiceId;
  const scopeLabel = mappingLoading
    ? "Checking Coverage"
    : scopeChoices.find((choice) => choice.key === scopeKey)?.label ?? "Provider-wide scope";

  return (
    <article className="incident-detail">
      <div className="incident-detail-heading">
        <div><h3>{problem.title}</h3><span>{problem.id} · {formatStatus(problem.category)}</span></div>
        <StatusPill tone={active ? "warning" : "neutral"}>{active ? "Active" : "Closed"}</StatusPill>
      </div>

      <div className="incident-contract-context">
        <div><span>Provider service</span><strong>{providerServiceLabel}</strong></div>
        <div><span>Dynatrace scope</span><strong>{scopeLabel}</strong></div>
        <div><span>Applied terms</span><strong className={contractTerms?.source === "tenant override" ? "source-tenant" : ""}>{contractLoading ? "Checking" : contractError ? "Public fallback" : contractTerms?.source === "tenant override" ? "Tenant override" : "sla.directory"}</strong></div>
      </div>
      <div className={`incident-mapping-note incident-mapping-${mappingSource}`}>
        <StatusPill tone={!mappingLoading && (mappingSource === "confirmed" || mappingSource === "observed") ? "positive" : !mappingLoading && mappingSource === "candidate" ? "warning" : "neutral"}>
          {mappingLoading ? "Checking Coverage" : mappingSource === "confirmed" ? "Confirmed mapping" : mappingSource === "observed" ? "Observed topology" : mappingSource === "candidate" ? "Coverage review needed" : "Provider-wide fallback"}
        </StatusPill>
        <span>{mappingDetail}</span>
        <Link to="/">{mappingSource === "candidate" || mappingSource === "none" ? "Resolve in Coverage" : "Review Coverage"}</Link>
      </div>

      <dl className="incident-facts">
        <div><dt>Affected services</dt><dd>{boundary}</dd></div>
        <div><dt>Root cause signal</dt><dd>{problem.hasRootCause ? "Entity linked" : "Not returned"}</dd></div>
        <div><dt>Applied target</dt><dd>{contractTerms?.availabilityTarget === null || contractTerms?.availabilityTarget === undefined ? "Not published" : `${contractTerms.availabilityTarget}%`}</dd></div>
        <div><dt>Maximum credit</dt><dd>{maxCredit === null || maxCredit === undefined ? "Not published" : `${maxCredit}%`}</dd></div>
      </dl>

      <div className="incident-evidence-row">
        <section className="incident-timeline" aria-label="Observed impact window">
          <span>Observed impact</span>
          <strong>{formatDateTime(problem.startedAt)}</strong>
          <small>{problem.endedAt ? `to ${formatDateTime(problem.endedAt)}` : "Ongoing or end unavailable"}</small>
        </section>
        <section className={`incident-window incident-window-${reference.tone}`}>
          <span>Filing window reference</span>
          <strong>{reference.title}</strong>
          <small>{reference.detail}</small>
        </section>
      </div>

      <details className="incident-provider-details">
        <summary>Provider terms and evidence requirements</summary>
        <div className="incident-provider-detail-grid">
          <div><span>Submission method</span><strong>{claimProcess?.method ?? "Not published"}</strong></div>
          <div><span>Provider review time</span><strong>{claimProcess?.reviewDays ? `${claimProcess.reviewDays} business days` : "Not published"}</strong></div>
          <div><span>Credit application</span><strong>{claimProcess?.creditApplication ?? "Not published"}</strong></div>
          <div><span>Directory last verified</span><strong>{providerRecord?.lastVerified ?? "Unavailable"}</strong></div>
        </div>
        {contractTerms?.appliedOverrides.length ? <div className="incident-override-sources"><strong>Tenant source reference{contractTerms.appliedOverrides.length === 1 ? "" : "s"}</strong><span>{contractTerms.appliedOverrides.map((override) => override.sourceReference).join("; ")}</span></div> : null}
        {claimProcess?.requiredEvidence.length ? <ul>{claimProcess.requiredEvidence.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No evidence checklist is published in this directory record.</p>}
        {providerRecord?.exclusions?.length ? <p><strong>Published exclusions:</strong> {providerRecord.exclusions.slice(0, 4).join("; ")}</p> : null}
      </details>

      <p className="incident-boundary-note">Confirm the affected services, actual impact window, customer-side exclusions, and current provider terms before filing.</p>
    </article>
  );
};

export const IncidentReview = ({ provider, problems, services, topology, topologyLoading, topologyError, lookbackHours, onLookbackChange, loading, error }: IncidentReviewProps) => {
  const location = useLocation();
  const requestedProblemId = new URLSearchParams(location.search).get("problem");
  const [selectedId, setSelectedId] = useState<string | null>(requestedProblemId);
  const lastRequestedProblem = useRef<string | null>(null);
  const contractSettings = useContractOverrides();
  const scopeSettings = useProviderScopeAssignments();
  const selectedProblem = problems.find((problem) => problem.id === selectedId) ?? problems[0];
  const serviceNamesById = useMemo(() => new Map(services.map((service) => [service.id, service.name])), [services]);
  const activeProblems = problems.filter((problem) => problem.status.toUpperCase() === "ACTIVE").length;

  useEffect(() => {
    if (problems.length === 0) {
      setSelectedId(null);
      return;
    }
    if (
      requestedProblemId &&
      requestedProblemId !== lastRequestedProblem.current &&
      problems.some((problem) => problem.id === requestedProblemId)
    ) {
      lastRequestedProblem.current = requestedProblemId;
      setSelectedId(requestedProblemId);
      return;
    }
    if (!problems.some((problem) => problem.id === selectedId))
      setSelectedId(problems[0].id);
  }, [problems, requestedProblemId, selectedId]);

  const selectedServiceNames = selectedProblem
    ? selectedProblem.affectedEntityIds.map((id) => serviceNamesById.get(id)).filter((name): name is string => Boolean(name))
    : [];

  const scopeChoices = useMemo<ContractScopeChoice[]>(() => {
    const choices: ContractScopeChoice[] = [{ key: "provider", label: "Provider-wide scope", context: {} }];
    if (!selectedProblem) return choices;
    const affected = new Set(selectedProblem.affectedEntityIds);
    const affectedServices = services.filter((service) => affected.has(service.id));
    affectedServices.forEach((service) => choices.push({
      key: `service:${service.id}`,
      label: `Service · ${service.name}`,
      context: { serviceId: service.id },
    }));
    topology.filter((edge) => affected.has(serviceEntityIdForEdge(edge))).forEach((edge) => {
      const serviceEntityId = serviceEntityIdForEdge(edge);
      const hostId = edge.targetClassicId ?? edge.targetNodeId;
      const key = `host:${serviceEntityId}:${hostId}`;
      if (choices.some((choice) => choice.key === key)) return;
      choices.push({
        key,
        label: `${edge.serviceName} · ${edge.targetName}${edge.location ? ` · ${edge.location}` : ""}`,
        context: { serviceId: serviceEntityId, hostId, location: edge.location },
      });
      if (edge.location && !choices.some((choice) => choice.key === `location:${edge.location}`)) {
        choices.push({
          key: `location:${edge.location}`,
          label: `Location · ${edge.location}`,
          context: { location: edge.location },
        });
      }
    });
    return choices;
  }, [selectedProblem, services, topology]);

  const providerOverrides = useMemo(() => provider
    ? contractSettings.overrides.filter((override) => override.providerSlug === provider.provider.slug)
    : [], [contractSettings.overrides, provider]);

  const confirmedAssignments = useMemo(() => {
    if (!provider || !selectedProblem) return [];
    const affected = new Set(selectedProblem.affectedEntityIds);
    return scopeSettings.assignments.filter((assignment) => (
      assignment.enabled &&
      assignment.providerSlug === provider.provider.slug &&
      affected.has(assignment.serviceEntityId)
    )).flatMap((assignment) => {
      const candidateScopeKey = isServiceScopeAssignment(assignment)
        ? `service:${assignment.serviceEntityId}`
        : `host:${assignment.serviceEntityId}:${assignment.runtimeEntityId}`;
      return scopeChoices.some((choice) => choice.key === candidateScopeKey)
        ? [{ providerServiceId: assignment.providerServiceId, scopeKey: candidateScopeKey, serviceEntityId: assignment.serviceEntityId, evidence: assignment.evidence, confidence: "observed" as const }]
        : [];
    });
  }, [provider, scopeChoices, scopeSettings.assignments, selectedProblem]);
  const confirmedDecision = useMemo(() => resolveUniqueProviderServiceCandidate(confirmedAssignments), [confirmedAssignments]);

  const topologyCandidates = useMemo(() => {
    if (!provider || !selectedProblem) return [];
    const affected = new Set(selectedProblem.affectedEntityIds);
    const candidates = new Map<string, IncidentProviderServiceCandidate>();
    topology.filter((edge) => affected.has(serviceEntityIdForEdge(edge))).forEach((edge) => {
      const candidate = inferProviderServiceCandidate(edge, provider);
      if (!candidate) return;
      const candidateScopeKey = `host:${serviceEntityIdForEdge(edge)}:${runtimeEntityIdForEdge(edge)}`;
      if (!scopeChoices.some((choice) => choice.key === candidateScopeKey)) return;
      const key = `${candidate.providerServiceId}|${candidateScopeKey}`;
      candidates.set(key, { providerServiceId: candidate.providerServiceId, scopeKey: candidateScopeKey, serviceEntityId: serviceEntityIdForEdge(edge), evidence: candidate.evidence, confidence: candidate.confidence });
    });
    return Array.from(candidates.values());
  }, [provider, scopeChoices, selectedProblem, topology]);
  const topologyDecision = useMemo(() => resolveUniqueProviderServiceCandidate(topologyCandidates), [topologyCandidates]);
  const confirmedAmbiguous = confirmedAssignments.length > 0 && !confirmedDecision;

  const resolvedMapping = useMemo<ResolvedIncidentMapping>(() => {
    if (confirmedDecision) return {
      providerServiceId: confirmedDecision.providerServiceId,
      scopeKey: confirmedDecision.scopeKey,
      source: "confirmed",
    };
    if (confirmedAmbiguous) return {
      providerServiceId: "*",
      scopeKey: "provider",
      source: "candidate",
    };
    if (topologyDecision?.confidence === "observed") return {
      providerServiceId: topologyDecision.providerServiceId,
      scopeKey: topologyDecision.scopeKey,
      source: "observed",
    };
    if (topologyDecision) return {
      providerServiceId: "*",
      scopeKey: "provider",
      source: "candidate",
    };
    return { providerServiceId: "*", scopeKey: "provider", source: "none" };
  }, [confirmedAmbiguous, confirmedDecision, topologyDecision]);
  const mappingLoading = scopeSettings.loading || topologyLoading;
  const mappingDetail = mappingLoading
    ? "Reading confirmed Coverage mappings and provider-native Smartscape relationships."
    : resolvedMapping.source === "confirmed"
      ? confirmedDecision?.evidence ?? "A mapping confirmed in Coverage was reused for this incident."
      : resolvedMapping.source === "observed"
        ? `${topologyDecision?.evidence ?? "Provider-native Smartscape runtime metadata identifies this provider service"}. The applicable terms were resolved automatically; this does not establish provider fault or credit eligibility.`
        : resolvedMapping.source === "candidate"
          ? confirmedAmbiguous
            ? "More than one confirmed Coverage mapping applies to the affected services. Provider-wide terms remain in use until the conflict is resolved in Coverage."
            : `${topologyDecision?.evidence ?? "Smartscape runtime metadata suggests a provider service"}. Provider-wide terms remain in use until the suggestion is confirmed in Coverage.`
          : "No unique provider-service mapping was found for the affected services. Provider-wide terms remain in use until Coverage is resolved.";

  const selectedScope = scopeChoices.find((choice) => choice.key === resolvedMapping.scopeKey) ?? scopeChoices[0];
  const effectiveTerms = provider ? resolveEffectiveContractTerms(
    provider,
    providerOverrides,
    {
      providerSlug: provider.provider.slug,
      providerServiceId: resolvedMapping.providerServiceId,
      ...selectedScope.context,
    },
  ) : undefined;

  return (
    <Surface className="panel-card incidents-panel">
      <div className="incidents-heading">
        <div>
          <Heading level={2}>Incidents</Heading>
          <Paragraph>Select a Dynatrace Problem to compare its observed impact with the {provider?.provider.name ?? "selected provider"} record.</Paragraph>
        </div>
        <div className="incidents-heading-actions">
          <StatusPill tone={activeProblems > 0 ? "warning" : "neutral"}>{loading ? "Checking" : `${activeProblems} active`}</StatusPill>
          {provider?.provider.slaUrl ? <a className="inline-action" href={provider.provider.slaUrl} target="_blank" rel="noreferrer">Open provider terms</a> : <Link className="inline-action" to="/directory">Review terms</Link>}
        </div>
      </div>

      <dl className="incidents-summary">
        <div className="incidents-lookback">
          <dt><label htmlFor="incidents-lookback">Lookback</label></dt>
          <dd>
            <select
              id="incidents-lookback"
              aria-label="Incident evidence lookback"
              value={lookbackHours}
              onChange={(event) => onLookbackChange(Number(event.target.value) as EvidenceLookbackHours)}
            >
              {EVIDENCE_LOOKBACK_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </dd>
        </div>
        <div><dt>Problems</dt><dd>{problems.length}</dd></div>
        <div><dt>Service entities</dt><dd>{services.length}</dd></div>
        <div><dt>Provider</dt><dd>{provider?.provider.name ?? "Unavailable"}</dd></div>
      </dl>

      {error ? <div className="error-box">The Problem query is incomplete. Check the current user's event access.</div> : null}
      {loading ? (
        <div className="incidents-empty" role="status"><strong>Reading Problems</strong><span>Loading the selected tenant window.</span></div>
      ) : problems.length === 0 ? (
        <div className="incidents-empty"><strong>No Problems found in the last {formatEvidenceLookback(lookbackHours)}.</strong><span>When Dynatrace records a Problem, it will appear here for provider review.</span></div>
      ) : (
        <div className="incidents-layout">
          <aside className="incident-queue" aria-label="Observed Problems">
            <div className="incident-queue-heading"><strong>Problem queue</strong><span>{problems.length} observed</span></div>
            <div className="incident-queue-list">
              {problems.slice(0, 12).map((problem) => (
                <button type="button" className={`incident-queue-item${selectedProblem?.id === problem.id ? " selected" : ""}`} key={problem.id} onClick={() => setSelectedId(problem.id)} aria-pressed={selectedProblem?.id === problem.id}>
                  <span><strong>{problem.title}</strong><small>{problem.id} · {formatStatus(problem.category)}</small></span>
                  <StatusPill tone={problem.status.toUpperCase() === "ACTIVE" ? "warning" : "neutral"}>{problem.status.toUpperCase() === "ACTIVE" ? "Active" : "Closed"}</StatusPill>
                </button>
              ))}
            </div>
          </aside>
          {selectedProblem ? <IncidentDetail
            problem={selectedProblem}
            serviceNames={selectedServiceNames}
            provider={provider}
            contractTerms={effectiveTerms}
            providerServiceId={resolvedMapping.providerServiceId}
            scopeKey={resolvedMapping.scopeKey}
            scopeChoices={scopeChoices}
            contractLoading={contractSettings.loading || scopeSettings.loading || topologyLoading}
            contractError={Boolean(contractSettings.error || scopeSettings.error || topologyError)}
            mappingLoading={mappingLoading}
            mappingSource={resolvedMapping.source}
            mappingDetail={mappingDetail}
          /> : null}
        </div>
      )}

      <div className="incidents-disclaimer"><strong>Assessment boundary</strong><span>Dynatrace provides observed tenant evidence. The provider determines fault, eligibility, and any service credit.</span></div>
    </Surface>
  );
};
