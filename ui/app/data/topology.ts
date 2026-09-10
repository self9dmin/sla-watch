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

export const parseSmartscapeScopeEdges = (data: { records?: unknown[] } | undefined): SmartscapeScopeEdge[] => {
  const records = Array.isArray(data?.records) ? data.records : [];
  return records.flatMap((value, index) => {
    const row = asRecord(value);
    const serviceNodeId = optionalText(row.service_node_id);
    const targetNodeId = optionalText(row.target_node_id);
    if (!serviceNodeId || !targetNodeId) return [];
    const relationship = optionalText(row.relationship) === "belongs_to" ? "belongs_to" as const : "runs_on" as const;

    return [{
      serviceNodeId,
      serviceClassicId: optionalText(row.service_classic_id),
      serviceName: firstText(row.service_name, row.service_classic_id) ?? `Service ${index + 1}`,
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
