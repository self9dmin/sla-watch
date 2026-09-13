import {
  parseProviderInventory,
  providerInventoryDetail,
  providerInventoryNodeTypeLabel,
  providerInventorySlugs,
} from "../ui/app/data/providerInventory";

describe("provider Smartscape inventory", () => {
  const inventory = parseProviderInventory({ records: [
    {
      node_type: "AWS_ACCOUNT",
      node_count: 1,
    },
    {
      node_type: "AWS_AVAILABILITY_ZONE",
      node_count: 6,
    },
    {
      node_type: "AWS_EC2_INSTANCE",
      node_count: 9,
    },
    {
      node_type: "AZURE_MICROSOFT_RESOURCES_SUBSCRIPTIONS",
      node_count: "1",
    },
    {
      node_type: "AZURE_MICROSOFT_RESOURCES_LOCATIONS_AVAILABILITYZONES",
      node_count: 121,
    },
    {
      node_type: "AZURE_MICROSOFT_COMPUTE_VIRTUALMACHINES",
      node_count: 1,
    },
  ] });

  it("detects provider presence independently of service relationships", () => {
    expect(providerInventorySlugs(inventory)).toEqual(["aws", "azure"]);
  });

  it("retains provider account, region, zone, and resource-type context", () => {
    expect(inventory[0]).toMatchObject({
      providerSlug: "aws",
      nodeCount: 16,
      accountScopeCount: 1,
      regionCount: 0,
      availabilityZoneCount: 6,
      computeResourceCount: 9,
      nodeTypes: ["AWS_ACCOUNT", "AWS_AVAILABILITY_ZONE", "AWS_EC2_INSTANCE"],
      nodeTypeCounts: [
        { nodeType: "AWS_EC2_INSTANCE", nodeCount: 9 },
        { nodeType: "AWS_AVAILABILITY_ZONE", nodeCount: 6 },
        { nodeType: "AWS_ACCOUNT", nodeCount: 1 },
      ],
    });
    expect(inventory[1]).toMatchObject({
      providerSlug: "azure",
      computeResourceCount: 1,
      availabilityZoneCount: 121,
    });
    expect(providerInventoryDetail(inventory[0])).toBe("1 account · 9 EC2 instances · 3 Smartscape types");
    expect(providerInventoryDetail(inventory[1])).toBe("1 subscription · 1 VM · 3 Smartscape types");
    expect(providerInventoryDetail(inventory[1])).not.toContain("zone records");
    expect(providerInventoryNodeTypeLabel("AZURE_MICROSOFT_COMPUTE_VIRTUALMACHINES", 1)).toBe("Virtual machine");
    expect(providerInventoryNodeTypeLabel("AWS_EC2_SUBNET", 2)).toBe("EC2 subnets");
    expect(providerInventoryNodeTypeLabel("AZURE_MICROSOFT_STORAGE_STORAGEACCOUNTS", 3)).toBe("Storage accounts");
    expect(providerInventoryNodeTypeLabel("AZURE_MICROSOFT_NETWORK_NETWORKINTERFACES_IPCONFIGURATIONS", 1)).toBe("Network interface IP configuration");
    expect(providerInventoryNodeTypeLabel("AZURE_MICROSOFT_RESOURCES_TENANTS", 2)).toBe("Azure tenants");
  });

  it("ignores unrelated and empty records", () => {
    expect(parseProviderInventory({ records: [
      { node_type: "SERVICE", node_count: 20 },
      { node_type: "AWS_EC2_INSTANCE", node_count: 0 },
    ] })).toEqual([]);
  });
});
