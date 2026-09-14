import {
  buildProviderInfrastructureCandidate,
  providerInfrastructureCandidateDetail,
} from "../ui/app/data/providerInfrastructure";

describe("provider infrastructure candidates", () => {
  it("creates one conservative provider-level candidate from separate Azure signals", () => {
    const candidate = buildProviderInfrastructureCandidate({
      providerSlug: "azure",
      inventory: {
        providerSlug: "azure",
        nodeCount: 123,
        nodeTypes: [
          "AZURE_MICROSOFT_COMPUTE_VIRTUALMACHINES",
          "AZURE_MICROSOFT_RESOURCES_LOCATIONS_AVAILABILITYZONES",
          "AZURE_MICROSOFT_RESOURCES_SUBSCRIPTIONS",
        ],
        nodeTypeCounts: [
          { nodeType: "AZURE_MICROSOFT_RESOURCES_LOCATIONS_AVAILABILITYZONES", nodeCount: 121 },
          { nodeType: "AZURE_MICROSOFT_COMPUTE_VIRTUALMACHINES", nodeCount: 1 },
          { nodeType: "AZURE_MICROSOFT_RESOURCES_SUBSCRIPTIONS", nodeCount: 1 },
        ],
        providerIdentities: [],
        accountScopeCount: 1,
        regionCount: 0,
        availabilityZoneCount: 121,
        computeResourceCount: 1,
      },
      hostContext: {
        providerSlug: "azure",
        hostCount: 1,
        accountIds: ["a-different-subscription"],
        regions: ["eastus"],
        evidence: ["Smartscape Azure runtime attributes"],
      },
    });

    expect(candidate).toEqual({
      providerSlug: "azure",
      hostCount: 1,
      computeResourceCount: 1,
    });
    expect(providerInfrastructureCandidateDetail(candidate!)).toBe(
      "Dynatrace found 1 monitored host with Azure metadata and 1 Azure VM in provider-native topology. These provider-level signals may describe different resources. This evidence establishes provider presence, not a service relationship.",
    );
  });

  it("does not create a candidate from location metadata alone", () => {
    expect(buildProviderInfrastructureCandidate({
      providerSlug: "azure",
      inventory: {
        providerSlug: "azure",
        nodeCount: 121,
        nodeTypes: ["AZURE_MICROSOFT_RESOURCES_LOCATIONS_AVAILABILITYZONES"],
        nodeTypeCounts: [
          { nodeType: "AZURE_MICROSOFT_RESOURCES_LOCATIONS_AVAILABILITYZONES", nodeCount: 121 },
        ],
        providerIdentities: [],
        accountScopeCount: 0,
        regionCount: 0,
        availabilityZoneCount: 121,
        computeResourceCount: 0,
      },
    })).toBeUndefined();
  });

  it("ignores infrastructure summaries from another provider", () => {
    expect(buildProviderInfrastructureCandidate({
      providerSlug: "azure",
      hostContext: {
        providerSlug: "aws",
        hostCount: 4,
        accountIds: ["123456789012"],
        regions: ["us-east-1"],
        evidence: ["Smartscape AWS runtime attributes"],
      },
    })).toBeUndefined();
  });
});
