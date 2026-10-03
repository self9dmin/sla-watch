import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { pathToFileURL } from "node:url";
import { decideRoute, parseRoutePacket } from "./router.mjs";

const MAX_BODY_BYTES = 16 * 1024;
const REQUEST_HASH = /^[0-9a-f]{24}$/;
const TRACE_ID = /^[0-9a-f]{32}$/;
const SPAN_ID = /^[0-9a-f]{16}$/;
const ROUTES = new Set(["prepare_provider_draft", "internal_only", "human_review"]);
const isLoopback = (url) => ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
  ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;

const json = (response, status, body) => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
};

const authorized = (header, token) => {
  if (!header?.startsWith("Bearer ") || !token) return false;
  const received = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return received.length === expected.length && timingSafeEqual(received, expected);
};

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) throw new TypeError("Route packet is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function callJev(request, endpoint, apiKey, fetchImpl = fetch) {
  const url = new URL(endpoint);
  if (url.pathname !== "/v1/systemone" || !isLoopback(url))
    throw new TypeError("JEV_ENDPOINT must be a local HTTP or HTTPS /v1/systemone URL.");
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}), "content-type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Jev HTTP ${response.status}`);
  return response.json();
}

const attr = (key, value) => ({ key, value: { stringValue: String(value) } });

export async function exportRouteTrace(packet, result, endpoint, fetchImpl = fetch, startedAtMs = Date.now()) {
  const traceId = randomBytes(16).toString("hex");
  const spanId = randomBytes(8).toString("hex");
  const requestHash = createHash("sha256").update(packet.requestId).digest("hex").slice(0, 24);
  if (!endpoint) return { traceId, spanId, requestHash, exported: false };
  const url = new URL(endpoint);
  if (!isLoopback(url) || url.pathname !== "/v1/traces")
    throw new TypeError("OTLP endpoint must be a local /v1/traces URL.");
  const start = (BigInt(startedAtMs) * 1000000n).toString();
  const end = (BigInt(Date.now()) * 1000000n).toString();
  const caseHash = createHash("sha256").update(packet.caseId).digest("hex").slice(0, 24);
  const body = {
    resourceSpans: [{
      resource: { attributes: [attr("service.name", "sla-finops-router")] },
      scopeSpans: [{
        scope: { name: "sla-finops-router" },
        spans: [{
          traceId,
          spanId,
          name: "finops.route",
          kind: 1,
          startTimeUnixNano: start,
          endTimeUnixNano: end,
          attributes: [
            attr("openinference.span.kind", "CHAIN"),
            attr("finops.case_hash", caseHash),
            attr("finops.request_hash", requestHash),
            attr("finops.provider", packet.providerSlug),
            attr("finops.observed_availability_percent", packet.observedAvailabilityPercent ?? "unknown"),
            attr("finops.sla_target_percent", packet.slaTargetPercent ?? "unknown"),
            attr("finops.route", result.route),
            attr("output.value", result.route),
            attr("finops.reason", result.reason),
            attr("finops.source", result.source),
            attr("finops.policy_version", result.policyVersion),
            attr("finops.model_dialect", result.modelDialect ?? "none"),
            attr("finops.model", result.model ?? "none"),
            attr("finops.confidence", result.confidence ?? "unknown"),
            attr("finops.confidence_metric", result.confidenceMetric ?? "none"),
            attr("finops.entropy_confidence", result.entropyConfidence ?? "unknown"),
            attr("finops.selected_probability", result.selectedProbability ?? "unknown"),
            attr("finops.input_tokens", result.inputTokens ?? "unknown"),
            attr("finops.provider_submission", result.providerSubmission),
          ],
          status: { code: 1 },
        }],
      }],
    }],
  };
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`OTLP HTTP ${response.status}`);
  return { traceId, spanId, requestHash, exported: true };
}

/** Human adjudication is the ground truth used to score the earlier route. */
export function parseFeedback(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      typeof value.requestHash !== "string" || !REQUEST_HASH.test(value.requestHash) ||
      typeof value.traceId !== "string" || !TRACE_ID.test(value.traceId) ||
      typeof value.spanId !== "string" || !SPAN_ID.test(value.spanId) ||
      typeof value.recommendedRoute !== "string" || !ROUTES.has(value.recommendedRoute) ||
      typeof value.correctRoute !== "string" || !ROUTES.has(value.correctRoute))
    throw new TypeError("Invalid route feedback.");
  return {
    requestHash: value.requestHash,
    traceId: value.traceId,
    spanId: value.spanId,
    recommendedRoute: value.recommendedRoute,
    correctRoute: value.correctRoute,
  };
}

export async function annotateRouteFeedback(feedback, phoenixBaseUrl, apiKey, fetchImpl = fetch) {
  const url = new URL("/v1/span_annotations?sync=true", phoenixBaseUrl);
  if (!isLoopback(new URL(phoenixBaseUrl)))
    throw new TypeError("Phoenix must be local.");
  const correct = feedback.recommendedRoute === feedback.correctRoute;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ data: [{
      name: "finops_route_correctness",
      annotator_kind: "HUMAN",
      span_id: feedback.spanId,
      identifier: "contract_owner",
      result: { label: correct ? "correct" : "incorrect", score: correct ? 1 : 0,
        explanation: `Human selected ${feedback.correctRoute}.` },
    }] }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`Phoenix annotation HTTP ${response.status}`);
  return { annotated: true, correct };
}

export function makeServer({ bridgeToken, jevEndpoint, jevModel = "openjev", jevDialect = "jev", apiKey,
  otlpEndpoint, phoenixBaseUrl, phoenixApiKey, feedbackEnabled = false, fetchImpl = fetch }) {
  if (!bridgeToken || !jevEndpoint || !otlpEndpoint || !phoenixBaseUrl)
    throw new TypeError("FINOPS_ROUTER_TOKEN, JEV_ENDPOINT, OTLP_TRACES_ENDPOINT, and PHOENIX_BASE_URL are required.");
  if (!["jev", "laya"].includes(jevDialect) || (jevDialect === "laya" && jevModel !== "typed-decisions"))
    throw new TypeError("Unsupported local decision model configuration.");
  return createHttpServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      json(response, 200, { status: "configured", modelEndpointReachable: "not_checked" });
      return;
    }
    if (request.method !== "POST" || !["/route", "/feedback"].includes(request.url)) {
      json(response, 404, { error: "Not found." });
      return;
    }
    if (!authorized(request.headers.authorization, bridgeToken)) {
      json(response, 401, { error: "Unauthorized." });
      return;
    }
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      json(response, 415, { error: "JSON is required." });
      return;
    }
    try {
      if (request.url === "/feedback") {
        if (!feedbackEnabled) {
          json(response, 503, { error: "Phoenix feedback is disabled pending trace identity verification." });
          return;
        }
        const feedback = parseFeedback(await readJson(request));
        const result = await annotateRouteFeedback(feedback, phoenixBaseUrl, phoenixApiKey, fetchImpl);
        json(response, 200, result);
        return;
      }
      const packet = parseRoutePacket(await readJson(request));
      const startedAtMs = Date.now();
      const result = await decideRoute(packet, (body) => callJev(body, jevEndpoint, apiKey, fetchImpl), jevModel, jevDialect);
      let trace;
      try {
        trace = await exportRouteTrace(packet, result, otlpEndpoint, fetchImpl, startedAtMs);
      } catch {
        json(response, 503, { error: "Decision trace could not be exported; route withheld for review." });
        return;
      }
      json(response, 200, { ...result, requestHash: trace.requestHash,
        traceId: trace.traceId, spanId: trace.spanId, traceExported: trace.exported });
    } catch (error) {
      json(response, error instanceof TypeError || error instanceof SyntaxError ? 400 : 500,
        { error: error instanceof TypeError || error instanceof SyntaxError ? "Invalid route packet." : "Router failed." });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = makeServer({
    bridgeToken: process.env.FINOPS_ROUTER_TOKEN,
    jevEndpoint: process.env.JEV_ENDPOINT,
    jevModel: process.env.JEV_MODEL ?? "openjev",
    jevDialect: process.env.JEV_DIALECT ?? "jev",
    apiKey: process.env.JEV_API_KEY,
    otlpEndpoint: process.env.OTLP_TRACES_ENDPOINT,
    phoenixBaseUrl: process.env.PHOENIX_BASE_URL,
    phoenixApiKey: process.env.PHOENIX_API_KEY,
    feedbackEnabled: process.env.FINOPS_FEEDBACK_ENABLED === "1",
  });
  const port = Number.parseInt(process.env.FINOPS_ROUTER_PORT ?? "8787", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new TypeError("Invalid FINOPS_ROUTER_PORT.");
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write(`SLA FinOps router listening on 127.0.0.1:${port}\n`);
  });
}
