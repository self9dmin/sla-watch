import { buildProviderCoverageModel, rowServiceId } from "../ui/app/data/providerCoverage";
import { createServiceScopeAssignment } from "../ui/app/data/providerScopeAssignments";
import type {
  ProblemRecord,
  ProviderScopeAssignmentRecord,
  ServiceRecord,
  SlaProviderResponse,
  SmartscapeScopeEdge,
} from "../ui/app/types";

const provider: SlaProviderResponse = {
  generatedAt: "2026-09-12T00:00:00.000Z",
  provider: {
    slug: "aws",
    name: "AWS",
    category: "Cloud",
    uptime: 99.99,
    status: "verified",
    lastVerified: "2026-09-12",
  },
  services: [{
    id: "ec2",
    name: "Amazon EC2",
    category: "Compute",
    uptime: 99.99,
    eligible: true,
    slaUrl: "https://example.test/ec2",
  }],
};

const services: ServiceRecord[] = [
  { id: "SERVICE-1", name: "Catalog", type: "SERVICE", tags: [] },
  { id: "SERVICE-2", name: "Checkout", type: "SERVICE", tags: [] },
  { id: "SERVICE-3", name: "Tagged", type: "SERVICE", tags: ["provider:aws"] },
  { id: "SERVICE-4", name: "Internal", type: "SERVICE", tags: [] },
];

const edge = (overrides: Partial<SmartscapeScopeEdge>): SmartscapeScopeEdge => ({
  serviceNodeId: "service-node",
  serviceClassicId: "SERVICE-1",
  serviceName: "Catalog",
  serviceTags: [],
  targetNodeId: "runtime-node",
  targetClassicId: "AWS_EC2_INSTANCE-1",
  targetName: "catalog-runtime",
  targetType: "AWS_EC2_INSTANCE",
  relationship: "runs_on",
  providerSlug: "aws",
  providerEvidence: "AWS runtime metadata",
  ...overrides,
});

const topology: SmartscapeScopeEdge[] = [
  edge({}),
  edge({
    targetNodeId: "catalog-host",
    targetClassicId: "HOST-1",
    targetName: "ip-10-0-0-1.ec2.internal",
    targetType: "HOST",
  }),
  edge({
    serviceNodeId: "checkout-service",
    serviceClassicId: "SERVICE-2",
    serviceName: "Checkout",
    targetNodeId: "checkout-host",
    targetClassicId: "HOST-2",
    targetName: "ip-10-0-0-2.ec2.internal",
    targetType: "HOST",
  }),
];

const problems: ProblemRecord[] = [{
  id: "P-1",
  title: "Failure rate increase",
  status: "CLOSED",
  category: "ERROR",
  affectedEntityIds: ["SERVICE-2"],
  affectedEntities: [],
  hasRootCause: false,
}];

const build = (assignments: ProviderScopeAssignmentRecord[] = []) =>
  buildProviderCoverageModel({
    provider,
    providerSlug: "aws",
    topology,
    services,
    problems,
    providerTagKey: "provider",
    assignments,
  });

describe("provider coverage model", () => {
  it("uses one row and one status per service", () => {
    const model = build();

    expect(model.rows).toHaveLength(4);
    expect(model.rows.map(rowServiceId)).toEqual(expect.arrayContaining([
      "SERVICE-1",
      "SERVICE-2",
      "SERVICE-3",
      "SERVICE-4",
    ]));
    expect(model.coveredRows.map(rowServiceId).sort()).toEqual([
      "SERVICE-1",
      "SERVICE-3",
    ]);
    expect(model.reviewRows.map(rowServiceId)).toEqual(["SERVICE-2"]);
    expect(model.unattributedRows.map(rowServiceId)).toEqual(["SERVICE-4"]);
    expect(model.taggedServiceCount).toBe(1);
    expect(model.observedServiceCount).toBe(1);
  });

  it("moves a reviewed service into covered without changing the total", () => {
    const assignment: ProviderScopeAssignmentRecord = {
      ...createServiceScopeAssignment({
        providerSlug: "aws",
        providerServiceId: "ec2",
        providerServiceName: "Amazon EC2",
        serviceEntityId: "SERVICE-2",
        serviceEntityName: "Checkout",
      }),
      objectId: "assignment-1",
      version: "1",
    };
    const model = build([assignment]);

    expect(model.rows).toHaveLength(4);
    expect(model.coveredRows.map(rowServiceId).sort()).toEqual([
      "SERVICE-1",
      "SERVICE-2",
      "SERVICE-3",
    ]);
    expect(model.reviewRows).toHaveLength(0);
    expect(model.unattributedRows.map(rowServiceId)).toEqual(["SERVICE-4"]);
  });
});
