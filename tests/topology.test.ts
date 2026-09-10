import { detectedProviderSlugs, parseServiceCloudContexts, parseSmartscapeScopeEdges, uniqueLocations, uniqueRuntimeTargets } from "../ui/app/data/topology";

describe("Smartscape scope parsing", () => {
  const data = {
    records: [
      {
        service_node_id: "service-node-1",
        service_classic_id: "SERVICE-1",
        service_name: "Checkout",
        target_node_id: "host-node-1",
        target_classic_id: "HOST-1",
        target_name: "checkout-a",
        target_type: "HOST",
        relationship: "runs_on",
        aws_region: "us-east-1",
        aws_availability_zone: "us-east-1a",
      },
      {
        service_node_id: "service-node-2",
        service_classic_id: "SERVICE-2",
        service_name: "Payments",
        target_node_id: "host-node-1",
        target_classic_id: "HOST-1",
        target_name: "checkout-a",
        target_type: "HOST",
        relationship: "runs_on",
        aws_region: "us-east-1",
        aws_availability_zone: "us-east-1a",
      },
    ],
  };

  it("prefers the most precise location returned by Smartscape", () => {
    const edges = parseSmartscapeScopeEdges(data);
    expect(edges[0].location).toBe("us-east-1a");
    expect(uniqueLocations(edges)).toEqual(["us-east-1a"]);
  });

  it("deduplicates runtime choices by Smartscape node ID", () => {
    expect(uniqueRuntimeTargets(parseSmartscapeScopeEdges(data))).toHaveLength(1);
  });

  it("identifies AWS from provider-specific Smartscape runtime fields", () => {
    const edges = parseSmartscapeScopeEdges(data);
    expect(edges[0]).toMatchObject({ providerSlug: "aws", providerEvidence: "Smartscape AWS runtime attributes" });
    expect(detectedProviderSlugs(edges)).toEqual(["aws"]);
  });

  it("prefers the explicit cloud.provider field", () => {
    const edges = parseSmartscapeScopeEdges({ records: [{
      service_node_id: "service-node-3",
      service_classic_id: "SERVICE-3",
      target_node_id: "runtime-node-3",
      target_name: "orders",
      target_type: "CONTAINER",
      relationship: "runs_on",
      cloud_provider: "gcp",
      gcp_project_id: "orders-prod",
    }] });
    expect(edges[0]).toMatchObject({ providerSlug: "gcp", accountId: "orders-prod", providerEvidence: "Smartscape cloud.provider=gcp" });
  });

  it("identifies exact services from provider dimensions on service metrics", () => {
    const contexts = parseServiceCloudContexts({ records: [{
      service_node_id: "SERVICE-node-4",
      service_classic_id: "SERVICE-4",
      service_name: "Orders",
      aws_account_id: "123456789012",
      aws_region: "us-east-1",
    }] });
    expect(contexts[0]).toMatchObject({
      serviceClassicId: "SERVICE-4",
      providerSlug: "aws",
      providerEvidence: "Service metric AWS dimensions",
      accountId: "123456789012",
      location: "us-east-1",
    });
  });

  it("does not invent a provider when service metrics have no cloud dimensions", () => {
    expect(parseServiceCloudContexts({ records: [{
      service_node_id: "SERVICE-node-5",
      service_name: "Unscoped",
      request_count: 12,
    }] })).toEqual([]);
  });
});
