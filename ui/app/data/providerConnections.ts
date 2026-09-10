import type { ProviderConnectionValue } from "../types";

export const PROVIDER_CONNECTIONS_SCHEMA_ID = "provider-connections";

const PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const CREDENTIAL_ID_PATTERN = /^CREDENTIALS_VAULT-[A-F0-9]{16}$/i;

const requiredText = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export const createProviderConnectionKey = (providerSlug: string, projectId: string): string =>
  `${providerSlug.trim().toLowerCase()}|${projectId.trim().toLowerCase()}`;

export const normalizeProviderConnection = (value: unknown): ProviderConnectionValue | null => {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const providerSlug = requiredText(row.providerSlug)?.toLowerCase();
  const displayName = requiredText(row.displayName);
  const projectId = requiredText(row.projectId)?.toLowerCase();
  const credentialId = requiredText(row.credentialId)?.toUpperCase();
  if (!providerSlug || !displayName || !projectId || !credentialId) return null;

  return {
    connectionKey: requiredText(row.connectionKey) ?? createProviderConnectionKey(providerSlug, projectId),
    providerSlug,
    displayName,
    projectId,
    credentialId,
    enabled: row.enabled !== false,
  };
};

export const validateProviderConnection = (value: ProviderConnectionValue): string[] => {
  const errors: string[] = [];
  if (value.providerSlug !== "gcp") errors.push("Google Cloud is the only personalized provider connection supported in this release.");
  if (!PROJECT_ID_PATTERN.test(value.projectId)) errors.push("Enter a valid Google Cloud project ID.");
  if (!CREDENTIAL_ID_PATTERN.test(value.credentialId)) errors.push("Enter the full Dynatrace Credential Vault ID shown in Credential Vault.");
  return errors;
};
