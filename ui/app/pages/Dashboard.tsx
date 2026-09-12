import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAppFunction, useDql } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import { Surface } from "@dynatrace/strato-components/layouts";
import {
  Heading,
  Paragraph,
} from "@dynatrace/strato-components/typography";
import { EvidenceWorkspace } from "../components/EvidenceWorkspace";
import { IncidentReview } from "../components/IncidentReview";
import { CoverageWorkspace } from "../components/CoverageWorkspace";
import { ProviderDirectoryWorkspace } from "../components/ProviderDirectoryWorkspace";
import { useSlaPreferences } from "../context/SlaPreferencesContext";
import { useProviderConnections } from "../hooks/useProviderConnections";
import { useProviderScopeAssignments } from "../hooks/useProviderScopeAssignments";
import { detectedProviderTagSlugs, providerTagValue } from "../data/providerTags";
import { buildSetupRecommendations } from "../data/recommendations";
import { formatEvidenceLookback } from "../data/lookback";
import {
  buildProviderCandidates,
  mergeServiceInventory,
} from "../data/providerAttribution";
import {
  resolveProviderServiceCandidates,
  createProviderScopeAssignmentKey,
  isServiceScopeAssignment,
  runtimeEntityIdForEdge,
  serviceEntityIdForEdge,
} from "../data/providerScopeAssignments";
import { providerDisplayName, resolveEnvironmentProviderSlugs } from "../data/providers";
import {
  detectedProviderSlugs,
  mergeSmartscapeScopeEdges,
  parseServiceCloudContexts,
  parseSmartscapeScopeEdges,
} from "../data/topology";
import {
  INCIDENT_SERVICE_FILTER_LIMIT,
  INCIDENT_SMARTSCAPE_RESULT_LIMIT,
  SERVICE_INVENTORY_COUNT_QUERY,
  SERVICE_RESULT_LIMIT,
  SMARTSCAPE_COVERAGE_COUNT_QUERY,
  SMARTSCAPE_RESULT_LIMIT,
  createIncidentServicesQuery,
  createIncidentSmartscapeQuery,
  createLogsCountQuery,
  createProblemsQuery,
  createServiceMetricsQuery,
  createSpansCountQuery,
  SERVICES_QUERY,
  SMARTSCAPE_SERVICE_RUNTIME_QUERY,
} from "../data/queries";
import {
  type ProblemRecord,
  type CoverageInventoryStatus,
  type ServiceRecord,
  type SlaProviderResponse,
  type WatchSection,
} from "../types";

type DashboardProps = { initialSection?: WatchSection };
type Tone = "neutral" | "warning" | "positive";

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
const textValue = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback;
const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;
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

const parseServiceRecords = (
  data: { records?: unknown[] } | undefined,
): ServiceRecord[] => {
  const records = Array.isArray(data?.records) ? data.records : [];
  return records.map((record: unknown, index: number) => {
    const row = asRecord(record);
    return {
      id: textValue(row.id, `service-${index + 1}`),
      name: textValue(row.name, "Unnamed service"),
      type: textValue(row.type, "SERVICE"),
      tags: stringArray(row.tags),
    };
  });
};

const firstCount = (
  data: { records?: unknown[] } | undefined,
  field: string,
): number | null => {
  const first = Array.isArray(data?.records) ? asRecord(data.records[0]) : {};
  const value = first[field];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value)))
    return Number(value);
  return null;
};

const resultRecordCount = (data: { records?: unknown[] } | undefined): number =>
  Array.isArray(data?.records) ? data.records.length : 0;

const hasSignalValue = (value: unknown): boolean =>
  Array.isArray(value)
    ? value.some(hasSignalValue)
    : value !== null && value !== undefined;
const hasMetricSeries = (
  data: { records?: unknown[] } | undefined,
): boolean => {
  const records = Array.isArray(data?.records) ? data.records : [];
  return records.some((record) =>
    hasSignalValue(asRecord(record).request_count),
  );
};

const StatusPill = ({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) => <span className={`status-pill status-pill-${tone}`}>{children}</span>;

const OverviewFact = ({
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

const WATCH_LINKS: ReadonlyArray<{
  section: WatchSection;
  label: string;
  to: string;
  tour: string;
}> = [
  { section: "coverage", label: "Coverage", to: "/", tour: "coverage" },
  {
    section: "incidents",
    label: "Incidents",
    to: "/incidents",
    tour: "incidents",
  },
  {
    section: "evidence",
    label: "Evidence",
    to: "/evidence",
    tour: "evidence",
  },
];

const WatchNavigation = ({ section }: { section: WatchSection }) => (
  <nav className="section-tabs" aria-label="Review sections">
    {WATCH_LINKS.map((item) => (
      <Link
        key={item.section}
        className={
          section === item.section ? "section-tab active" : "section-tab"
        }
        to={item.to}
        aria-current={section === item.section ? "page" : undefined}
        data-tour={item.tour}
      >
        {item.label}
      </Link>
    ))}
    <span
      className="section-tab-future"
      title="Planned for a future AppEngine agent release"
    >
      <button
        type="button"
        className="section-tab section-tab-disabled"
        disabled
        aria-label="FinOps Agent, planned for a future AppEngine agent release"
      >
        FinOps Agent
        <span className="section-tab-status" aria-hidden="true">
          Planned
        </span>
      </button>
    </span>
  </nav>
);

export const Dashboard = ({ initialSection = "coverage" }: DashboardProps) => {
  const section = initialSection;
  const location = useLocation();
  const evidenceView =
    new URLSearchParams(location.search).get("view") === "provider-reports"
      ? "provider-reports"
      : "candidates";
  const { preferences, updatePreferences } = useSlaPreferences();
  const scopeSettings = useProviderScopeAssignments();
  const providerConnections = useProviderConnections();
  const {
    providerSlug: requestedProviderSlug,
    providerLabelKey,
    lookbackHours,
  } = preferences;
  const problemsQuery = useMemo(
    () => createProblemsQuery(lookbackHours),
    [lookbackHours],
  );
  const logsQuery = useMemo(
    () => createLogsCountQuery(lookbackHours),
    [lookbackHours],
  );
  const spansQuery = useMemo(
    () => createSpansCountQuery(lookbackHours),
    [lookbackHours],
  );
  const metricsQuery = useMemo(
    () => createServiceMetricsQuery(lookbackHours),
    [lookbackHours],
  );
  const {
    data: serviceData,
    error: serviceError,
    isLoading: servicesLoading,
  } = useDql({ query: SERVICES_QUERY });
  const serviceCountQuery = useDql({ query: SERVICE_INVENTORY_COUNT_QUERY });
  const {
    data: problemData,
    error: problemError,
    isLoading: problemsLoading,
  } = useDql({ query: problemsQuery });
  const {
    data: logsData,
    error: logsError,
    isLoading: logsLoading,
  } = useDql({ query: logsQuery });
  const {
    data: spansData,
    error: spansError,
    isLoading: spansLoading,
  } = useDql({ query: spansQuery });
  const {
    data: metricsData,
    error: metricsError,
    isLoading: metricsLoading,
  } = useDql({ query: metricsQuery });
  const topologyQuery = useDql({ query: SMARTSCAPE_SERVICE_RUNTIME_QUERY });
  const topologyCountQuery = useDql({ query: SMARTSCAPE_COVERAGE_COUNT_QUERY });
  const globalEntityServices = useMemo<ServiceRecord[]>(
    () => parseServiceRecords(serviceData),
    [serviceData],
  );

  const problems = useMemo<ProblemRecord[]>(() => {
    const records = Array.isArray(problemData?.records)
      ? problemData.records
      : [];
    return records.map((record: unknown, index: number) => {
      const row = asRecord(record);
      return {
        id: textValue(row.display_id, `problem-${index + 1}`),
        title: textValue(row.title, "Untitled problem"),
        status: textValue(row.status, "UNKNOWN").toUpperCase(),
        category: textValue(row.category, "UNKNOWN"),
        affectedEntityIds: stringArray(row.affected_entity_ids),
        hasRootCause:
          typeof row.root_cause_entity_id === "string" &&
          row.root_cause_entity_id.length > 0,
        startedAt: optionalText(row.start_time),
        endedAt: optionalText(row.end_time),
      };
    });
  }, [problemData?.records]);

  const allAffectedServiceIds = useMemo(
    () => Array.from(new Set(
      problems
        .flatMap((problem) => problem.affectedEntityIds)
        .map((id) => id.trim().toUpperCase())
        .filter((id) => /^SERVICE-[A-F0-9]+$/.test(id)),
    )),
    [problems],
  );
  const affectedServiceIds = useMemo(
    () => allAffectedServiceIds.slice(0, INCIDENT_SERVICE_FILTER_LIMIT),
    [allAffectedServiceIds],
  );
  const incidentTopologyQueryText = useMemo(
    () => createIncidentSmartscapeQuery(affectedServiceIds),
    [affectedServiceIds],
  );
  const incidentServicesQueryText = useMemo(
    () => createIncidentServicesQuery(affectedServiceIds),
    [affectedServiceIds],
  );
  const incidentTopologyQuery = useDql(
    { query: incidentTopologyQueryText },
    { enabled: affectedServiceIds.length > 0 },
  );
  const incidentServicesQuery = useDql(
    { query: incidentServicesQueryText },
    { enabled: affectedServiceIds.length > 0 },
  );
  const incidentEntityServices = useMemo<ServiceRecord[]>(
    () => parseServiceRecords(incidentServicesQuery.data),
    [incidentServicesQuery.data],
  );
  const entityServices = useMemo<ServiceRecord[]>(() => {
    const merged = new Map<string, ServiceRecord>();
    [...globalEntityServices, ...incidentEntityServices].forEach((service) =>
      merged.set(service.id, service),
    );
    return Array.from(merged.values());
  }, [globalEntityServices, incidentEntityServices]);

  const coverageTopology = useMemo(
    () => parseSmartscapeScopeEdges(topologyQuery.data),
    [topologyQuery.data],
  );
  const incidentTopology = useMemo(
    () => parseSmartscapeScopeEdges(incidentTopologyQuery.data),
    [incidentTopologyQuery.data],
  );
  const topology = useMemo(
    () => mergeSmartscapeScopeEdges(coverageTopology, incidentTopology),
    [coverageTopology, incidentTopology],
  );
  const serviceCloudContexts = useMemo(
    () => parseServiceCloudContexts(metricsData),
    [metricsData],
  );
  const providerEvidence = useMemo(
    () => mergeSmartscapeScopeEdges(topology, serviceCloudContexts),
    [serviceCloudContexts, topology],
  );
  const services = useMemo(
    () => mergeServiceInventory(entityServices, providerEvidence),
    [entityServices, providerEvidence],
  );
  const topologyDetectedProviders = useMemo(
    () => detectedProviderSlugs(providerEvidence),
    [providerEvidence],
  );
  const tagDetectedProviders = useMemo(
    () => detectedProviderTagSlugs(services.map((service) => service.tags), providerLabelKey),
    [providerLabelKey, services],
  );
  const assignedProviders = useMemo(
    () => scopeSettings.assignments
      .filter((assignment) => assignment.enabled)
      .map((assignment) => assignment.providerSlug),
    [scopeSettings.assignments],
  );
  const connectedProviders = useMemo(
    () => providerConnections.connections
      .filter((connection) => connection.enabled)
      .map((connection) => connection.providerSlug),
    [providerConnections.connections],
  );
  const enabledProviderSlugs = useMemo(
    () => resolveEnvironmentProviderSlugs({
      detected: topologyDetectedProviders,
      tagged: tagDetectedProviders,
      assigned: assignedProviders,
      connected: connectedProviders,
      fallback: requestedProviderSlug,
    }),
    [
      assignedProviders,
      connectedProviders,
      requestedProviderSlug,
      tagDetectedProviders,
      topologyDetectedProviders,
    ],
  );
  const providerSlug = enabledProviderSlugs.includes(requestedProviderSlug)
    ? requestedProviderSlug
    : enabledProviderSlugs[0] ?? requestedProviderSlug;
  const directoryRequest = useMemo(
    () => ({ vendor: providerSlug }),
    [providerSlug],
  );
  const directoryQuery = useAppFunction<SlaProviderResponse>({
    name: "slaDirectory",
    data: directoryRequest,
    responseType: "json",
  });
  const directoryData =
    directoryQuery.data?.provider.slug === providerSlug
      ? directoryQuery.data
      : undefined;
  const directoryError = directoryQuery.error;
  const directoryLoading =
    directoryQuery.isLoading ||
    Boolean(!directoryQuery.error && directoryQuery.data && !directoryData);
  const providerCandidates = useMemo(
    () => buildProviderCandidates(services, providerEvidence),
    [providerEvidence, services],
  );

  const activeProblems = problems.filter(
    (problem) => problem.status === "ACTIVE",
  ).length;
  const logCount = firstCount(logsData, "log_count");
  const spanCount = firstCount(spansData, "span_count");
  const selectedProviderSlug = directoryData?.provider.slug ?? providerSlug;
  const providerLabels = useMemo(
    () =>
      Array.from(
        new Set(
          services.flatMap((service) =>
            service.tags
              .map((tag) =>
                providerTagValue(tag, providerLabelKey, selectedProviderSlug),
              )
              .filter((value): value is string => Boolean(value)),
          ),
        ),
      ),
    [providerLabelKey, selectedProviderSlug, services],
  );
  const taggedProviderServiceIds = useMemo(
    () =>
      new Set(
        services
          .filter((service) =>
            service.tags.some(
              (tag) =>
                providerTagValue(
                  tag,
                  providerLabelKey,
                  selectedProviderSlug,
                ) === selectedProviderSlug,
            ),
          )
          .map((service) => service.id),
      ),
    [providerLabelKey, selectedProviderSlug, services],
  );
  const confirmedScopeServiceIds = useMemo(() => {
    const currentScopeKeys = new Set(
      providerEvidence.map((edge) =>
        createProviderScopeAssignmentKey(
          selectedProviderSlug,
          serviceEntityIdForEdge(edge),
          runtimeEntityIdForEdge(edge),
        ),
      ),
    );
    return new Set(
      scopeSettings.assignments
        .filter(
          (assignment) =>
            assignment.enabled &&
            assignment.providerSlug === selectedProviderSlug &&
            (isServiceScopeAssignment(assignment) ||
              currentScopeKeys.has(assignment.assignmentKey)),
        )
        .map((assignment) => assignment.serviceEntityId),
    );
  }, [providerEvidence, scopeSettings.assignments, selectedProviderSlug]);
  const observedProviderServiceIds = useMemo(() => {
    if (!directoryData) return new Set<string>();
    return new Set(Array.from(
      resolveProviderServiceCandidates(providerEvidence, directoryData).entries(),
    ).flatMap(([serviceId, resolution]) =>
      resolution.candidate?.confidence === "observed" && !resolution.ambiguous
        ? [serviceId]
        : [],
    ));
  }, [directoryData, providerEvidence]);
  const matchedProviderServices = services.filter(
    (service) =>
      taggedProviderServiceIds.has(service.id) ||
      confirmedScopeServiceIds.has(service.id) ||
      observedProviderServiceIds.has(service.id),
  ).length;
  const taggedProviderServices = taggedProviderServiceIds.size;
  const activeProviderCandidates = providerCandidates.filter(
    (candidate) => candidate.providerSlug === selectedProviderSlug,
  );
  const suggestedServiceCount = new Set(
    activeProviderCandidates
      .filter((candidate) =>
        services.some(
          (service) =>
            service.id === candidate.serviceId &&
            !taggedProviderServiceIds.has(service.id) &&
            !confirmedScopeServiceIds.has(service.id) &&
            !observedProviderServiceIds.has(service.id),
        ),
      )
      .map((candidate) => candidate.serviceId),
  ).size;

  const serviceTotal = firstCount(serviceCountQuery.data, "service_count");
  const relationshipTotal = firstCount(topologyCountQuery.data, "relationship_count");
  const loadedServiceRecords = resultRecordCount(serviceData);
  const loadedRelationshipRecords = resultRecordCount(topologyQuery.data);
  const serviceInventoryIncomplete = serviceTotal !== null
    ? serviceTotal > loadedServiceRecords
    : loadedServiceRecords >= SERVICE_RESULT_LIMIT;
  const topologyInventoryIncomplete = relationshipTotal !== null
    ? relationshipTotal > loadedRelationshipRecords
    : loadedRelationshipRecords >= SMARTSCAPE_RESULT_LIMIT;
  const incidentTopologyIncomplete =
    allAffectedServiceIds.length > affectedServiceIds.length ||
    resultRecordCount(incidentTopologyQuery.data) >= INCIDENT_SMARTSCAPE_RESULT_LIMIT;
  const inventoryUnverified = Boolean(serviceCountQuery.error || topologyCountQuery.error);
  const inventoryReasons = [
    serviceInventoryIncomplete
      ? `${loadedServiceRecords.toLocaleString()} of ${serviceTotal?.toLocaleString() ?? `more than ${SERVICE_RESULT_LIMIT.toLocaleString()}`} services loaded`
      : null,
    topologyInventoryIncomplete
      ? `${loadedRelationshipRecords.toLocaleString()} of ${relationshipTotal?.toLocaleString() ?? `more than ${SMARTSCAPE_RESULT_LIMIT.toLocaleString()}`} preferred Smartscape relationships loaded`
      : null,
    incidentTopologyIncomplete
      ? "The recent Problem scope exceeded the bounded incident topology query"
      : null,
    scopeSettings.incomplete
      ? `${scopeSettings.assignments.length.toLocaleString()} of ${scopeSettings.totalCount.toLocaleString()} saved mappings loaded`
      : null,
  ].filter((value): value is string => Boolean(value));
  const inventoryStatus: CoverageInventoryStatus = {
    serviceTotal,
    loadedServices: loadedServiceRecords,
    relationshipTotal,
    loadedRelationships: loadedRelationshipRecords,
    incomplete: inventoryReasons.length > 0,
    unverified: inventoryUnverified,
    reasons: inventoryReasons,
  };

  const telemetryLoading =
    servicesLoading ||
    incidentServicesQuery.isLoading ||
    problemsLoading ||
    logsLoading ||
    spansLoading ||
    metricsLoading;
  const inventoryLoading = serviceCountQuery.isLoading || topologyCountQuery.isLoading;
  const telemetryError =
    serviceError ?? incidentServicesQuery.error ?? problemError ?? logsError ?? spansError ?? metricsError;
  const telemetrySignalsPresent =
    problems.length > 0 ||
    (logCount !== null && logCount > 0) ||
    (spanCount !== null && spanCount > 0) ||
    hasMetricSeries(metricsData);
  const providerName = directoryData?.provider.name ?? providerSlug;
  const coverageStatus =
    telemetryLoading ||
    inventoryLoading ||
    directoryLoading ||
    topologyQuery.isLoading ||
    scopeSettings.loading
      ? "Checking coverage"
      : telemetryError
        ? "Access incomplete"
        : !directoryData
          ? "Contract unavailable"
          : inventoryStatus.incomplete || inventoryStatus.unverified
            ? "Inventory incomplete"
          : matchedProviderServices > 0
            ? activeProblems > 0
              ? "Review available"
              : "Boundary ready"
            : "Action required";
  const coverageTone: Tone =
    telemetryLoading || inventoryLoading || directoryLoading || topologyQuery.isLoading || scopeSettings.loading
      ? "neutral"
      : telemetryError || !directoryData || inventoryStatus.incomplete || inventoryStatus.unverified
        ? "warning"
        : matchedProviderServices > 0
          ? "positive"
          : "warning";

  const setupRecommendations = useMemo(
    () =>
      buildSetupRecommendations({
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
        taggedProviderServices,
        providerCandidateServices: suggestedServiceCount,
      }),
    [
      directoryData,
      directoryError,
      matchedProviderServices,
      problems,
      providerLabelKey,
      providerLabels,
      selectedProviderSlug,
      services,
      suggestedServiceCount,
      taggedProviderServices,
      telemetryError,
      telemetrySignalsPresent,
    ],
  );

  return (
    <div className="dashboard-shell">
      <section className="hero-row">
        <div className="hero-copy-block">
          <Heading level={1}>Provider review</Heading>
          <Paragraph className="hero-copy">
            Review provider mapping, Dynatrace Problems, and filing windows for
            this environment.
          </Paragraph>
        </div>
        <div className="hero-actions">
          <label className="hero-provider">
            <span>Active provider</span>
            <select
              value={providerSlug}
              onChange={(event) =>
                void updatePreferences({ providerSlug: event.target.value })
              }
              aria-label="Active provider"
              title="Providers detected from this environment"
            >
              {enabledProviderSlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {providerDisplayName(slug)}
                </option>
              ))}
            </select>
          </label>
          <nav className="hero-action-buttons" aria-label="Workspace tools">
            <Button
              className={`hero-tool-button${section === "directory" ? " active" : ""}`}
              as={Link}
              to="/directory"
              size="condensed"
              data-tour="directory"
              aria-current={section === "directory" ? "page" : undefined}
            >
              Review terms
            </Button>
          </nav>
        </div>
      </section>

      <WatchNavigation section={section} />

      <div className={`watch-view watch-view-${section}`}>
        {section === "coverage" ? (
          <Surface className="panel-card setup-panel coverage-panel">
            <div className="setup-heading" data-tour="coverage-summary">
              <div>
                <Heading level={2}>Coverage</Heading>
                <Paragraph>
                  Confirm which provider service applies to each Dynatrace
                  service and runtime.
                </Paragraph>
              </div>
              <StatusPill tone={coverageTone}>{coverageStatus}</StatusPill>
            </div>
            <div className="overview-facts coverage-facts" aria-label="Coverage status">
              <OverviewFact
                label="Providers"
                value={`${enabledProviderSlugs.length}`}
                detail={
                  directoryLoading
                    ? `checking ${providerDisplayName(providerSlug)}`
                    : directoryData
                      ? `${providerName} selected`
                      : `${providerDisplayName(providerSlug)} unavailable`
                }
                tone={
                  directoryLoading
                    ? "neutral"
                    : directoryData
                      ? "positive"
                      : "warning"
                }
              />
              <OverviewFact
                label="Provider scope"
                value={
                  servicesLoading || inventoryLoading || scopeSettings.loading
                    ? "Checking"
                    : `${matchedProviderServices.toLocaleString()} service${matchedProviderServices === 1 ? "" : "s"}`
                }
                detail={
                  observedProviderServiceIds.size > 0
                    ? `${observedProviderServiceIds.size} matched from provider-native topology`
                  : suggestedServiceCount > 0
                    ? `${suggestedServiceCount} suggestion${suggestedServiceCount === 1 ? "" : "s"} to review`
                    : matchedProviderServices > 0
                      ? "confirmed scope or provider tag"
                      : `No loaded service evidence for ${providerName}`
                }
                tone={
                  servicesLoading || inventoryLoading || scopeSettings.loading
                    ? "neutral"
                    : inventoryStatus.incomplete || inventoryStatus.unverified
                      ? "warning"
                    : matchedProviderServices > 0
                      ? "positive"
                      : "warning"
                }
              />
              <OverviewFact
                label="Incidents"
                value={
                  problemsLoading ? "Checking" : `${activeProblems} active`
                }
                detail={`${problems.length} observed in ${formatEvidenceLookback(lookbackHours)}`}
                tone={
                  problemsLoading
                    ? "neutral"
                    : activeProblems > 0
                      ? "warning"
                      : "neutral"
                }
              />
              <OverviewFact
                label="Filing reference"
                value={
                  directoryData?.provider.claimProcess?.deadlineDays
                    ? `${directoryData.provider.claimProcess.deadlineDays} days`
                    : "Not published"
                }
                detail={
                  directoryData?.provider.claimProcess?.businessDays
                    ? "provider business days"
                    : "provider calendar days"
                }
                tone={
                  directoryData?.provider.claimProcess?.deadlineDays
                    ? "positive"
                    : "neutral"
                }
              />
            </div>
            {telemetryError ? (
              <div className="error-box setup-error">
                Telemetry scan incomplete. Check the current user's data access.
              </div>
            ) : null}
            <CoverageWorkspace
              provider={directoryData}
              topology={providerEvidence}
              services={services}
              problems={problems}
              providerTagKey={providerLabelKey}
              loading={servicesLoading || incidentServicesQuery.isLoading || topologyQuery.isLoading || incidentTopologyQuery.isLoading || directoryLoading}
              error={topologyQuery.error ?? directoryError ?? undefined}
              scopeSettings={scopeSettings}
              recommendations={setupRecommendations}
              recommendationsLoading={telemetryLoading || directoryLoading}
              limitedContext={Boolean(
                telemetryError ||
                  (services.length === 0 && telemetrySignalsPresent),
              )}
              inventory={inventoryStatus}
            />
          </Surface>
        ) : section === "directory" ? (
          <Surface className="panel-card directory-panel">
            <ProviderDirectoryWorkspace
              directory={directoryData}
              directoryLoading={directoryLoading}
              directoryError={directoryError ?? undefined}
              services={services}
              topology={providerEvidence}
              servicesLoading={servicesLoading || incidentServicesQuery.isLoading}
              serviceError={serviceError ?? incidentServicesQuery.error ?? undefined}
            />
          </Surface>
        ) : section === "incidents" ? (
          <IncidentReview
            provider={directoryData}
            problems={problems}
            services={services}
            topology={providerEvidence}
            topologyLoading={topologyQuery.isLoading || incidentTopologyQuery.isLoading}
            topologyError={topologyQuery.error ?? incidentTopologyQuery.error ?? undefined}
            lookbackHours={lookbackHours}
            onLookbackChange={(value) =>
              void updatePreferences({ lookbackHours: value })
            }
            loading={problemsLoading || incidentServicesQuery.isLoading}
            error={problemError ?? incidentServicesQuery.error ?? undefined}
          />
        ) : (
          <EvidenceWorkspace
            view={evidenceView}
            provider={directoryData}
            providerSlug={selectedProviderSlug}
            providerLabelKey={providerLabelKey}
            problems={problems}
            services={services}
            topology={providerEvidence}
            assignments={scopeSettings.assignments}
            lookbackHours={lookbackHours}
            loading={
              problemsLoading ||
              incidentServicesQuery.isLoading ||
              topologyQuery.isLoading ||
              incidentTopologyQuery.isLoading ||
              directoryLoading ||
              scopeSettings.loading
            }
            error={
              problemError ??
              incidentServicesQuery.error ??
              topologyQuery.error ??
              incidentTopologyQuery.error ??
              directoryError ??
              scopeSettings.error ??
              undefined
            }
          />
        )}
      </div>
    </div>
  );
};
