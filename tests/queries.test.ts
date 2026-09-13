import {
  INCIDENT_SERVICE_FILTER_LIMIT,
  INCIDENT_SMARTSCAPE_RESULT_LIMIT,
  PROVIDER_INVENTORY_RESULT_LIMIT,
  PROVIDER_HOST_CONTEXT_RESULT_LIMIT,
  SERVICE_RESULT_LIMIT,
  SERVICES_QUERY,
  SMARTSCAPE_COVERAGE_COUNT_QUERY,
  SMARTSCAPE_HOST_CLOUD_CONTEXT_QUERY,
  SMARTSCAPE_PROVIDER_INVENTORY_QUERY,
  SMARTSCAPE_RESULT_LIMIT,
  SMARTSCAPE_SERVICE_RUNTIME_QUERY,
  createIncidentServiceMetricsQuery,
  createIncidentServicesQuery,
  createIncidentSmartscapeQuery,
  createProblemsQuery,
} from "../ui/app/data/queries";

describe("bounded inventory queries", () => {
  it("uses stable Smartscape Problem fields with compatibility fallbacks", () => {
    const query = createProblemsQuery(168);

    expect(query).toContain("smartscape.affected_entities");
    expect(query).toContain("dt.smartscape.service");
    expect(query).toContain("dt.smartscape_source.id");
    expect(query).toContain("dt.davis.affected_users_count");
    expect(query).toContain("dt.davis.impact_level");
    expect(query).toContain("root_cause.smartscape_entity");
    expect(query).toContain("affected_entity_ids");
    expect(query).toContain("root_cause_entity_id");
    expect(query).toContain("from:-168h");
  });

  it("keeps the global inventory bounded and focused on coverage anchors", () => {
    expect(SERVICES_QUERY).toContain("smartscapeNodes SERVICE");
    expect(SERVICES_QUERY).toContain('getNodeField(id, "id_classic")');
    expect(SERVICES_QUERY).not.toContain("fetch dt.entity.service");
    expect(SERVICES_QUERY).toContain(`limit ${SERVICE_RESULT_LIMIT}`);
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).toContain('smartscapeEdges "*", from:-7d');
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).toContain(`limit ${SMARTSCAPE_RESULT_LIMIT}`);
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).toContain('target_type == "HOST"');
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).toContain('target_type == "K8S_CLUSTER"');
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).toContain('startsWith(target_type, "AWS_")');
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).toContain('startsWith(target_type, "AZURE_")');
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).toContain('startsWith(target_type, "GCP_")');
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).toContain('startsWith(target_type, "OCI_")');
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).not.toContain('target_type == "PROCESS"');
    expect(SMARTSCAPE_SERVICE_RUNTIME_QUERY).not.toContain('target_type == "CONTAINER"');
    expect(SMARTSCAPE_COVERAGE_COUNT_QUERY).toContain("countDistinctExact(source_id)");
  });

  it("summarizes recent provider-owned Smartscape inventory without loading raw cloud nodes", () => {
    expect(SMARTSCAPE_PROVIDER_INVENTORY_QUERY).toContain('smartscapeNodes {"AWS_*", "AZURE_*", "GCP_*", "OCI_*", "ORACLE_*"}');
    expect(SMARTSCAPE_PROVIDER_INVENTORY_QUERY).toContain("from:-7d");
    expect(SMARTSCAPE_PROVIDER_INVENTORY_QUERY).toContain("fields node_type = type");
    expect(SMARTSCAPE_PROVIDER_INVENTORY_QUERY).toContain("summarize node_count = count()");
    expect(SMARTSCAPE_PROVIDER_INVENTORY_QUERY).not.toContain("aws.account.id");
    expect(SMARTSCAPE_PROVIDER_INVENTORY_QUERY).not.toContain("azure.subscription");
    expect(SMARTSCAPE_PROVIDER_INVENTORY_QUERY).toContain(`limit ${PROVIDER_INVENTORY_RESULT_LIMIT}`);
  });

  it("summarizes cloud-aware hosts before applying a bounded result limit", () => {
    expect(SMARTSCAPE_HOST_CLOUD_CONTEXT_QUERY).toContain("smartscapeNodes HOST");
    expect(SMARTSCAPE_HOST_CLOUD_CONTEXT_QUERY).toContain('getNodeField(id, "azure.subscription")');
    expect(SMARTSCAPE_HOST_CLOUD_CONTEXT_QUERY).toContain("or isNotNull(azure_location)");
    expect(SMARTSCAPE_HOST_CLOUD_CONTEXT_QUERY).toContain("summarize host_count = count()");
    expect(SMARTSCAPE_HOST_CLOUD_CONTEXT_QUERY).toContain(`limit ${PROVIDER_HOST_CONTEXT_RESULT_LIMIT}`);
    expect(SMARTSCAPE_HOST_CLOUD_CONTEXT_QUERY.indexOf("summarize host_count")).toBeLessThan(
      SMARTSCAPE_HOST_CLOUD_CONTEXT_QUERY.indexOf(`limit ${PROVIDER_HOST_CONTEXT_RESULT_LIMIT}`),
    );
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
    expect(query).toContain("smartscapeNodes SERVICE");
    expect(query).not.toContain("fetch dt.entity.service");
    expect(query).toContain(`limit ${INCIDENT_SERVICE_FILTER_LIMIT}`);
  });

  it("loads request and failure evidence only for exact affected services", () => {
    const query = createIncidentServiceMetricsQuery([
      "service-abc",
      "SERVICE-ABC",
      'SERVICE-ABC") | fetch logs',
    ], 720);
    expect(query).toContain("dt.service.request.count");
    expect(query).toContain("dt.service.request.failure_count");
    expect(query.match(/"SERVICE-ABC"/g)).toHaveLength(1);
    expect(query).not.toContain("fetch logs");
    expect(query).toContain("from:-720h");
  });
});
