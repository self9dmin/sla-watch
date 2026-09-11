import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAppFunction, useDql } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import { Surface } from "@dynatrace/strato-components/layouts";
import {
  Heading,
  Paragraph,
  Text,
} from "@dynatrace/strato-components/typography";
import { SetupAdvisor } from "../components/SetupAdvisor";
import { IncidentReview } from "../components/IncidentReview";
import { ProviderTagSetup } from "../components/ProviderTagSetup";
import { ProviderScopeMap } from "../components/ProviderScopeMap";
import { ProviderDirectoryWorkspace } from "../components/ProviderDirectoryWorkspace";
import { ProviderNotices } from "../components/ProviderNotices";
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
  { section: "overview", label: "Overview", to: "/", tour: "overview" },
  { section: "setup", label: "Setup", to: "/setup", tour: "setup" },
  {
    section: "incidents",
    label: "Incidents",
    to: "/incidents",
    tour: "incidents",
  },
  {
    section: "provider-notices",
    label: "Provider notices",
    to: "/provider-notices",
    tour: "provider-notices",
  },
  {
    section: "directory",
    label: "Directory",
    to: "/directory",
    tour: "directory",
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
  </nav>
);

const EvidenceStep = ({
  number,
  title,
  detail,
  state,
}: {
  number: number;
  title: string;
  detail: string;
  state: Tone;
}) => (
  <div className="evidence-step" role="listitem">
    <span
      className={`evidence-step-marker evidence-step-${state}`}
      aria-hidden="true"
    >
      {number}
    </span>
    <div className="evidence-step-copy">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  </div>
);

export const Dashboard = ({ initialSection = "overview" }: DashboardProps) => {
  const section = initialSection;
  const location = useLocation();
  const setupView =
    new URLSearchParams(location.search).get("view") === "tags"
      ? "tags"
      : "scope";
  const { preferences, updatePreferences } = useSlaPreferences();
  const scopeSettings = useProviderScopeAssignments();
  const { providerSlugs, providerSlug, providerLabelKey, lookbackHours } =
    preferences;
  const [providerNoticeRefresh, setProviderNoticeRefresh] = useState(0);
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
    refetch: refetchServices,
  } = useDql({ query: SERVICES_QUERY });
  const {
    data: problemData,
    error: problemError,
    isLoading: problemsLoading,
    refetch: refetchProblems,
  } = useDql({ query: problemsQuery });
  const {
    data: logsData,
    error: logsError,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useDql({ query: logsQuery });
  const {
    data: spansData,
    error: spansError,
    isLoading: spansLoading,
    refetch: refetchSpans,
  } = useDql({ query: spansQuery });
  const {
    data: metricsData,
    error: metricsError,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
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
  const refetchDirectory = directoryQuery.refetch;

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
            currentScopeKeys.has(assignment.assignmentKey),
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
  const confirmedScopeServices = services.filter((service) =>
    confirmedScopeServiceIds.has(service.id),
  ).length;
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
  const telemetryState = telemetryLoading
    ? {
        tone: "neutral" as Tone,
        title: "Checking telemetry",
        detail:
          "Reading the service inventory and recent signals before making a diagnosis.",
      }
    : telemetryError
      ? {
          tone: "warning" as Tone,
          title: "Access incomplete",
          detail:
            "At least one telemetry read was denied or failed. This is not evidence that telemetry is absent.",
        }
      : services.length === 0 && telemetrySignalsPresent
        ? {
            tone: "warning" as Tone,
            title: "Entity inventory incomplete",
            detail:
              "Telemetry exists, but no service entities were returned. Check entity permissions or entity mapping before evaluating provider responsibility.",
          }
        : telemetrySignalsPresent
          ? {
              tone: "positive" as Tone,
              title: "Telemetry detected",
              detail:
                "Dynatrace has service entities or signals that can support an evidence review.",
            }
          : {
              tone: "warning" as Tone,
              title: "Telemetry missing",
              detail: `No Problems, logs, spans, or service request series were detected in the last ${formatEvidenceLookback(lookbackHours)}.`,
            };
  const providerState =
    directoryLoading || scopeSettings.loading
      ? {
          tone: "neutral" as Tone,
          title: "Checking provider scope",
          detail: `Loading the ${providerSlug} contract and confirmed service mappings.`,
        }
      : !directoryData
        ? {
            tone: "warning" as Tone,
            title: "Directory unavailable",
            detail:
              directoryError?.message ??
              "Load a provider contract before checking provider identity.",
          }
        : telemetryLoading
          ? {
              tone: "neutral" as Tone,
              title: "Waiting for service inventory",
              detail:
                "Provider matching will be evaluated after the tenant service list finishes loading.",
            }
          : telemetryError
            ? {
                tone: "warning" as Tone,
                title: "Provider check blocked",
                detail:
                  "Telemetry access is incomplete, so provider tagging cannot be judged reliably yet.",
              }
            : services.length === 0 && telemetrySignalsPresent
              ? {
                  tone: "warning" as Tone,
                  title: "Identify service first",
                  detail:
                    "The tenant has telemetry, but the affected service inventory is incomplete. Provider tagging cannot be evaluated yet.",
                }
              : services.length === 0
                ? {
                    tone: "warning" as Tone,
                    title: "No service entities",
                    detail:
                      "There is no service inventory to tag. Fix instrumentation or entity access before identifying a provider.",
                  }
                : matchedProviderServices > 0
                  ? {
                      tone: "positive" as Tone,
                      title: "Provider scope confirmed",
                      detail: `${matchedProviderServices} service${matchedProviderServices === 1 ? " is" : "s are"} identified by ${confirmedScopeServices > 0 ? `${confirmedScopeServices} scope mapping${confirmedScopeServices === 1 ? "" : "s"}` : ""}${confirmedScopeServices > 0 && taggedProviderServices > 0 ? " and " : ""}${taggedProviderServices > 0 ? `${taggedProviderServices} provider tag${taggedProviderServices === 1 ? "" : "s"}` : ""}. This still does not prove a provider outage.`,
                    }
                  : providerLabels.length === 0
                    ? {
                        tone: "warning" as Tone,
                        title: "Provider tags missing",
                        detail:
                          suggestedServiceCount > 0
                            ? `Smartscape found ${suggestedServiceCount} ${directoryData.provider.name} service candidate${suggestedServiceCount === 1 ? "" : "s"}. Confirm each assignment in Setup.`
                            : `Services exist, but no explicit provider tag was found. Review the services that depend on ${directoryData.provider.name} in Setup.`,
                      }
                    : {
                        tone: "warning" as Tone,
                        title: "Provider identification needed",
                        detail: `Provider tags were found (${providerLabels.slice(0, 3).join(", ")}), but none resolves to ${directoryData.provider.name}. Select the correct provider or update the Dynatrace tags.`,
                      };

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
                    value: "Needs setup",
                    detail:
                      "Confirm which services depend on the selected provider.",
                  }
                : {
                    tone: "warning" as Tone,
                    value: "Needs mapping",
                    detail:
                      "Detected provider tags do not match the selected contract.",
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
  const overviewAssessment =
    telemetryLoading || directoryLoading || scopeSettings.loading
      ? {
          title: "Checking this environment",
          detail:
            "Dynatrace telemetry and the selected provider contract are still loading.",
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
              detail:
                directoryError?.message ??
                `The ${providerSlug} contract could not be loaded from sla.directory.`,
              action: "Review provider connection",
              href: "/setup",
            }
          : !telemetrySignalsPresent
            ? {
                title: "Add a recent service signal",
                detail: `No Problems, logs, spans, or service request series were detected in the last ${formatEvidenceLookback(lookbackHours)}.`,
                action: "Review evidence scope",
                href: "/setup",
              }
            : services.length === 0
              ? {
                  title: "Expose the affected service boundary",
                  detail:
                    "Telemetry is present, but no service entities were returned. Provider attribution should wait until the service boundary is visible.",
                  action: "Review service access",
                  href: "/settings/watch",
                }
              : matchedProviderServices > 0
                ? activeProblems === 0
                  ? {
                      title: "No incident requires provider review",
                      detail: `${matchedProviderServices} service${matchedProviderServices === 1 ? " matches" : "s match"} ${providerName}. No active Problems were found in the last ${formatEvidenceLookback(lookbackHours)}.`,
                      action: "Review provider terms",
                      href: "/directory",
                    }
                  : {
                      title:
                        "Review the active Problem before considering a claim",
                      detail: `${activeProblems} active Problem${activeProblems === 1 ? "" : "s"} and ${matchedProviderServices} provider-matched service${matchedProviderServices === 1 ? "" : "s"} require human review.`,
                      action: "Review incident evidence",
                      href: "/incidents",
                    }
                : providerLabels.length === 0 && suggestedServiceCount > 0
                  ? {
                      title: `Confirm ${suggestedServiceCount} ${providerName} service candidate${suggestedServiceCount === 1 ? "" : "s"}`,
                      detail: `Smartscape links ${suggestedServiceCount === 1 ? "this service" : "these services"} to ${providerName} runtime metadata. Confirm the provider service before using the mapping in incident review.`,
                      action: "Open scope map",
                      href: "/setup",
                    }
                  : providerLabels.length === 0
                    ? {
                        title: `Identify which services depend on ${providerName}`,
                        detail: `${services.length} service${services.length === 1 ? " is" : "s are"} visible, but no explicit provider tag was found.`,
                        action: "Review service tags",
                        href: "/setup?view=tags",
                      }
                    : {
                        title: `Resolve provider tags to ${providerName}`,
                        detail: `${providerLabels.length} provider tag${providerLabels.length === 1 ? " is" : "s are"} visible, but none resolves to the selected contract.`,
                        action: "Review service tags",
                        href: "/setup?view=tags",
                      };

  const setupStatus =
    telemetryLoading ||
    directoryLoading ||
    topologyQuery.isLoading ||
    scopeSettings.loading
      ? "Checking setup"
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

  const handleRefresh = () => {
    if (section === "provider-notices") {
      setProviderNoticeRefresh((current) => current + 1);
      return;
    }
    void Promise.all([
      refetchServices(),
      refetchProblems(),
      refetchLogs(),
      refetchSpans(),
      refetchMetrics(),
      topologyQuery.refetch(),
      refetchDirectory(),
    ]);
  };

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
          <div className="hero-action-buttons">
            <Button
              className="hero-action-secondary"
              onClick={handleRefresh}
              disabled={telemetryLoading || directoryLoading}
              size="condensed"
            >
              {telemetryLoading || directoryLoading
                ? "Refreshing"
                : "Refresh data"}
            </Button>
            <Button
              className="hero-action-primary"
              as={Link}
              to="/settings/watch"
              variant="emphasized"
              size="condensed"
            >
              Configure
            </Button>
          </div>
        </div>
      </section>

      <WatchNavigation section={section} />

      <div className={`watch-view watch-view-${section}`}>
        {section === "overview" ? (
          <Surface
            className={`panel-card overview-status-panel overview-status-panel-${claimReadiness.tone}`}
            data-tour="overview-status"
          >
            <div className="overview-status-main">
              <div className="overview-status-copy">
                <StatusPill tone={claimReadiness.tone}>
                  {claimReadiness.value}
                </StatusPill>
                <Heading level={2}>{overviewAssessment.title}</Heading>
                <Paragraph>{overviewAssessment.detail}</Paragraph>
              </div>
              <div className="overview-status-actions">
                <Button
                  className="overview-primary-action"
                  as={Link}
                  to={overviewAssessment.href}
                  variant="emphasized"
                  color="primary"
                >
                  {overviewAssessment.action}
                </Button>
                {overviewAssessment.href !== "/setup" &&
                setupRecommendations.length > 0 ? (
                  <Link className="text-action" to="/setup">
                    View {setupRecommendations.length} setup check
                    {setupRecommendations.length === 1 ? "" : "s"}
                  </Link>
                ) : setupRecommendations.length > 0 ? (
                  <Text className="overview-check-count">
                    {setupRecommendations.length} setup check
                    {setupRecommendations.length === 1 ? "" : "s"} open
                  </Text>
                ) : null}
              </div>
            </div>
            <div className="overview-facts" aria-label="Current monitor facts">
              <OverviewFact
                label="Providers monitored"
                value={`${providerSlugs.length}`}
                detail={
                  directoryLoading
                    ? `checking ${providerDisplayName(providerSlug)}`
                    : directoryData
                      ? `${providerName} active`
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
                label="Services mapped"
                value={
                  servicesLoading || scopeSettings.loading
                    ? "Checking"
                    : `${matchedProviderServices} / ${services.length}`
                }
                detail="confirmed scope or provider tag"
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
                label="Filing window"
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
            <div className="overview-boundary-note">
              <strong>Assessment boundary</strong>
              <span>
                Dynatrace provides observed tenant evidence. The provider
                determines fault, eligibility, and any service credit.
              </span>
            </div>
          </Surface>
        ) : section === "setup" ? (
          <Surface className="panel-card setup-panel">
            <div className="setup-heading">
              <div>
                <Heading level={2}>Setup</Heading>
                <Paragraph>
                  Confirm each service scope in Smartscape. Add provider tags
                  only when other Dynatrace workflows should reuse the boundary.
                </Paragraph>
              </div>
              <StatusPill tone={claimReadiness.tone}>{setupStatus}</StatusPill>
            </div>
            <div
              className="evidence-ladder"
              role="list"
              aria-label="Setup stages"
            >
              <EvidenceStep
                number={1}
                title="Telemetry"
                detail={telemetryState.title}
                state={telemetryState.tone}
              />
              <EvidenceStep
                number={2}
                title="Services"
                detail={
                  servicesLoading
                    ? "Checking inventory"
                    : `${services.length} detected`
                }
                state={
                  services.length > 0 && !servicesLoading
                    ? "positive"
                    : telemetryLoading
                      ? "neutral"
                      : "warning"
                }
              />
              <EvidenceStep
                number={3}
                title="Provider scope"
                detail={
                  directoryLoading ||
                  topologyQuery.isLoading ||
                  scopeSettings.loading
                    ? "Checking mapping"
                    : matchedProviderServices > 0
                      ? `${matchedProviderServices} confirmed`
                      : suggestedServiceCount > 0
                        ? `${suggestedServiceCount} candidate${suggestedServiceCount === 1 ? "" : "s"}`
                        : "0 confirmed"
                }
                state={
                  matchedProviderServices > 0 && !directoryLoading
                    ? "positive"
                    : providerState.tone
                }
              />
              <EvidenceStep
                number={4}
                title="Contract"
                detail={
                  directoryData ? `${providerName} loaded` : "Unavailable"
                }
                state={directoryData ? "positive" : "neutral"}
              />
            </div>
            <nav className="setup-view-tabs" aria-label="Setup views">
              <Link
                className={
                  setupView === "scope"
                    ? "setup-view-tab active"
                    : "setup-view-tab"
                }
                to="/setup"
              >
                Scope map
              </Link>
              <Link
                className={
                  setupView === "tags"
                    ? "setup-view-tab active"
                    : "setup-view-tab"
                }
                to="/setup?view=tags"
              >
                Service tags
              </Link>
            </nav>
            {telemetryError ? (
              <div className="error-box setup-error">
                Telemetry scan incomplete. Check the current user's data access.
              </div>
            ) : null}
            {setupView === "tags" ? (
              <div className="setup-content-grid">
                <ProviderTagSetup
                  services={services}
                  providerName={providerName}
                  providerSlug={selectedProviderSlug}
                  providerTagKey={providerLabelKey}
                  providerCandidates={activeProviderCandidates}
                  topologyLoading={topologyQuery.isLoading || metricsLoading}
                  topologyError={
                    topologyQuery.error ?? metricsError ?? undefined
                  }
                  loading={servicesLoading || directoryLoading}
                  onRefresh={() => refetchServices()}
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
          <ProviderNotices
            key={providerNoticeRefresh}
            providerSlug={selectedProviderSlug}
            lookbackHours={lookbackHours}
          />
        )}
      </div>
    </div>
  );
};
