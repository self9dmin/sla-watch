import {
  detectedProviderSlugs,
  mergeSmartscapeScopeEdges,
  parseServiceCloudContexts,
  parseSmartscapeScopeEdges,
  topologyAnchorRank,
  uniqueLocations,
  uniqueRuntimeTargets,
} from "../ui/app/data/topology";

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
    expect(edges[0]).toMatchObject({
      location: "us-east-1a",
      region: "us-east-1",
      availabilityZone: "us-east-1a",
    });
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

  it("normalizes Oracle Cloud provider metadata for OCI setup", () => {
    const edges = parseSmartscapeScopeEdges({ records: [{
      service_node_id: "service-node-oci",
      service_classic_id: "SERVICE-OCI",
      target_node_id: "runtime-node-oci",
      target_name: "orders-oci",
      target_type: "OCI_COMPUTE_INSTANCE",
      relationship: "runs_on",
      cloud_provider: "oracle_cloud",
      cloud_account_id: "tenancy-1",
      cloud_region: "us-ashburn-1",
    }] });
    expect(edges[0]).toMatchObject({
      providerSlug: "oci",
      accountId: "tenancy-1",
      location: "us-ashburn-1",
      providerEvidence: "Smartscape cloud.provider=oracle_cloud",
    });
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

  it("merges overlapping global and incident topology without duplicate rows", () => {
    const [first, second] = parseSmartscapeScopeEdges(data);
    expect(mergeSmartscapeScopeEdges([first], [first, second])).toEqual([first, second]);
  });

  it("ranks provider-native and infrastructure anchors ahead of process detail", () => {
    const [base] = parseSmartscapeScopeEdges(data);
    expect(topologyAnchorRank({ ...base, targetType: "AWS_EC2_INSTANCE" })).toBeLessThan(
      topologyAnchorRank({ ...base, targetType: "HOST" }),
    );
    expect(topologyAnchorRank({ ...base, targetType: "HOST" })).toBeLessThan(
      topologyAnchorRank({ ...base, targetType: "PROCESS" }),
    );
    expect(topologyAnchorRank({ ...base, targetType: "K8S_CLUSTER" })).toBeLessThan(
      topologyAnchorRank({ ...base, targetType: "CONTAINER" }),
    );
  });
});
