import type { ProviderCandidate, ServiceRecord, SmartscapeScopeEdge } from "../types";

export const mergeServiceInventory = (
  services: ServiceRecord[],
  topology: SmartscapeScopeEdge[],
): ServiceRecord[] => {
  const merged = new Map(services.map((service) => [service.id, service]));
  for (const edge of topology) {
    const id = edge.serviceClassicId ?? (/^SERVICE-[A-F0-9]+$/.test(edge.serviceNodeId) ? edge.serviceNodeId : undefined);
    if (!id) continue;
    const existing = merged.get(id);
    if (existing) {
      merged.set(id, { ...existing, tags: Array.from(new Set([...existing.tags, ...edge.serviceTags])) });
    } else {
      merged.set(id, { id, name: edge.serviceName, type: "SERVICE", tags: edge.serviceTags });
    }
  }
  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
};

export const buildProviderCandidates = (
  services: ServiceRecord[],
  topology: SmartscapeScopeEdge[],
): ProviderCandidate[] => {
  const serviceIds = new Set(services.map((service) => service.id));
  const candidates = new Map<string, ProviderCandidate>();

  for (const edge of topology) {
    const serviceId = edge.serviceClassicId && serviceIds.has(edge.serviceClassicId)
      ? edge.serviceClassicId
      : serviceIds.has(edge.serviceNodeId) ? edge.serviceNodeId : undefined;
    if (!serviceId || !edge.providerSlug) continue;

    const key = `${serviceId}|${edge.providerSlug}`;
    const current = candidates.get(key) ?? {
      serviceId,
      providerSlug: edge.providerSlug,
      evidence: [],
      runtimeNames: [],
    };
    if (edge.providerEvidence && !current.evidence.includes(edge.providerEvidence)) current.evidence.push(edge.providerEvidence);
    if (!current.runtimeNames.includes(edge.targetName)) current.runtimeNames.push(edge.targetName);
    candidates.set(key, current);
  }

  return Array.from(candidates.values()).sort((left, right) => (
    left.serviceId.localeCompare(right.serviceId) || left.providerSlug.localeCompare(right.providerSlug)
  ));
};
