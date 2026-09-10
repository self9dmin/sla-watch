import type { SmartscapeScopeEdge } from "../types";

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const firstText = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const text = optionalText(value);
    if (text) return text;
  }
  return undefined;
};

const tagStrings = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(tagStrings);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, tagValue]) => {
    if (Array.isArray(tagValue)) return tagValue.flatMap((item) => typeof item === "string" ? [`${key}:${item}`] : []);
    if (typeof tagValue === "string" || typeof tagValue === "number" || typeof tagValue === "boolean") return [`${key}:${String(tagValue)}`];
    return [];
  });
};

const providerFromTarget = (row: Record<string, unknown>): { slug?: string; evidence?: string; accountId?: string } => {
  const explicitProvider = optionalText(row.cloud_provider)?.toLowerCase();
  if (explicitProvider === "aws" || explicitProvider === "azure" || explicitProvider === "gcp") {
    const accountId = firstText(row.aws_account_id, row.azure_subscription, row.gcp_project_id);
    return { slug: explicitProvider, evidence: `Smartscape cloud.provider=${explicitProvider}`, accountId };
  }

  const targetType = optionalText(row.target_type)?.toUpperCase() ?? "";
  const awsEvidence = firstText(row.aws_account_id, row.aws_region, row.aws_availability_zone);
  if (awsEvidence || targetType.startsWith("AWS_")) {
    return {
      slug: "aws",
      evidence: targetType.startsWith("AWS_") ? `Smartscape runtime type ${targetType}` : "Smartscape AWS runtime attributes",
      accountId: optionalText(row.aws_account_id),
    };
  }

  const azureEvidence = firstText(row.azure_subscription, row.azure_location);
  if (azureEvidence || targetType.startsWith("AZURE_")) {
    return {
      slug: "azure",
      evidence: targetType.startsWith("AZURE_") ? `Smartscape runtime type ${targetType}` : "Smartscape Azure runtime attributes",
      accountId: optionalText(row.azure_subscription),
    };
  }

  const gcpEvidence = firstText(row.gcp_project_id, row.gcp_region, row.gcp_location);
  if (gcpEvidence || targetType.startsWith("GCP_") || targetType.startsWith("GOOGLE_")) {
    return {
      slug: "gcp",
      evidence: targetType.startsWith("GCP_") || targetType.startsWith("GOOGLE_") ? `Smartscape runtime type ${targetType}` : "Smartscape GCP runtime attributes",
      accountId: optionalText(row.gcp_project_id),
    };
  }

  return {};
};

export const parseSmartscapeScopeEdges = (data: { records?: unknown[] } | undefined): SmartscapeScopeEdge[] => {
  const records = Array.isArray(data?.records) ? data.records : [];
  return records.flatMap((value, index) => {
    const row = asRecord(value);
    const serviceNodeId = optionalText(row.service_node_id);
    const targetNodeId = optionalText(row.target_node_id);
    if (!serviceNodeId || !targetNodeId) return [];
    const relationship = optionalText(row.relationship) === "belongs_to" ? "belongs_to" as const : "runs_on" as const;
    const provider = providerFromTarget(row);

    return [{
      serviceNodeId,
      serviceClassicId: optionalText(row.service_classic_id),
      serviceName: firstText(row.service_name, row.service_classic_id) ?? `Service ${index + 1}`,
      serviceTags: tagStrings(row.service_tags),
      targetNodeId,
      targetClassicId: optionalText(row.target_classic_id),
      targetName: firstText(row.target_name, row.target_classic_id) ?? `Runtime ${index + 1}`,
      targetType: optionalText(row.target_type) ?? "RUNTIME",
      relationship,
      location: firstText(
        row.aws_availability_zone,
        row.aws_region,
        row.azure_location,
        row.gcp_location,
        row.gcp_region,
        row.k8s_cluster,
      ),
      providerSlug: provider.slug,
      providerEvidence: provider.evidence,
      accountId: provider.accountId,
    }];
  });
};

export const parseServiceCloudContexts = (data: { records?: unknown[] } | undefined): SmartscapeScopeEdge[] => {
  const records = Array.isArray(data?.records) ? data.records : [];
  return records.flatMap((value, index) => {
    if (typeof value !== "object" || value === null) return [];
    const row = value as Record<string, unknown>;
    const serviceNodeId = optionalText(row.service_node_id);
    if (!serviceNodeId) return [];

    const provider = providerFromTarget(row);
    if (!provider.slug) return [];
    const region = firstText(row.aws_region, row.azure_location, row.gcp_region);
    const contextName = firstText(provider.accountId, region) ?? `${provider.slug.toUpperCase()} service context`;
    const evidence = provider.evidence
      ?.replace("Smartscape runtime attributes", "Service metric dimensions")
      .replace("Smartscape AWS runtime attributes", "Service metric AWS dimensions")
      .replace("Smartscape Azure runtime attributes", "Service metric Azure dimensions")
      .replace("Smartscape GCP runtime attributes", "Service metric GCP dimensions")
      .replace("Smartscape cloud.provider", "Service metric cloud.provider");

    return [{
      serviceNodeId,
      serviceClassicId: optionalText(row.service_classic_id),
      serviceName: firstText(row.service_name, row.service_classic_id) ?? `Service ${index + 1}`,
      serviceTags: tagStrings(row.service_tags),
      targetNodeId: `${serviceNodeId}:cloud-context:${provider.slug}`,
      targetName: contextName,
      targetType: "SERVICE_CLOUD_CONTEXT",
      relationship: "runs_on" as const,
      location: region,
      providerSlug: provider.slug,
      providerEvidence: evidence,
      accountId: provider.accountId,
    }];
  });
};

export const uniqueRuntimeTargets = (edges: SmartscapeScopeEdge[]): SmartscapeScopeEdge[] => {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    if (seen.has(edge.targetNodeId)) return false;
    seen.add(edge.targetNodeId);
    return true;
  });
};

export const uniqueLocations = (edges: SmartscapeScopeEdge[]): string[] =>
  Array.from(new Set(edges.map((edge) => edge.location).filter((value): value is string => Boolean(value)))).sort();

export const detectedProviderSlugs = (edges: SmartscapeScopeEdge[]): string[] => (
  Array.from(new Set(edges.map((edge) => edge.providerSlug).filter((value): value is string => Boolean(value)))).sort()
);
