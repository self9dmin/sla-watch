import {
  parseProviderInventory,
  providerInventoryDetail,
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
    });
    expect(inventory[1]).toMatchObject({
      providerSlug: "azure",
      computeResourceCount: 1,
      availabilityZoneCount: 121,
    });
    expect(providerInventoryDetail(inventory[0])).toBe("1 account · 9 EC2 instances · 3 Smartscape types");
    expect(providerInventoryDetail(inventory[1])).toBe("1 subscription · 1 VM · 3 Smartscape types");
    expect(providerInventoryDetail(inventory[1])).not.toContain("zone records");
  });

  it("ignores unrelated and empty records", () => {
    expect(parseProviderInventory({ records: [
      { node_type: "SERVICE", node_count: 20 },
      { node_type: "AWS_EC2_INSTANCE", node_count: 0 },
    ] })).toEqual([]);
  });
});
