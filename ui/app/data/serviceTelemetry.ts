export type ServiceTelemetry = {
  requestCount: number;
  failureCount: number;
};

export type ServiceTelemetryMap = ReadonlyMap<string, ServiceTelemetry>;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};

const textValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const numberValue = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return 0;
};

const serviceKey = (value: string): string => value.trim().toLowerCase();

export const parseServiceTelemetry = (
  data: { records?: unknown[] } | undefined,
): Map<string, ServiceTelemetry> => {
  const telemetry = new Map<string, ServiceTelemetry>();
  const records = Array.isArray(data?.records) ? data.records : [];

  records.forEach((value) => {
    const row = asRecord(value);
    const serviceId = textValue(row.service_classic_id) ?? textValue(row.service_node_id);
    if (!serviceId) return;
    const key = serviceKey(serviceId);
    const current = telemetry.get(key) ?? { requestCount: 0, failureCount: 0 };
    telemetry.set(key, {
      requestCount: current.requestCount + numberValue(row.request_count),
      failureCount: current.failureCount + numberValue(row.failure_count),
    });
  });

  return telemetry;
};

export const summarizeServiceTelemetry = (
  telemetry: ServiceTelemetryMap,
  serviceIds: string[],
): ServiceTelemetry => Array.from(new Set(serviceIds.map(serviceKey))).reduce(
  (summary, id) => {
    const service = telemetry.get(id);
    return service
      ? {
          requestCount: summary.requestCount + service.requestCount,
          failureCount: summary.failureCount + service.failureCount,
        }
      : summary;
  },
  { requestCount: 0, failureCount: 0 },
);
