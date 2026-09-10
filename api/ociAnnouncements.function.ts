import {
  credentialVaultClient,
  type CredentialsDetailsTokenResponseElement,
} from "@dynatrace-sdk/client-classic-environment-v2";
import { mapOciServiceToDirectoryIds } from "./ociNoticeMappings";

type RequestPayload = {
  tenancyId?: string;
  region?: string;
  credentialId?: string;
  lookbackHours?: number;
};

type OciSigningCredential = {
  userOcid: string;
  fingerprint: string;
  privateKey: string;
};

type ProviderNoticeProduct = {
  id: string;
  name: string;
  directoryServiceIds: string[];
};

type ProviderNotice = {
  id: string;
  source: "oci-announcement";
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
  products: ProviderNoticeProduct[];
  locations: string[];
};

const FETCH_TIMEOUT_MS = 8_000;
const MAX_NOTICES = 100;
const TENANCY_OCID_PATTERN = /^ocid1\.tenancy\.oc1\.[a-z0-9-]*\.[a-z0-9]+$/i;
const USER_OCID_PATTERN = /^ocid1\.user\.oc1\.[a-z0-9-]*\.[a-z0-9]+$/i;
const REGION_PATTERN = /^[a-z]{2}-[a-z0-9-]+-\d+$/;
const FINGERPRINT_PATTERN = /^(?:[a-f0-9]{2}:){15}[a-f0-9]{2}$/i;
const CREDENTIAL_ID_PATTERN = /^CREDENTIALS_VAULT-[A-F0-9]{16}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const optionalText = (value: unknown): string | undefined => typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))];
const compactText = (value: unknown, fallback: string): string => {
  const text = optionalText(value)?.replace(/\s+/g, " ") ?? fallback;
  return text.length > 420 ? `${text.slice(0, 417)}...` : text;
};

const textList = (value: unknown): string[] => Array.isArray(value)
  ? unique(value.flatMap((item) => optionalText(item) ?? []))
  : [];

const noticeState = (lifecycleState: unknown, endTime: string | undefined, now: Date): ProviderNotice["state"] => {
  if (endTime && new Date(endTime).getTime() <= now.getTime()) return "CLOSED";
  const normalized = optionalText(lifecycleState)?.toUpperCase();
  if (normalized === "ACTIVE") return "ACTIVE";
  if (normalized === "INACTIVE" || normalized === "DELETED") return "CLOSED";
  return "UNKNOWN";
};

export const parseOciAnnouncements = (payload: unknown, tenancyId: string, now = new Date()): ProviderNotice[] => {
  if (!isRecord(payload) || (payload.items !== undefined && !Array.isArray(payload.items))) {
    throw new Error("OCI Announcements returned an invalid response.");
  }
  const items = Array.isArray(payload.items) ? payload.items.slice(0, MAX_NOTICES) : [];
  return items.flatMap((value): ProviderNotice[] => {
    if (!isRecord(value)) return [];
    const id = optionalText(value.id);
    if (!id) return [];
    const services = textList(value.services);
    const locations = textList(value.affectedRegions);
    const startTime = optionalText(value.timeOneValue ?? value.timeCreated);
    const endTime = optionalText(value.timeTwoValue);
    const reference = optionalText(value.referenceTicketNumber);
    const title = compactText(value.summary, reference ? `OCI announcement ${reference}` : "OCI tenancy announcement");
    const environmentName = optionalText(value.environmentName);
    return [{
      id,
      source: "oci-announcement",
      sourceScope: tenancyId,
      title,
      summary: compactText(
        value.description,
        `${reference ? `Reference ${reference}. ` : ""}OCI issued this announcement for the configured tenancy${environmentName ? ` (${environmentName})` : ""}.`,
      ),
      state: noticeState(value.lifecycleState, endTime, now),
      detailedState: optionalText(value.announcementType ?? value.lifecycleState),
      relevance: "Tenancy announcement",
      severity: optionalText(value.announcementType),
      startTime,
      endTime,
      updateTime: optionalText(value.timeUpdated ?? value.timeCreated),
      products: services.map((service) => ({
        id: service,
        name: service,
        directoryServiceIds: mapOciServiceToDirectoryIds(service),
      })),
      locations,
    }];
  });
};

const parseRequest = (payload: RequestPayload | undefined) => {
  const tenancyId = optionalText(payload?.tenancyId);
  const region = optionalText(payload?.region)?.toLowerCase();
  const credentialId = optionalText(payload?.credentialId)?.toUpperCase();
  if (!tenancyId || !TENANCY_OCID_PATTERN.test(tenancyId)) throw new Error("Enter a valid OCI tenancy OCID.");
  if (!region || !REGION_PATTERN.test(region)) throw new Error("Enter a valid commercial OCI region, such as us-ashburn-1.");
  if (!credentialId || !CREDENTIAL_ID_PATTERN.test(credentialId)) throw new Error("Enter the full Dynatrace Credential Vault ID shown in Credential Vault.");
  const requestedLookback = typeof payload?.lookbackHours === "number" && Number.isFinite(payload.lookbackHours) ? payload.lookbackHours : 168;
  return {
    tenancyId,
    region,
    credentialId,
    lookbackHours: Math.min(2_160, Math.max(1, Math.round(requestedLookback))),
  };
};

const parseSigningCredential = (value: string): OciSigningCredential => {
  if (value.length > 40_000) throw new Error("The Credential Vault token is too large to be an OCI signing credential.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error("The Credential Vault token is not valid OCI signing JSON.");
  }
  if (!isRecord(parsed)) throw new Error("The Credential Vault token must contain OCI signing JSON.");
  const userOcid = optionalText(parsed.userOcid);
  const fingerprint = optionalText(parsed.fingerprint)?.toLowerCase();
  const privateKey = optionalText(parsed.privateKey);
  if (!userOcid || !USER_OCID_PATTERN.test(userOcid)) throw new Error("The OCI signing JSON does not contain a valid userOcid.");
  if (!fingerprint || !FINGERPRINT_PATTERN.test(fingerprint)) throw new Error("The OCI signing JSON does not contain a valid API-key fingerprint.");
  if (!privateKey || !/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(privateKey) || /ENCRYPTED PRIVATE KEY/.test(privateKey)) {
    throw new Error("The OCI signing JSON must contain an unencrypted RSA privateKey in PEM format.");
  }
  return { userOcid, fingerprint, privateKey };
};

const readCredential = async (credentialId: string): Promise<OciSigningCredential> => {
  let result: Awaited<ReturnType<typeof credentialVaultClient.getCredentialsDetails>>;
  try {
    result = await credentialVaultClient.getCredentialsDetails({ id: credentialId });
  } catch {
    throw new Error("The Credential Vault entry could not be read. Verify its AppEngine scope, SLA Watch access, and user access.");
  }
  if (result.type !== "TOKEN") throw new Error("The Credential Vault entry must use the Token credential type.");
  const token = optionalText((result as CredentialsDetailsTokenResponseElement).token);
  if (!token) throw new Error("The Credential Vault entry does not contain a token value.");
  return parseSigningCredential(token);
};

const bytesFromPem = (pem: string): { bytes: Uint8Array; pkcs1: boolean } => {
  // eslint-disable-next-line noSecrets/no-secrets -- This public PEM marker identifies a key format; it is not credential material.
  const pkcs1 = pem.includes("-----BEGIN RSA PRIVATE KEY-----");
  const body = pem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  try {
    return { bytes: Uint8Array.from(atob(body), (character) => character.charCodeAt(0)), pkcs1 };
  } catch {
    throw new Error("The OCI private key in Credential Vault is malformed.");
  }
};

const derLength = (length: number): Uint8Array => {
  if (length < 128) return Uint8Array.of(length);
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>>= 8;
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
};

const concatBytes = (...parts: Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
};

const wrapPkcs1AsPkcs8 = (pkcs1: Uint8Array): Uint8Array => {
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const rsaAlgorithm = Uint8Array.of(0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00);
  const privateKey = concatBytes(Uint8Array.of(0x04), derLength(pkcs1.length), pkcs1);
  const body = concatBytes(version, rsaAlgorithm, privateKey);
  return concatBytes(Uint8Array.of(0x30), derLength(body.length), body);
};

const base64 = (value: ArrayBuffer): string => {
  let binary = "";
  new Uint8Array(value).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

export const buildOciAnnouncementsRequest = (tenancyId: string, region: string, since: Date) => {
  const host = `announcements.${region}.oraclecloud.com`;
  const pathname = "/20180904/announcements";
  const params = new URLSearchParams({
    compartmentId: tenancyId,
    limit: String(MAX_NOTICES),
    sortBy: "timeCreated",
    sortOrder: "DESC",
    timeOneEarliestTime: since.toISOString(),
    shouldShowOnlyLatestInChain: "true",
  });
  const requestTarget = `${pathname}?${params.toString()}`;
  return { host, requestTarget, url: `https://${host}${requestTarget}` };
};

const createAuthorization = async (
  requestTarget: string,
  host: string,
  xDate: string,
  tenancyId: string,
  credential: OciSigningCredential,
): Promise<string> => {
  const decoded = bytesFromPem(credential.privateKey);
  const keyBytes = decoded.pkcs1 ? wrapPkcs1AsPkcs8(decoded.bytes) : decoded.bytes;
  let key: CryptoKey;
  try {
    const buffer = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer;
    key = await crypto.subtle.importKey("pkcs8", buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  } catch {
    throw new Error("The OCI private key in Credential Vault could not be used for request signing.");
  }
  const signingString = `(request-target): get ${requestTarget}\nhost: ${host}\nx-date: ${xDate}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingString));
  const keyId = `${tenancyId}/${credential.userOcid}/${credential.fingerprint}`;
  return `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) host x-date",signature="${base64(signature)}"`;
};

const fetchWithTimeout = async (url: string, init: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (isRecord(error) && error.name === "AbortError") throw new Error(`OCI Announcements did not respond within ${FETCH_TIMEOUT_MS / 1000} seconds.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const responseError = (status: number): Error => {
  if (status === 401) return new Error("OCI rejected the signing credential. Verify the API key, fingerprint, user OCID, tenancy OCID, and tenant clock.");
  if (status === 403) return new Error("OCI denied Announcements access. Grant the API user 'inspect announcements in tenancy'.");
  if (status === 404) return new Error("OCI could not find this tenancy or regional Announcements endpoint.");
  if (status === 429) return new Error("OCI Announcements throttled this request. Try again after the provider retry interval.");
  return new Error(`OCI Announcements returned HTTP ${status}.`);
};

export default async function (payload: RequestPayload = {}) {
  const request = parseRequest(payload);
  const credential = await readCredential(request.credentialId);
  const now = new Date();
  const since = new Date(now.getTime() - request.lookbackHours * 60 * 60 * 1_000);
  const target = buildOciAnnouncementsRequest(request.tenancyId, request.region, since);
  const xDate = now.toUTCString();
  const authorization = await createAuthorization(target.requestTarget, target.host, xDate, request.tenancyId, credential);
  const response = await fetchWithTimeout(target.url, {
    headers: { Accept: "application/json", Authorization: authorization, "x-date": xDate },
  });
  if (!response.ok) throw responseError(response.status);
  const notices = parseOciAnnouncements(await response.json() as unknown, request.tenancyId, now);
  return {
    provider: "oci" as const,
    providerName: "Oracle Cloud Infrastructure",
    sourceName: "OCI tenancy announcements",
    fetchedAt: now.toISOString(),
    source: "personalized" as const,
    connectionState: "connected" as const,
    scopeLabel: request.tenancyId,
    message: `OCI returned ${notices.length} tenancy announcement${notices.length === 1 ? "" : "s"} in the selected window.`,
    warning: "OCI tenancy announcements are customer-specific provider communications. They do not prove local Dynatrace impact, provider fault, or SLA credit eligibility.",
    notices,
  };
}
