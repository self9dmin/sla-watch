import getProviderPublicStatus, { parseOciComponents, parseStatusPageIncidents } from "../api/providerPublicStatus.function";

describe("public provider status normalization", () => {
  it("normalizes recent Statuspage incidents without claiming customer impact", () => {
    const notices = parseStatusPageIncidents({
      incidents: [{
        id: "incident-1",
        name: "Elevated API errors",
        status: "resolved",
        impact: "minor",
        created_at: "2026-09-09T10:00:00Z",
        updated_at: "2026-09-09T11:00:00Z",
        resolved_at: "2026-09-09T11:00:00Z",
        incident_updates: [{ body: "API traffic has recovered.", updated_at: "2026-09-09T11:00:00Z" }],
        components: [{ id: "api", name: "API" }],
      }],
    }, "openai", { name: "OpenAI", statusUrl: "https://status.openai.com" }, new Date("2026-09-08T00:00:00Z"));

    expect(notices).toEqual([expect.objectContaining({
      id: "incident-1",
      source: "provider-public",
      sourceScope: "Public openai status",
      state: "CLOSED",
      summary: "API traffic has recovered.",
      url: "https://status.openai.com/incidents/incident-1",
    })]);
    expect(notices[0].products).toEqual([{ id: "api", name: "API", directoryServiceIds: [] }]);
  });

  it("filters old closed Statuspage incidents and retains active incidents", () => {
    const notices = parseStatusPageIncidents({ incidents: [
      { id: "old", name: "Old event", status: "resolved", resolved_at: "2026-01-01T01:00:00Z" },
      { id: "active", name: "Current event", status: "investigating", created_at: "2026-01-01T00:00:00Z" },
    ] }, "anthropic", { name: "Anthropic", statusUrl: "https://status.claude.com" }, new Date("2026-09-01T00:00:00Z"));

    expect(notices.map(({ id }) => id)).toEqual(["active"]);
  });

  it("normalizes only disrupted OCI service and region combinations", () => {
    const notices = parseOciComponents({
      realm: "OC1",
      regionHealthReports: [{
        regionId: "region-1",
        regionName: "US East (Ashburn)",
        regionCanonicalName: "us-ashburn-1",
        serviceHealthReports: [
          { serviceId: "compute", serviceName: "Compute", serviceCanonicalName: "compute", serviceStatus: "ServiceDisruption", incidents: [{ incidentId: "incident-oci", severity: "ServiceDisruption" }] },
          { serviceId: "storage", serviceName: "Object Storage", serviceCanonicalName: "object-storage", serviceStatus: "NormalPerformance", incidents: [] },
        ],
      }],
    });

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      source: "provider-public",
      title: "Compute in US East (Ashburn)",
      state: "ACTIVE",
      locations: ["US East (Ashburn)"],
    });
  });

  it("uses an allowlisted public endpoint and never requests a customer credential", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ incidents: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    try {
      const result = await getProviderPublicStatus({ providerSlug: "elevenlabs", lookbackHours: 24 });
      expect(result).toMatchObject({ provider: "elevenlabs", source: "public", connectionState: "public" });
      expect(String(fetchMock.mock.calls[0][0])).toBe("https://status.elevenlabs.io/api/v2/incidents.json");
      expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ headers: { Accept: "application/json" } }));
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("rejects providers without a reviewed public adapter", async () => {
    await expect(getProviderPublicStatus({ providerSlug: "unknown-provider" })).rejects.toThrow("does not have a supported public status source");
  });
});
