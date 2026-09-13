import {
  formatDavisImpact,
  parseProblemRecords,
  summarizeDavisImpact,
} from "../ui/app/data/problems";

describe("Dynatrace Problem parsing", () => {
  it("uses stable Smartscape root-cause and affected-entity records", () => {
    const [problem] = parseProblemRecords({
      records: [{
        display_id: "P-1",
        title: "Failure rate increase",
        status: "closed",
        category: "ERROR",
        start_time: "2026-09-12T10:00:00Z",
        end_time: "2026-09-12T10:07:00Z",
        affected_entities: [
          { id: "SERVICE-1", type: "service", name: "Checkout" },
          { id: "HOST-1", type: "host", name: "worker-1" },
        ],
        root_cause: { id: "SERVICE-ROOT", type: "service", name: "Payments" },
        affected_service_ids: ["SERVICE-NATIVE"],
        smartscape_source_id: "SERVICE-SOURCE",
        affected_users_count: 42,
        impact_level: "SERVICES",
        affected_entity_ids: ["service-1", "SERVICE-LEGACY"],
      }],
    });

    expect(problem).toMatchObject({
      id: "P-1",
      status: "CLOSED",
      affectedEntityIds: ["SERVICE-1", "HOST-1", "SERVICE-NATIVE", "SERVICE-SOURCE", "SERVICE-LEGACY"],
      affectedEntities: [
        { id: "SERVICE-1", type: "service", name: "Checkout" },
        { id: "HOST-1", type: "host", name: "worker-1" },
      ],
      hasRootCause: true,
      rootCause: { id: "SERVICE-ROOT", type: "service", name: "Payments" },
      sourceEntityId: "SERVICE-SOURCE",
      affectedUsersCount: 42,
      impactLevel: "SERVICES",
    });
    expect(summarizeDavisImpact([problem])).toEqual({
      impactLevels: ["SERVICES"],
      maximumAffectedUsers: 42,
    });
    expect(formatDavisImpact([problem])).toBe("Services · 42 affected users");
  });

  it("retains the deprecated fields only as a compatibility fallback", () => {
    const [problem] = parseProblemRecords({
      records: [{
        display_id: "P-2",
        affected_entity_ids: ["SERVICE-2"],
        root_cause_entity_id: "HOST-2",
        root_cause_entity_name: "worker-2",
      }],
    });

    expect(problem.affectedEntityIds).toEqual(["SERVICE-2"]);
    expect(problem.affectedEntities).toEqual([]);
    expect(problem.rootCause).toEqual({
      id: "HOST-2",
      name: "worker-2",
      type: "unknown",
    });
  });

  it("keeps malformed root-cause data unavailable instead of inventing context", () => {
    const [problem] = parseProblemRecords({ records: [{ root_cause: { name: "missing-id" } }] });

    expect(problem.hasRootCause).toBe(false);
    expect(problem.rootCause).toBeUndefined();
    expect(problem.affectedEntityIds).toEqual([]);
  });

  it("does not treat a non-service Davis source as an affected service", () => {
    const [problem] = parseProblemRecords({ records: [{
      smartscape_source_id: "HOST-1",
      affected_users_count: "not-a-number",
    }] });

    expect(problem.sourceEntityId).toBe("HOST-1");
    expect(problem.affectedEntityIds).toEqual([]);
    expect(problem.affectedUsersCount).toBeUndefined();
    expect(formatDavisImpact([problem])).toBe("Not returned");
  });

  it("summarizes grouped Problem impact conservatively", () => {
    const problems = parseProblemRecords({ records: [
      { impact_level: "APPLICATION", affected_users_count: 5 },
      { impact_level: "SERVICES", affected_users_count: 18 },
    ] });

    expect(summarizeDavisImpact(problems)).toEqual({
      impactLevels: ["APPLICATION", "SERVICES"],
      maximumAffectedUsers: 18,
    });
    expect(formatDavisImpact(problems)).toBe("2 impact levels · up to 18 affected users");
  });
});
