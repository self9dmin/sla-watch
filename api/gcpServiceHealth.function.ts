import {
  credentialVaultClient,
  type CredentialsDetailsTokenResponseElement,
} from "@dynatrace-sdk/client-classic-environment-v2";

type RequestPayload = {
  projectId?: string;
  credentialId?: string;
  lookbackHours?: number;
  requirePersonalized?: boolean;
};

type ProviderNoticeProduct = {
  id: string;
  name: string;
  directoryServiceIds: string[];
};

type ProviderNotice = {
  id: string;
  source: "gcp-personalized" | "gcp-public";
  sourceScope?: string;
  title: string;
  summary: string;
  state: "ACTIVE" | "CLOSED" | "UNKNOWN";
  detailedState?: string;
  relevance?: string;
  severity?: string;
  startTime?: string;
  endTime?: string;
  updateTime?: string;
  products: ProviderNoticeProduct[];
  locations: string[];
  url?: string;
};

type ServiceAccountCredential = {
  type: "service_account";
  client_email: string;
  private_key: string;
  token_uri: "https://oauth2.googleapis.com/token";
};

const FETCH_TIMEOUT_MS = 8_000;
const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";
const GOOGLE_CLOUD_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const PUBLIC_STATUS_URI = "https://status.cloud.google.com/incidents.json";
const PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const CREDENTIAL_ID_PATTERN = /^CREDENTIALS_VAULT-[A-F0-9]{16}$/i;

/* eslint-disable noSecrets/no-secrets -- These are public, stable Google Cloud Status product identifiers, not credentials. */
const GCP_PRODUCT_TO_DIRECTORY_SERVICES: Readonly<Record<string, readonly string[]>> = {
  "L3ggmi3Jy4xJmgodFA9K": ["compute-engine", "compute"],
  "UwaYoXQ5bHYHG6EdiPB8": ["cloud-storage"],
  "hV87iK5DcEXKgWU2kDri": ["cloud-sql"],
  "EcNGGUgBtBLrtm4mWvqC": ["cloud-spanner"],
  "9CcrhHUcFevXPSVaSxkf": ["bigquery"],
  "oW4vJ7VNqyxTWNzSHopX": ["cloud-functions", "functions"],
  "LCSbT57h59oR4W98NHuz": ["gke"],
  "9D7d2iNBQWN24zc1VamE": ["cloud-run"],
  "dFjdLh2v6zuES6t9ADCB": ["pub-sub"],
  "ckSRJf2vQwQy188ULGy3": ["cloud-cdn"],
  "kchyUtnkMHJWaAva8aYc": ["appengine"],
  "TUZUsWSJUVJGW97Jq2sH": ["dns"],
  "LGPLu3M5pcUAKU1z6eP3": ["memorystore"],
  "CETSkT92V21G6A1x28me": ["firestore"],
  "LfZSuE3xdQU46YMFV5fy": ["bigtable"],
  "T9bFoXPqG8w8g1YbWTKY": ["dataflow"],
  "fPovtKbaWN9UTepMm3kJ": ["alloydb"],
  "9Y13BNFy4fJydvjdsN3X": ["apigee"],
  "jog4nyYkquiLeSK5s26q": ["filestore"],
  "hCNpnTQHkUCCGxJy35Yq": ["nat"],
  "ix7u9beT8ivBdjApTif3": ["compute"],
  "vtzMUyQ4z9CbA1x6z85s": ["netapp-volumes"],
  "9H6gWUHvb2ZubeoxzQ1Y": ["vmware-engine"],
  "3zaaDb7antc73BM1UAVT": ["operations"],
  "PuCJ6W2ovoDhLcyvZ1xa": ["operations"],
  "aY6Fbgy6TV4YWoutjhfe": ["firebase-storage"],
};
/* eslint-enable noSecrets/no-secrets */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const optionalText = (value: unknown): string | undefined => typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
const requiredText = (value: unknown, field: string): string => {
  const text = optionalText(value);
  if (!text) throw new Error(`Google Cloud returned an event without ${field}.`);
  return text;
};

const compactText = (value: unknown, fallback: string): string => {
  const text = optionalText(value)?.replace(/\s+/g, " ") ?? fallback;
  return text.length > 420 ? `${text.slice(0, 417)}...` : text;
};

const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

const eventId = (name: string): string => name.split("/").filter(Boolean).at(-1) ?? name;

const noticeState = (value: unknown, hasEndTime = false): ProviderNotice["state"] => {
  if (value === "ACTIVE") return "ACTIVE";
  if (value === "CLOSED" || hasEndTime) return "CLOSED";
  return "UNKNOWN";
};

const mappedProduct = (id: string, name: string): ProviderNoticeProduct => ({
  id,
  name,
  directoryServiceIds: [...(GCP_PRODUCT_TO_DIRECTORY_SERVICES[id] ?? [])],
});

const extractLocationNames = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const location = isRecord(item.location) ? item.location : item;
    const name = optionalText(location.locationName ?? location.title ?? location.id);
    return name ? [name] : [];
  });
};

export const parsePersonalizedEvents = (payload: unknown, projectId: string): ProviderNotice[] => {
  if (!isRecord(payload) || (payload.events !== undefined && !Array.isArray(payload.events))) {
    throw new Error("Google Cloud Service Health returned an invalid response.");
  }
  const events = Array.isArray(payload.events) ? payload.events.slice(0, 100) : [];
  return events.map((value): ProviderNotice => {
    if (!isRecord(value)) throw new Error("Google Cloud Service Health returned an invalid event.");
    const name = requiredText(value.name, "an event ID");
    const impacts = Array.isArray(value.eventImpacts) ? value.eventImpacts : [];
    const products: ProviderNoticeProduct[] = [];
    const locations: string[] = [];
    impacts.forEach((impact) => {
      if (!isRecord(impact)) return;
      const product = isRecord(impact.product) ? impact.product : {};
      const productId = optionalText(product.id);
      const productName = optionalText(product.productName);
      if (productId && productName && !products.some((item) => item.id === productId)) products.push(mappedProduct(productId, productName));
      locations.push(...extractLocationNames([impact.location]));
    });
    const endTime = optionalText(value.endTime);
    return {
      id: eventId(name),
      source: "gcp-personalized",
      sourceScope: projectId,
      title: compactText(value.title, "Google Cloud service health event"),
      summary: compactText(value.description, "Google Cloud did not provide an event description."),
      state: noticeState(value.state, Boolean(endTime)),
      detailedState: optionalText(value.detailedState ?? value.detailedCategory),
      relevance: optionalText(value.relevance),
      startTime: optionalText(value.startTime),
      endTime,
      updateTime: optionalText(value.updateTime),
      products,
      locations: unique(locations),
    };
  }).slice(0, 100);
};

export const parsePublicIncidents = (payload: unknown, since: Date): ProviderNotice[] => {
  if (!Array.isArray(payload)) throw new Error("Google Cloud Status returned an invalid response.");
  const sinceTime = since.getTime();
  return payload.flatMap((value): ProviderNotice[] => {
    if (!isRecord(value)) return [];
    const id = optionalText(value.id);
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return [];
    const startTime = optionalText(value.begin);
    const endTime = optionalText(value.end);
    const updateTime = optionalText(value.modified);
    const relevantTime = Math.max(
      startTime ? new Date(startTime).getTime() : 0,
      endTime ? new Date(endTime).getTime() : 0,
      updateTime ? new Date(updateTime).getTime() : 0,
    );
    if (endTime && (!Number.isFinite(relevantTime) || relevantTime < sinceTime)) return [];

    const products = Array.isArray(value.affected_products) ? value.affected_products.flatMap((item): ProviderNoticeProduct[] => {
      if (!isRecord(item)) return [];
      const productId = optionalText(item.id);
      const productName = optionalText(item.current_title ?? item.title);
      return productId && productName ? [mappedProduct(productId, productName)] : [];
    }) : [];
    const locations = unique([
      ...extractLocationNames(value.currently_affected_locations),
      ...extractLocationNames(value.previously_affected_locations),
    ]);
    return [{
      id,
      source: "gcp-public",
      title: compactText(value.external_desc, "Google Cloud public service incident"),
      summary: compactText(value.external_desc, "Google Cloud did not provide an incident description."),
      state: endTime ? "CLOSED" : "ACTIVE",
      severity: optionalText(value.severity ?? value.status_impact),
      startTime,
      endTime,
      updateTime,
      products,
      locations,
      url: `https://status.cloud.google.com/incidents/${encodeURIComponent(id)}`,
    }];
  }).slice(0, 100);
};

const parseRequest = (payload: RequestPayload | undefined): Required<Pick<RequestPayload, "lookbackHours" | "requirePersonalized">> & Pick<RequestPayload, "projectId" | "credentialId"> => {
  const projectId = optionalText(payload?.projectId)?.toLowerCase();
  const credentialId = optionalText(payload?.credentialId)?.toUpperCase();
  if (Boolean(projectId) !== Boolean(credentialId)) throw new Error("A personalized Google Cloud connection requires both a project ID and a Credential Vault ID.");
  if (projectId && !PROJECT_ID_PATTERN.test(projectId)) throw new Error("The Google Cloud project ID is invalid.");
  if (credentialId && !CREDENTIAL_ID_PATTERN.test(credentialId)) throw new Error("The Dynatrace Credential Vault ID is invalid.");
  const requestedLookback = typeof payload?.lookbackHours === "number" && Number.isFinite(payload.lookbackHours) ? payload.lookbackHours : 168;
  return {
    projectId,
    credentialId,
    lookbackHours: Math.min(2160, Math.max(1, Math.round(requestedLookback))),
    requirePersonalized: payload?.requirePersonalized === true,
  };
};

const withTimeout = async (url: string, init?: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (isRecord(error) && error.name === "AbortError") throw new Error(`The provider endpoint did not respond within ${FETCH_TIMEOUT_MS / 1000} seconds.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const parseServiceAccount = (value: string): ServiceAccountCredential => {
  if (value.length > 20_000) throw new Error("The Credential Vault token is too large to be a Google Cloud service-account JSON key.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error("The Credential Vault token is not valid Google Cloud service-account JSON.");
  }
  if (!isRecord(parsed) || parsed.type !== "service_account") throw new Error("The Credential Vault token must contain a Google Cloud service-account JSON key.");
  const clientEmail = optionalText(parsed.client_email);
  const privateKey = optionalText(parsed.private_key);
  if (!clientEmail?.endsWith(".iam.gserviceaccount.com") || !privateKey?.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("The Credential Vault token does not contain a valid Google Cloud service-account identity and private key.");
  }
  if (parsed.token_uri !== GOOGLE_TOKEN_URI) throw new Error("The service-account token endpoint is not the supported Google OAuth endpoint.");
  return { type: "service_account", client_email: clientEmail, private_key: privateKey, token_uri: GOOGLE_TOKEN_URI };
};

const base64Url = (value: Uint8Array | string): string => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

const pemToBytes = (pem: string): Uint8Array => {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  try {
    return Uint8Array.from(atob(body), (character) => character.charCodeAt(0));
  } catch {
    throw new Error("The Google Cloud private key in Credential Vault is malformed.");
  }
};

const createServiceAccountAssertion = async (credential: ServiceAccountCredential): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: credential.client_email,
    scope: GOOGLE_CLOUD_SCOPE,
    aud: credential.token_uri,
    iat: now,
    exp: now + 3_600,
  }));
  const unsigned = `${header}.${claim}`;
  let key: CryptoKey;
  try {
    const privateKeyBytes = pemToBytes(credential.private_key);
    const privateKeyBuffer = privateKeyBytes.buffer.slice(privateKeyBytes.byteOffset, privateKeyBytes.byteOffset + privateKeyBytes.byteLength) as ArrayBuffer;
    key = await crypto.subtle.importKey(
      "pkcs8",
      privateKeyBuffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    throw new Error("The Google Cloud private key in Credential Vault could not be used for signing.");
  }
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
};

const getAccessToken = async (credential: ServiceAccountCredential): Promise<string> => {
  const assertion = await createServiceAccountAssertion(credential);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const response = await withTimeout(GOOGLE_TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });
  if (!response.ok) throw new Error(`Google OAuth rejected the service-account credential with HTTP ${response.status}.`);
  const payload = await response.json() as unknown;
  if (!isRecord(payload) || !optionalText(payload.access_token)) throw new Error("Google OAuth returned an invalid access-token response.");
  return optionalText(payload.access_token) as string;
};

const readCredential = async (credentialId: string): Promise<ServiceAccountCredential> => {
  let result: Awaited<ReturnType<typeof credentialVaultClient.getCredentialsDetails>>;
  try {
    result = await credentialVaultClient.getCredentialsDetails({ id: credentialId });
  } catch {
    throw new Error("The Credential Vault entry could not be read. Verify its AppEngine scope, app access, and user access.");
  }
  if (result.type !== "TOKEN") throw new Error("The Credential Vault entry must use the Token credential type.");
  const token = optionalText((result as CredentialsDetailsTokenResponseElement).token);
  if (!token) throw new Error("The Credential Vault entry does not contain a token value.");
  return parseServiceAccount(token);
};

const fetchPersonalized = async (projectId: string, credentialId: string, since: Date): Promise<ProviderNotice[]> => {
  const credential = await readCredential(credentialId);
  const accessToken = await getAccessToken(credential);
  const params = new URLSearchParams({
    pageSize: "100",
    view: "EVENT_VIEW_BASIC",
    filter: `category=INCIDENT update_time>=${since.toISOString()}`,
  });
  const response = await withTimeout(`https://servicehealth.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/global/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Google Cloud Service Health returned HTTP ${response.status}. Verify the API and Service Health Viewer role for project '${projectId}'.`);
  return parsePersonalizedEvents(await response.json() as unknown, projectId);
};

const fetchPublic = async (since: Date): Promise<ProviderNotice[]> => {
  const response = await withTimeout(PUBLIC_STATUS_URI, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Google Cloud Status returned HTTP ${response.status}.`);
  return parsePublicIncidents(await response.json() as unknown, since);
};

export default async function (payload: RequestPayload = {}) {
  const request = parseRequest(payload);
  const since = new Date(Date.now() - request.lookbackHours * 60 * 60 * 1000);

  if (request.projectId && request.credentialId) {
    try {
      const notices = await fetchPersonalized(request.projectId, request.credentialId, since);
      return {
        provider: "gcp" as const,
        providerName: "Google Cloud",
        sourceName: "Personalized Service Health",
        fetchedAt: new Date().toISOString(),
        source: "personalized" as const,
        connectionState: "connected" as const,
        projectId: request.projectId,
        message: `Google Cloud returned ${notices.length} project-relevant service health event${notices.length === 1 ? "" : "s"}.`,
        notices,
      };
    } catch (error: unknown) {
      if (request.requirePersonalized) throw error;
      const notices = await fetchPublic(since);
      return {
        provider: "gcp" as const,
        providerName: "Google Cloud",
        sourceName: "Google Cloud Status",
        fetchedAt: new Date().toISOString(),
        source: "public" as const,
        connectionState: "fallback" as const,
        projectId: request.projectId,
        message: `Showing ${notices.length} public Google Cloud incident${notices.length === 1 ? "" : "s"}.`,
        warning: "The personalized project connection could not be read. Public status is shown and is not evidence that this project was affected.",
        notices,
      };
    }
  }

  const notices = await fetchPublic(since);
  return {
    provider: "gcp" as const,
    providerName: "Google Cloud",
    sourceName: "Google Cloud Status",
    fetchedAt: new Date().toISOString(),
    source: "public" as const,
    connectionState: "public" as const,
    message: `Showing ${notices.length} public Google Cloud incident${notices.length === 1 ? "" : "s"}.`,
    warning: "Public status is not project-specific and does not show whether this environment was affected.",
    notices,
  };
}
