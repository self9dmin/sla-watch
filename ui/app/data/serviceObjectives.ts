import type { SloConfig } from "@dynatrace-sdk/client-service-level-objectives";

export const MANAGED_OBJECTIVE_TAG = "managed-by:sla-review";
export const OBJECTIVE_EVALUATION_WINDOW = "now-30d";
export const OBJECTIVE_EVALUATION_HOURS = 30 * 24;

const CLASSIC_SERVICE_ID = /^SERVICE-[A-F0-9]+$/;

const safeTagValue = (value: string): string => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 100);

const safeName = (value: string): string => value.trim().replace(/\s+/g, " ").slice(0, 180);

export const normalizeClassicServiceId = (value?: string | null): string | null => {
  const normalized = value?.trim().toUpperCase() ?? "";
  return CLASSIC_SERVICE_ID.test(normalized) ? normalized : null;
};

export const createServiceObjectiveExternalId = (
  providerSlug: string,
  serviceClassicId: string,
): string | null => {
  const serviceId = normalizeClassicServiceId(serviceClassicId);
  const provider = safeTagValue(providerSlug);
  if (!serviceId || !provider) return null;
  return `sla-review-${provider}-${serviceId.toLowerCase()}`;
};

const scopedServiceFilter = (serviceClassicId: string): string | null => {
  const serviceId = normalizeClassicServiceId(serviceClassicId);
  if (!serviceId) return null;
  return `| fieldsAdd target_service = toSmartscapeId(array("${serviceId}")[])\n| filter in(dt.smartscape.service, target_service)`;
};

export const createServiceAvailabilitySliQuery = (serviceClassicId: string): string | null => {
  const filter = scopedServiceFilter(serviceClassicId);
  if (!filter) return null;
  return `timeseries {
  total = sum(dt.service.request.count),
  failures = sum(dt.service.request.failure_count)
}, by: { dt.smartscape.service }
${filter}
| fieldsAdd sli = (((total[] - failures[]) / total[]) * 100)
| fieldsAdd dt.smartscape.entity.name = getNodeName(dt.smartscape.service)
| fieldsRemove total, failures, target_service`;
};

export const createServiceAvailabilityPreviewQuery = (
  serviceClassicId: string,
  lookbackHours: number,
): string | null => {
  const filter = scopedServiceFilter(serviceClassicId);
  if (!filter || !Number.isInteger(lookbackHours) || lookbackHours < 1 || lookbackHours > 2160) return null;
  return `timeseries {
  total = sum(dt.service.request.count, scalar: true),
  failures = sum(dt.service.request.failure_count, scalar: true)
}, by: { dt.smartscape.service }, from:-${lookbackHours}h, to:now(), nonempty:true
${filter}
| fieldsAdd sli = (((total - failures) / total) * 100)
| fields service_name = getNodeName(dt.smartscape.service), total_requests = total, failed_requests = failures, sli`;
};

type CreateServiceObjectiveInput = {
  serviceClassicId: string;
  serviceName: string;
  providerSlug: string;
  providerName: string;
  providerServiceName: string;
  target: number;
};

export const createServiceObjectiveConfig = ({
  serviceClassicId,
  serviceName,
  providerSlug,
  providerName,
  providerServiceName,
  target,
}: CreateServiceObjectiveInput): SloConfig | null => {
  const serviceId = normalizeClassicServiceId(serviceClassicId);
  const externalId = createServiceObjectiveExternalId(providerSlug, serviceClassicId);
  const indicator = createServiceAvailabilitySliQuery(serviceClassicId);
  if (!serviceId || !externalId || !indicator || !Number.isFinite(target) || target <= 0 || target > 100) return null;

  const provider = safeTagValue(providerSlug);
  return {
    name: safeName(`${serviceName} availability (${providerName})`),
    description: safeName(
      `Customer-observed availability for ${serviceName}, mapped to ${providerServiceName}. Built from Dynatrace service requests; provider reports remain separate evidence.`,
    ),
    customSli: { indicator },
    criteria: [{ timeframeFrom: OBJECTIVE_EVALUATION_WINDOW, target }],
    tags: [
      MANAGED_OBJECTIVE_TAG,
      `provider:${provider}`,
      `service:${serviceId.toLowerCase()}`,
    ],
    externalId,
  };
};

const finiteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
};

export type ServiceObjectivePreview = {
  reliability: number | null;
  totalRequests: number;
  failedRequests: number;
};

export const parseServiceObjectivePreview = (
  records: Array<Record<string, unknown>> | undefined,
): ServiceObjectivePreview | null => {
  const row = records?.[0];
  if (!row) return null;
  const totalRequests = finiteNumber(row.total_requests) ?? 0;
  const failedRequests = finiteNumber(row.failed_requests) ?? 0;
  return {
    reliability: finiteNumber(row.sli),
    totalRequests,
    failedRequests,
  };
};
