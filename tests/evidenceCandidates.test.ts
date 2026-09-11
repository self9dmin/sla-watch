import {
  buildEvidenceCandidates,
  createEvidenceDecisionKey,
  evidenceDecisionValue,
  normalizeEvidenceDecision,
} from "../ui/app/data/evidenceCandidates";
import type {
  ProblemRecord,
  ProviderScopeAssignmentRecord,
  ServiceRecord,
  SlaProviderResponse,
  SmartscapeScopeEdge,
} from "../ui/app/types";

const provider: SlaProviderResponse = {
  generatedAt: "2026-09-10T00:00:00.000Z",
  provider: {
    slug: "aws",
    name: "AWS",
    category: "Cloud",
    uptime: 99.99,
    status: "verified",
    lastVerified: "2026-09-10",
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

const service: ServiceRecord = {
  id: "SERVICE-1",
  name: "Checkout",
  type: "SERVICE",
  tags: [],
};

const problem: ProblemRecord = {
  id: "P-1",
  title: "Failure rate increase",
  status: "CLOSED",
  category: "ERROR",
  affectedEntityIds: [service.id],
  hasRootCause: false,
  startedAt: "2026-09-09T10:00:00.000Z",
  endedAt: "2026-09-09T10:07:00.000Z",
};

const edge: SmartscapeScopeEdge = {
  serviceNodeId: "service-node",
  serviceClassicId: service.id,
  serviceName: service.name,
  serviceTags: [],
  targetNodeId: "runtime-node",
  targetClassicId: "AWS_EC2_INSTANCE-1",
  targetName: "checkout-runtime",
  targetType: "AWS_EC2_INSTANCE",
  relationship: "runs_on",
  providerSlug: "aws",
  providerEvidence: "AWS runtime metadata",
};

const assignment: ProviderScopeAssignmentRecord = {
  objectId: "setting-1",
  version: "1",
  assignmentKey: "aws|service-1|aws_ec2_instance-1",
  providerSlug: "aws",
  providerServiceId: "ec2",
  providerServiceName: "Amazon EC2",
  serviceEntityId: service.id,
  serviceEntityName: service.name,
  runtimeEntityId: "AWS_EC2_INSTANCE-1",
  runtimeEntityName: "checkout-runtime",
  runtimeType: "AWS_EC2_INSTANCE",
  evidence: "Operator confirmed the Smartscape relationship.",
  enabled: true,
};

describe("evidence candidates", () => {
  it("creates a stable decision key", () => {
    expect(createEvidenceDecisionKey(" AWS ", " P-1 ")).toBe("aws|p-1");
  });

  it("includes an observed Problem when an exact scope mapping overlaps", () => {
    const candidates = buildEvidenceCandidates({
      provider,
      problems: [problem],
      services: [service],
      topology: [edge],
      assignments: [assignment],
      providerLabelKey: "provider",
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      mappingBasis: "confirmed-scope",
      scopeConfirmed: true,
      providerServiceIds: ["ec2"],
    });
  });

  it("keeps a Smartscape-only match visibly unconfirmed", () => {
    const [candidate] = buildEvidenceCandidates({
      provider,
      problems: [problem],
      services: [service],
      topology: [edge],
      assignments: [],
      providerLabelKey: "provider",
    });
    expect(candidate).toMatchObject({
      mappingBasis: "smartscape-candidate",
      scopeConfirmed: false,
    });
  });

  it("does not turn an unrelated Problem into a provider candidate", () => {
    expect(buildEvidenceCandidates({
      provider,
      problems: [{ ...problem, affectedEntityIds: ["SERVICE-OTHER"] }],
      services: [service],
      topology: [edge],
      assignments: [assignment],
      providerLabelKey: "provider",
    })).toEqual([]);
  });

  it("creates and normalizes a conservative human review record", () => {
    const [candidate] = buildEvidenceCandidates({
      provider,
      problems: [problem],
      services: [service],
      topology: [edge],
      assignments: [assignment],
      providerLabelKey: "provider",
    });
    const value = evidenceDecisionValue(
      candidate,
      "aws",
      "validated",
      "Scope and dates reviewed.",
      "2026-09-10T12:00:00.000Z",
    );
    expect(normalizeEvidenceDecision(value)).toEqual(value);
    expect(normalizeEvidenceDecision({ ...value, mappingEvidence: "" })).toBeNull();
  });
});
