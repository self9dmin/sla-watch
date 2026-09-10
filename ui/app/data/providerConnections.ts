import type { ProviderConnectionValue } from "../types";

export const PROVIDER_CONNECTIONS_SCHEMA_ID = "provider-connections";

const PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const AWS_ACCOUNT_ID_PATTERN = /^\d{12}$/;
const AZURE_SUBSCRIPTION_ID_PATTERN = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const TENANCY_OCID_PATTERN = /^ocid1\.tenancy\.oc1\.[a-z0-9-]*\.[a-z0-9]+$/i;
const OCI_REGION_PATTERN = /^[a-z]{2}-[a-z0-9-]+-\d+$/;
const CREDENTIAL_ID_PATTERN = /^CREDENTIALS_VAULT-[A-F0-9]{16}$/i;

const requiredText = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export const createProviderConnectionKey = (providerSlug: string, scopeId: string): string =>
  `${providerSlug.trim().toLowerCase()}|${scopeId.trim().toLowerCase()}`;

export const providerConnectionScopeId = (value: Pick<ProviderConnectionValue, "providerSlug" | "accountId" | "subscriptionId" | "projectId" | "tenancyId">): string => {
  if (value.providerSlug === "aws") return value.accountId;
  if (value.providerSlug === "azure") return value.subscriptionId;
  if (value.providerSlug === "oci") return value.tenancyId;
  return value.projectId;
};

export const providerConnectionScopeLabel = (value: Pick<ProviderConnectionValue, "providerSlug" | "accountId" | "subscriptionId" | "projectId" | "tenancyId" | "region">): string =>
  value.providerSlug === "oci" ? `${value.tenancyId} · ${value.region}` : providerConnectionScopeId(value);

export const normalizeProviderConnection = (value: unknown): ProviderConnectionValue | null => {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const providerSlug = requiredText(row.providerSlug)?.toLowerCase();
  const displayName = requiredText(row.displayName);
  const accountId = requiredText(row.accountId) ?? "";
  const subscriptionId = requiredText(row.subscriptionId)?.toLowerCase() ?? "";
  const projectId = requiredText(row.projectId)?.toLowerCase() ?? "";
  const tenancyId = requiredText(row.tenancyId) ?? "";
  const region = requiredText(row.region)?.toLowerCase() ?? "";
  const credentialId = requiredText(row.credentialId)?.toUpperCase();
  const scopeId = providerSlug ? providerConnectionScopeId({ providerSlug, accountId, subscriptionId, projectId, tenancyId }) : "";
  if (!providerSlug || !displayName || !scopeId || !credentialId) return null;

  return {
    connectionKey: requiredText(row.connectionKey) ?? createProviderConnectionKey(providerSlug, scopeId),
    providerSlug,
    displayName,
    accountId,
    subscriptionId,
    projectId,
    tenancyId,
    region,
    credentialId,
    enabled: row.enabled !== false,
  };
};

export const validateProviderConnection = (value: ProviderConnectionValue): string[] => {
  const errors: string[] = [];
  if (value.providerSlug === "aws") {
    if (!AWS_ACCOUNT_ID_PATTERN.test(value.accountId)) errors.push("Enter a valid 12-digit AWS account ID.");
  } else if (value.providerSlug === "azure") {
    if (!AZURE_SUBSCRIPTION_ID_PATTERN.test(value.subscriptionId)) errors.push("Enter a valid Azure subscription ID.");
  } else if (value.providerSlug === "gcp") {
    if (!PROJECT_ID_PATTERN.test(value.projectId)) errors.push("Enter a valid Google Cloud project ID.");
  } else if (value.providerSlug === "oci") {
    if (!TENANCY_OCID_PATTERN.test(value.tenancyId)) errors.push("Enter a valid OCI tenancy OCID.");
    if (!OCI_REGION_PATTERN.test(value.region)) errors.push("Enter a valid commercial OCI region, such as us-ashburn-1.");
  } else {
    errors.push("Select a supported provider connection type.");
  }
  if (!CREDENTIAL_ID_PATTERN.test(value.credentialId)) errors.push("Enter the full Dynatrace Credential Vault ID shown in Credential Vault.");
  return errors;
};
