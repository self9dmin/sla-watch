import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppFunction, useDql } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";
import { SetupAdvisor } from "../components/SetupAdvisor";
import { useSlaPreferences } from "../context/SlaPreferencesContext";
import { buildSetupRecommendations } from "../data/recommendations";
import {
  createLogsCountQuery,
  createProblemsQuery,
  createServiceMetricsQuery,
  createSpansCountQuery,
  SERVICES_QUERY,
} from "../data/queries";
import {
  slaDirectoryConnection,
  type ProblemRecord,
  type ServiceRecord,
  type SlaProviderResponse,
  type WatchSection,
} from "../types";

type DashboardProps = { initialSection?: WatchSection };
type Tone = "neutral" | "warning" | "positive";

const asRecord = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
const textValue = (value: unknown, fallback: string): string => typeof value === "string" && value.trim().length > 0 ? value : fallback;
const stringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return typeof value === "string" ? [value] : [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    const record = asRecord(item);
    const key = textValue(record.key ?? record.name, "");
    const tagValue = textValue(record.value, "");
    return key && tagValue ? [`${key}:${tagValue}`] : [];
  });
};

const firstCount = (data: { records?: unknown[] } | undefined, field: string): number | null => {
  const first = Array.isArray(data?.records) ? asRecord(data.records[0]) : {};
  const value = first[field];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return null;
};

const hasSignalValue = (value: unknown): boolean => Array.isArray(value) ? value.some(hasSignalValue) : value !== null && value !== undefined;
const hasMetricSeries = (data: { records?: unknown[] } | undefined): boolean => {
  const records = Array.isArray(data?.records) ? data.records : [];
  return records.some((record) => hasSignalValue(asRecord(record).request_count));
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const providerLabel = (tag: string, configuredKey: string): string | null => {
  const normalized = tag.trim().toLowerCase();
  const keys = Array.from(new Set([configuredKey.trim().toLowerCase(), "provider", "vendor", "cloud.provider"].filter(Boolean))).map(escapeRegExp);
  const keyed = normalized.match(new RegExp(`(?:^|\\[|\\s)(?:${keys.join("|")})\\s*[:=]\\s*([a-z0-9][a-z0-9._-]*)`));
  if (keyed?.[1]) return keyed[1];
  const context = normalized.match(/^\[([a-z0-9][a-z0-9._-]*)\]/);
  if (context?.[1]) return context[1];
  const commonProvider = /^(aws|amazon|azure|microsoft|gcp|google|oci|oracle|ibm|alibaba|cloudflare|stripe|github|openai)$/;
  return commonProvider.test(normalized) ? normalized : null;
};

const StatusPill = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => <span className={`status-pill status-pill-${tone}`}>{children}</span>;

const MetricCard = ({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: Tone }) => (
  <Surface className="metric-card"><Text className="eyebrow">{label}</Text><div className={`metric-value metric-value-${tone}`}>{value}</div><Text className="metric-detail">{detail}</Text></Surface>
);

const DiagnosticCard = ({ label, title, detail, tone, children }: { label: string; title: string; detail: string; tone: Tone; children?: React.ReactNode }) => (
  <div className="diagnostic-card"><Text className="eyebrow">{label}</Text><div className="diagnostic-title"><StatusPill tone={tone}>{title}</StatusPill></div><p>{detail}</p>{children ? <div className="diagnostic-meta">{children}</div> : null}</div>
);

const EvidenceStep = ({ number, title, detail, state }: { number: number; title: string; detail: string; state: Tone }) => (
  <div className="evidence-step"><span className={`evidence-step-marker evidence-step-${state}`}>{number}</span><div><strong>{title}</strong><span>{detail}</span></div></div>
);

export const Dashboard = ({ initialSection = "overview" }: DashboardProps) => {
  const [section, setSection] = useState<WatchSection>(initialSection);
  const { preferences } = useSlaPreferences();
  useEffect(() => setSection(initialSection), [initialSection]);
  const { providerSlug, providerLabelKey, lookbackHours } = preferences;
  const problemsQuery = useMemo(() => createProblemsQuery(lookbackHours), [lookbackHours]);
  const logsQuery = useMemo(() => createLogsCountQuery(lookbackHours), [lookbackHours]);
  const spansQuery = useMemo(() => createSpansCountQuery(lookbackHours), [lookbackHours]);
  const metricsQuery = useMemo(() => createServiceMetricsQuery(lookbackHours), [lookbackHours]);
  const directoryRequest = useMemo(() => ({ vendor: providerSlug }), [providerSlug]);

  const { data: serviceData, error: serviceError, isLoading: servicesLoading, refetch: refetchServices } = useDql({ query: SERVICES_QUERY });
  const { data: problemData, error: problemError, isLoading: problemsLoading, refetch: refetchProblems } = useDql({ query: problemsQuery });
  const { data: logsData, error: logsError, isLoading: logsLoading, refetch: refetchLogs } = useDql({ query: logsQuery });
  const { data: spansData, error: spansError, isLoading: spansLoading, refetch: refetchSpans } = useDql({ query: spansQuery });
  const { data: metricsData, error: metricsError, isLoading: metricsLoading, refetch: refetchMetrics } = useDql({ query: metricsQuery });
  const { data: directoryData, error: directoryError, isLoading: directoryLoading, refetch: refetchDirectory } = useAppFunction<SlaProviderResponse>({ name: "slaDirectory", data: directoryRequest, responseType: "json" });

  const services = useMemo<ServiceRecord[]>(() => {
    const records = Array.isArray(serviceData?.records) ? serviceData.records : [];
    return records.map((record: unknown, index: number) => {
      const row = asRecord(record);
      return { id: textValue(row.id, `service-${index + 1}`), name: textValue(row.name, "Unnamed service"), type: textValue(row.type, "SERVICE"), tags: stringArray(row.tags) };
    });
  }, [serviceData?.records]);

  const problems = useMemo<ProblemRecord[]>(() => {
    const records = Array.isArray(problemData?.records) ? problemData.records : [];
    return records.map((record: unknown, index: number) => {
      const row = asRecord(record);
      return { id: textValue(row.display_id, `problem-${index + 1}`), title: textValue(row.title, "Untitled problem"), status: textValue(row.status, "UNKNOWN").toUpperCase(), category: textValue(row.category, "UNKNOWN"), affectedEntityIds: stringArray(row.affected_entity_ids), hasRootCause: typeof row.root_cause_entity_id === "string" && row.root_cause_entity_id.length > 0 };
    });
  }, [problemData?.records]);

  const activeProblems = problems.filter((problem) => problem.status === "ACTIVE").length;
  const logCount = firstCount(logsData, "log_count");
  const spanCount = firstCount(spansData, "span_count");
  const providerLabels = useMemo(() => Array.from(new Set(services.flatMap((service) => service.tags.map((tag) => providerLabel(tag, providerLabelKey)).filter((value): value is string => Boolean(value))))), [providerLabelKey, services]);
  const selectedProviderSlug = directoryData?.provider.slug ?? providerSlug;
  const matchedProviderServices = services.filter((service) => service.tags.some((tag) => providerLabel(tag, providerLabelKey) === selectedProviderSlug)).length;

  const telemetryLoading = servicesLoading || problemsLoading || logsLoading || spansLoading || metricsLoading;
  const telemetryError = serviceError ?? problemError ?? logsError ?? spansError ?? metricsError;
  const telemetrySignalsPresent = problems.length > 0 || (logCount !== null && logCount > 0) || (spanCount !== null && spanCount > 0) || hasMetricSeries(metricsData);
  const telemetryState = telemetryLoading
    ? { tone: "neutral" as Tone, title: "Checking telemetry", detail: "Reading the service inventory and recent signals before making a diagnosis." }
    : telemetryError
      ? { tone: "warning" as Tone, title: "Access incomplete", detail: "At least one telemetry read was denied or failed. This is not evidence that telemetry is absent." }
      : services.length === 0 && telemetrySignalsPresent
        ? { tone: "warning" as Tone, title: "Entity inventory incomplete", detail: "Telemetry exists, but no service entities were returned. Check entity permissions or entity mapping before evaluating provider responsibility." }
        : telemetrySignalsPresent
          ? { tone: "positive" as Tone, title: "Telemetry detected", detail: "Dynatrace has service entities or signals that can support an evidence review." }
          : { tone: "warning" as Tone, title: "Telemetry missing", detail: `No Problems, logs, spans, or service request series were detected in the last ${lookbackHours} hours.` };
  const providerState = directoryLoading
    ? { tone: "neutral" as Tone, title: "Checking provider identity", detail: `Loading the ${providerSlug} contract before evaluating labels.` }
    : !directoryData
      ? { tone: "warning" as Tone, title: "Directory unavailable", detail: directoryError?.message ?? "Load a provider contract before checking provider identity." }
      : telemetryLoading
        ? { tone: "neutral" as Tone, title: "Waiting for service inventory", detail: "Provider matching will be evaluated after the tenant service list finishes loading." }
        : telemetryError
          ? { tone: "warning" as Tone, title: "Provider check blocked", detail: "Telemetry access is incomplete, so provider labeling cannot be judged reliably yet." }
          : services.length === 0 && telemetrySignalsPresent
            ? { tone: "warning" as Tone, title: "Identify service first", detail: "The tenant has telemetry, but the affected service inventory is incomplete. Provider labeling cannot be evaluated yet." }
            : services.length === 0
              ? { tone: "warning" as Tone, title: "No service entities", detail: "There is no service inventory to label. Fix instrumentation or entity access before identifying a provider." }
              : providerLabels.length === 0
                ? { tone: "warning" as Tone, title: "Labeling missing", detail: `Services exist, but no explicit provider label was found. Add a tag such as ${providerLabelKey}:${selectedProviderSlug} or confirm a mapping in this app.` }
                : matchedProviderServices > 0
                  ? { tone: "positive" as Tone, title: "Provider identified", detail: `${matchedProviderServices} service${matchedProviderServices === 1 ? "" : "s"} carry an explicit ${directoryData.provider.name} label. This still does not prove a provider outage.` }
                  : { tone: "warning" as Tone, title: "Provider identification needed", detail: `Provider labels were found (${providerLabels.slice(0, 3).join(", ")}), but none resolve to ${directoryData.provider.name}. Select the correct provider or update the Dynatrace labels.` };

  const claimReadiness = telemetryLoading || directoryLoading
    ? { tone: "neutral" as Tone, value: "Checking", detail: "Waiting for the evidence path to settle." }
    : telemetryError || !directoryData
      ? { tone: "warning" as Tone, value: "Blocked", detail: "Access or contract lookup must be repaired first." }
      : services.length === 0
        ? { tone: "warning" as Tone, value: "Needs telemetry", detail: "No service boundary is available for attribution." }
        : providerLabels.length === 0
          ? { tone: "warning" as Tone, value: "Needs labeling", detail: "Add a provider label or configure a mapping." }
          : matchedProviderServices === 0
            ? { tone: "warning" as Tone, value: "Needs mapping", detail: "Detected labels do not match the selected contract." }
            : activeProblems === 0
              ? { tone: "neutral" as Tone, value: "No active claim", detail: "Provider is identified, but there is no active Problem in scope." }
              : { tone: "positive" as Tone, value: "Candidate", detail: "A human review can compare the active Problem with the provider contract." };

  const setupRecommendations = useMemo(() => buildSetupRecommendations({
    services,
    problems,
    telemetrySignalsPresent,
    telemetryError: telemetryError ?? undefined,
    directoryData,
    directoryError: directoryError ?? undefined,
    providerLabels,
    selectedProviderSlug,
    providerLabelKey,
    matchedProviderServices,
  }), [directoryData, directoryError, matchedProviderServices, problems, providerLabelKey, providerLabels, selectedProviderSlug, services, telemetryError, telemetrySignalsPresent]);

  const handleRefresh = () => {
    void Promise.all([refetchServices(), refetchProblems(), refetchLogs(), refetchSpans(), refetchMetrics(), refetchDirectory()]);
  };

  return (
    <div className="dashboard-shell">
      <section className="hero-row">
        <div><Text className="eyebrow">SLA / environment watch</Text><Heading level={1}>Review provider evidence for this environment.</Heading><Paragraph className="hero-copy">Compare the selected SLA contract with service inventory, Problems, and supporting Dynatrace signals.</Paragraph></div>
        <div className="hero-actions"><div className="hero-status-line"><StatusPill tone={directoryLoading ? "neutral" : directoryData ? "positive" : "warning"}>{slaDirectoryConnection.source}: {directoryLoading ? "checking" : directoryData ? "connected" : "unavailable"}</StatusPill><span>Watching <strong>{directoryData?.provider.name ?? providerSlug}</strong></span></div><Button variant="emphasized" onClick={handleRefresh} disabled={telemetryLoading || directoryLoading}>{telemetryLoading || directoryLoading ? "Refreshing" : "Refresh watch"}</Button><Link className="text-action" to="/settings/watch">Configure watch</Link></div>
      </section>

      <div className="section-tabs" role="tablist" aria-label="SLA watch sections"><button type="button" className={section === "overview" ? "section-tab active" : "section-tab"} onClick={() => setSection("overview")} role="tab" aria-selected={section === "overview"}>Overview</button><button type="button" className={section === "directory" ? "section-tab active" : "section-tab"} onClick={() => setSection("directory")} role="tab" aria-selected={section === "directory"}>Provider directory</button></div>

      {section === "overview" ? (
        <>
          <div className="metric-grid"><MetricCard label="Providers" value={directoryLoading ? "..." : directoryData ? "1" : "Unavailable"} detail={directoryData ? `${directoryData.provider.name} contract loaded` : "SLA.directory provider records"} tone={directoryData ? "positive" : directoryLoading ? "neutral" : "warning"} /><MetricCard label="Services in tenant" value={servicesLoading ? "..." : String(services.length)} detail="Live entity inventory" tone={servicesLoading ? "neutral" : services.length > 0 ? "positive" : "warning"} /><MetricCard label={`Problems · ${lookbackHours}h`} value={problemsLoading ? "..." : String(problems.length)} detail={problemsLoading ? "Reading Davis data" : `${activeProblems} active · ${problems.length - activeProblems} closed`} tone={problemsLoading ? "neutral" : activeProblems > 0 ? "warning" : "neutral"} /><MetricCard label="Attribution status" value={claimReadiness.value} detail={claimReadiness.detail} tone={claimReadiness.tone} /></div>

          <div className="content-grid"><Surface className="panel-card connector-card"><Text className="eyebrow">Provider contract</Text><Heading level={3}>Selected provider contract</Heading><Paragraph>{slaDirectoryConnection.message}</Paragraph><div className="contract-list"><div><span>Provider</span><strong>{directoryData?.provider.name ?? providerSlug}</strong></div><div><span>Directory transport</span><strong>Versioned JSON API</strong></div><div><span>Dynatrace evidence</span><strong>Services, Problems, logs, spans</strong></div></div><Button variant="default" onClick={() => void refetchDirectory()} disabled={directoryLoading}>{directoryLoading ? "Testing" : "Refresh provider"}</Button></Surface><Surface className="panel-card"><Text className="eyebrow">Next check</Text><Heading level={3}>{claimReadiness.value === "Candidate" ? "Candidate for human review" : providerState.title}</Heading><Paragraph>Service health is an observed symptom. Provider attribution requires a service boundary, a matching contract, and enough customer-side evidence to rule out a local cause.</Paragraph><div className="signal-row"><StatusPill tone={telemetryState.tone}>{telemetryState.title}</StatusPill><Text>{services.length} services · {problems.length} Problems</Text></div><div className="signal-row"><StatusPill tone={providerState.tone}>{providerState.title}</StatusPill><Text>{providerLabels.length} provider labels detected</Text></div><Link className="inline-action" to={providerState.tone === "warning" ? "/settings/watch" : "/bugs"}>{providerState.tone === "warning" ? "Configure provider identity" : "Report a mismatch"}</Link></Surface></div>

          <SetupAdvisor recommendations={setupRecommendations} loading={telemetryLoading || directoryLoading} limitedContext={Boolean(telemetryError || (services.length === 0 && telemetrySignalsPresent))} />

          <Surface className="panel-card diagnostics-panel" data-tour="evidence"><div className="panel-heading-row"><div><Text className="eyebrow">Tenant evidence diagnostics</Text><Heading level={2}>Evidence required for provider attribution</Heading></div><StatusPill tone={claimReadiness.tone}>{claimReadiness.value === "Candidate" ? "Candidate for review" : "Action required"}</StatusPill></div><Paragraph>These checks separate telemetry availability, service boundary, provider identity, and contract evidence. No check by itself establishes provider fault or credit eligibility.</Paragraph><div className="evidence-ladder"><EvidenceStep number={1} title="Telemetry captured" detail="Problems, logs, spans, or service request signals are present." state={telemetryState.tone === "positive" ? "positive" : telemetryState.tone} /><EvidenceStep number={2} title="Service boundary visible" detail={`${services.length} service${services.length === 1 ? "" : "s"} returned from the tenant inventory.`} state={services.length > 0 && !servicesLoading ? "positive" : telemetryLoading ? "neutral" : "warning"} /><EvidenceStep number={3} title="Provider boundary identified" detail={`${matchedProviderServices} service${matchedProviderServices === 1 ? "" : "s"} match the ${directoryData?.provider.name ?? providerSlug} contract.`} state={matchedProviderServices > 0 && !directoryLoading ? "positive" : providerState.tone} /><EvidenceStep number={4} title="Contract evidence verified" detail="A candidate still needs human review against provider-side evidence and customer-side exclusions." state={claimReadiness.value === "Candidate" ? "positive" : "neutral"} /></div><div className="diagnostic-grid"><DiagnosticCard label="Telemetry coverage" title={telemetryState.title} tone={telemetryState.tone} detail={telemetryState.detail}><span>Services <strong>{services.length}</strong></span><span>Problems <strong>{problems.length}</strong></span><span>Logs <strong>{logCount === null ? "n/a" : logCount.toLocaleString()}</strong></span><span>Spans <strong>{spanCount === null ? "n/a" : spanCount.toLocaleString()}</strong></span></DiagnosticCard><DiagnosticCard label="Provider identity" title={providerState.title} tone={providerState.tone} detail={providerState.detail}><span>Selected contract <strong>{directoryData?.provider.name ?? providerSlug}</strong></span><span>Explicit labels <strong>{providerLabels.length}</strong></span><span>Matched services <strong>{matchedProviderServices}</strong></span></DiagnosticCard></div>{telemetryError ? <div className="error-box">Telemetry scan incomplete: {telemetryError.message}</div> : null}</Surface>

          <Surface className="panel-card problems-panel"><div className="panel-heading-row"><div><Text className="eyebrow">Dynatrace evidence</Text><Heading level={2}>Recent Problems</Heading></div><StatusPill tone={activeProblems > 0 ? "warning" : "neutral"}>{activeProblems > 0 ? `${activeProblems} active` : "No active Problems"}</StatusPill></div><Paragraph>These records show service symptoms. They become provider candidates only after boundary evidence and customer-side exclusions are available.</Paragraph>{problems.length > 0 ? <div className="problem-table" role="table" aria-label="Recent Dynatrace Problems"><div className="problem-row problem-row-header" role="row"><span>Problem</span><span>Status</span><span>Category</span><span>Affected entity</span><span>Root cause</span></div>{problems.slice(0, 8).map((problem) => <div className="problem-row" role="row" key={problem.id}><div><strong>{problem.title}</strong><small>{problem.id}</small></div><StatusPill tone={problem.status === "ACTIVE" ? "warning" : "neutral"}>{problem.status === "ACTIVE" ? "Active" : "Closed"}</StatusPill><span>{problem.category}</span><span>{problem.affectedEntityIds[0] ?? "Unknown"}</span><StatusPill tone={problem.hasRootCause ? "positive" : "neutral"}>{problem.hasRootCause ? "Found" : "Unknown"}</StatusPill></div>)}</div> : <div className="empty-state">{problemsLoading ? "Reading Problems..." : `No Problems found in the last ${lookbackHours} hours.`}</div>}</Surface>
        </>
      ) : (
        <Surface className="panel-card directory-panel"><div className="panel-heading-row"><div><Text className="eyebrow">Provider and service map</Text><Heading level={2}>Provider directory</Heading></div><StatusPill tone={directoryLoading ? "neutral" : directoryData ? "positive" : "warning"}>{directoryLoading ? "Checking" : directoryData ? `${directoryData.provider.name} connected` : "Directory unavailable"}</StatusPill></div><Paragraph>{directoryData ? `${directoryData.provider.name} has ${directoryData.services.length} service records. These are contractual targets, not measured tenant availability.` : directoryError ? `${directoryError.message}. Check the environment External requests allowlist.` : "Loading provider data..."}</Paragraph>{serviceError ? <div className="error-box">Dynatrace service inventory could not be loaded: {serviceError.message}</div> : null}{directoryData ? <div className="service-table" role="table" aria-label="Provider SLA services"><div className="service-row service-row-header" role="row"><span>Provider service</span><span>Target</span><span>Eligibility</span><span>Verification</span></div>{directoryData.services.slice(0, 20).map((service) => <div className="service-row" role="row" key={service.id}><div><strong>{service.name}</strong><small>{service.id}</small></div><span>{service.uptime ? `${service.uptime}%` : "No target"}</span><StatusPill tone={service.eligible ? "positive" : "neutral"}>{service.eligible ? "Directory eligible" : "Reference"}</StatusPill><span>{directoryData.provider.lastVerified}</span></div>)}</div> : null}<div className="directory-footer"><span>Need a different provider or label convention?</span><Link className="inline-action" to="/settings/watch">Open watch settings</Link></div>{servicesLoading || directoryLoading ? <div className="empty-state">Loading watch data...</div> : null}</Surface>
      )}
    </div>
  );
};
