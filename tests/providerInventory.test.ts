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

  it("maps exact provider identities to the contract owner", () => {
    const identityInventory = parseProviderInventory({ records: [
      { node_type: "GENAI_PROVIDER", provider_identity: "anthropic", node_count: 2 },
      { node_type: "GENAI_PROVIDER", provider_identity: "openai", node_count: 1 },
      { node_type: "GENAI_PROVIDER", provider_identity: "aws.bedrock", node_count: 1 },
      { node_type: "GENAI_PROVIDER", provider_identity: "azure.ai.openai", node_count: 1 },
      { node_type: "GENAI_PROVIDER", provider_identity: "gcp.gemini", node_count: 1 },
      { node_type: "GENAI_PROVIDER", provider_identity: "elevenlabs", node_count: 1 },
    ] });

    expect(providerInventorySlugs(identityInventory)).toEqual([
      "aws",
      "azure",
      "gcp",
      "openai",
      "anthropic",
      "elevenlabs",
    ]);
    expect(identityInventory.find(({ providerSlug }) => providerSlug === "anthropic")).toMatchObject({
      nodeCount: 2,
      nodeTypes: ["GENAI_PROVIDER"],
      providerIdentities: ["anthropic"],
    });
    expect(providerInventoryDetail(identityInventory.find(({ providerSlug }) => providerSlug === "anthropic")!))
      .toBe("1 provider identity · 1 Smartscape type");
  });

  it("recognizes vetted native topology without guessing from names or technologies", () => {
    const identityInventory = parseProviderInventory({ records: [
      { node_type: "DATABRICKS_CLUSTER", provider_identity: "workspace-a", node_count: 10 },
      { node_type: "DATABRICKS_MODEL_SERVING_ENDPOINT", provider_identity: "endpoint-a", node_count: 3 },
      { node_type: "DATABRICKS_WORKSPACE", provider_identity: "workspace-a", node_count: 1 },
      { node_type: "GENAI_MODEL", provider_identity: "claude-sonnet-4", node_count: 3 },
      { node_type: "GENAI_PROVIDER", provider_identity: "langchain", node_count: 2 },
      { node_type: "DB_INSTANCE_ORACLE", provider_identity: "oracle", node_count: 4 },
      { node_type: "VENDOR_CLOUDFLARE", provider_identity: "cloudflare", node_count: 1 },
    ] });

    expect(providerInventorySlugs(identityInventory)).toEqual(["databricks"]);
    expect(identityInventory[0]).toMatchObject({
      providerSlug: "databricks",
      nodeCount: 14,
      providerIdentities: [],
    });
    expect(providerInventoryDetail(identityInventory[0])).toBe("14 topology nodes · 3 Smartscape types");
    expect(providerInventoryNodeTypeLabel("DATABRICKS_MODEL_SERVING_ENDPOINT", 3)).toBe("Model serving endpoints");
  });
});
