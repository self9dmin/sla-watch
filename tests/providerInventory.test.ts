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
      nodeTypes: ["AWS_ACCOUNT", "AWS_AVAILABILITY_ZONE", "AWS_EC2_INSTANCE"],
    });
    expect(providerInventoryDetail(inventory[0])).toBe("1 account · 6 zone records · 3 resource types");
    expect(providerInventoryDetail(inventory[1])).toBe("1 subscription · 121 zone records · 2 resource types");
  });

  it("ignores unrelated and empty records", () => {
    expect(parseProviderInventory({ records: [
      { node_type: "SERVICE", node_count: 20 },
      { node_type: "AWS_EC2_INSTANCE", node_count: 0 },
    ] })).toEqual([]);
  });
});
