import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppFunction, useDql } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";
import { SetupAdvisor } from "../components/SetupAdvisor";
import { IncidentReview } from "../components/IncidentReview";
import { ProviderTagSetup } from "../components/ProviderTagSetup";
import { useSlaPreferences } from "../context/SlaPreferencesContext";
import { providerTagValue } from "../data/providerTags";
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
type WatchRouteSection = Exclude<WatchSection, "directory">;

const asRecord = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
const textValue = (value: unknown, fallback: string): string => typeof value === "string" && value.trim().length > 0 ? value : fallback;
const optionalText = (value: unknown): string | undefined => typeof value === "string" && value.trim().length > 0 ? value : undefined;
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

const StatusPill = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => <span className={`status-pill status-pill-${tone}`}>{children}</span>;

const OverviewFact = ({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: Tone }) => (
  <div className="overview-fact">
    <span>{label}</span>
    <strong className={`overview-fact-value overview-fact-value-${tone}`}>{value}</strong>
    <small>{detail}</small>
  </div>
);

const WATCH_LINKS: ReadonlyArray<{ section: WatchRouteSection; label: string; to: string; tour: string }> = [
  { section: "overview", label: "Overview", to: "/", tour: "overview" },
  { section: "setup", label: "Setup", to: "/setup", tour: "setup" },
  { section: "incidents", label: "Incidents", to: "/incidents", tour: "incidents" },
];

const WatchNavigation = ({ section }: { section: WatchRouteSection }) => (
  <nav className="section-tabs" aria-label="Watch sections">
    {WATCH_LINKS.map((item) => (
      <Link
        key={item.section}
        className={section === item.section ? "section-tab active" : "section-tab"}
        to={item.to}
        aria-current={section === item.section ? "page" : undefined}
        data-tour={item.tour}
      >
        {item.label}
      </Link>
    ))}
  </nav>
);

const EvidenceStep = ({ number, title, detail, state }: { number: number; title: string; detail: string; state: Tone }) => (
  <div className="evidence-step" role="listitem">
    <span className={`evidence-step-marker evidence-step-${state}`} aria-hidden="true">{number}</span>
    <div className="evidence-step-copy"><strong>{title}</strong><span>{detail}</span></div>
  </div>
);

export const Dashboard = ({ initialSection = "overview" }: DashboardProps) => {
  const section = initialSection;
  const { preferences } = useSlaPreferences();
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
      return { id: textValue(row.display_id, `problem-${index + 1}`), title: textValue(row.title, "Untitled problem"), status: textValue(row.status, "UNKNOWN").toUpperCase(), category: textValue(row.category, "UNKNOWN"), affectedEntityIds: stringArray(row.affected_entity_ids), hasRootCause: typeof row.root_cause_entity_id === "string" && row.root_cause_entity_id.length > 0, startedAt: optionalText(row.start_time), endedAt: optionalText(row.end_time) };
    });
  }, [problemData?.records]);

  const activeProblems = problems.filter((problem) => problem.status === "ACTIVE").length;
  const logCount = firstCount(logsData, "log_count");
  const spanCount = firstCount(spansData, "span_count");
  const selectedProviderSlug = directoryData?.provider.slug ?? providerSlug;
  const providerLabels = useMemo(() => Array.from(new Set(services.flatMap((service) => service.tags.map((tag) => providerTagValue(tag, providerLabelKey, selectedProviderSlug)).filter((value): value is string => Boolean(value))))), [providerLabelKey, selectedProviderSlug, services]);
  const matchedProviderServices = services.filter((service) => service.tags.some((tag) => providerTagValue(tag, providerLabelKey, selectedProviderSlug) === selectedProviderSlug)).length;

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
    ? { tone: "neutral" as Tone, title: "Checking provider identity", detail: `Loading the ${providerSlug} contract before evaluating tags.` }
    : !directoryData
      ? { tone: "warning" as Tone, title: "Directory unavailable", detail: directoryError?.message ?? "Load a provider contract before checking provider identity." }
      : telemetryLoading
        ? { tone: "neutral" as Tone, title: "Waiting for service inventory", detail: "Provider matching will be evaluated after the tenant service list finishes loading." }
        : telemetryError
          ? { tone: "warning" as Tone, title: "Provider check blocked", detail: "Telemetry access is incomplete, so provider tagging cannot be judged reliably yet." }
          : services.length === 0 && telemetrySignalsPresent
            ? { tone: "warning" as Tone, title: "Identify service first", detail: "The tenant has telemetry, but the affected service inventory is incomplete. Provider tagging cannot be evaluated yet." }
            : services.length === 0
              ? { tone: "warning" as Tone, title: "No service entities", detail: "There is no service inventory to tag. Fix instrumentation or entity access before identifying a provider." }
              : providerLabels.length === 0
                ? { tone: "warning" as Tone, title: "Provider tags missing", detail: `Services exist, but no explicit provider tag was found. Review the services that depend on ${directoryData.provider.name} in Setup.` }
                : matchedProviderServices > 0
                  ? { tone: "positive" as Tone, title: "Provider identified", detail: `${matchedProviderServices} service${matchedProviderServices === 1 ? "" : "s"} carry an explicit ${directoryData.provider.name} tag. This still does not prove a provider outage.` }
                  : { tone: "warning" as Tone, title: "Provider identification needed", detail: `Provider tags were found (${providerLabels.slice(0, 3).join(", ")}), but none resolve to ${directoryData.provider.name}. Select the correct provider or update the Dynatrace tags.` };

  const claimReadiness = telemetryLoading || directoryLoading
    ? { tone: "neutral" as Tone, value: "Checking", detail: "Waiting for the evidence path to settle." }
    : telemetryError || !directoryData
      ? { tone: "warning" as Tone, value: "Blocked", detail: "Access or contract lookup must be repaired first." }
      : !telemetrySignalsPresent
        ? { tone: "warning" as Tone, value: "Needs telemetry", detail: "No recent signal supports an evidence review." }
        : services.length === 0
          ? { tone: "warning" as Tone, value: "Needs service boundary", detail: "No service entity is available for attribution." }
          : providerLabels.length === 0
            ? { tone: "warning" as Tone, value: "Needs setup", detail: "Identify which services depend on the selected provider." }
            : matchedProviderServices === 0
              ? { tone: "warning" as Tone, value: "Needs mapping", detail: "Detected provider tags do not match the selected contract." }
              : activeProblems === 0
                ? { tone: "neutral" as Tone, value: "No incident in scope", detail: "The provider is identified, but there is no active Problem in scope." }
                : { tone: "positive" as Tone, value: "Candidate", detail: "A human review can compare the active Problem with the provider contract." };

  const providerName = directoryData?.provider.name ?? providerSlug;
  const overviewAssessment = telemetryLoading || directoryLoading
    ? {
        title: "Checking this environment",
        detail: "Dynatrace telemetry and the selected provider contract are still loading.",
        action: "Open setup",
        href: "/setup",
      }
    : telemetryError
      ? {
          title: "Complete the Dynatrace evidence read",
          detail: telemetryState.detail,
          action: "Review app access",
          href: "/setup",
        }
      : !directoryData
        ? {
            title: "Restore the provider contract connection",
            detail: directoryError?.message ?? `The ${providerSlug} contract could not be loaded from sla.directory.`,
            action: "Review provider connection",
            href: "/setup",
          }
        : !telemetrySignalsPresent
          ? {
              title: "Add a recent service signal",
              detail: `No Problems, logs, spans, or service request series were detected in the last ${lookbackHours} hours.`,
              action: "Review evidence scope",
              href: "/setup",
            }
          : services.length === 0
            ? {
                title: "Expose the affected service boundary",
                detail: "Telemetry is present, but no service entities were returned. Provider attribution should wait until the service boundary is visible.",
                action: "Review service access",
                href: "/settings/watch",
              }
            : providerLabels.length === 0
              ? {
                  title: `Identify which services depend on ${providerName}`,
                  detail: `${services.length} service${services.length === 1 ? " is" : "s are"} visible, but no explicit provider tag was found.`,
                  action: "Continue setup",
                  href: "/setup",
                }
              : matchedProviderServices === 0
                ? {
                    title: `Resolve provider tags to ${providerName}`,
                    detail: `${providerLabels.length} provider tag${providerLabels.length === 1 ? " is" : "s are"} visible, but none resolves to the selected contract.`,
                    action: "Resolve provider mapping",
                    href: "/setup",
                  }
                : activeProblems === 0
                  ? {
                      title: "No incident requires provider review",
                      detail: `${matchedProviderServices} service${matchedProviderServices === 1 ? " matches" : "s match"} ${providerName}. No active Problems were found in the last ${lookbackHours} hours.`,
                      action: "Review provider terms",
                      href: "/directory",
                    }
                  : {
                      title: "Review the active Problem before considering a claim",
                      detail: `${activeProblems} active Problem${activeProblems === 1 ? "" : "s"} and ${matchedProviderServices} provider-matched service${matchedProviderServices === 1 ? "" : "s"} require human review.`,
                      action: "Review incident evidence",
                      href: "/incidents",
                    };

  const setupStatus = telemetryLoading || directoryLoading
    ? "Checking setup"
    : telemetryError
      ? "Access incomplete"
      : !directoryData
        ? "Contract unavailable"
        : matchedProviderServices > 0
          ? activeProblems > 0 ? "Review available" : "Boundary ready"
          : "Action required";

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
        <div className="hero-copy-block">
          <Heading level={1}>Provider SLA watch</Heading>
          <Paragraph className="hero-copy">Monitor provider mapping, Dynatrace Problems, and filing windows for this environment.</Paragraph>
        </div>
        <div className="hero-actions">
          <div className="hero-status-line">
            <StatusPill tone={directoryLoading ? "neutral" : directoryData ? "positive" : "warning"}>
              {slaDirectoryConnection.source}: {directoryLoading ? "checking" : directoryData ? "connected" : "unavailable"}
            </StatusPill>
            <span>Watching <strong>{providerName}</strong></span>
          </div>
          <Button variant="emphasized" onClick={handleRefresh} disabled={telemetryLoading || directoryLoading} size="condensed">
            {telemetryLoading || directoryLoading ? "Refreshing" : "Refresh watch"}
          </Button>
          <Link className="text-action" to="/settings/watch">Configure watch</Link>
        </div>
      </section>

      {section !== "directory" ? <WatchNavigation section={section} /> : null}

      <div className={`watch-view watch-view-${section}`}>
        {section === "overview" ? (
          <Surface className={`panel-card overview-status-panel overview-status-panel-${claimReadiness.tone}`} data-tour="overview-status">
            <div className="overview-status-main">
              <div className="overview-status-copy">
                <StatusPill tone={claimReadiness.tone}>{claimReadiness.value}</StatusPill>
                <Heading level={2}>{overviewAssessment.title}</Heading>
                <Paragraph>{overviewAssessment.detail}</Paragraph>
              </div>
              <div className="overview-status-actions">
                <Button className="overview-primary-action" as={Link} to={overviewAssessment.href} variant="emphasized" color="primary">
                  {overviewAssessment.action}
                </Button>
                {overviewAssessment.href !== "/setup" && setupRecommendations.length > 0 ? (
                  <Link className="text-action" to="/setup">View {setupRecommendations.length} setup check{setupRecommendations.length === 1 ? "" : "s"}</Link>
                ) : setupRecommendations.length > 0 ? (
                  <Text className="overview-check-count">{setupRecommendations.length} setup check{setupRecommendations.length === 1 ? "" : "s"} open</Text>
                ) : null}
              </div>
            </div>
            <div className="overview-facts" aria-label="Current watch facts">
              <OverviewFact
                label="Provider"
                value={directoryLoading ? "Checking" : directoryData ? providerName : "Unavailable"}
                detail={directoryData ? "contract record loaded" : "sla.directory connection"}
                tone={directoryLoading ? "neutral" : directoryData ? "positive" : "warning"}
              />
              <OverviewFact
                label="Services mapped"
                value={servicesLoading ? "Checking" : `${matchedProviderServices} / ${services.length}`}
                detail="explicit provider boundary"
                tone={servicesLoading ? "neutral" : matchedProviderServices > 0 ? "positive" : "warning"}
              />
              <OverviewFact
                label="Incidents"
                value={problemsLoading ? "Checking" : `${activeProblems} active`}
                detail={`${problems.length} observed in ${lookbackHours}h`}
                tone={problemsLoading ? "neutral" : activeProblems > 0 ? "warning" : "neutral"}
              />
              <OverviewFact
                label="Filing window"
                value={directoryData?.provider.claimProcess?.deadlineDays ? `${directoryData.provider.claimProcess.deadlineDays} days` : "Not published"}
                detail={directoryData?.provider.claimProcess?.businessDays ? "provider business days" : "provider calendar days"}
                tone={directoryData?.provider.claimProcess?.deadlineDays ? "positive" : "neutral"}
              />
            </div>
            <div className="overview-boundary-note"><strong>Assessment boundary</strong><span>Dynatrace provides observed tenant evidence. The provider determines fault, eligibility, and any service credit.</span></div>
          </Surface>
        ) : section === "setup" ? (
          <Surface className="panel-card setup-panel">
            <div className="setup-heading">
              <div><Heading level={2}>Setup</Heading><Paragraph>Complete the provider boundary once, then use Overview and Incidents for daily review.</Paragraph></div>
              <StatusPill tone={claimReadiness.tone}>{setupStatus}</StatusPill>
            </div>
            <div className="evidence-ladder" role="list" aria-label="SLA Watch setup stages">
              <EvidenceStep number={1} title="Telemetry" detail={telemetryState.title} state={telemetryState.tone} />
              <EvidenceStep number={2} title="Services" detail={servicesLoading ? "Checking inventory" : `${services.length} detected`} state={services.length > 0 && !servicesLoading ? "positive" : telemetryLoading ? "neutral" : "warning"} />
              <EvidenceStep number={3} title="Provider tags" detail={directoryLoading ? "Checking mapping" : `${matchedProviderServices} mapped`} state={matchedProviderServices > 0 && !directoryLoading ? "positive" : providerState.tone} />
              <EvidenceStep number={4} title="Contract" detail={directoryData ? `${providerName} loaded` : "Unavailable"} state={directoryData ? "positive" : "neutral"} />
            </div>
            {telemetryError ? <div className="error-box setup-error">Telemetry scan incomplete. Check the current user's data access.</div> : null}
            <div className="setup-content-grid">
              <ProviderTagSetup services={services} providerName={providerName} providerSlug={selectedProviderSlug} providerTagKey={providerLabelKey} loading={servicesLoading || directoryLoading} onRefresh={() => refetchServices()} />
              <SetupAdvisor recommendations={setupRecommendations} loading={telemetryLoading || directoryLoading} limitedContext={Boolean(telemetryError || (services.length === 0 && telemetrySignalsPresent))} />
            </div>
          </Surface>
        ) : section === "directory" ? (
          <Surface className="panel-card directory-panel"><div className="panel-heading-row"><div><Text className="eyebrow">Provider and service map</Text><Heading level={2}>Provider directory</Heading></div><StatusPill tone={directoryLoading ? "neutral" : directoryData ? "positive" : "warning"}>{directoryLoading ? "Checking" : directoryData ? `${directoryData.provider.name} connected` : "Directory unavailable"}</StatusPill></div><Paragraph>{directoryData ? `${directoryData.provider.name} has ${directoryData.services.length} service records. These are contractual targets, not measured tenant availability.` : directoryError ? `${directoryError.message}. Check the environment External requests allowlist.` : "Loading provider data..."}</Paragraph>{serviceError ? <div className="error-box">Dynatrace service inventory could not be loaded: {serviceError.message}</div> : null}{directoryData ? <div className="service-table" role="table" aria-label="Provider SLA services"><div className="service-row service-row-header" role="row"><span>Provider service</span><span>Target</span><span>Contract record</span><span>Verification</span></div>{directoryData.services.slice(0, 20).map((service) => <div className="service-row" role="row" key={service.id}><div><strong>{service.name}</strong><small>{service.id}</small></div><span>{service.uptime ? `${service.uptime}%` : "No target"}</span><StatusPill tone={service.eligible ? "positive" : "neutral"}>{service.eligible ? "Published SLA" : "Reference"}</StatusPill><span>{directoryData.provider.lastVerified}</span></div>)}</div> : null}<div className="directory-footer"><span>Need a different provider or tag convention?</span><Link className="inline-action" to="/settings/watch">Open watch settings</Link></div>{servicesLoading || directoryLoading ? <div className="empty-state">Loading watch data...</div> : null}</Surface>
        ) : (
          <IncidentReview provider={directoryData} problems={problems} services={services} lookbackHours={lookbackHours} loading={problemsLoading} error={problemError ?? undefined} />
        )}
      </div>
    </div>
  );
};
