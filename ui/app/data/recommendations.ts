import type {
  ProblemRecord,
  ServiceRecord,
  SetupRecommendation,
  SlaProviderResponse,
} from "../types";

type RecommendationInput = {
  services: ServiceRecord[];
  problems: ProblemRecord[];
  telemetrySignalsPresent: boolean;
  telemetryError?: Error;
  directoryData?: SlaProviderResponse;
  directoryError?: Error;
  providerLabels: string[];
  selectedProviderSlug: string;
  providerLabelKey: string;
  matchedProviderServices: number;
  taggedProviderServices?: number;
  providerCandidateServices?: number;
};

const priorityRank: Record<SetupRecommendation["priority"], number> = { high: 0, medium: 1, low: 2 };

const normalized = (value: string): string => value.trim().toLowerCase();

const hasOwnershipContext = (service: ServiceRecord): boolean => service.tags.some((tag) => {
  const value = normalized(tag);
  return /(?:^|[\s._-]|\[)(?:owner|team|application|app|service\.owner)\s*[:=]/.test(value);
});

const namesEncodeDeploymentContext = (services: ServiceRecord[]): boolean => services.some(({ name }) => {
  const value = normalized(name);
  const environment = /(?:^|[-_.])(?:dev|development|qa|test|testing|stage|staging|prod|production)(?:$|[-_.])/.test(value);
  const region = /(?:^|[-_.])(?:us|eu|ap|sa|ca|me|af|cn|au)[-_]?(?:east|west|central|north|south)?[-_.]?(?:\d+)?(?:$|[-_.])/.test(value);
  return environment || region;
});

const namesNeedAttention = (services: ServiceRecord[]): boolean => services.some(({ name }) => {
  const value = normalized(name);
  return value === "unnamed service" || value === "unknown_service" || value === "unknown-service" || value === "service" || value.startsWith("localhost");
});

const add = (items: SetupRecommendation[], recommendation: SetupRecommendation): void => {
  if (!items.some((item) => item.id === recommendation.id)) items.push(recommendation);
};

export const buildSetupRecommendations = ({
  services,
  problems,
  telemetrySignalsPresent,
  telemetryError,
  directoryData,
  directoryError,
  providerLabels,
  selectedProviderSlug,
  providerLabelKey,
  matchedProviderServices,
  taggedProviderServices = matchedProviderServices,
  providerCandidateServices = 0,
}: RecommendationInput): SetupRecommendation[] => {
  const recommendations: SetupRecommendation[] = [];
  const activeProblems = problems.filter((problem) => problem.status === "ACTIVE").length;
  const ownershipTaggedServices = services.filter(hasOwnershipContext).length;

  if (directoryError || !directoryData) {
    add(recommendations, {
      id: "directory-unavailable",
      priority: "high",
      title: "Reconnect the provider contract",
      detail: "The app cannot compare Dynatrace evidence with a contractual target until the selected sla.directory record is available.",
      evidence: directoryError?.message ?? "No provider contract response is available yet.",
      action: "Review the provider connection",
      href: "/settings/watch",
    });
  }

  if (telemetryError) {
    add(recommendations, {
      id: "telemetry-access",
      priority: "high",
      title: "Restore the evidence path",
      detail: "At least one Dynatrace read failed. Treat the environment as unknown until service and signal access is complete.",
      evidence: telemetryError.message,
      action: "Review app permissions",
      href: "/settings/watch",
    });
  } else if (services.length === 0 && telemetrySignalsPresent) {
    add(recommendations, {
      id: "service-inventory",
      priority: "high",
      title: "Expose the affected service boundary",
      detail: "Telemetry exists, but no service entities were returned. Confirm entity access and service detection before assigning provider responsibility.",
      evidence: "Signals were detected without a service inventory.",
      action: "Open the monitor settings",
      href: "/settings/watch",
    });
  } else if (services.length === 0) {
    add(recommendations, {
      id: "instrumentation",
      priority: "medium",
      title: "Expose a service signal",
      detail: "No service entities or recent signals are in scope. Instrument the workload or widen the evidence window before setting up provider attribution.",
      evidence: "No service inventory, Problems, logs, spans, or service request series were detected.",
      action: "Widen the evidence window",
      href: "/settings/watch",
    });
  } else if (!telemetrySignalsPresent) {
    add(recommendations, {
      id: "recent-telemetry",
      priority: "high",
      title: "Add a recent service signal",
      detail: "Service entities are visible, but the selected window has no Problems, logs, spans, or service-request series to support an incident review.",
      evidence: `${services.length} service${services.length === 1 ? " is" : "s are"} visible without a recent supporting signal.`,
      action: "Review the evidence window",
      href: "/settings/watch",
    });
  }

  if (directoryData && services.length > 0 && providerLabels.length === 0 && matchedProviderServices === 0) {
    add(recommendations, {
      id: "provider-label",
      priority: "high",
      title: providerCandidateServices > 0 ? `Confirm ${directoryData.provider.name} service candidates` : "Identify services that use this provider",
      detail: providerCandidateServices > 0
        ? `Smartscape links ${providerCandidateServices} service${providerCandidateServices === 1 ? "" : "s"} to ${directoryData.provider.name} runtime metadata. Confirm the exact services before adding ${providerLabelKey}:${selectedProviderSlug}.`
        : `Add ${providerLabelKey}:${selectedProviderSlug} (or a documented equivalent) to the services that depend on ${directoryData.provider.name}. Names alone are not enough for a provider review.`,
      evidence: providerCandidateServices > 0
        ? `${providerCandidateServices} topology candidate${providerCandidateServices === 1 ? "" : "s"}; ${services.length - providerCandidateServices} service${services.length - providerCandidateServices === 1 ? " has" : "s have"} no matching ${directoryData.provider.name} runtime evidence.`
        : `${services.length} service${services.length === 1 ? "" : "s"} returned, but no provider tags were found.`,
      action: providerCandidateServices > 0 ? "Open scope map" : "Review service tags",
      href: providerCandidateServices > 0 ? "/" : "/?view=tags&review=provider#provider-service-tags",
    });
  } else if (directoryData && providerLabels.length > 0 && matchedProviderServices === 0) {
    add(recommendations, {
      id: "provider-mapping",
      priority: "high",
      title: "Resolve provider tags to the selected contract",
      detail: `Dynatrace has provider tags, but none resolve to ${directoryData.provider.name}. Confirm the intended provider before reviewing the contract.`,
      evidence: `Detected tags: ${providerLabels.slice(0, 3).join(", ")}. Selected contract: ${directoryData.provider.name}.`,
      action: "Review service tags",
      href: "/?view=tags&review=provider#provider-service-tags",
    });
  } else if (directoryData && matchedProviderServices > 0 && taggedProviderServices === 0) {
    add(recommendations, {
      id: "provider-tag-reuse",
      priority: "low",
      title: "Add provider tags for wider Dynatrace reuse",
      detail: `The confirmed scope mapping is sufficient for this review. Add ${providerLabelKey}:${selectedProviderSlug} only when dashboards, alerts, management zones, or workflows should reuse the same boundary.`,
      evidence: `${matchedProviderServices} service${matchedProviderServices === 1 ? " is" : "s are"} mapped without an explicit provider tag.`,
      action: "Review service tags",
      href: "/?view=tags&review=provider#provider-service-tags",
    });
  }

  if (services.length > 0 && ownershipTaggedServices === 0) {
    add(recommendations, {
      id: "ownership-context",
      priority: "medium",
      title: "Add ownership metadata",
      detail: "Add team, owner, application, or service metadata so the next responder can route a provider finding without decoding a name or guessing the owning group.",
      evidence: "No owner, team, application, or app tags were found on the returned service records.",
      action: "Read ownership setup guidance",
      platformAction: "ownership-settings",
    });
  }

  if (namesEncodeDeploymentContext(services)) {
    add(recommendations, {
      id: "service-context",
      priority: "low",
      title: "Move environment and region out of service names",
      detail: "Keep service.name stable and put deployment context in tags or primary fields. This makes provider mapping and SLO scope resilient as environments multiply.",
      evidence: "At least one returned service name appears to encode an environment or region.",
      action: "Review service naming",
    });
  } else if (namesNeedAttention(services)) {
    add(recommendations, {
      id: "service-naming",
      priority: "medium",
      title: "Give the service a stable identity",
      detail: "A generated or localhost-style service name makes attribution brittle. Set a durable service.name and keep environment and region in metadata.",
      evidence: "At least one returned service has an unhelpful or generated-looking name.",
      action: "Review service detection",
    });
  }

  if (directoryData && matchedProviderServices > 0 && recommendations.length < 3) {
    add(recommendations, {
      id: "slo-coverage",
      priority: "low",
      title: "Review native SLO coverage next",
      detail: `The ${directoryData.provider.name} boundary is identifiable. Use a Dynatrace SLO for the customer-facing service to track the error budget, then compare that evidence with the provider contract.`,
      evidence: `${matchedProviderServices} service${matchedProviderServices === 1 ? "" : "s"} match the selected contract${activeProblems > 0 ? ` and ${activeProblems} active Problem${activeProblems === 1 ? "" : "s"} need review` : ""}.`,
      action: "Open the SLO workflow in Dynatrace",
    });
  }

  return recommendations.sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority]).slice(0, 3);
};
