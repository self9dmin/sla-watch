const DEFAULT_PROVIDER_KEYS = ["provider", "vendor", "cloud.provider"] as const;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const providerTagValue = (tag: string, configuredKey: string, expectedProvider?: string): string | null => {
  const normalized = tag.trim().toLowerCase();
  const normalizedExpected = expectedProvider?.trim().toLowerCase();
  const commonProvider = /^(aws|amazon|azure|microsoft|gcp|google|oci|oracle|ibm|alibaba|cloudflare|stripe|github|openai)$/;
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
