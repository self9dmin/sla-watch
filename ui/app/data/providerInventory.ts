import { sortProviderSlugs } from "./providers";

export type ProviderInventorySummary = {
  providerSlug: string;
  nodeCount: number;
  nodeTypes: string[];
  nodeTypeCounts: Array<{
    nodeType: string;
    nodeCount: number;
  }>;
  accountScopeCount: number;
  regionCount: number;
  availabilityZoneCount: number;
  computeResourceCount: number;
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

const isComputeResourceType = (providerSlug: string, nodeType: string): boolean => {
  if (providerSlug === "aws") return nodeType === "AWS_EC2_INSTANCE";
  // This is a Dynatrace Smartscape node type, not a credential.
  // eslint-disable-next-line noSecrets/no-secrets
  if (providerSlug === "azure") return nodeType === "AZURE_MICROSOFT_COMPUTE_VIRTUALMACHINES";
  if (providerSlug === "gcp") return nodeType === "GCP_COMPUTE_INSTANCE" || nodeType === "GCP_GCE_INSTANCE";
  return nodeType === "OCI_COMPUTE_INSTANCE";
};

const sortUnique = (values: Iterable<string>): string[] =>
  Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));

const NODE_TYPE_LABELS: Record<string, readonly [string, string]> = {
  AWS_ACCOUNT: ["AWS account", "AWS accounts"],
  AWS_AVAILABILITY_ZONE: ["Availability zone", "Availability zones"],
  AWS_EC2_INSTANCE: ["EC2 instance", "EC2 instances"],
  AWS_EC2_SUBNET: ["EC2 subnet", "EC2 subnets"],
  AWS_EC2_VPC: ["VPC", "VPCs"],
  AZURE_MICROSOFT_COMPUTE_DISKS: ["Managed disk", "Managed disks"],
  AZURE_MICROSOFT_COMPUTE_VIRTUALMACHINES: ["Virtual machine", "Virtual machines"],
  AZURE_MICROSOFT_CONTAINERSERVICE_MANAGEDCLUSTERS: ["Managed Kubernetes cluster", "Managed Kubernetes clusters"],
  AZURE_MICROSOFT_NETWORK_APPLICATIONGATEWAYS: ["Application gateway", "Application gateways"],
  AZURE_MICROSOFT_NETWORK_LOADBALANCERS: ["Load balancer", "Load balancers"],
  AZURE_MICROSOFT_NETWORK_NETWORKINTERFACES: ["Network interface", "Network interfaces"],
  AZURE_MICROSOFT_NETWORK_NETWORKINTERFACES_IPCONFIGURATIONS: ["Network interface IP configuration", "Network interface IP configurations"],
  AZURE_MICROSOFT_NETWORK_NETWORKSECURITYGROUPS: ["Network security group", "Network security groups"],
  AZURE_MICROSOFT_NETWORK_NETWORKWATCHERS: ["Network watcher", "Network watchers"],
  AZURE_MICROSOFT_NETWORK_PUBLICIPADDRESSES: ["Public IP address", "Public IP addresses"],
  AZURE_MICROSOFT_NETWORK_SUBNETS: ["Virtual network subnet", "Virtual network subnets"],
  AZURE_MICROSOFT_NETWORK_VIRTUALNETWORKS: ["Virtual network", "Virtual networks"],
  AZURE_MICROSOFT_NETWORK_VIRTUALNETWORKS_SUBNETS: ["Virtual network subnet", "Virtual network subnets"],
  AZURE_MICROSOFT_RESOURCES_LOCATIONS: ["Azure location record", "Azure location records"],
  AZURE_MICROSOFT_RESOURCES_LOCATIONS_AVAILABILITYZONES: ["Availability-zone record", "Availability-zone records"],
  AZURE_MICROSOFT_RESOURCES_RESOURCEGROUPS: ["Resource group", "Resource groups"],
  AZURE_MICROSOFT_RESOURCES_SUBSCRIPTIONS: ["Azure subscription", "Azure subscriptions"],
  AZURE_MICROSOFT_RESOURCES_TENANTS: ["Azure tenant", "Azure tenants"],
  AZURE_MICROSOFT_SQL_SERVERS: ["SQL server", "SQL servers"],
  AZURE_MICROSOFT_SQL_SERVERS_DATABASES: ["SQL database", "SQL databases"],
  AZURE_MICROSOFT_STORAGE_STORAGEACCOUNTS: ["Storage account", "Storage accounts"],
  AZURE_MICROSOFT_WEB_SITES: ["App Service site", "App Service sites"],
  GCP_COMPUTE_INSTANCE: ["Compute instance", "Compute instances"],
  GCP_GCE_INSTANCE: ["Compute instance", "Compute instances"],
  GCP_PROJECT: ["Google Cloud project", "Google Cloud projects"],
  GCP_REGION: ["Google Cloud region", "Google Cloud regions"],
  GCP_ZONE: ["Google Cloud zone", "Google Cloud zones"],
  OCI_COMPUTE_INSTANCE: ["Compute instance", "Compute instances"],
  OCI_REGION: ["OCI region", "OCI regions"],
  OCI_TENANCY: ["OCI tenancy", "OCI tenancies"],
};

const fallbackNodeTypeLabel = (nodeType: string): string => nodeType
  .replace(/^(AZURE_MICROSOFT|AWS|GCP|GOOGLE|OCI|ORACLE)_/, "")
  .replaceAll("_", " ")
  .toLowerCase()
  .replace(/^\w/, (character) => character.toUpperCase());

export const providerInventoryNodeTypeLabel = (
  nodeType: string,
  nodeCount: number,
): string => {
  const labels = NODE_TYPE_LABELS[nodeType.toUpperCase()];
  return labels ? labels[nodeCount === 1 ? 0 : 1] : fallbackNodeTypeLabel(nodeType);
};

export const parseProviderInventory = (
  data: { records?: unknown[] } | undefined,
): ProviderInventorySummary[] => {
  const records = Array.isArray(data?.records) ? data.records : [];
  const summaries = new Map<string, {
    nodeCount: number;
    nodeTypes: Set<string>;
    nodeTypeCounts: Map<string, number>;
    accountScopeCount: number;
    regionCount: number;
    availabilityZoneCount: number;
    computeResourceCount: number;
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
      nodeTypeCounts: new Map<string, number>(),
      accountScopeCount: 0,
      regionCount: 0,
      availabilityZoneCount: 0,
      computeResourceCount: 0,
    };
    summary.nodeCount += nodeCount;
    summary.nodeTypes.add(nodeType);
    summary.nodeTypeCounts.set(nodeType, (summary.nodeTypeCounts.get(nodeType) ?? 0) + nodeCount);
    if (isAccountScopeType(providerSlug, nodeType)) summary.accountScopeCount += nodeCount;
    if (isRegionType(providerSlug, nodeType)) summary.regionCount += nodeCount;
    if (isAvailabilityZoneType(nodeType)) summary.availabilityZoneCount += nodeCount;
    if (isComputeResourceType(providerSlug, nodeType)) summary.computeResourceCount += nodeCount;
    summaries.set(providerSlug, summary);
  });

  const providerSlugs = sortProviderSlugs(Array.from(summaries.keys()));
  return providerSlugs.map((providerSlug) => {
    const summary = summaries.get(providerSlug)!;
    return {
      providerSlug,
      nodeCount: summary.nodeCount,
      nodeTypes: sortUnique(summary.nodeTypes),
      nodeTypeCounts: Array.from(summary.nodeTypeCounts, ([nodeType, nodeCount]) => ({
        nodeType,
        nodeCount,
      })).sort((left, right) =>
        right.nodeCount - left.nodeCount || left.nodeType.localeCompare(right.nodeType)),
      accountScopeCount: summary.accountScopeCount,
      regionCount: summary.regionCount,
      availabilityZoneCount: summary.availabilityZoneCount,
      computeResourceCount: summary.computeResourceCount,
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
    summary.computeResourceCount > 0
      ? summary.providerSlug === "aws"
        ? plural(summary.computeResourceCount, "EC2 instance")
        : summary.providerSlug === "azure"
          ? plural(summary.computeResourceCount, "VM")
          : plural(summary.computeResourceCount, "compute instance")
      : undefined,
    plural(summary.nodeTypes.length, "Smartscape type"),
  ].filter((value): value is string => Boolean(value));
  return details.join(" · ");
};

export const providerInventorySlugs = (summaries: ProviderInventorySummary[]): string[] =>
  summaries.map((summary) => summary.providerSlug);
