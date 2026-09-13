import type { ProviderInventorySummary } from "./providerInventory";
import { providerDisplayName } from "./providers";
import type { ProviderHostContextSummary } from "./topology";

export type ProviderInfrastructureCandidate = {
  providerSlug: string;
  hostCount: number;
  computeResourceCount: number;
};

const matchingInventory = (
  providerSlug: string,
  inventory: ProviderInventorySummary | undefined,
): ProviderInventorySummary | undefined =>
  inventory?.providerSlug === providerSlug ? inventory : undefined;

const matchingHostContext = (
  providerSlug: string,
  hostContext: ProviderHostContextSummary | undefined,
): ProviderHostContextSummary | undefined =>
  hostContext?.providerSlug === providerSlug ? hostContext : undefined;

export const buildProviderInfrastructureCandidate = ({
  providerSlug,
  inventory,
  hostContext,
}: {
  providerSlug: string;
  inventory?: ProviderInventorySummary;
  hostContext?: ProviderHostContextSummary;
}): ProviderInfrastructureCandidate | undefined => {
  const selectedInventory = matchingInventory(providerSlug, inventory);
  const selectedHostContext = matchingHostContext(providerSlug, hostContext);
  const hostCount = selectedHostContext?.hostCount ?? 0;
  const computeResourceCount = selectedInventory?.computeResourceCount ?? 0;
  if (hostCount === 0 && computeResourceCount === 0) return undefined;

  return {
    providerSlug,
    hostCount,
    computeResourceCount,
  };
};

const plural = (count: number, singular: string, pluralValue = `${singular}s`): string =>
  `${count.toLocaleString()} ${count === 1 ? singular : pluralValue}`;

const computeResourceLabel = (providerSlug: string, count: number): string => {
  if (providerSlug === "aws") return plural(count, "Amazon EC2 instance");
  if (providerSlug === "azure") return plural(count, "Azure VM");
  if (providerSlug === "gcp") return plural(count, "Google Cloud compute instance");
  if (providerSlug === "oci") return plural(count, "OCI compute instance");
  return plural(count, "provider compute resource");
};

export const providerInfrastructureCandidateDetail = (
  candidate: ProviderInfrastructureCandidate,
): string => {
  const providerName = providerDisplayName(candidate.providerSlug);
  const signals = [
    candidate.hostCount > 0
      ? `${plural(candidate.hostCount, "monitored host")} with ${providerName} metadata`
      : undefined,
    candidate.computeResourceCount > 0
      ? `${computeResourceLabel(candidate.providerSlug, candidate.computeResourceCount)} in provider-native topology`
      : undefined,
  ].filter((value): value is string => Boolean(value));
  const grouping = signals.length > 1
    ? "These signals are grouped once at the provider level and are not assumed to represent the same resource."
    : "This evidence is shown once at the provider level.";

  return `Dynatrace detected ${signals.join(" and ")}. ${grouping} No service is assigned until Dynatrace returns a service relationship, a matching source tag exists, or an operator confirms one.`;
};
