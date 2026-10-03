import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import { callJev, makeServer } from "./server.mjs";

const packet = {
  schemaVersion: 1,
  requestId: "aws|P-123|2026-10-02T12:00:00.000Z",
  reviewedAt: "2026-10-02T12:00:00.000Z",
  caseId: "aws|P-123",
  problemId: "P-123",
  providerSlug: "aws",
  providerServiceId: "amazon-rds",
  problemClosed: true,
  reviewStatus: "validated",
  reviewCurrent: true,
  scopeConfirmed: true,
  customerTelemetryAvailable: true,
  observedAvailabilityPercent: 98,
  slaTargetPercent: 99.9,
  missingRequirementsCount: 0,
  providerReportStatus: "matched",
  davisImpact: "Service availability degradation",
};

async function withServer(fetchImpl, run, overrides = {}) {
  const server = makeServer({
    bridgeToken: "test-bridge-token",
    jevEndpoint: "http://127.0.0.1:3000/v1/systemone",
    otlpEndpoint: "http://127.0.0.1:14318/v1/traces",
    phoenixBaseUrl: "http://127.0.0.1:6006",
    fetchImpl,
    ...overrides,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("bridge authenticates, calls Jev, exports a redacted route span, and returns a draft route", async () => {
  let jevRequest;
  let otlp;
  await withServer(async (url, options) => {
    if (String(url).includes(":3000/v1/systemone")) {
      jevRequest = JSON.parse(options.body);
      assert.equal(options.headers.authorization, undefined);
      return new Response(JSON.stringify({
        model: "openjev",
        answers: { route: { type: "choice", choice: "prepare_provider_draft", confidence: 0.96,
          probabilities: { prepare_provider_draft: 0.97, internal_only: 0.01, human_review: 0.02 } } },
        usage: { input_tokens: 180, output_tokens: 5 },
      }), { status: 200 });
    }
    otlp = JSON.parse(options.body);
    return new Response("{}", { status: 200 });
  }, async (base) => {
    const unauthorized = await fetch(`${base}/route`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(packet) });
    assert.equal(unauthorized.status, 401);
    const response = await fetch(`${base}/route`, { method: "POST", headers: {
      authorization: "Bearer test-bridge-token", "content-type": "application/json",
    }, body: JSON.stringify(packet) });
    assert.equal(response.status, 200);
    const decision = await response.json();
    assert.equal(decision.route, "prepare_provider_draft");
    assert.equal(decision.providerSubmission, "not_sent");
    assert.equal(decision.traceExported, true);
    assert.match(decision.traceId, /^[0-9a-f]{32}$/);
    assert.equal(decision.requestHash,
      createHash("sha256").update(packet.requestId).digest("hex").slice(0, 24));
    assert.equal(decision.traceId, otlp.resourceSpans[0].scopeSpans[0].spans[0].traceId);
    assert.equal(decision.spanId, otlp.resourceSpans[0].scopeSpans[0].spans[0].spanId);
  });
  assert.equal(jevRequest.state.provider, "aws");
  assert.equal(JSON.stringify(jevRequest).includes(packet.problemId), false);
  const span = otlp.resourceSpans[0].scopeSpans[0].spans[0];
  assert.equal(span.name, "finops.route");
  assert.equal(JSON.stringify(otlp).includes(packet.problemId), false);
  assert.equal(JSON.stringify(otlp).includes(packet.caseId), false);
  const attributeNames = span.attributes.map(({ key }) => key);
  assert.equal(attributeNames.includes("finops.case_hash"), false);
  assert.equal(attributeNames.includes("finops.provider"), false);
  assert.equal(attributeNames.includes("finops.observed_availability_percent"), false);
  assert.equal(attributeNames.includes("finops.sla_target_percent"), false);
});

test("human feedback annotates the Phoenix span with route correctness", async () => {
  let annotation;
  await withServer(async (url, options) => {
    assert.equal(String(url), "http://127.0.0.1:6006/v1/span_annotations?sync=true");
    annotation = JSON.parse(options.body);
    return new Response("{}", { status: 200 });
  }, async (base) => {
    const response = await fetch(`${base}/feedback`, { method: "POST", headers: {
      authorization: "Bearer test-bridge-token", "content-type": "application/json",
    }, body: JSON.stringify({ requestHash: "0123456789abcdef01234567", traceId: "0123456789abcdef0123456789abcdef",
      spanId: "0123456789abcdef", recommendedRoute: "prepare_provider_draft", correctRoute: "internal_only" }) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { annotated: true, correct: false });
  }, { feedbackEnabled: true });
  assert.equal(annotation.data[0].span_id, "0123456789abcdef");
  assert.equal(annotation.data[0].result.score, 0);
  assert.equal(annotation.data[0].annotator_kind, "HUMAN");
});

test("Phoenix feedback is off until cross-system trace identity is verified", async () => {
  await withServer(async () => { throw new Error("Phoenix must not be called"); }, async (base) => {
    const response = await fetch(`${base}/feedback`, { method: "POST", headers: {
      authorization: "Bearer test-bridge-token", "content-type": "application/json",
    }, body: JSON.stringify({}) });
    assert.equal(response.status, 503);
  });
});

test("the model endpoint refuses a non-local HTTPS inference host", async () => {
  await assert.rejects(callJev({}, "https://inference.example/v1/systemone", "", async () => {
    throw new Error("Remote inference must never be called");
  }), /local HTTP or HTTPS/);
});

test("router withholds its result if audit trace export fails", async () => {
  await withServer(async (url) => {
    if (String(url).includes(":3000/v1/systemone")) return new Response(JSON.stringify({
      model: "openjev",
      answers: { route: { type: "choice", choice: "internal_only", confidence: 0.9,
        probabilities: { internal_only: 0.95 } } },
    }), { status: 200 });
    return new Response("{}", { status: 503 });
  }, async (base) => {
    const response = await fetch(`${base}/route`, { method: "POST", headers: {
      authorization: "Bearer test-bridge-token", "content-type": "application/json",
    }, body: JSON.stringify(packet) });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "Decision trace could not be exported; route withheld for review.");
  });
});
