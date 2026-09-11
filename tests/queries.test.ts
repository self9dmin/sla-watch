import {
  INCIDENT_SERVICE_FILTER_LIMIT,
  INCIDENT_SMARTSCAPE_RESULT_LIMIT,
  SERVICE_RESULT_LIMIT,
  SERVICES_QUERY,
  SMARTSCAPE_COVERAGE_COUNT_QUERY,
  SMARTSCAPE_RESULT_LIMIT,
  SMARTSCAPE_SERVICE_RUNTIME_QUERY,
  createIncidentServicesQuery,
  createIncidentSmartscapeQuery,
} from "../ui/app/data/queries";

describe("bounded inventory queries", () => {
  it("keeps the global inventory bounded and focused on coverage anchors", () => {
    expect(SERVICES_QUERY).toContain(`limit ${SERVICE_RESULT_LIMIT}`);
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).toContain(`limit ${SMARTSCAPE_RESULT_LIMIT}`);
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).toContain('target_type == "HOST"');
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).toContain('target_type == "K8S_CLUSTER"');
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).toContain('startsWith(target_type, "AWS_")');
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).not.toContain('target_type == "PROCESS"');
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).not.toContain('target_type == "CONTAINER"');
    expect(SMARTSCAPE_COVERAGE_COUNT_QUERY).toContain("countDistinctExact(source_id)");
  });

  it("sanitizes, deduplicates, and caps incident-scoped service IDs", () => {
    const serviceIds = Array.from(
      { length: INCIDENT_SERVICE_FILTER_LIMIT + 5 },
      (_, index) => `SERVICE-${index.toString(16).toUpperCase()}`,
    );
    const query = createIncidentSmartscapeQuery([
      serviceIds[0].toLowerCase(),
      ...serviceIds,
      'SERVICE-ABC") | fetch logs',
      "HOST-123",
    ]);

    expect(query.match(/"SERVICE-/g)).toHaveLength(INCIDENT_SERVICE_FILTER_LIMIT);
    expect(query).toContain('"SERVICE-0"');
    expect(query).not.toContain(`"${serviceIds[INCIDENT_SERVICE_FILTER_LIMIT]}"`);
    expect(query).not.toContain("fetch logs");
    expect(query).toContain(`limit ${INCIDENT_SMARTSCAPE_RESULT_LIMIT}`);
  });

  it("returns no incident topology when no valid service ID is supplied", () => {
    const query = createIncidentSmartscapeQuery(["HOST-123", "not-an-id"]);
    expect(query).toContain('service_classic_id_filter == "__NO_SERVICE__"');
  });

  it("loads exact affected service records outside the global inventory sample", () => {
    const query = createIncidentServicesQuery([
      "service-abc",
      "SERVICE-ABC",
      'SERVICE-ABC") | fetch logs',
    ]);
    expect(query.match(/"SERVICE-ABC"/g)).toHaveLength(1);
    expect(query).not.toContain("fetch logs");
    expect(query).toContain(`limit ${INCIDENT_SERVICE_FILTER_LIMIT}`);
  });
});
