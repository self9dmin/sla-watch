import { buildProviderCandidates, mergeServiceInventory, prioritizeServicesByProblemActivity } from "../ui/app/data/providerAttribution";
import type { ProblemRecord, ServiceRecord, SmartscapeScopeEdge } from "../ui/app/types";

describe("provider attribution candidates", () => {
  const services: ServiceRecord[] = [
    { id: "SERVICE-1", name: "Catalog", type: "SERVICE", tags: [] },
    { id: "SERVICE-2", name: "Engage", type: "SERVICE", tags: [] },
  ];

  const edge = (overrides: Partial<SmartscapeScopeEdge>): SmartscapeScopeEdge => ({
    serviceNodeId: "SERVICE-node",
    serviceClassicId: "SERVICE-1",
    serviceName: "Catalog",
    serviceTags: [],
    targetNodeId: "AWS_EC2_INSTANCE-node",
    targetName: "catalog-runtime",
    targetType: "AWS_EC2_INSTANCE",
    relationship: "runs_on",
    providerSlug: "aws",
    providerEvidence: "Smartscape runtime type AWS_EC2_INSTANCE",
    ...overrides,
  });

  it("creates candidates only when topology maps to an exact service entity ID", () => {
    const candidates = buildProviderCandidates(services, [
      edge({}),
      edge({ serviceClassicId: undefined, serviceNodeId: "unknown", serviceName: "Engage" }),
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ serviceId: "SERVICE-1", providerSlug: "aws" });
  });

  it("groups multiple runtime relationships for the same provider candidate", () => {
    const candidates = buildProviderCandidates(services, [
      edge({}),
      edge({ targetNodeId: "HOST-node", targetName: "catalog-host", targetType: "HOST", providerEvidence: "Smartscape AWS runtime attributes" }),
    ]);
    expect(candidates[0].runtimeNames).toEqual(["catalog-runtime", "catalog-host"]);
    expect(candidates[0].evidence).toHaveLength(2);
  });

  it("keeps different provider candidates separate", () => {
    const candidates = buildProviderCandidates(services, [
      edge({}),
      edge({ providerSlug: "azure", targetNodeId: "AZURE-node", targetName: "catalog-azure", targetType: "AZURE_VM", providerEvidence: "Smartscape runtime type AZURE_VM" }),
    ]);
    expect(candidates.map((candidate) => candidate.providerSlug)).toEqual(["aws", "azure"]);
  });

  it("adds Smartscape-only service nodes to the review inventory", () => {
    const merged = mergeServiceInventory(services, [edge({
      serviceClassicId: "SERVICE-3",
      serviceName: "Orders",
      serviceTags: ["owner:checkout"],
    })]);
    expect(merged).toContainEqual({ id: "SERVICE-3", name: "Orders", type: "SERVICE", tags: ["owner:checkout"] });
  });

  it("prioritizes exact services with recent Problems without using their names", () => {
    const problems: ProblemRecord[] = [
      {
        id: "P-1",
        title: "Failure rate increase",
        status: "CLOSED",
        category: "ERROR",
        affectedEntityIds: ["SERVICE-2", "SERVICE-2"],
        hasRootCause: false,
      },
      {
        id: "P-2",
        title: "Response time degradation",
        status: "CLOSED",
        category: "SLOWDOWN",
        affectedEntityIds: ["SERVICE-2"],
        hasRootCause: false,
      },
    ];

    expect(prioritizeServicesByProblemActivity(services, problems)).toEqual([
      { service: services[1], problemCount: 2 },
      { service: services[0], problemCount: 0 },
    ]);
  });
});
