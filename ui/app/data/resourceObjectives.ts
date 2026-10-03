import type { SloConfig } from "@dynatrace-sdk/client-service-level-objectives";
import type { ProviderCoverageModel } from "./providerCoverage";
import { rowIsCovered, rowServiceIds } from "./providerCoverage";
import { isResourceScopeAssignment, runtimeEntityIdForEdge } from "./providerScopeAssignments";
import {
  MANAGED_OBJECTIVE_TAG,
  normalizeClassicServiceId,
  normalizeObjectiveTagValue,
  OBJECTIVE_EVALUATION_WINDOW,
} from "./serviceObjectives";
import type { ServiceRecord, SlaProviderResponse } from "../types";

export const RESOURCE_OBJECTIVE_MAX_SERVICES = 200;

export type ResourceObjectiveCandidate = {
  scopeId: string;
  accountId: string;
  region: string;
  resourceIds: string[];
  resourceNames: string[];
  members: Array<{ resourceId: string; serviceId: string; location?: string }>;
  providerServiceId: string;
  providerServiceName: string;
  serviceIds: string[];
  serviceNames: string[];
  basis: "confirmed" | "observed";
};

/** A product and exact account/region form one screening unit; services are evidence, not claim units. */
export const resourceObjectiveCandidates = (
  model: ProviderCoverageModel,
  services: ServiceRecord[],
  provider?: SlaProviderResponse,
): ResourceObjectiveCandidate[] => {
  if (!provider) return [];
  const names = new Map(services.map((service) => [service.id, service.name]));
  const seen = new Map<string, ResourceObjectiveCandidate>();
  const resourceGroups = new Map<string, string>();
  const conflicting = new Set<string>();
  for (const row of model.resourceRows) {
    if (!rowIsCovered(row) || row.ambiguous || row.mixedAssignments) continue;
    if (row.assignments?.some((assignment) => !isResourceScopeAssignment(assignment))) continue;
    if (row.edges.some((edge) => edge.providerSlug && edge.providerSlug !== provider.provider.slug)) continue;
    const productId = row.assignment?.providerServiceId ??
      (row.observed ? row.candidate?.providerServiceId : undefined);
    const product = provider.services.find((item) => item.id === productId);
    if (!product) continue;
    const resourceId = runtimeEntityIdForEdge(row.edge);
    if (!resourceId || !row.edges.every((edge) => runtimeEntityIdForEdge(edge) === resourceId)) continue;
    if (row.assignment && row.assignment.runtimeEntityId !== resourceId) continue;
    const accountIds = [...new Set(row.edges.map((edge) => edge.accountId?.trim()).filter(Boolean))];
    const regions = [...new Set(row.edges.map((edge) => edge.region?.trim()).filter(Boolean))];
    if (accountIds.length !== 1 || regions.length !== 1 ||
        row.edges.some((edge) => !edge.accountId?.trim() || !edge.region?.trim())) continue;
    const accountId = accountIds[0] as string;
    const region = regions[0] as string;
    const scopeId = `${product.id}|${accountId}|${region}`;
    if (resourceGroups.has(resourceId) && resourceGroups.get(resourceId) !== scopeId) {
      conflicting.add(scopeId);
      conflicting.add(resourceGroups.get(resourceId) as string);
      continue;
    }
    resourceGroups.set(resourceId, scopeId);
    const serviceIds = rowServiceIds(row).map(normalizeClassicServiceId);
    if (serviceIds.length === 0 || serviceIds.some((id) => !id)) continue;
    const ids = [...new Set(serviceIds as string[])].sort();
    const previous = seen.get(scopeId);
    const members = row.edges.flatMap((edge) => {
      const serviceId = normalizeClassicServiceId(edge.serviceClassicId);
      return serviceId ? [{ resourceId, serviceId, location: edge.location || undefined }] : [];
    });
    seen.set(scopeId, {
      scopeId,
      accountId,
      region,
      resourceIds: [...new Set([...(previous?.resourceIds ?? []), resourceId])].sort(),
      resourceNames: [...new Set([...(previous?.resourceNames ?? []), row.edge.targetName])].sort(),
      members: [...(previous?.members ?? []), ...members],
      providerServiceId: product.id,
      providerServiceName: product.name,
      serviceIds: [...new Set([...(previous?.serviceIds ?? []), ...ids])].sort(),
      serviceNames: [...new Set([...(previous?.serviceNames ?? []), ...ids.map((id) => names.get(id) ??
        row.edges.find((edge) => normalizeClassicServiceId(edge.serviceClassicId) === id)?.serviceName ?? id)])].sort(),
      basis: row.assignment && (!previous || previous.basis === "confirmed") ? "confirmed" : "observed",
    });
  }
  return [...seen.values()]
    .filter((candidate) => !conflicting.has(candidate.scopeId))
    .sort((a, b) => a.providerServiceName.localeCompare(b.providerServiceName) ||
      a.accountId.localeCompare(b.accountId) || a.region.localeCompare(b.region));
};

const fnv64 = (value: string): string => {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
};

export const createResourceObjectiveExternalId = (
  providerSlug: string,
  productId: string,
  accountId: string,
  region: string,
): string | null => {
  const provider = normalizeObjectiveTagValue(providerSlug);
  const product = normalizeObjectiveTagValue(productId);
  const account = accountId.trim();
  const normalizedRegion = region.trim();
  if (!provider || !product || !account || !normalizedRegion || account.length > 180 ||
      normalizedRegion.length > 180 || !/^[a-z0-9._:-]+$/i.test(account) ||
      !/^[a-z0-9._:-]+$/i.test(normalizedRegion)) return null;
  return `sla-review-product-${provider}-${product}-${fnv64(`${account}|${normalizedRegion}`)}`;
};

const serviceFilter = (ids: string[]): string | null => {
  const normalized = [...new Set(ids.map(normalizeClassicServiceId))];
  if (normalized.length < 1 || normalized.length > RESOURCE_OBJECTIVE_MAX_SERVICES ||
      normalized.some((id) => !id)) return null;
  return `in(dt.smartscape.service, ${normalized.map((id) => `toSmartscapeId("${id}")`).join(", ")})`;
};

export const createResourceAvailabilitySliQuery = (ids: string[]): string | null => {
  const filter = serviceFilter(ids);
  if (!filter) return null;
  return `timeseries {
  total = sum(dt.service.request.count),
  failures = sum(dt.service.request.failure_count)
}, filter: ${filter}
| fieldsAdd sli = (((total[] - failures[]) / total[]) * 100)
| fieldsRemove total, failures`;
};

export const createResourceAvailabilityPreviewQuery = (ids: string[]): string | null => {
  const filter = serviceFilter(ids);
  if (!filter) return null;
  return `timeseries {
  total = sum(dt.service.request.count, scalar: true),
  failures = sum(dt.service.request.failure_count, scalar: true)
}, by: { dt.smartscape.service }, filter: ${filter}, from:-30d, to:now(), nonempty:true
| fields total_requests = total, failed_requests = failures`;
};

export type ResourceAvailabilityPreview = {
  observedServices: number;
  totalRequests: number;
  failedRequests: number;
  reliability: number | null;
};

export const parseResourceAvailabilityPreview = (
  records: Array<Record<string, unknown>> | undefined,
): ResourceAvailabilityPreview => {
  const rows = records ?? [];
  const numbers = rows.map((row) => ({
    total: typeof row.total_requests === "number" && Number.isFinite(row.total_requests)
      ? row.total_requests : 0,
    failed: typeof row.failed_requests === "number" && Number.isFinite(row.failed_requests)
      ? row.failed_requests : 0,
  }));
  const valid = numbers.filter((row) => row.total > 0 && row.failed >= 0 && row.failed <= row.total);
  const totalRequests = valid.reduce((sum, row) => sum + row.total, 0);
  const failedRequests = valid.reduce((sum, row) => sum + row.failed, 0);
  return {
    observedServices: valid.length,
    totalRequests,
    failedRequests,
    reliability: totalRequests > 0 ? ((totalRequests - failedRequests) / totalRequests) * 100 : null,
  };
};

export const createResourceObjectiveConfig = ({
  providerSlug,
  providerName,
  candidate,
  target,
}: {
  providerSlug: string;
  providerName: string;
  candidate: ResourceObjectiveCandidate;
  target: number;
}): SloConfig | null => {
  const externalId = createResourceObjectiveExternalId(
    providerSlug, candidate.providerServiceId, candidate.accountId, candidate.region,
  );
  const indicator = createResourceAvailabilitySliQuery(candidate.serviceIds);
  if (!externalId || !indicator || !Number.isFinite(target) || target <= 0 || target > 100)
    return null;
  return {
    externalId,
    name: `${providerName} ${candidate.providerServiceName} customer availability (${candidate.region})`.slice(0, 180),
    description: `Customer request availability across ${candidate.serviceIds.length} Dynatrace services and ${candidate.resourceIds.length} resources in one product/account/region scope. Screening only; provider eligibility and contract-period credit remain undetermined.`.slice(0, 250),
    customSli: { indicator },
    criteria: [{ timeframeFrom: OBJECTIVE_EVALUATION_WINDOW, target }],
    tags: [
      MANAGED_OBJECTIVE_TAG,
      `provider:${normalizeObjectiveTagValue(providerSlug)}`,
      `product:${normalizeObjectiveTagValue(candidate.providerServiceId)}`,
      `scope:${fnv64(`${candidate.accountId}|${candidate.region}`)}`,
    ],
  };
};
