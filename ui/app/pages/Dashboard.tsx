import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAppFunction, useDql } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import { Surface } from "@dynatrace/strato-components/layouts";
import {
  Heading,
  Paragraph,
} from "@dynatrace/strato-components/typography";
import { SetupAdvisor } from "../components/SetupAdvisor";
import { EvidenceWorkspace } from "../components/EvidenceWorkspace";
import { IncidentReview } from "../components/IncidentReview";
import { ProviderTagSetup } from "../components/ProviderTagSetup";
import { ProviderScopeMap } from "../components/ProviderScopeMap";
import { ProviderDirectoryWorkspace } from "../components/ProviderDirectoryWorkspace";
import { useSlaPreferences } from "../context/SlaPreferencesContext";
import { useProviderScopeAssignments } from "../hooks/useProviderScopeAssignments";
import { providerTagValue } from "../data/providerTags";
import { buildSetupRecommendations } from "../data/recommendations";
import { formatEvidenceLookback } from "../data/lookback";
import {
  buildProviderCandidates,
  mergeServiceInventory,
} from "../data/providerAttribution";
import {
  createProviderScopeAssignmentKey,
  isServiceScopeAssignment,
  runtimeEntityIdForEdge,
  serviceEntityIdForEdge,
} from "../data/providerScopeAssignments";
import { providerDisplayName } from "../data/providers";
import {
  parseServiceCloudContexts,
  parseSmartscapeScopeEdges,
} from "../data/topology";
import {
  createLogsCountQuery,
  createProblemsQuery,
  createServiceMetricsQuery,
  createSpansCountQuery,
  SERVICES_QUERY,
  SMARTSCAPE_SERVICE_RUNTIME_QUERY,
} from "../data/queries";
import {
  type ProblemRecord,
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
  const coverageView =
    new URLSearchParams(location.search).get("view") === "tags"
      ? "tags"
      : "scope";
  const evidenceView =
    new URLSearchParams(location.search).get("view") === "provider-reports"
      ? "provider-reports"
      : "candidates";
  const { preferences, updatePreferences } = useSlaPreferences();
  const scopeSettings = useProviderScopeAssignments();
  const { providerSlugs, providerSlug, providerLabelKey, lookbackHours } =
    preferences;
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
  const directoryRequest = useMemo(
    () => ({ vendor: providerSlug }),
    [providerSlug],
  );

  const {
    data: serviceData,
    error: serviceError,
    isLoading: servicesLoading,
  } = useDql({ query: SERVICES_QUERY });
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

  const entityServices = useMemo<ServiceRecord[]>(() => {
    const records = Array.isArray(serviceData?.records)
      ? serviceData.records
      : [];
    return records.map((record: unknown, index: number) => {
      const row = asRecord(record);
      return {
        id: textValue(row.id, `service-${index + 1}`),
        name: textValue(row.name, "Unnamed service"),
        type: textValue(row.type, "SERVICE"),
        tags: stringArray(row.tags),
      };
    });
  }, [serviceData?.records]);

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

  const topology = useMemo(
    () => parseSmartscapeScopeEdges(topologyQuery.data),
    [topologyQuery.data],
  );
  const serviceCloudContexts = useMemo(
    () => parseServiceCloudContexts(metricsData),
    [metricsData],
  );
  const providerEvidence = useMemo(
    () => [...topology, ...serviceCloudContexts],
    [serviceCloudContexts, topology],
  );
  const services = useMemo(
    () => mergeServiceInventory(entityServices, providerEvidence),
    [entityServices, providerEvidence],
  );
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
      topology.map((edge) =>
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
  }, [scopeSettings.assignments, selectedProviderSlug, topology]);
  const matchedProviderServices = services.filter(
    (service) =>
      taggedProviderServiceIds.has(service.id) ||
      confirmedScopeServiceIds.has(service.id),
  ).length;
  const taggedProviderServices = taggedProviderServiceIds.size;
  const activeProviderCandidates = providerCandidates.filter(
    (candidate) => candidate.providerSlug === selectedProviderSlug,
  );
  const activeTopologyServiceIds = useMemo(
    () => Array.from(new Set(
      topology
        .filter((edge) => edge.providerSlug === selectedProviderSlug)
        .map(serviceEntityIdForEdge),
    )),
    [selectedProviderSlug, topology],
  );
  const suggestedServiceCount = new Set(
    activeProviderCandidates
      .filter((candidate) =>
        services.some(
          (service) =>
            service.id === candidate.serviceId &&
            !taggedProviderServiceIds.has(service.id) &&
            !confirmedScopeServiceIds.has(service.id),
        ),
      )
      .map((candidate) => candidate.serviceId),
  ).size;

  const telemetryLoading =
    servicesLoading ||
    problemsLoading ||
    logsLoading ||
    spansLoading ||
    metricsLoading;
  const telemetryError =
    serviceError ?? problemError ?? logsError ?? spansError ?? metricsError;
  const telemetrySignalsPresent =
    problems.length > 0 ||
    (logCount !== null && logCount > 0) ||
    (spanCount !== null && spanCount > 0) ||
    hasMetricSeries(metricsData);
  const claimReadiness =
    telemetryLoading || directoryLoading || scopeSettings.loading
      ? {
          tone: "neutral" as Tone,
          value: "Checking",
          detail: "Waiting for the evidence path to settle.",
        }
      : telemetryError || !directoryData
        ? {
            tone: "warning" as Tone,
            value: "Blocked",
            detail: "Access or contract lookup must be repaired first.",
          }
        : !telemetrySignalsPresent
          ? {
              tone: "warning" as Tone,
              value: "Needs telemetry",
              detail: "No recent signal supports an evidence review.",
            }
          : services.length === 0
            ? {
                tone: "warning" as Tone,
                value: "Needs service boundary",
                detail: "No service entity is available for attribution.",
              }
            : matchedProviderServices === 0
              ? providerLabels.length === 0
                ? {
                    tone: "warning" as Tone,
                    value: "Needs coverage",
                    detail:
                      "Confirm which services depend on the selected provider.",
                  }
                : {
                    tone: "warning" as Tone,
                    value: "Needs mapping",
                    detail:
                      "Detected source tags do not match the selected provider.",
                  }
              : activeProblems === 0
                ? {
                    tone: "neutral" as Tone,
                    value: "No incident in scope",
                    detail:
                      "The provider is identified, but there is no active Problem in scope.",
                  }
                : {
                    tone: "positive" as Tone,
                    value: "Candidate",
                    detail:
                      "A human review can compare the active Problem with the provider contract.",
                  };

  const providerName = directoryData?.provider.name ?? providerSlug;
  const coverageStatus =
    telemetryLoading ||
    directoryLoading ||
    topologyQuery.isLoading ||
    scopeSettings.loading
      ? "Checking coverage"
      : telemetryError
        ? "Access incomplete"
        : !directoryData
          ? "Contract unavailable"
          : matchedProviderServices > 0
            ? activeProblems > 0
              ? "Review available"
              : "Boundary ready"
            : "Action required";

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
            >
              {providerSlugs.map((slug) => (
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
              <StatusPill tone={claimReadiness.tone}>{coverageStatus}</StatusPill>
            </div>
            <div className="overview-facts coverage-facts" aria-label="Coverage status">
              <OverviewFact
                label="Providers"
                value={`${providerSlugs.length}`}
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
                label="Services covered"
                value={
                  servicesLoading || scopeSettings.loading
                    ? "Checking"
                    : `${matchedProviderServices} / ${services.length}`
                }
                detail={
                  suggestedServiceCount > 0
                    ? `${suggestedServiceCount} suggestion${suggestedServiceCount === 1 ? "" : "s"} to review`
                    : "confirmed scope or provider tag"
                }
                tone={
                  servicesLoading || scopeSettings.loading
                    ? "neutral"
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
            <nav className="setup-view-tabs" aria-label="Coverage views">
              <Link
                className={
                  coverageView === "scope"
                    ? "setup-view-tab active"
                    : "setup-view-tab"
                }
                to="/"
              >
                Scope map
              </Link>
              <Link
                className={
                  coverageView === "tags"
                    ? "setup-view-tab active"
                    : "setup-view-tab"
                }
                to="/?view=tags"
              >
                Manual coverage
              </Link>
            </nav>
            {telemetryError ? (
              <div className="error-box setup-error">
                Telemetry scan incomplete. Check the current user's data access.
              </div>
            ) : null}
            {coverageView === "tags" ? (
              <div className="setup-content-grid">
                <ProviderTagSetup
                  services={services}
                  problems={problems}
                  provider={directoryData}
                  providerSlug={selectedProviderSlug}
                  providerTagKey={providerLabelKey}
                  topologyServiceIds={activeTopologyServiceIds}
                  loading={servicesLoading || directoryLoading}
                  scopeSettings={scopeSettings}
                />
                <SetupAdvisor
                  recommendations={setupRecommendations}
                  loading={telemetryLoading || directoryLoading}
                  limitedContext={Boolean(
                    telemetryError ||
                      (services.length === 0 && telemetrySignalsPresent),
                  )}
                />
              </div>
            ) : (
              <ProviderScopeMap
                provider={directoryData}
                topology={topology}
                loading={topologyQuery.isLoading || directoryLoading}
                error={topologyQuery.error ?? directoryError ?? undefined}
                scopeSettings={scopeSettings}
              />
            )}
          </Surface>
        ) : section === "directory" ? (
          <Surface className="panel-card directory-panel">
            <ProviderDirectoryWorkspace
              directory={directoryData}
              directoryLoading={directoryLoading}
              directoryError={directoryError ?? undefined}
              services={services}
              topology={topology}
              servicesLoading={servicesLoading}
              serviceError={serviceError ?? undefined}
            />
          </Surface>
        ) : section === "incidents" ? (
          <IncidentReview
            provider={directoryData}
            problems={problems}
            services={services}
            topology={topology}
            topologyLoading={topologyQuery.isLoading}
            topologyError={topologyQuery.error ?? undefined}
            lookbackHours={lookbackHours}
            onLookbackChange={(value) =>
              void updatePreferences({ lookbackHours: value })
            }
            loading={problemsLoading}
            error={problemError ?? undefined}
          />
        ) : (
          <EvidenceWorkspace
            view={evidenceView}
            provider={directoryData}
            providerSlug={selectedProviderSlug}
            providerLabelKey={providerLabelKey}
            problems={problems}
            services={services}
            topology={topology}
            assignments={scopeSettings.assignments}
            lookbackHours={lookbackHours}
            loading={
              problemsLoading ||
              topologyQuery.isLoading ||
              directoryLoading ||
              scopeSettings.loading
            }
            error={
              problemError ??
              topologyQuery.error ??
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
