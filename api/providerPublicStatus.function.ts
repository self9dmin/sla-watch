import { mapOciServiceToDirectoryIds } from "./ociNoticeMappings";

type RequestPayload = {
  providerSlug?: string;
  lookbackHours?: number;
};

type ProviderNoticeProduct = {
  id: string;
  name: string;
  directoryServiceIds: string[];
};

export type PublicProviderNotice = {
  id: string;
  source: "provider-public";
  sourceScope: string;
  title: string;
  summary: string;
  state: "ACTIVE" | "CLOSED" | "UNKNOWN";
  detailedState?: string;
  severity?: string;
  startTime?: string;
  endTime?: string;
  updateTime?: string;
  products: ProviderNoticeProduct[];
  locations: string[];
  url: string;
};

type StatusPageConfig = {
  kind: "statuspage";
  name: string;
  endpoint: string;
  statusUrl: string;
};

type OciStatusConfig = {
  kind: "oci";
  name: string;
  endpoint: string;
  statusUrl: string;
};

type PublicProviderConfig = StatusPageConfig | OciStatusConfig;

const PUBLIC_PROVIDER_CONFIGS: Readonly<Record<string, PublicProviderConfig>> = {
  openai: {
    kind: "statuspage",
    name: "OpenAI",
    endpoint: "https://status.openai.com/api/v2/incidents.json",
    statusUrl: "https://status.openai.com",
  },
  anthropic: {
    kind: "statuspage",
    name: "Anthropic",
    endpoint: "https://status.claude.com/api/v2/incidents.json",
    statusUrl: "https://status.claude.com",
  },
  elevenlabs: {
    kind: "statuspage",
    name: "ElevenLabs",
    endpoint: "https://status.elevenlabs.io/api/v2/incidents.json",
    statusUrl: "https://status.elevenlabs.io",
  },
  oci: {
    kind: "oci",
    name: "OCI",
    endpoint: "https://ocistatus.oraclecloud.com/api/v2/components.json",
    statusUrl: "https://ocistatus.oraclecloud.com/incidents/",
  },
};

const FETCH_TIMEOUT_MS = 8_000;
const MAX_NOTICES = 100;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const optionalText = (value: unknown): string | undefined => typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
const requiredText = (value: unknown, field: string): string => {
  const text = optionalText(value);
  if (!text) throw new Error(`The public provider response is missing ${field}.`);
  return text;
};

const compactText = (value: unknown, fallback: string): string => {
  const text = optionalText(value)?.replace(/\s+/g, " ") ?? fallback;
  return text.length > 420 ? `${text.slice(0, 417)}...` : text;
};

const dateTime = (value: unknown): string | undefined => {
  const text = optionalText(value);
  return text && Number.isFinite(Date.parse(text)) ? text : undefined;
};

const timeValue = (...values: Array<string | undefined>): number => Math.max(0, ...values.map((value) => value ? Date.parse(value) : 0).filter(Number.isFinite));

const closedStatus = (value: string): boolean => ["resolved", "postmortem", "completed"].includes(value.toLowerCase());

const uniqueProducts = (value: unknown): ProviderNoticeProduct[] => {
  if (!Array.isArray(value)) return [];
  const products = new Map<string, ProviderNoticeProduct>();
  value.forEach((item) => {
    if (!isRecord(item)) return;
    const id = optionalText(item.id);
    const name = optionalText(item.name);
    if (id && name) products.set(id, { id, name, directoryServiceIds: [] });
  });
  return [...products.values()];
};

const latestUpdateText = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return undefined;
  const updates = value
    .filter(isRecord)
    .map((item) => ({ body: optionalText(item.body), time: timeValue(dateTime(item.updated_at), dateTime(item.created_at)) }))
    .filter((item): item is { body: string; time: number } => Boolean(item.body))
    .sort((left, right) => right.time - left.time);
  return updates[0]?.body;
};

export const parseStatusPageIncidents = (
  payload: unknown,
  providerSlug: string,
  config: Pick<StatusPageConfig, "name" | "statusUrl">,
  since: Date,
): PublicProviderNotice[] => {
  if (!isRecord(payload) || !Array.isArray(payload.incidents)) throw new Error(`${config.name} Status returned an invalid response.`);
  const sinceTime = since.getTime();
  return payload.incidents.map((value): PublicProviderNotice => {
    if (!isRecord(value)) throw new Error(`${config.name} Status returned an invalid incident.`);
    const id = requiredText(value.id, "an incident ID");
    const title = requiredText(value.name, "an incident title");
    const detailedState = optionalText(value.status) ?? "unknown";
    const startTime = dateTime(value.created_at);
    const endTime = dateTime(value.resolved_at);
    const updateTime = dateTime(value.updated_at);
    return {
      id,
      source: "provider-public",
      sourceScope: "Public provider status",
      title: compactText(title, `${config.name} service incident`),
      summary: compactText(latestUpdateText(value.incident_updates), `${config.name} did not provide an incident update.`),
      state: closedStatus(detailedState) || Boolean(endTime) ? "CLOSED" : "ACTIVE",
      detailedState,
      severity: optionalText(value.impact),
      startTime,
      endTime,
      updateTime,
      products: uniqueProducts(value.components),
      locations: [],
      url: `${config.statusUrl}/incidents/${encodeURIComponent(id)}`,
    };
  }).filter((notice) => notice.state === "ACTIVE" || timeValue(notice.endTime, notice.updateTime, notice.startTime) >= sinceTime)
    .sort((left, right) => timeValue(right.updateTime, right.startTime) - timeValue(left.updateTime, left.startTime))
    .slice(0, MAX_NOTICES)
    .map((notice) => ({ ...notice, sourceScope: `Public ${providerSlug} status` }));
};

const normalizedOciStatus = (value: string): string => value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");

export const parseOciComponents = (payload: unknown): PublicProviderNotice[] => {
  if (!isRecord(payload) || !Array.isArray(payload.regionHealthReports)) throw new Error("OCI Status returned an invalid response.");
  const notices: PublicProviderNotice[] = [];
  payload.regionHealthReports.forEach((regionValue) => {
    if (!isRecord(regionValue) || !Array.isArray(regionValue.serviceHealthReports)) return;
    const regionName = optionalText(regionValue.regionName) ?? "Unknown region";
    const regionId = optionalText(regionValue.regionCanonicalName) ?? optionalText(regionValue.regionId) ?? regionName;
    regionValue.serviceHealthReports.forEach((serviceValue) => {
      if (!isRecord(serviceValue)) return;
      const rawStatus = optionalText(serviceValue.serviceStatus) ?? "Unknown";
      if (/^normal\s*performance$/i.test(rawStatus)) return;
      const serviceName = optionalText(serviceValue.serviceName) ?? "OCI service";
      const serviceId = optionalText(serviceValue.serviceCanonicalName) ?? optionalText(serviceValue.serviceId) ?? serviceName;
      const incidents = Array.isArray(serviceValue.incidents) && serviceValue.incidents.length > 0 ? serviceValue.incidents : [{}];
      incidents.forEach((incidentValue, index) => {
        const incident = isRecord(incidentValue) ? incidentValue : {};
        const incidentId = optionalText(incident.incidentId) ?? `${regionId}:${serviceId}:${index}`;
        notices.push({
          id: `${incidentId}:${regionId}:${serviceId}`,
          source: "provider-public",
          sourceScope: "Public oci status",
          title: `${serviceName} in ${regionName}`,
          summary: `${serviceName} reports ${normalizedOciStatus(rawStatus).toLowerCase()} in ${regionName}.`,
          state: "ACTIVE",
          detailedState: rawStatus,
          severity: optionalText(incident.severity) ?? rawStatus,
          products: [{ id: serviceId, name: serviceName, directoryServiceIds: mapOciServiceToDirectoryIds(serviceName) }],
          locations: [regionName],
          url: "https://ocistatus.oraclecloud.com/incidents/",
        });
      });
    });
  });
  return notices.slice(0, MAX_NOTICES);
};

const parseRequest = (payload: RequestPayload | undefined): { providerSlug: string; lookbackHours: number; config: PublicProviderConfig } => {
  const providerSlug = optionalText(payload?.providerSlug)?.toLowerCase() ?? "";
  const config = PUBLIC_PROVIDER_CONFIGS[providerSlug];
  if (!config) throw new Error("This provider does not have a supported public status source.");
  const requestedLookback = typeof payload?.lookbackHours === "number" && Number.isFinite(payload.lookbackHours) ? payload.lookbackHours : 168;
  return { providerSlug, lookbackHours: Math.min(2160, Math.max(1, Math.round(requestedLookback))), config };
};

const fetchWithTimeout = async (url: string): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
  } catch (error: unknown) {
    if (isRecord(error) && error.name === "AbortError") throw new Error(`The public provider endpoint did not respond within ${FETCH_TIMEOUT_MS / 1000} seconds.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export default async function (payload: RequestPayload = {}) {
  const request = parseRequest(payload);
  const response = await fetchWithTimeout(request.config.endpoint);
  if (!response.ok) throw new Error(`${request.config.name} Status returned HTTP ${response.status}.`);
  const responseBody = await response.json() as unknown;
  const notices = request.config.kind === "oci"
    ? parseOciComponents(responseBody)
    : parseStatusPageIncidents(responseBody, request.providerSlug, request.config, new Date(Date.now() - request.lookbackHours * 60 * 60 * 1000));

  return {
    provider: request.providerSlug,
    providerName: request.config.name,
    sourceName: `${request.config.name} public status`,
    fetchedAt: new Date().toISOString(),
    source: "public" as const,
    connectionState: "public" as const,
    message: request.config.kind === "oci"
      ? `Showing ${notices.length} current public OCI service or region disruption${notices.length === 1 ? "" : "s"}.`
      : `Showing ${notices.length} public ${request.config.name} incident${notices.length === 1 ? "" : "s"} in the selected window.`,
    warning: `Public ${request.config.name} status is not customer-specific and does not show whether this Dynatrace environment was affected.`,
    notices,
  };
}
