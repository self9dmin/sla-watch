import { sortProviderSlugs } from "./providers";

export type ProviderInventorySummary = {
  providerSlug: string;
  nodeCount: number;
  nodeTypes: string[];
  accountScopeCount: number;
  regionCount: number;
  availabilityZoneCount: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const positiveCount = (value: unknown): number => {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
};

const providerFromInventoryRow = (row: Record<string, unknown>): string | undefined => {
  const nodeType = optionalText(row.node_type)?.toUpperCase() ?? "";
  if (nodeType.startsWith("AWS_")) return "aws";
  if (nodeType.startsWith("AZURE_")) return "azure";
  if (nodeType.startsWith("GCP_") || nodeType.startsWith("GOOGLE_")) return "gcp";
  if (nodeType.startsWith("OCI_") || nodeType.startsWith("ORACLE_")) return "oci";
  return undefined;
};

const isAvailabilityZoneType = (nodeType: string): boolean =>
  nodeType === "AWS_AVAILABILITY_ZONE"
  || nodeType === "GCP_ZONE"
  || nodeType.includes("AVAILABILITYZONE")
  || nodeType.includes("AVAILABILITY_ZONE")
  || nodeType.includes("AVAILABILITY_DOMAIN");

const isAccountScopeType = (providerSlug: string, nodeType: string): boolean => {
  if (providerSlug === "aws") return nodeType === "AWS_ACCOUNT";
  if (providerSlug === "azure") return nodeType.endsWith("_SUBSCRIPTIONS");
  if (providerSlug === "gcp") return nodeType === "GCP_PROJECT" || nodeType.endsWith("_PROJECTS");
  return nodeType === "OCI_TENANCY" || nodeType.endsWith("_TENANCIES");
};

const isRegionType = (providerSlug: string, nodeType: string): boolean => {
  if (providerSlug === "aws") return nodeType === "AWS_REGION";
  if (providerSlug === "azure") return nodeType.endsWith("_LOCATIONS");
  if (providerSlug === "gcp") return nodeType === "GCP_REGION" || nodeType.endsWith("_REGIONS");
  return nodeType === "OCI_REGION" || nodeType.endsWith("_REGIONS");
};

const sortUnique = (values: Iterable<string>): string[] =>
  Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));

export const parseProviderInventory = (
  data: { records?: unknown[] } | undefined,
): ProviderInventorySummary[] => {
  const records = Array.isArray(data?.records) ? data.records : [];
  const summaries = new Map<string, {
    nodeCount: number;
    nodeTypes: Set<string>;
    accountScopeCount: number;
    regionCount: number;
    availabilityZoneCount: number;
  }>();

  records.forEach((value) => {
    const row = asRecord(value);
    const providerSlug = providerFromInventoryRow(row);
    const nodeType = optionalText(row.node_type)?.toUpperCase();
    const nodeCount = positiveCount(row.node_count);
    if (!providerSlug || !nodeType || nodeCount === 0) return;

    const summary = summaries.get(providerSlug) ?? {
      nodeCount: 0,
      nodeTypes: new Set<string>(),
      accountScopeCount: 0,
      regionCount: 0,
      availabilityZoneCount: 0,
    };
    summary.nodeCount += nodeCount;
    summary.nodeTypes.add(nodeType);
    if (isAccountScopeType(providerSlug, nodeType)) summary.accountScopeCount += nodeCount;
    if (isRegionType(providerSlug, nodeType)) summary.regionCount += nodeCount;
    if (isAvailabilityZoneType(nodeType)) summary.availabilityZoneCount += nodeCount;
    summaries.set(providerSlug, summary);
  });

  const providerSlugs = sortProviderSlugs(Array.from(summaries.keys()));
  return providerSlugs.map((providerSlug) => {
    const summary = summaries.get(providerSlug)!;
    return {
      providerSlug,
      nodeCount: summary.nodeCount,
      nodeTypes: sortUnique(summary.nodeTypes),
      accountScopeCount: summary.accountScopeCount,
      regionCount: summary.regionCount,
      availabilityZoneCount: summary.availabilityZoneCount,
    };
  });
};

const plural = (count: number, singular: string, pluralValue = `${singular}s`): string =>
  `${count.toLocaleString()} ${count === 1 ? singular : pluralValue}`;

export const providerInventoryDetail = (summary: ProviderInventorySummary): string => {
  const scopeNoun = summary.providerSlug === "azure"
    ? "subscription"
    : summary.providerSlug === "gcp"
      ? "project"
      : summary.providerSlug === "oci"
        ? "tenancy"
        : "account";
  const details = [
    summary.accountScopeCount > 0 ? plural(summary.accountScopeCount, scopeNoun, scopeNoun === "tenancy" ? "tenancies" : `${scopeNoun}s`) : undefined,
    summary.availabilityZoneCount > 0 ? plural(summary.availabilityZoneCount, "zone record") : undefined,
    plural(summary.nodeTypes.length, "resource type"),
  ].filter((value): value is string => Boolean(value));
  return details.join(" · ");
};

export const providerInventorySlugs = (summaries: ProviderInventorySummary[]): string[] =>
  summaries.map((summary) => summary.providerSlug);
