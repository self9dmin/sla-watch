import {
  credentialVaultClient,
  type CredentialsDetailsTokenResponseElement,
} from "@dynatrace-sdk/client-classic-environment-v2";
import { mapAwsServiceToDirectoryIds } from "./awsNoticeMappings";

type RequestPayload = {
  accountId?: string;
  credentialId?: string;
  lookbackHours?: number;
};

type AwsSigningCredential = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

type ProviderNotice = {
  id: string;
  source: "aws-health";
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
  affectedResources: ProviderNoticeAffectedResource[];
  url: string;
};

type ProviderNoticeAffectedResource = {
  id: string;
  arn?: string;
  accountId?: string;
  status?: string;
  updateTime?: string;
};

type AwsRequest = {
  host: string;
  region: string;
  service: string;
  target?: string;
  contentType: string;
  body: string;
};

const HEALTH_HOST = "health.us-east-1.amazonaws.com";
const HEALTH_REGION = "us-east-1";
const STS_HOST = "sts.us-east-1.amazonaws.com";
const FETCH_TIMEOUT_MS = 8_000;
const MAX_NOTICES = 100;
const DETAIL_BATCH_SIZE = 10;
const AFFECTED_ENTITY_BATCH_SIZE = 10;
const MAX_AFFECTED_ENTITY_EVENTS = 20;
const MAX_AFFECTED_ENTITY_PAGES = 2;
const MAX_AFFECTED_RESOURCES = 200;
const ACCOUNT_ID_PATTERN = /^\d{12}$/;
const ACCESS_KEY_ID_PATTERN = /^[A-Z0-9]{16,128}$/;
const CREDENTIAL_ID_PATTERN = /^CREDENTIALS_VAULT-[A-F0-9]{16}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const optionalText = (value: unknown): string | undefined => typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
const unique = (values: Array<string | undefined>): string[] => [...new Set(values.filter((value): value is string => Boolean(value)))];
const compactText = (value: unknown, fallback: string): string => {
  const text = optionalText(value)?.replace(/\s+/g, " ") ?? fallback;
  return text.length > 600 ? `${text.slice(0, 597)}...` : text;
};

const parseRequest = (payload: RequestPayload | undefined) => {
  const accountId = optionalText(payload?.accountId);
  const credentialId = optionalText(payload?.credentialId)?.toUpperCase();
  if (!accountId || !ACCOUNT_ID_PATTERN.test(accountId)) throw new Error("Enter a valid 12-digit AWS account ID.");
  if (!credentialId || !CREDENTIAL_ID_PATTERN.test(credentialId)) throw new Error("Enter the full Dynatrace Credential Vault ID shown in Credential Vault.");
  const requestedLookback = typeof payload?.lookbackHours === "number" && Number.isFinite(payload.lookbackHours) ? payload.lookbackHours : 168;
  return { accountId, credentialId, lookbackHours: Math.min(2_160, Math.max(1, Math.round(requestedLookback))) };
};

const parseSigningCredential = (value: string): AwsSigningCredential => {
  if (value.length > 20_000) throw new Error("The Credential Vault token is too large to be an AWS signing credential.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error("The Credential Vault token is not valid AWS signing JSON.");
  }
  if (!isRecord(parsed)) throw new Error("The Credential Vault token must contain AWS signing JSON.");
  const accessKeyId = optionalText(parsed.accessKeyId)?.toUpperCase();
  const secretAccessKey = optionalText(parsed.secretAccessKey);
  const sessionToken = optionalText(parsed.sessionToken);
  if (!accessKeyId || !ACCESS_KEY_ID_PATTERN.test(accessKeyId)) throw new Error("The AWS signing JSON does not contain a valid accessKeyId.");
  if (!secretAccessKey || secretAccessKey.length < 20 || secretAccessKey.length > 256) throw new Error("The AWS signing JSON does not contain a valid secretAccessKey.");
  if (sessionToken && sessionToken.length > 8_192) throw new Error("The AWS sessionToken is too large.");
  return { accessKeyId, secretAccessKey, sessionToken };
};

const readCredential = async (credentialId: string): Promise<AwsSigningCredential> => {
  let result: Awaited<ReturnType<typeof credentialVaultClient.getCredentialsDetails>>;
  try {
    result = await credentialVaultClient.getCredentialsDetails({ id: credentialId });
  } catch {
    throw new Error("The Credential Vault entry could not be read. Verify its AppEngine scope, SLA Review access, and user access.");
  }
  if (result.type !== "TOKEN") throw new Error("The Credential Vault entry must use the Token credential type.");
  const token = optionalText((result as CredentialsDetailsTokenResponseElement).token);
  if (!token) throw new Error("The Credential Vault entry does not contain a token value.");
  return parseSigningCredential(token);
};

const utf8 = (value: string): Uint8Array<ArrayBuffer> => new Uint8Array(new TextEncoder().encode(value));
const hex = (value: ArrayBuffer | Uint8Array<ArrayBuffer>): string => Array.from(value instanceof Uint8Array ? value : new Uint8Array(value))
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");
const sha256 = async (value: string): Promise<string> => hex(await crypto.subtle.digest("SHA-256", utf8(value)));
const hmac = async (key: Uint8Array<ArrayBuffer>, value: string): Promise<Uint8Array<ArrayBuffer>> => {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, utf8(value)));
};

const formatAmzDate = (date: Date): string => date.toISOString().replace(/[:-]|\.\d{3}/g, "");

export const createAwsAuthorization = async (
  request: AwsRequest,
  credential: AwsSigningCredential,
  now: Date,
): Promise<Record<string, string>> => {
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    "content-type": request.contentType,
    host: request.host,
    "x-amz-date": amzDate,
  };
  if (request.target) headers["x-amz-target"] = request.target;
  if (credential.sessionToken) headers["x-amz-security-token"] = credential.sessionToken;
  const signedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaders.map((name) => `${name}:${headers[name].trim().replace(/\s+/g, " ")}\n`).join("");
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders.join(";"), await sha256(request.body)].join("\n");
  const scope = `${dateStamp}/${request.region}/${request.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256(canonicalRequest)].join("\n");
  const dateKey = await hmac(utf8(`AWS4${credential.secretAccessKey}`), dateStamp);
  const regionKey = await hmac(dateKey, request.region);
  const serviceKey = await hmac(regionKey, request.service);
  const signingKey = await hmac(serviceKey, "aws4_request");
  const signature = hex(await hmac(signingKey, stringToSign));
  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${credential.accessKeyId}/${scope}, SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`,
  };
};

const fetchWithTimeout = async (url: string, init: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (isRecord(error) && error.name === "AbortError") throw new Error(`AWS did not respond within ${FETCH_TIMEOUT_MS / 1000} seconds.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const signedPost = async (request: AwsRequest, credential: AwsSigningCredential, now: Date): Promise<Response> => {
  const headers = await createAwsAuthorization(request, credential, now);
  return fetchWithTimeout(`https://${request.host}/`, { method: "POST", headers, body: request.body });
};

const verifyAwsAccount = async (accountId: string, credential: AwsSigningCredential, now: Date): Promise<void> => {
  const body = new URLSearchParams({ Action: "GetCallerIdentity", Version: "2011-06-15" }).toString();
  const response = await signedPost({
    host: STS_HOST,
    region: HEALTH_REGION,
    service: "sts",
    contentType: "application/x-www-form-urlencoded; charset=utf-8",
    body,
  }, credential, now);
  if (!response.ok) throw new Error("AWS STS rejected the signing credential. Verify the access key, secret, optional session token, and tenant clock.");
  const xml = await response.text();
  const returnedAccount = /<Account>(\d{12})<\/Account>/.exec(xml)?.[1];
  if (!returnedAccount) throw new Error("AWS STS returned an invalid account identity response.");
  if (returnedAccount !== accountId) throw new Error(`The vaulted AWS credential belongs to account ${returnedAccount}, not the configured account.`);
};

const healthRequest = async (target: string, body: string, credential: AwsSigningCredential, now: Date): Promise<Response> => signedPost({
  host: HEALTH_HOST,
  region: HEALTH_REGION,
  service: "health",
  target: `AWSHealth_20160804.${target}`,
  contentType: "application/x-amz-json-1.1",
  body,
}, credential, now);

const healthResponseError = async (response: Response): Promise<Error> => {
  let code = "";
  try {
    const body = await response.json() as unknown;
    if (isRecord(body)) code = optionalText(body.__type ?? body.code)?.split("#").pop() ?? "";
  } catch {
    // Status-specific guidance below is sufficient when AWS returns a non-JSON error.
  }
  if (code === "SubscriptionRequiredException") return new Error("AWS Health API access requires Business Support+, Enterprise Support, or Unified Operations for this account.");
  if (response.status === 401) return new Error("AWS rejected the signing credential or request signature.");
  if (response.status === 403) return new Error("AWS denied Health access. Grant health:DescribeEvents, health:DescribeEventDetails, and health:DescribeAffectedEntities to the dedicated identity.");
  if (response.status === 429) return new Error("AWS Health throttled this request. Try again after the provider retry interval.");
  return new Error(`AWS Health returned HTTP ${response.status}${code ? ` (${code})` : ""}.`);
};

const epochDate = (value: unknown): string | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const parsed = new Date(value * 1_000);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

const state = (value: unknown): ProviderNotice["state"] => {
  const normalized = optionalText(value)?.toLowerCase();
  if (normalized === "open") return "ACTIVE";
  if (normalized === "closed") return "CLOSED";
  return "UNKNOWN";
};

const displayService = (value: string): string => value
  .replace(/^AWS_/, "")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (character) => character.toUpperCase());

export const parseAwsHealthEvents = (
  payload: unknown,
  accountId: string,
  descriptions: ReadonlyMap<string, string> = new Map(),
  affectedResources: ReadonlyMap<string, ProviderNoticeAffectedResource[]> = new Map(),
): ProviderNotice[] => {
  if (!isRecord(payload) || (payload.events !== undefined && !Array.isArray(payload.events))) throw new Error("AWS Health returned an invalid response.");
  const events = Array.isArray(payload.events) ? payload.events.slice(0, MAX_NOTICES) : [];
  return events.flatMap((value): ProviderNotice[] => {
    if (!isRecord(value) || optionalText(value.eventScopeCode) !== "ACCOUNT_SPECIFIC") return [];
    const arn = optionalText(value.arn);
    const service = optionalText(value.service);
    if (!arn || !service) return [];
    const typeCode = optionalText(value.eventTypeCode) ?? "AWS Health event";
    const serviceName = displayService(service);
    return [{
      id: arn,
      source: "aws-health",
      sourceScope: accountId,
      title: `${serviceName}: ${typeCode.replace(/^AWS_[A-Z0-9]+_/, "").replace(/_/g, " ").toLowerCase()}`,
      summary: compactText(descriptions.get(arn), `AWS Health reported an account-specific ${optionalText(value.eventTypeCategory)?.toLowerCase() ?? "event"} for ${serviceName}.`),
      state: state(value.statusCode),
      detailedState: optionalText(value.statusCode),
      relevance: "Account-specific event",
      severity: optionalText(value.actionability ?? value.eventTypeCategory),
      startTime: epochDate(value.startTime),
      endTime: epochDate(value.endTime),
      updateTime: epochDate(value.lastUpdatedTime),
      products: [{ id: service, name: serviceName, directoryServiceIds: mapAwsServiceToDirectoryIds(service) }],
      locations: unique([optionalText(value.region), optionalText(value.availabilityZone)]),
      affectedResources: affectedResources.get(arn) ?? [],
      url: "https://health.aws.amazon.com/health/home#/account/dashboard/open-issues",
    }];
  });
};

export const parseAwsAffectedEntities = (payload: unknown): Map<string, ProviderNoticeAffectedResource[]> => {
  if (!isRecord(payload) || (payload.entities !== undefined && !Array.isArray(payload.entities))) {
    throw new Error("AWS Health returned an invalid affected-entity response.");
  }
  const resources = new Map<string, ProviderNoticeAffectedResource[]>();
  const seen = new Set<string>();
  const entities = Array.isArray(payload.entities) ? payload.entities : [];
  entities.slice(0, MAX_AFFECTED_RESOURCES).forEach((value) => {
    if (!isRecord(value)) return;
    const eventArn = optionalText(value.eventArn);
    const arn = optionalText(value.entityArn);
    const entityValue = optionalText(value.entityValue);
    const id = entityValue ?? arn;
    if (!eventArn || !id) return;
    const key = `${eventArn}|${id}|${arn ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    const eventResources = resources.get(eventArn) ?? [];
    eventResources.push({
      id,
      arn,
      accountId: optionalText(value.awsAccountId),
      status: optionalText(value.statusCode),
      updateTime: epochDate(value.lastUpdatedTime),
    });
    resources.set(eventArn, eventResources);
  });
  return resources;
};

const affectedEntities = async (
  arns: string[],
  credential: AwsSigningCredential,
  now: Date,
): Promise<Map<string, ProviderNoticeAffectedResource[]>> => {
  const resources = new Map<string, ProviderNoticeAffectedResource[]>();
  const limitedArns = arns.slice(0, MAX_AFFECTED_ENTITY_EVENTS);
  let resourceCount = 0;
  for (let offset = 0; offset < limitedArns.length && resourceCount < MAX_AFFECTED_RESOURCES; offset += AFFECTED_ENTITY_BATCH_SIZE) {
    const eventArns = limitedArns.slice(offset, offset + AFFECTED_ENTITY_BATCH_SIZE);
    let nextToken: string | undefined;
    for (let page = 0; page < MAX_AFFECTED_ENTITY_PAGES && resourceCount < MAX_AFFECTED_RESOURCES; page += 1) {
      const body = JSON.stringify({
        filter: { eventArns },
        maxResults: 100,
        ...(nextToken ? { nextToken } : {}),
      });
      const response = await healthRequest("DescribeAffectedEntities", body, credential, now);
      if (!response.ok) throw await healthResponseError(response);
      const payload = await response.json() as unknown;
      const pageResources = parseAwsAffectedEntities(payload);
      pageResources.forEach((items, eventArn) => {
        const current = resources.get(eventArn) ?? [];
        const currentKeys = new Set(current.map((item) => `${item.id}|${item.arn ?? ""}`));
        items.forEach((item) => {
          const key = `${item.id}|${item.arn ?? ""}`;
          if (resourceCount >= MAX_AFFECTED_RESOURCES || currentKeys.has(key)) return;
          currentKeys.add(key);
          current.push(item);
          resourceCount += 1;
        });
        resources.set(eventArn, current);
      });
      nextToken = isRecord(payload) ? optionalText(payload.nextToken) : undefined;
      if (!nextToken) break;
    }
  }
  return resources;
};

const eventDescriptions = async (arns: string[], credential: AwsSigningCredential, now: Date): Promise<Map<string, string>> => {
  const descriptions = new Map<string, string>();
  for (let offset = 0; offset < arns.length; offset += DETAIL_BATCH_SIZE) {
    const response = await healthRequest("DescribeEventDetails", JSON.stringify({ eventArns: arns.slice(offset, offset + DETAIL_BATCH_SIZE), locale: "en" }), credential, now);
    if (!response.ok) throw await healthResponseError(response);
    const payload = await response.json() as unknown;
    if (!isRecord(payload) || !Array.isArray(payload.successfulSet)) continue;
    payload.successfulSet.forEach((value) => {
      if (!isRecord(value)) return;
      const event = isRecord(value.event) ? value.event : {};
      const description = isRecord(value.eventDescription) ? value.eventDescription : {};
      const arn = optionalText(event.arn);
      const latestDescription = optionalText(description.latestDescription);
      if (arn && latestDescription) descriptions.set(arn, latestDescription);
    });
  }
  return descriptions;
};

export default async function (payload: RequestPayload = {}) {
  const request = parseRequest(payload);
  const credential = await readCredential(request.credentialId);
  const now = new Date();
  await verifyAwsAccount(request.accountId, credential, now);
  const since = Math.floor((now.getTime() - request.lookbackHours * 60 * 60 * 1_000) / 1_000);
  const response = await healthRequest("DescribeEvents", JSON.stringify({ filter: { lastUpdatedTimes: [{ from: since }] }, maxResults: MAX_NOTICES, locale: "en" }), credential, now);
  if (!response.ok) throw await healthResponseError(response);
  const eventPayload = await response.json() as unknown;
  const summaries = parseAwsHealthEvents(eventPayload, request.accountId);
  const descriptions = await eventDescriptions(summaries.map((notice) => notice.id), credential, now);
  const resources = await affectedEntities(summaries.map((notice) => notice.id), credential, now);
  const notices = parseAwsHealthEvents(eventPayload, request.accountId, descriptions, resources);
  return {
    provider: "aws" as const,
    providerName: "AWS",
    sourceName: "AWS Health account events",
    fetchedAt: now.toISOString(),
    source: "personalized" as const,
    connectionState: "connected" as const,
    scopeLabel: request.accountId,
    message: `AWS returned ${notices.length} account-specific Health event${notices.length === 1 ? "" : "s"} in the selected window.`,
    warning: "AWS Health account events are provider-owned evidence. They do not prove local Dynatrace impact, provider fault, or service credit eligibility.",
    notices,
  };
}
