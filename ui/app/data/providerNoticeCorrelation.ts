import type { ProviderNotice, ProviderNoticeAffectedResource, SmartscapeScopeEdge } from "../types";

export type ProviderNoticeScopeMatch = {
  resourceId: string;
  serviceEntityId: string;
  serviceName: string;
  runtimeEntityId: string;
  runtimeName: string;
};

export type ProviderNoticeCorrelation = {
  matches: ProviderNoticeScopeMatch[];
  matchedResourceCount: number;
  matchedServiceNames: string[];
};

const normalized = (value: string | undefined): string => value?.trim().toLowerCase() ?? "";

const identifierTokens = (value: string | undefined): string[] => {
  const exact = normalized(value);
  if (!exact) return [];
  return Array.from(new Set([
    exact,
    ...exact.split(/[:/\s]+/).filter((token) => token.length >= 6),
  ]));
};

const arnResourceTokens = (value: string | undefined): string[] => {
  const arn = normalized(value);
  if (!arn) return [];
  const parts = arn.split(":");
  const resource = parts.length >= 6 ? parts.slice(5).join(":") : "";
  return Array.from(new Set([arn, ...identifierTokens(resource)]));
};

const awsRegion = (value: string | undefined): string | undefined => {
  const location = normalized(value);
  if (!location || location === "global") return undefined;
  const availabilityZone = /^([a-z]{2}(?:-gov)?-[a-z]+-\d)[a-z]$/.exec(location);
  return availabilityZone?.[1] ?? location;
};

const locationMatches = (notice: ProviderNotice, edge: SmartscapeScopeEdge): boolean => {
  const noticeRegions = new Set(notice.locations.map(awsRegion).filter((value): value is string => Boolean(value)));
  const edgeRegion = awsRegion(edge.region ?? edge.availabilityZone ?? edge.location);
  if (noticeRegions.size === 0 || !edgeRegion) return true;
  return noticeRegions.has(edgeRegion);
};

const accountMatches = (
  notice: ProviderNotice,
  resource: ProviderNoticeAffectedResource,
  edge: SmartscapeScopeEdge,
): boolean => {
  const resourceAccount = normalized(resource.accountId) || (/^\d{12}$/.test(notice.sourceScope ?? "") ? normalized(notice.sourceScope) : "");
  const edgeAccount = normalized(edge.accountId);
  return !resourceAccount || !edgeAccount || resourceAccount === edgeAccount;
};

const resourceMatches = (resource: ProviderNoticeAffectedResource, edge: SmartscapeScopeEdge): boolean => {
  if (edge.targetType === "SERVICE_CLOUD_CONTEXT") return false;
  const resourceId = normalized(resource.id);
  if (/^\d{12}$/.test(resourceId) || /^(?:aws[-_ ]?account|account|global|all|unknown|n\/a)$/.test(resourceId)) return false;
  const resourceTokens = new Set([
    ...identifierTokens(resource.id),
    ...arnResourceTokens(resource.arn),
  ]);
  const edgeTokens = [edge.targetName, edge.targetClassicId, edge.targetNodeId].flatMap(identifierTokens);
  return edgeTokens.some((token) => resourceTokens.has(token));
};

export const correlateProviderNoticeToTopology = (
  notice: ProviderNotice,
  topology: SmartscapeScopeEdge[],
): ProviderNoticeCorrelation => {
  const resources = notice.affectedResources ?? [];
  const matches = new Map<string, ProviderNoticeScopeMatch>();
  const matchedResources = new Set<string>();

  resources.forEach((resource) => {
    topology.forEach((edge) => {
      if (notice.source === "aws-health" && edge.providerSlug && edge.providerSlug !== "aws") return;
      if (!accountMatches(notice, resource, edge) || !locationMatches(notice, edge) || !resourceMatches(resource, edge)) return;
      const serviceEntityId = edge.serviceClassicId ?? edge.serviceNodeId;
      const runtimeEntityId = edge.targetClassicId ?? edge.targetNodeId;
      const key = `${resource.id}|${serviceEntityId}|${runtimeEntityId}`;
      matches.set(key, {
        resourceId: resource.id,
        serviceEntityId,
        serviceName: edge.serviceName,
        runtimeEntityId,
        runtimeName: edge.targetName,
      });
      matchedResources.add(resource.id);
    });
  });

  const values = Array.from(matches.values());
  return {
    matches: values,
    matchedResourceCount: matchedResources.size,
    matchedServiceNames: Array.from(new Set(values.map((match) => match.serviceName))).sort(),
  };
};
