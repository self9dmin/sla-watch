const DEFAULT_PROVIDER_KEYS = ["provider", "vendor", "cloud.provider"] as const;

export type ProviderTagWriteIssue = {
  title: string;
  detail: string;
  code?: number;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const providerTagValue = (tag: string, configuredKey: string, expectedProvider?: string): string | null => {
  const normalized = tag.trim().toLowerCase();
  const normalizedExpected = expectedProvider?.trim().toLowerCase();
  const commonProvider = /^(aws|amazon|azure|microsoft|gcp|google|oci|oracle|ibm|alibaba|cloudflare|stripe|github|openai|anthropic|elevenlabs)$/;
  const keys = Array.from(new Set([configuredKey.trim().toLowerCase(), ...DEFAULT_PROVIDER_KEYS].filter(Boolean))).map(escapeRegExp);
  const keyed = normalized.match(new RegExp(`(?:^|\\[|\\s)(?:${keys.join("|")})\\s*[:=]\\s*([a-z0-9][a-z0-9._-]*)`));
  if (keyed?.[1]) return keyed[1];
  const context = normalized.match(/^\[([a-z0-9][a-z0-9._-]*)\]/);
  if (context?.[1] && (commonProvider.test(context[1]) || context[1] === normalizedExpected)) return context[1];
  return commonProvider.test(normalized) ? normalized : null;
};

export const providerTagValues = (tags: string[], configuredKey: string, expectedProvider?: string): string[] => (
  Array.from(new Set(tags.map((tag) => providerTagValue(tag, configuredKey, expectedProvider)).filter((value): value is string => Boolean(value))))
);

const escapeEntitySelectorValue = (value: string): string => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export const buildEntityIdSelector = (entityIds: string[]): string => {
  if (entityIds.length === 0) throw new Error("At least one service must be selected.");
  const uniqueIds = Array.from(new Set(entityIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) throw new Error("At least one valid service must be selected.");
  if (uniqueIds.some((id) => !/^SERVICE-[A-F0-9]+$/.test(id))) {
    throw new Error("Only Dynatrace service entity IDs can be updated.");
  }
  const selector = `entityId(${uniqueIds.map((id) => `"${escapeEntitySelectorValue(id)}"`).join(",")})`;
  if (selector.length > 2000) throw new Error("Too many services are selected for one update. Apply the tag in smaller batches.");
  return selector;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined => (
  typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined
);

const numericStatus = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d{3}$/.test(value)) return Number(value);
  return undefined;
};

export const providerTagWriteIssue = (error: unknown): ProviderTagWriteIssue => {
  const record = asRecord(error);
  const response = asRecord(record?.response);
  const body = asRecord(record?.body);
  const bodyError = asRecord(body?.error);
  const code = numericStatus(response?.status)
    ?? numericStatus(bodyError?.code)
    ?? numericStatus(record?.status)
    ?? numericStatus(record?.statusCode)
    ?? numericStatus(record?.name);
  const message = [record?.message, bodyError?.message, record?.name]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (code === 401 || /expired|authentication|not authenticated|invalid token/.test(message)) {
    return {
      title: "Dynatrace session expired",
      detail: "Reload SLA Watch, then review the same services before applying the tag again.",
      code: 401,
    };
  }
  if (code === 403 || /forbidden|permission|unauthori[sz]ed|missing scope/.test(message)) {
    return {
      title: "Tag change denied",
      detail: "Ask a tenant administrator to grant Manage monitoring settings access and confirm that SLA Watch is authorized to write entity tags.",
      code: 403,
    };
  }
  if (code === 400 || /entity selector|constraint|invalid request|malformed/.test(message)) {
    return {
      title: "Selected services were rejected",
      detail: "Refresh the service inventory and review the exact services before trying again.",
      code: 400,
    };
  }
  if (code === 404 || /not found|no matching entit/.test(message)) {
    return {
      title: "Selected services are no longer available",
      detail: "Refresh the service inventory. Dynatrace may have replaced or removed one of the selected service entities.",
      code: 404,
    };
  }
  if ((code !== undefined && code >= 500) || /server error|temporarily unavailable|timeout/.test(message)) {
    return {
      title: "Dynatrace could not complete the tag change",
      detail: "The outcome is unverified. Refresh the service inventory before retrying so the same tag is not applied twice.",
      code,
    };
  }
  return {
    title: "Tag change could not be verified",
    detail: "Refresh the service inventory before retrying. If the services remain untagged, review the app and user permissions with a tenant administrator.",
    code,
  };
};
