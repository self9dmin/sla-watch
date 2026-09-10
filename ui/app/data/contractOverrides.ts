import type {
  ContractContext,
  ContractOverrideRecord,
  ContractOverrideValue,
  EffectiveContractTerms,
  SlaProviderResponse,
} from "../types";

export const CONTRACT_OVERRIDES_SCHEMA_ID = "contract-overrides";

const optionalText = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const optionalNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0 && Number.isFinite(Number(value))) return Number(value);
  return null;
};

const optionalTextList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const text = optionalText(item);
    return text ? [text] : [];
  });
};

export const getOverrideScopeIds = (
  value: Pick<ContractOverrideValue, "scopeEntityId"> & Partial<Pick<ContractOverrideValue, "scopeEntityIds">>,
): string[] => {
  const values = [...new Set(optionalTextList(value.scopeEntityIds))];
  if (values.length > 0) return values;
  const fallback = optionalText(value.scopeEntityId);
  return fallback ? [fallback] : [];
};

export const getOverrideScopeNames = (
  value: Pick<ContractOverrideValue, "scopeEntityName"> & Partial<Pick<ContractOverrideValue, "scopeEntityNames">>,
): string[] => {
  const values = optionalTextList(value.scopeEntityNames);
  if (values.length > 0) return values;
  const fallback = optionalText(value.scopeEntityName);
  return fallback ? [fallback] : [];
};

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const normalizedScopeIdentity = (
  value: Pick<ContractOverrideValue, "scopeEntityId"> & Partial<Pick<ContractOverrideValue, "scopeEntityIds">>,
): string[] => getOverrideScopeIds(value).map((item) => item.toLowerCase()).sort();

export const createOverrideKey = ({
  providerSlug,
  providerServiceId,
  scopeKind,
  scopeEntityId,
  scopeEntityIds,
}: Pick<ContractOverrideValue, "providerSlug" | "providerServiceId" | "scopeKind" | "scopeEntityId"> & Partial<Pick<ContractOverrideValue, "scopeEntityIds">>): string => {
  const scopeIds = normalizedScopeIdentity({ scopeEntityId, scopeEntityIds });
  const scopeKey = scopeIds.length <= 1 ? (scopeIds[0] ?? "") : `set-${scopeIds.length}-${stableHash(scopeIds.join("\u001f"))}`;
  return [providerSlug, providerServiceId, scopeKind, scopeKey]
    .map((value) => value.trim().toLowerCase())
    .join("|");
};

export const sameOverrideIdentity = (
  left: Pick<ContractOverrideValue, "providerSlug" | "providerServiceId" | "scopeKind" | "scopeEntityId"> & Partial<Pick<ContractOverrideValue, "scopeEntityIds">>,
  right: Pick<ContractOverrideValue, "providerSlug" | "providerServiceId" | "scopeKind" | "scopeEntityId"> & Partial<Pick<ContractOverrideValue, "scopeEntityIds">>,
): boolean => (
  left.providerSlug.toLowerCase() === right.providerSlug.toLowerCase() &&
  left.providerServiceId === right.providerServiceId &&
  left.scopeKind === right.scopeKind &&
  normalizedScopeIdentity(left).join("\u001f") === normalizedScopeIdentity(right).join("\u001f")
);

export const normalizeContractOverride = (value: unknown): ContractOverrideValue | null => {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const providerSlug = optionalText(row.providerSlug);
  const providerServiceId = optionalText(row.providerServiceId);
  const providerServiceName = optionalText(row.providerServiceName);
  const scopeKind = row.scopeKind;
  const legacyScopeEntityId = optionalText(row.scopeEntityId);
  const legacyScopeEntityName = optionalText(row.scopeEntityName);
  const scopeEntityIds = [...new Set(optionalTextList(row.scopeEntityIds))];
  const scopeEntityNames = optionalTextList(row.scopeEntityNames);
  if (scopeEntityIds.length === 0 && legacyScopeEntityId) scopeEntityIds.push(legacyScopeEntityId);
  if (scopeEntityNames.length === 0 && legacyScopeEntityName) scopeEntityNames.push(legacyScopeEntityName);
  const scopeEntityId = scopeEntityIds[0];
  const scopeEntityName = scopeEntityNames[0] ?? scopeEntityId;
  const sourceReference = optionalText(row.sourceReference);
  const effectiveFrom = optionalText(row.effectiveFrom);

  if (
    !providerSlug || !providerServiceId || !providerServiceName || !scopeEntityId ||
    !scopeEntityName || !sourceReference || !effectiveFrom ||
    !["provider", "service", "host", "location"].includes(String(scopeKind))
  ) return null;

  const normalized: ContractOverrideValue = {
    overrideKey: optionalText(row.overrideKey) ?? createOverrideKey({
      providerSlug,
      providerServiceId,
      scopeKind: scopeKind as ContractOverrideValue["scopeKind"],
      scopeEntityId,
    }),
    providerSlug: providerSlug.toLowerCase(),
    providerServiceId,
    providerServiceName,
    scopeKind: scopeKind as ContractOverrideValue["scopeKind"],
    scopeEntityId,
    scopeEntityName,
    scopeEntityIds,
    scopeEntityNames: scopeEntityIds.map((id, index) => scopeEntityNames[index] ?? (index === 0 ? scopeEntityName : id)),
    location: optionalText(row.location),
    availabilityTarget: optionalNumber(row.availabilityTarget),
    filingDeadlineDays: optionalNumber(row.filingDeadlineDays),
    deadlineBasis: optionalText(row.deadlineBasis),
    businessDays: row.businessDays === true,
    maxCreditPercent: optionalNumber(row.maxCreditPercent),
    claimMethod: optionalText(row.claimMethod),
    effectiveFrom,
    effectiveTo: optionalText(row.effectiveTo),
    sourceReference,
    sourceUrl: optionalText(row.sourceUrl),
    notes: optionalText(row.notes),
    enabled: row.enabled !== false,
  };

  return normalized;
};

export const overrideMatchesContext = (
  override: ContractOverrideValue,
  context: ContractContext,
  now = new Date(),
): boolean => {
  if (!override.enabled || override.providerSlug !== context.providerSlug.toLowerCase()) return false;
  if (override.providerServiceId !== "*" && override.providerServiceId !== context.providerServiceId) return false;

  const date = now.toISOString().slice(0, 10);
  if (override.effectiveFrom > date || (override.effectiveTo && override.effectiveTo < date)) return false;

  if (override.scopeKind === "provider") return true;
  const scopeIds = getOverrideScopeIds(override);
  if (override.scopeKind === "service") return Boolean(context.serviceId && scopeIds.includes(context.serviceId));
  if (override.scopeKind === "host") return Boolean(context.hostId && scopeIds.includes(context.hostId));
  return Boolean(context.location && scopeIds.some((id) => id.toLowerCase() === context.location?.toLowerCase()));
};

const scopeRank: Record<ContractOverrideValue["scopeKind"], number> = {
  provider: 10,
  service: 20,
  location: 30,
  host: 40,
};

const baselineTerms = (
  directory: SlaProviderResponse,
  providerServiceId: string,
): EffectiveContractTerms => {
  const service = directory.services.find((item) => item.id === providerServiceId);
  const policy = service?.creditPolicy ?? directory.provider.defaultCreditPolicy;
  return {
    availabilityTarget: service?.uptime ?? directory.provider.uptime,
    filingDeadlineDays: directory.provider.claimProcess?.deadlineDays ?? null,
    deadlineBasis: directory.provider.claimProcess?.deadlineBasis ?? null,
    businessDays: directory.provider.claimProcess?.businessDays ?? false,
    maxCreditPercent: policy?.maxCreditPercent ?? directory.provider.maxCreditPercent ?? null,
    claimMethod: directory.provider.claimProcess?.method ?? null,
    source: "sla.directory",
    appliedOverrides: [],
  };
};

export const resolveEffectiveContractTerms = (
  directory: SlaProviderResponse,
  overrides: ContractOverrideRecord[],
  context: ContractContext,
  now = new Date(),
): EffectiveContractTerms => {
  const baseline = baselineTerms(directory, context.providerServiceId);
  const matches = overrides
    .filter((override) => overrideMatchesContext(override, context, now))
    .sort((left, right) => {
      const rank = scopeRank[left.scopeKind] - scopeRank[right.scopeKind];
      if (rank !== 0) return rank;
      const serviceSpecificity = Number(left.providerServiceId !== "*") - Number(right.providerServiceId !== "*");
      if (serviceSpecificity !== 0) return serviceSpecificity;
      return left.effectiveFrom.localeCompare(right.effectiveFrom);
    });

  if (matches.length === 0) return baseline;

  return matches.reduce<EffectiveContractTerms>((terms, override) => ({
    availabilityTarget: override.availabilityTarget ?? terms.availabilityTarget,
    filingDeadlineDays: override.filingDeadlineDays ?? terms.filingDeadlineDays,
    deadlineBasis: override.deadlineBasis ?? terms.deadlineBasis,
    businessDays: override.filingDeadlineDays !== null && override.filingDeadlineDays !== undefined
      ? override.businessDays
      : terms.businessDays,
    maxCreditPercent: override.maxCreditPercent ?? terms.maxCreditPercent,
    claimMethod: override.claimMethod ?? terms.claimMethod,
    source: "tenant override",
    appliedOverrides: [...terms.appliedOverrides, override],
  }), baseline);
};

export const validateContractOverride = (value: ContractOverrideValue): string[] => {
  const errors: string[] = [];
  const scopeIds = getOverrideScopeIds(value);
  if (!value.sourceReference.trim()) errors.push("Enter the contract or amendment reference used for this override.");
  if (!value.effectiveFrom) errors.push("Choose the date when these terms take effect.");
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) errors.push("The end date must be on or after the effective date.");
  if (
    value.availabilityTarget === null && value.filingDeadlineDays === null &&
    value.maxCreditPercent === null && !value.claimMethod?.trim()
  ) errors.push("Override at least one operational term.");
  if (value.availabilityTarget !== null && value.availabilityTarget !== undefined && (value.availabilityTarget < 0 || value.availabilityTarget > 100)) errors.push("Availability must be between 0 and 100 percent.");
  if (value.maxCreditPercent !== null && value.maxCreditPercent !== undefined && (value.maxCreditPercent < 0 || value.maxCreditPercent > 100)) errors.push("Maximum credit must be between 0 and 100 percent.");
  if (value.filingDeadlineDays !== null && value.filingDeadlineDays !== undefined && (value.filingDeadlineDays < 0 || value.filingDeadlineDays > 365)) errors.push("The filing deadline must be between 0 and 365 days.");
  if (value.scopeKind !== "provider" && scopeIds.length === 0) errors.push("Select at least one Dynatrace evidence target.");
  if (scopeIds.length > 100) errors.push("Select no more than 100 Dynatrace evidence targets for one SLA override.");
  return errors;
};
