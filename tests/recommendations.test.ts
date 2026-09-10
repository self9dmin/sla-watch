import { buildSetupRecommendations } from "../ui/app/data/recommendations";
import type { ProblemRecord, ServiceRecord, SlaProviderResponse } from "../ui/app/types";

const provider: SlaProviderResponse = {
  generatedAt: "2026-09-10T00:00:00.000Z",
  provider: {
    slug: "aws",
    name: "Amazon Web Services",
    category: "Cloud",
    uptime: 99.99,
    status: "verified",
    lastVerified: "2026-09-09",
  },
  services: [],
};

const service = (tags: string[]): ServiceRecord => ({
  id: "SERVICE-1",
  name: "checkout",
  type: "SERVICE",
  tags,
});

const problem = (status: string): ProblemRecord => ({
  id: "P-1",
  title: "Checkout is slow",
  status,
  category: "PERFORMANCE",
  affectedEntityIds: ["SERVICE-1"],
  hasRootCause: true,
});

describe("buildSetupRecommendations", () => {
  it("distinguishes missing provider labels from a provider outage", () => {
    const recommendations = buildSetupRecommendations({
      services: [service(["owner:checkout"])],
      problems: [problem("ACTIVE")],
      telemetrySignalsPresent: true,
      directoryData: provider,
      providerLabels: [],
      selectedProviderSlug: "aws",
      providerLabelKey: "provider",
      matchedProviderServices: 0,
    });

    expect(recommendations[0]).toMatchObject({
      id: "provider-label",
      priority: "high",
    });
    expect(recommendations[0].detail).toContain("Names alone are not enough");
  });

  it("reports a mapping gap when labels exist but point elsewhere", () => {
    const recommendations = buildSetupRecommendations({
      services: [service(["provider:azure", "team:checkout"])],
      problems: [],
      telemetrySignalsPresent: true,
      directoryData: provider,
      providerLabels: ["azure"],
      selectedProviderSlug: "aws",
      providerLabelKey: "provider",
      matchedProviderServices: 0,
    });

    expect(recommendations[0]).toMatchObject({
      id: "provider-mapping",
      priority: "high",
    });
  });

  it("keeps the result conservative when telemetry access fails", () => {
    const recommendations = buildSetupRecommendations({
      services: [],
      problems: [],
      telemetrySignalsPresent: false,
      telemetryError: new Error("storage:entities:read denied"),
      directoryData: provider,
      providerLabels: [],
      selectedProviderSlug: "aws",
      providerLabelKey: "provider",
      matchedProviderServices: 0,
    });

    expect(recommendations[0]).toMatchObject({
      id: "telemetry-access",
      priority: "high",
    });
    expect(recommendations.some(({ id }) => id === "provider-label")).toBe(false);
  });

  it("suggests native SLO coverage only after the boundary is identified", () => {
    const recommendations = buildSetupRecommendations({
      services: [service(["provider:aws", "team:checkout"])],
      problems: [],
      telemetrySignalsPresent: true,
      directoryData: provider,
      providerLabels: ["aws"],
      selectedProviderSlug: "aws",
      providerLabelKey: "provider",
      matchedProviderServices: 1,
    });

    expect(recommendations).toEqual([
      expect.objectContaining({ id: "slo-coverage", priority: "low" }),
    ]);
  });
});
