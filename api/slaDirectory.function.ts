type LookupPayload = { vendor?: string } | string | undefined;

type CreditTier = {
  below: number;
  credit: number;
};

type CreditPolicy = {
  calculation: string;
  remedy: string | null;
  max_credit_percent: number | null;
  unit: string;
  note: string | null;
  automatic: boolean;
  credit_tiers: CreditTier[];
};

type ClaimProcess = {
  deadline_days: number | null;
  deadline_basis: string | null;
  business_days: boolean;
  method: string | null;
  url: string | null;
  required_evidence: string[];
  review_days: number | null;
  credit_application: string | null;
};

type DirectoryService = {
  id: string;
  name: string;
  category: string | null;
  uptime: number | null;
  sla_eligible: boolean;
  sla_url: string;
  description?: string | null;
  uptime_scope?: string | null;
  last_verified?: string | null;
  credit_policy?: CreditPolicy | null;
};

type DirectoryVendor = {
  slug: string;
  name: string;
  category_name: string;
  uptime: number | null;
  sla_status_label: string;
  last_verified: string;
  services: DirectoryService[];
  sla_url?: string | null;
  website?: string | null;
  scope?: string | null;
  max_credit_percent?: number | null;
  has_automatic_credits?: boolean;
  min_plan_for_sla?: string | null;
  default_credit_policy?: CreditPolicy | null;
  claim_process?: ClaimProcess | null;
  exclusions?: string[];
};

type DirectoryEnvelope = { generated_at: string; result: DirectoryVendor };

const DIRECTORY_TIMEOUT_MS = 8_000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isNullableNumber = (value: unknown): value is number | null => value === null || (typeof value === "number" && Number.isFinite(value));
const isNullableString = (value: unknown): value is string | null => value === null || isString(value);
const hasOwn = (value: Record<string, unknown>, key: string): boolean => key in value;

const parseCreditPolicy = (value: unknown): CreditPolicy | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isRecord(value) || !isString(value.calculation) || !isNullableString(value.remedy) || !isNullableNumber(value.max_credit_percent) || !isString(value.unit) || !isNullableString(value.note) || typeof value.automatic !== "boolean" || !Array.isArray(value.credit_tiers)) return undefined;
  const creditTiers = value.credit_tiers.map((tier): CreditTier | null => {
    if (!isRecord(tier) || typeof tier.below !== "number" || !Number.isFinite(tier.below) || typeof tier.credit !== "number" || !Number.isFinite(tier.credit)) return null;
    return { below: tier.below, credit: tier.credit };
  });
  if (creditTiers.some((tier) => tier === null)) return undefined;
  return {
    calculation: value.calculation,
    remedy: value.remedy,
    max_credit_percent: value.max_credit_percent,
    unit: value.unit,
    note: value.note,
    automatic: value.automatic,
    credit_tiers: creditTiers as CreditTier[],
  };
};

const parseClaimProcess = (value: unknown): ClaimProcess | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isRecord(value) || !isNullableNumber(value.deadline_days) || !isNullableString(value.deadline_basis) || typeof value.business_days !== "boolean" || !isNullableString(value.method) || !isNullableString(value.url) || !Array.isArray(value.required_evidence) || !isNullableNumber(value.review_days) || !isNullableString(value.credit_application) || value.required_evidence.some((item) => !isString(item))) return undefined;
  return {
    deadline_days: value.deadline_days,
    deadline_basis: value.deadline_basis,
    business_days: value.business_days,
    method: value.method,
    url: value.url,
    required_evidence: value.required_evidence as string[],
    review_days: value.review_days,
    credit_application: value.credit_application,
  };
};

const parseDirectoryService = (value: unknown): DirectoryService | null => {
  if (!isRecord(value)) return null;
  if (!isString(value.id) || !isString(value.name) || !isNullableNumber(value.uptime) || typeof value.sla_eligible !== "boolean" || !isString(value.sla_url)) return null;
  const category = value.category === null ? null : isString(value.category) ? value.category : undefined;
  if (category === undefined) return null;
  const service: DirectoryService = {
    id: value.id,
    name: value.name,
    category,
    uptime: value.uptime,
    sla_eligible: value.sla_eligible,
    sla_url: value.sla_url,
  };
  if (hasOwn(value, "description")) {
    if (!isNullableString(value.description)) return null;
    service.description = value.description;
  }
  if (hasOwn(value, "uptime_scope")) {
    if (!isNullableString(value.uptime_scope)) return null;
    service.uptime_scope = value.uptime_scope;
  }
  if (hasOwn(value, "last_verified")) {
    if (!isNullableString(value.last_verified)) return null;
    service.last_verified = value.last_verified;
  }
  if (hasOwn(value, "credit_policy")) {
    const creditPolicy = parseCreditPolicy(value.credit_policy);
    if (creditPolicy === undefined) return null;
    service.credit_policy = creditPolicy;
  }
  return service;
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

  const parsedResult: DirectoryVendor = {
    slug: result.slug,
    name: result.name,
    category_name: result.category_name,
    uptime: result.uptime,
    sla_status_label: result.sla_status_label,
    last_verified: result.last_verified,
    services: services as DirectoryService[],
  };
  if (hasOwn(result, "sla_url")) {
    if (!isNullableString(result.sla_url)) throw new Error("SLA.directory returned an invalid response.");
    parsedResult.sla_url = result.sla_url;
  }
  if (hasOwn(result, "website")) {
    if (!isNullableString(result.website)) throw new Error("SLA.directory returned an invalid response.");
    parsedResult.website = result.website;
  }
  if (hasOwn(result, "scope")) {
    if (!isNullableString(result.scope)) throw new Error("SLA.directory returned an invalid response.");
    parsedResult.scope = result.scope;
  }
  if (hasOwn(result, "max_credit_percent")) {
    if (!isNullableNumber(result.max_credit_percent)) throw new Error("SLA.directory returned an invalid response.");
    parsedResult.max_credit_percent = result.max_credit_percent;
  }
  if (hasOwn(result, "has_automatic_credits")) {
    if (typeof result.has_automatic_credits !== "boolean") throw new Error("SLA.directory returned an invalid response.");
    parsedResult.has_automatic_credits = result.has_automatic_credits;
  }
  if (hasOwn(result, "min_plan_for_sla")) {
    if (!isNullableString(result.min_plan_for_sla)) throw new Error("SLA.directory returned an invalid response.");
    parsedResult.min_plan_for_sla = result.min_plan_for_sla;
  }
  if (hasOwn(result, "default_credit_policy")) {
    const defaultCreditPolicy = parseCreditPolicy(result.default_credit_policy);
    if (defaultCreditPolicy === undefined) throw new Error("SLA.directory returned an invalid response.");
    parsedResult.default_credit_policy = defaultCreditPolicy;
  }
  if (hasOwn(result, "claim_process")) {
    const claimProcess = parseClaimProcess(result.claim_process);
    if (claimProcess === undefined) throw new Error("SLA.directory returned an invalid response.");
    parsedResult.claim_process = claimProcess;
  }
  if (hasOwn(result, "exclusions")) {
    if (!Array.isArray(result.exclusions) || result.exclusions.some((item) => !isString(item))) throw new Error("SLA.directory returned an invalid response.");
    parsedResult.exclusions = result.exclusions as string[];
  }

  return {
    generated_at: payload.generated_at,
    result: parsedResult,
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
      slaUrl: envelope.result.sla_url,
      website: envelope.result.website,
      scope: envelope.result.scope,
      maxCreditPercent: envelope.result.max_credit_percent,
      hasAutomaticCredits: envelope.result.has_automatic_credits,
      minPlanForSla: envelope.result.min_plan_for_sla,
      defaultCreditPolicy: envelope.result.default_credit_policy ? {
        calculation: envelope.result.default_credit_policy.calculation,
        remedy: envelope.result.default_credit_policy.remedy,
        maxCreditPercent: envelope.result.default_credit_policy.max_credit_percent,
        unit: envelope.result.default_credit_policy.unit,
        note: envelope.result.default_credit_policy.note,
        automatic: envelope.result.default_credit_policy.automatic,
        creditTiers: envelope.result.default_credit_policy.credit_tiers,
      } : envelope.result.default_credit_policy,
      claimProcess: envelope.result.claim_process ? {
        deadlineDays: envelope.result.claim_process.deadline_days,
        deadlineBasis: envelope.result.claim_process.deadline_basis,
        businessDays: envelope.result.claim_process.business_days,
        method: envelope.result.claim_process.method,
        url: envelope.result.claim_process.url,
        requiredEvidence: envelope.result.claim_process.required_evidence,
        reviewDays: envelope.result.claim_process.review_days,
        creditApplication: envelope.result.claim_process.credit_application,
      } : envelope.result.claim_process,
      exclusions: envelope.result.exclusions,
    },
    services: envelope.result.services.map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category,
      uptime: service.uptime,
      eligible: service.sla_eligible,
      slaUrl: service.sla_url,
      description: service.description,
      uptimeScope: service.uptime_scope,
      lastVerified: service.last_verified,
      creditPolicy: service.credit_policy ? {
        calculation: service.credit_policy.calculation,
        remedy: service.credit_policy.remedy,
        maxCreditPercent: service.credit_policy.max_credit_percent,
        unit: service.credit_policy.unit,
        note: service.credit_policy.note,
        automatic: service.credit_policy.automatic,
        creditTiers: service.credit_policy.credit_tiers,
      } : service.credit_policy,
    })),
  };
}
