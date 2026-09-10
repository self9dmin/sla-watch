import type {
  ProviderScopeAssignmentValue,
  SlaProviderResponse,
  SmartscapeScopeEdge,
} from "../types";

export const PROVIDER_SCOPE_ASSIGNMENTS_SCHEMA_ID = "provider-scope-assignments";

export type ProviderServiceCandidate = {
  providerServiceId: string;
  providerServiceName: string;
  evidence: string;
};

export type IncidentProviderServiceCandidate = {
  providerServiceId: string;
  scopeKey: string;
  serviceEntityId: string;
  evidence: string;
};

type RuntimeSignature = {
  pattern: RegExp;
  serviceIds: string[];
  label: string;
};

const RUNTIME_SIGNATURES: Record<string, RuntimeSignature[]> = {
  aws: [
    { pattern: /(?:^|_)EC2(?:_|$)|\.ec2\.internal$/i, serviceIds: ["ec2"], label: "EC2 runtime metadata" },
    { pattern: /(?:^|_)LAMBDA(?:_|$)/i, serviceIds: ["lambda"], label: "Lambda runtime type" },
    { pattern: /(?:^|_)RDS(?:_|$)/i, serviceIds: ["rds", "aurora"], label: "RDS runtime type" },
    { pattern: /(?:^|_)EKS(?:_|$)/i, serviceIds: ["eks"], label: "EKS runtime type" },
    { pattern: /(?:^|_)ECS(?:_|$)/i, serviceIds: ["ecs", "fargate"], label: "ECS runtime type" },
    { pattern: /(?:^|_)DYNAMODB(?:_|$)/i, serviceIds: ["dynamodb"], label: "DynamoDB runtime type" },
    { pattern: /(?:^|_)(?:ELB|ALB|NLB|LOAD_BALANCER)(?:_|$)/i, serviceIds: ["elb"], label: "load balancer runtime type" },
  ],
  azure: [
    { pattern: /(?:^|_)(?:VM|VIRTUAL_MACHINE)(?:_|$)/i, serviceIds: ["virtual-machines"], label: "virtual machine runtime type" },
    { pattern: /(?:^|_)FUNCTION(?:S)?(?:_|$)/i, serviceIds: ["functions", "functions-premium", "functions-consumption"], label: "Functions runtime type" },
    { pattern: /(?:^|_)AKS(?:_|$)|KUBERNETES_SERVICE/i, serviceIds: ["kubernetes-service"], label: "AKS runtime type" },
    { pattern: /(?:^|_)APP_SERVICE(?:_|$)/i, serviceIds: ["app-service", "app-service-standard", "app-service-enterprise"], label: "App Service runtime type" },
    { pattern: /(?:^|_)SQL(?:_DATABASE)?(?:_|$)/i, serviceIds: ["sql-database"], label: "SQL Database runtime type" },
  ],
  gcp: [
    { pattern: /COMPUTE(?:_ENGINE)?|GOOGLE_COMPUTE/i, serviceIds: ["compute-engine", "compute"], label: "Compute Engine runtime type" },
    { pattern: /(?:^|_)GKE(?:_|$)|KUBERNETES_ENGINE/i, serviceIds: ["gke"], label: "GKE runtime type" },
    { pattern: /CLOUD_RUN/i, serviceIds: ["cloud-run"], label: "Cloud Run runtime type" },
    { pattern: /CLOUD_FUNCTION|GOOGLE_FUNCTION/i, serviceIds: ["cloud-functions", "functions"], label: "Cloud Functions runtime type" },
    { pattern: /CLOUD_SQL/i, serviceIds: ["cloud-sql"], label: "Cloud SQL runtime type" },
  ],
  oci: [
    { pattern: /(?:^|_)COMPUTE(?:_|$)|INSTANCE/i, serviceIds: ["compute-multiad", "compute-single"], label: "OCI Compute runtime type" },
    { pattern: /(?:^|_)OKE(?:_|$)|KUBERNETES/i, serviceIds: ["oke"], label: "OKE runtime type" },
    { pattern: /(?:^|_)FUNCTION(?:S)?(?:_|$)/i, serviceIds: ["functions"], label: "OCI Functions runtime type" },
    { pattern: /OBJECT_STORAGE/i, serviceIds: ["object-storage"], label: "Object Storage runtime type" },
    { pattern: /LOAD_BALANCER/i, serviceIds: ["load-balancer"], label: "Load Balancer runtime type" },
  ],
};

const requiredText = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export const serviceEntityIdForEdge = (edge: SmartscapeScopeEdge): string => edge.serviceClassicId ?? edge.serviceNodeId;
export const runtimeEntityIdForEdge = (edge: SmartscapeScopeEdge): string => edge.targetClassicId ?? edge.targetNodeId;

export const createProviderScopeAssignmentKey = (
  providerSlug: string,
  serviceEntityId: string,
  runtimeEntityId: string,
): string => [providerSlug, serviceEntityId, runtimeEntityId]
  .map((value) => value.trim().toLowerCase())
  .join("|");

export const resolveUniqueProviderServiceCandidate = (
  items: IncidentProviderServiceCandidate[],
): IncidentProviderServiceCandidate | undefined => {
  const providerServiceIds = [...new Set(items.map((item) => item.providerServiceId))];
  if (providerServiceIds.length !== 1) return undefined;
  if (items.length === 1) return items[0];
  const serviceEntityIds = [...new Set(items.map((item) => item.serviceEntityId))];
  return {
    providerServiceId: providerServiceIds[0],
    scopeKey: serviceEntityIds.length === 1 ? `service:${serviceEntityIds[0]}` : "provider",
    serviceEntityId: serviceEntityIds[0] ?? "*",
    evidence: items[0].evidence,
  };
};

export const normalizeProviderScopeAssignment = (value: unknown): ProviderScopeAssignmentValue | null => {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const providerSlug = requiredText(row.providerSlug)?.toLowerCase();
  const providerServiceId = requiredText(row.providerServiceId);
  const providerServiceName = requiredText(row.providerServiceName);
  const serviceEntityId = requiredText(row.serviceEntityId);
  const serviceEntityName = requiredText(row.serviceEntityName);
  const runtimeEntityId = requiredText(row.runtimeEntityId);
  const runtimeEntityName = requiredText(row.runtimeEntityName);
  const runtimeType = requiredText(row.runtimeType);
  const evidence = requiredText(row.evidence);
  if (!providerSlug || !providerServiceId || !providerServiceName || !serviceEntityId || !serviceEntityName || !runtimeEntityId || !runtimeEntityName || !runtimeType || !evidence) return null;

  return {
    assignmentKey: requiredText(row.assignmentKey) ?? createProviderScopeAssignmentKey(providerSlug, serviceEntityId, runtimeEntityId),
    providerSlug,
    providerServiceId,
    providerServiceName,
    serviceEntityId,
    serviceEntityName,
    runtimeEntityId,
    runtimeEntityName,
    runtimeType,
    location: requiredText(row.location),
    evidence,
    enabled: row.enabled !== false,
  };
};

export const inferProviderServiceCandidate = (
  edge: SmartscapeScopeEdge,
  provider: SlaProviderResponse,
): ProviderServiceCandidate | null => {
  const providerSlug = provider.provider.slug.toLowerCase();
  if (edge.providerSlug !== providerSlug) return null;
  const signatures = RUNTIME_SIGNATURES[providerSlug] ?? [];
  const runtimeEvidence = `${edge.targetType} ${edge.targetName}`;
  const signature = signatures.find((item) => item.pattern.test(runtimeEvidence));
  if (!signature) return null;
  const service = signature.serviceIds
    .map((id) => provider.services.find((item) => item.id.toLowerCase() === id))
    .find((item) => item !== undefined);
  if (!service) return null;
  return {
    providerServiceId: service.id,
    providerServiceName: service.name,
    evidence: `${signature.label} suggests ${service.name}`,
  };
};
