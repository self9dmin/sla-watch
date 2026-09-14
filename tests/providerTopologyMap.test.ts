import {
  buildProviderTopologyFamilies,
  providerTopologyFamilyId,
} from "../ui/app/data/providerTopologyMap";

describe("provider topology map", () => {
  it("groups provider-native types into readable resource families", () => {
    expect(providerTopologyFamilyId("AWS_ACCOUNT")).toBe("scope");
    expect(providerTopologyFamilyId("AWS_EC2_INSTANCE")).toBe("compute");
    expect(providerTopologyFamilyId("AWS_EC2_SUBNET")).toBe("network");
    expect(providerTopologyFamilyId("AWS_EC2_SECURITYGROUP")).toBe("security");
    expect(providerTopologyFamilyId("AWS_BEDROCK_KNOWLEDGEBASE")).toBe("apps");
    expect(providerTopologyFamilyId("AWS_RDS_DBCLUSTER")).toBe("data");
    expect(providerTopologyFamilyId("AWS_CLOUDTRAIL_TRAIL")).toBe("operations");
    expect(providerTopologyFamilyId("SOME_FUTURE_PROVIDER_TYPE")).toBe("other");
  });

  it("aggregates record counts without treating them as unique resources", () => {
    const families = buildProviderTopologyFamilies([
      { nodeType: "AWS_EC2_SUBNET", nodeCount: 23 },
      { nodeType: "AWS_EC2_VPC", nodeCount: 5 },
      { nodeType: "AWS_EC2_INSTANCE", nodeCount: 9 },
      { nodeType: "AWS_ACCOUNT", nodeCount: 1 },
      { nodeType: "", nodeCount: 5 },
      { nodeType: "AWS_S3_BUCKET", nodeCount: 0 },
    ]);

    expect(families.map((family) => family.id)).toEqual(["scope", "network", "compute"]);
    expect(families.find((family) => family.id === "network")).toMatchObject({
      label: "Network",
      nodeCount: 28,
      nodeTypes: [
        { nodeType: "AWS_EC2_SUBNET", nodeCount: 23 },
        { nodeType: "AWS_EC2_VPC", nodeCount: 5 },
      ],
    });
  });

  it("keeps Azure infrastructure categories separate", () => {
    expect(providerTopologyFamilyId("AZURE_MICROSOFT_RESOURCES_SUBSCRIPTIONS")).toBe("scope");
    expect(providerTopologyFamilyId("AZURE_MICROSOFT_COMPUTE_VIRTUALMACHINES")).toBe("compute");
    expect(providerTopologyFamilyId("AZURE_MICROSOFT_COMPUTE_DISKS")).toBe("data");
    expect(providerTopologyFamilyId("AZURE_MICROSOFT_NETWORK_NETWORKINTERFACES")).toBe("network");
  });
});
