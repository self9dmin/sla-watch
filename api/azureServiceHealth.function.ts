import {
  credentialVaultClient,
  type CredentialsDetailsTokenResponseElement,
} from "@dynatrace-sdk/client-classic-environment-v2";
import { mapAzureServiceToDirectoryIds } from "./azureNoticeMappings";

type RequestPayload = {
  subscriptionId?: string;
  credentialId?: string;
  lookbackHours?: number;
};

type AzureCredential = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
};

type ProviderNotice = {
  id: string;
  source: "azure-service-health";
  sourceScope: string;
  title: string;
  summary: string;
  state: "ACTIVE" | "CLOSED" | "UNKNOWN";
  detailedState?: string;
  relevance: string;
  severity?: string;
  startTime?: string;
  endTime?: string;
  updateTime?: string;
  products: Array<{ id: string; name: string; directoryServiceIds: string[] }>;
  locations: string[];
  url: string;
};

const FETCH_TIMEOUT_MS = 8_000;
const MAX_NOTICES = 100;
const UUID_PATTERN = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const CREDENTIAL_ID_PATTERN = /^CREDENTIALS_VAULT-[A-F0-9]{16}$/i;
const MANAGEMENT_HOST = "management.azure.com";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const optionalText = (value: unknown): string | undefined => typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
const unique = (values: Array<string | undefined>): string[] => [...new Set(values.filter((value): value is string => Boolean(value)))];
const plainText = (value: unknown, fallback: string): string => {
  const text = (optionalText(value) ?? fallback).replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
  return text.length > 600 ? `${text.slice(0, 597)}...` : text;
};

const parseRequest = (payload: RequestPayload | undefined) => {
  const subscriptionId = optionalText(payload?.subscriptionId)?.toLowerCase();
  const credentialId = optionalText(payload?.credentialId)?.toUpperCase();
  if (!subscriptionId || !UUID_PATTERN.test(subscriptionId)) throw new Error("Enter a valid Azure subscription ID.");
  if (!credentialId || !CREDENTIAL_ID_PATTERN.test(credentialId)) throw new Error("Enter the full Dynatrace Credential Vault ID shown in Credential Vault.");
  const requestedLookback = typeof payload?.lookbackHours === "number" && Number.isFinite(payload.lookbackHours) ? payload.lookbackHours : 168;
  return { subscriptionId, credentialId, lookbackHours: Math.min(2_160, Math.max(1, Math.round(requestedLookback))) };
};

const parseAzureCredential = (value: string): AzureCredential => {
  if (value.length > 20_000) throw new Error("The Credential Vault token is too large to be an Azure client credential.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error("The Credential Vault token is not valid Azure client credential JSON.");
  }
  if (!isRecord(parsed)) throw new Error("The Credential Vault token must contain Azure client credential JSON.");
  const tenantId = optionalText(parsed.tenantId)?.toLowerCase();
  const clientId = optionalText(parsed.clientId)?.toLowerCase();
  const clientSecret = optionalText(parsed.clientSecret);
  if (!tenantId || !UUID_PATTERN.test(tenantId)) throw new Error("The Azure credential JSON does not contain a valid tenantId.");
  if (!clientId || !UUID_PATTERN.test(clientId)) throw new Error("The Azure credential JSON does not contain a valid clientId.");
  if (!clientSecret || clientSecret.length < 8 || clientSecret.length > 4_096) throw new Error("The Azure credential JSON does not contain a valid clientSecret.");
  return { tenantId, clientId, clientSecret };
};

const readCredential = async (credentialId: string): Promise<AzureCredential> => {
  let result: Awaited<ReturnType<typeof credentialVaultClient.getCredentialsDetails>>;
  try {
    result = await credentialVaultClient.getCredentialsDetails({ id: credentialId });
  } catch {
    throw new Error("The Credential Vault entry could not be read. Verify its AppEngine scope, SLA Watch access, and user access.");
  }
  if (result.type !== "TOKEN") throw new Error("The Credential Vault entry must use the Token credential type.");
  const token = optionalText((result as CredentialsDetailsTokenResponseElement).token);
  if (!token) throw new Error("The Credential Vault entry does not contain a token value.");
  return parseAzureCredential(token);
};

const fetchWithTimeout = async (url: string, init: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (isRecord(error) && error.name === "AbortError") throw new Error(`Azure did not respond within ${FETCH_TIMEOUT_MS / 1_000} seconds.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const getAccessToken = async (credential: AzureCredential): Promise<string> => {
  const body = new URLSearchParams({
    client_id: credential.clientId,
    client_secret: credential.clientSecret,
    grant_type: "client_credentials",
    scope: "https://management.azure.com/.default",
  });
  const response = await fetchWithTimeout(`https://login.microsoftonline.com/${credential.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) throw new Error("Microsoft Entra ID rejected the client credential. Verify the tenant ID, client ID, secret, and expiration.");
  const payload = await response.json() as unknown;
  const accessToken = isRecord(payload) ? optionalText(payload.access_token) : undefined;
  if (!accessToken || accessToken.length > 20_000) throw new Error("Microsoft Entra ID returned an invalid access token response.");
  return accessToken;
};

const isoDate = (value: unknown): string | undefined => {
  const text = optionalText(value);
  if (!text) return undefined;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

const noticeState = (value: unknown): ProviderNotice["state"] => {
  const normalized = optionalText(value)?.toLowerCase();
  if (normalized === "active") return "ACTIVE";
  if (normalized === "resolved") return "CLOSED";
  return "UNKNOWN";
};

export const parseAzureServiceHealthEvents = (payload: unknown, subscriptionId: string): ProviderNotice[] => {
  if (!isRecord(payload) || (payload.value !== undefined && !Array.isArray(payload.value))) throw new Error("Azure Service Health returned an invalid response.");
  const events = Array.isArray(payload.value) ? payload.value.slice(0, MAX_NOTICES) : [];
  return events.flatMap((value): ProviderNotice[] => {
    if (!isRecord(value)) return [];
    const properties = isRecord(value.properties) ? value.properties : {};
    const id = optionalText(value.name) ?? optionalText(value.id) ?? optionalText(properties.externalIncidentId);
    if (!id) return [];
    const impacts = Array.isArray(properties.impact) ? properties.impact.filter(isRecord) : [];
    const productsById = new Map<string, ProviderNotice["products"][number]>();
    impacts.forEach((impact) => {
      const name = optionalText(impact.impactedService);
      if (!name) return;
      const productId = optionalText(impact.impactedServiceGuid) ?? name;
      productsById.set(productId, { id: productId, name, directoryServiceIds: mapAzureServiceToDirectoryIds(name) });
    });
    const products = [...productsById.values()];
    const locations = impacts.flatMap((impact) => Array.isArray(impact.impactedRegions)
      ? impact.impactedRegions.filter(isRecord).flatMap((region) => optionalText(region.impactedRegion) ?? [])
      : []);
    const article = isRecord(properties.article) ? properties.article : {};
    const title = plainText(optionalText(properties.title) ?? optionalText(properties.header), "Azure Service Health event");
    return [{
      id,
      source: "azure-service-health",
      sourceScope: subscriptionId,
      title,
      summary: plainText(optionalText(properties.summary) ?? optionalText(properties.description) ?? article.articleContent, "Azure published a Service Health event for this subscription."),
      state: noticeState(properties.status),
      detailedState: optionalText(properties.eventType ?? properties.status),
      relevance: "Subscription event",
      severity: optionalText(properties.eventLevel ?? properties.level),
      startTime: isoDate(properties.impactStartTime),
      endTime: isoDate(properties.impactMitigationTime),
      updateTime: isoDate(properties.lastUpdateTime),
      products,
      locations: unique(locations),
      url: "https://portal.azure.com/#view/Microsoft_Azure_Health/AzureHealthBrowseBlade",
    }];
  });
};

const serviceHealthError = (status: number): Error => {
  if (status === 401) return new Error("Azure Resource Manager rejected the access token.");
  if (status === 403) return new Error("Azure denied Service Health access. Grant Microsoft.ResourceHealth/events/read on the subscription.");
  if (status === 404) return new Error("Azure could not find the configured subscription or Resource Health endpoint.");
  if (status === 429) return new Error("Azure Service Health throttled this request. Try again after the provider retry interval.");
  return new Error(`Azure Service Health returned HTTP ${status}.`);
};

export default async function (payload: RequestPayload = {}) {
  const request = parseRequest(payload);
  const credential = await readCredential(request.credentialId);
  const accessToken = await getAccessToken(credential);
  const now = new Date();
  const since = new Date(now.getTime() - request.lookbackHours * 60 * 60 * 1_000);
  const params = new URLSearchParams({ "api-version": "2025-05-01", queryStartTime: since.toISOString() });
  const response = await fetchWithTimeout(`https://${MANAGEMENT_HOST}/subscriptions/${encodeURIComponent(request.subscriptionId)}/providers/Microsoft.ResourceHealth/events?${params.toString()}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw serviceHealthError(response.status);
  const notices = parseAzureServiceHealthEvents(await response.json() as unknown, request.subscriptionId);
  return {
    provider: "azure" as const,
    providerName: "Azure",
    sourceName: "Azure Service Health subscription events",
    fetchedAt: now.toISOString(),
    source: "personalized" as const,
    connectionState: "connected" as const,
    scopeLabel: request.subscriptionId,
    message: `Azure returned ${notices.length} Service Health event${notices.length === 1 ? "" : "s"} for this subscription in the selected window.`,
    warning: "Azure subscription events are provider-owned evidence. They do not prove local Dynatrace impact, provider fault, or SLA credit eligibility.",
    notices,
  };
}
