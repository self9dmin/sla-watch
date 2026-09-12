import {
  createServiceAvailabilityPreviewQuery,
  createServiceAvailabilitySliQuery,
  createServiceObjectiveConfig,
  createServiceObjectiveExternalId,
  normalizeClassicServiceId,
  parseServiceObjectivePreview,
} from "../ui/app/data/serviceObjectives";

describe("service objectives", () => {
  it("accepts only exact classic service IDs", () => {
    expect(normalizeClassicServiceId(" service-a0b1c2 ")).toBe("SERVICE-A0B1C2");
    expect(normalizeClassicServiceId("SERVICE-1\") | fetch logs")).toBeNull();
    expect(normalizeClassicServiceId("HOST-A0B1C2")).toBeNull();
  });

  it("creates a deterministic provider and service identity", () => {
    expect(createServiceObjectiveExternalId("AWS", "SERVICE-A0B1C2"))
      .toBe("sla-review-aws-service-a0b1c2");
  });

  it("builds a bounded preview from service request metrics", () => {
    const query = createServiceAvailabilityPreviewQuery("SERVICE-A0B1C2", 168);
    expect(query).toContain("sum(dt.service.request.count, scalar: true)");
    expect(query).toContain("sum(dt.service.request.failure_count, scalar: true)");
    expect(query).toContain("from:-168h, to:now()");
    expect(query).toContain('toSmartscapeId(array("SERVICE-A0B1C2")[])');
    expect(createServiceAvailabilityPreviewQuery("SERVICE-A0B1C2", 0)).toBeNull();
  });

  it("uses the official array SLI shape for a Dynatrace objective", () => {
    const query = createServiceAvailabilitySliQuery("SERVICE-A0B1C2");
    expect(query).toContain("total[] - failures[]");
    expect(query).not.toContain("from:");
  });

  it("creates one custom SLI without mixing in a template reference", () => {
    const config = createServiceObjectiveConfig({
      serviceClassicId: "SERVICE-A0B1C2",
      serviceName: "Checkout",
      providerSlug: "aws",
      providerName: "AWS",
      providerServiceName: "Amazon EC2",
      target: 99.99,
    });

    expect(config).toMatchObject({
      name: "Checkout availability (AWS)",
      externalId: "sla-review-aws-service-a0b1c2",
      criteria: [{ timeframeFrom: "now-30d", target: 99.99 }],
      tags: ["managed-by:sla-review", "provider:aws", "service:service-a0b1c2"],
    });
    expect(config?.customSli?.indicator).toContain("dt.service.request.failure_count");
    expect(config?.sliReference).toBeUndefined();
  });

  it("rejects invalid targets and parses preview values safely", () => {
    expect(createServiceObjectiveConfig({
      serviceClassicId: "SERVICE-A0B1C2",
      serviceName: "Checkout",
      providerSlug: "aws",
      providerName: "AWS",
      providerServiceName: "Amazon EC2",
      target: 101,
    })).toBeNull();
    expect(parseServiceObjectivePreview([{
      sli: "99.95",
      total_requests: 2000,
      failed_requests: 1,
    }])).toEqual({ reliability: 99.95, totalRequests: 2000, failedRequests: 1 });
    expect(parseServiceObjectivePreview([])).toBeNull();
  });
});
