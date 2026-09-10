type LookupPayload = { vendor?: string } | string | undefined;

type DirectoryService = {
  id: string;
  name: string;
  category: string | null;
  uptime: number | null;
  sla_eligible: boolean;
  sla_url: string;
};

type DirectoryVendor = {
  slug: string;
  name: string;
  category_name: string;
  uptime: number | null;
  sla_status_label: string;
  last_verified: string;
  services: DirectoryService[];
};

type DirectoryEnvelope = { generated_at: string; result: DirectoryVendor };

const DIRECTORY_TIMEOUT_MS = 8_000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isNullableNumber = (value: unknown): value is number | null => value === null || (typeof value === "number" && Number.isFinite(value));

const parseDirectoryService = (value: unknown): DirectoryService | null => {
  if (!isRecord(value)) return null;
  if (!isString(value.id) || !isString(value.name) || !isNullableNumber(value.uptime) || typeof value.sla_eligible !== "boolean" || !isString(value.sla_url)) return null;
  const category = value.category === null ? null : isString(value.category) ? value.category : undefined;
  if (category === undefined) return null;
  return {
    id: value.id,
    name: value.name,
    category,
    uptime: value.uptime,
    sla_eligible: value.sla_eligible,
    sla_url: value.sla_url,
  };
};

export const parseDirectoryEnvelope = (payload: unknown): DirectoryEnvelope => {
  if (!isRecord(payload) || !isString(payload.generated_at) || !isRecord(payload.result)) {
    throw new Error("SLA.directory returned an invalid response.");
  }

  const result = payload.result;
  const services = Array.isArray(result.services) ? result.services.map(parseDirectoryService) : null;
  if (!isString(result.slug) || !isString(result.name) || !isString(result.category_name) || !isNullableNumber(result.uptime) || !isString(result.sla_status_label) || !isString(result.last_verified) || !services || services.some((service) => service === null)) {
    throw new Error("SLA.directory returned an invalid response.");
  }

  return {
    generated_at: payload.generated_at,
    result: {
      slug: result.slug,
      name: result.name,
      category_name: result.category_name,
      uptime: result.uptime,
      sla_status_label: result.sla_status_label,
      last_verified: result.last_verified,
      services: services as DirectoryService[],
    },
  };
};

const getVendorSlug = (payload: LookupPayload): string => {
  const value = typeof payload === "string" ? payload : payload?.vendor;
  if (!value || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error("Expected a vendor slug such as 'aws'.");
  }
  return value;
};

export default async function (payload: LookupPayload = undefined) {
  const vendorSlug = getVendorSlug(payload);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DIRECTORY_TIMEOUT_MS);

  let envelope: DirectoryEnvelope;
  try {
    const response = await fetch(`https://sla.directory/api/v1/vendors/${encodeURIComponent(vendorSlug)}.json`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`SLA.directory returned HTTP ${response.status} for vendor '${vendorSlug}'.`);
    envelope = parseDirectoryEnvelope(await response.json() as unknown);
  } catch (error: unknown) {
    if (isRecord(error) && error.name === "AbortError") {
      throw new Error(`SLA.directory did not respond within ${DIRECTORY_TIMEOUT_MS / 1000} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  return {
    generatedAt: envelope.generated_at,
    provider: {
      slug: envelope.result.slug,
      name: envelope.result.name,
      category: envelope.result.category_name,
      uptime: envelope.result.uptime,
      status: envelope.result.sla_status_label,
      lastVerified: envelope.result.last_verified,
    },
    services: envelope.result.services.map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category,
      uptime: service.uptime,
      eligible: service.sla_eligible,
      slaUrl: service.sla_url,
    })),
  };
}
