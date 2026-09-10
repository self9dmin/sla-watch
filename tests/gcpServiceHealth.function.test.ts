import getGcpServiceHealth, { parsePersonalizedEvents, parsePublicIncidents } from "../api/gcpServiceHealth.function";

describe("Google Cloud service health normalization", () => {
  it("preserves project relevance and maps stable Google product IDs to directory services", () => {
    const notices = parsePersonalizedEvents({
      events: [{
        name: "projects/example-project-123/locations/global/events/event-1",
        title: "Cloud Run service degradation",
        description: "Requests may fail in us-central1.",
        state: "ACTIVE",
        detailedState: "CONFIRMED",
        relevance: "IMPACTED",
        startTime: "2026-09-10T10:00:00Z",
        updateTime: "2026-09-10T11:00:00Z",
        eventImpacts: [{
          product: { id: "9D7d2iNBQWN24zc1VamE", productName: "Cloud Run" },
          location: { locationName: "us-central1" },
        }],
      }],
    }, "example-project-123");

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      id: "event-1",
      source: "gcp-personalized",
      sourceScope: "example-project-123",
      state: "ACTIVE",
      relevance: "IMPACTED",
      locations: ["us-central1"],
    });
    expect(notices[0].products[0]).toEqual({
      id: "9D7d2iNBQWN24zc1VamE",
      name: "Cloud Run",
      directoryServiceIds: ["cloud-run"],
    });
  });

  it("normalizes public incidents without implying project impact", () => {
    const notices = parsePublicIncidents([{
      id: "public-1",
      begin: "2026-09-09T10:00:00Z",
      end: "2026-09-09T11:00:00Z",
      modified: "2026-09-09T12:00:00Z",
      external_desc: "Google Compute Engine degradation.",
      severity: "medium",
      affected_products: [{ id: "L3ggmi3Jy4xJmgodFA9K", current_title: "Google Compute Engine" }],
      previously_affected_locations: [{ id: "us-central1", title: "Iowa (us-central1)" }],
    }], new Date("2026-09-08T00:00:00Z"));

    expect(notices[0]).toMatchObject({
      id: "public-1",
      source: "gcp-public",
      state: "CLOSED",
      severity: "medium",
      locations: ["Iowa (us-central1)"],
      url: "https://status.cloud.google.com/incidents/public-1",
    });
    expect(notices[0].products[0].directoryServiceIds).toEqual(["compute-engine", "compute"]);
  });

  it("filters old closed public incidents but retains active incidents", () => {
    const notices = parsePublicIncidents([
      { id: "old", begin: "2026-01-01T00:00:00Z", end: "2026-01-01T01:00:00Z", modified: "2026-01-01T02:00:00Z" },
      { id: "active", begin: "2026-01-01T00:00:00Z", modified: "2026-01-01T02:00:00Z" },
    ], new Date("2026-09-01T00:00:00Z"));

    expect(notices.map((notice) => notice.id)).toEqual(["active"]);
    expect(notices[0].state).toBe("ACTIVE");
  });

  it("rejects malformed provider responses", () => {
    expect(() => parsePersonalizedEvents({ events: "invalid" }, "example-project-123")).toThrow("invalid response");
    expect(() => parsePublicIncidents({}, new Date())).toThrow("invalid response");
  });

  it("uses public status without requesting a customer credential", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify([{
      id: "active-public",
      begin: new Date().toISOString(),
      modified: new Date().toISOString(),
      external_desc: "Public Google Cloud incident.",
    }]), { status: 200, headers: { "Content-Type": "application/json" } }));

    try {
      const result = await getGcpServiceHealth({ lookbackHours: 24 });
      expect(result).toMatchObject({ source: "public", connectionState: "public" });
      expect(result.notices[0]).toMatchObject({ id: "active-public", source: "gcp-public" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0][0])).toBe("https://status.cloud.google.com/incidents.json");
    } finally {
      fetchMock.mockRestore();
    }
  });
});
