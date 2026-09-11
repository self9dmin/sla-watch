import {
  buildEvidenceCandidates,
  createEvidenceDecisionKey,
  evidenceDecisionInputError,
  evidenceDecisionMatchesCandidate,
  evidenceDecisionValue,
  MAX_EVIDENCE_DECISION_NOTE_LENGTH,
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

  it("does not infer a candidate from a service name", () => {
    expect(buildEvidenceCandidates({
      provider,
      problems: [problem],
      services: [{ ...service, name: "AWS EC2 checkout" }],
      topology: [],
      assignments: [],
      providerLabelKey: "provider",
    })).toEqual([]);
  });

  it("does not accept topology from a different provider", () => {
    expect(buildEvidenceCandidates({
      provider,
      problems: [problem],
      services: [service],
      topology: [{ ...edge, providerSlug: "azure" }],
      assignments: [],
      providerLabelKey: "provider",
    })).toEqual([]);
  });

  it("accepts only an exact provider tag", () => {
    const [candidate] = buildEvidenceCandidates({
      provider,
      problems: [problem],
      services: [{ ...service, tags: ["provider:aws"] }],
      topology: [],
      assignments: [],
      providerLabelKey: "provider",
    });
    expect(candidate).toMatchObject({
      mappingBasis: "provider-tag",
      scopeConfirmed: true,
    });
    expect(buildEvidenceCandidates({
      provider,
      problems: [problem],
      services: [{ ...service, tags: ["provider:aws-dev"] }],
      topology: [],
      assignments: [],
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

  it("canonicalizes the persisted decision key", () => {
    const [candidate] = buildEvidenceCandidates({
      provider,
      problems: [problem],
      services: [service],
      topology: [edge],
      assignments: [assignment],
      providerLabelKey: "provider",
    });
    const value = evidenceDecisionValue(candidate, "aws", "validated", "");
    expect(normalizeEvidenceDecision({
      ...value,
      decisionKey: "untrusted-key",
    })?.decisionKey).toBe("aws|p-1");
  });

  it("requires a new review when the evidence boundary changes", () => {
    const [candidate] = buildEvidenceCandidates({
      provider,
      problems: [problem],
      services: [service],
      topology: [edge],
      assignments: [assignment],
      providerLabelKey: "provider",
    });
    const value = evidenceDecisionValue(candidate, "aws", "validated", "");
    expect(evidenceDecisionMatchesCandidate(value, candidate)).toBe(true);
    expect(evidenceDecisionMatchesCandidate(
      { ...value, affectedEntityIds: ["SERVICE-OTHER"] },
      candidate,
    )).toBe(false);
    expect(evidenceDecisionMatchesCandidate(
      { ...value, providerServiceIds: ["s3"] },
      candidate,
    )).toBe(false);
  });

  it("keeps the two decision rules explicit", () => {
    expect(evidenceDecisionInputError({
      status: "validated",
      note: "",
      acknowledged: false,
    })).toMatch(/Confirm the review boundary/);
    expect(evidenceDecisionInputError({
      status: "dismissed",
      note: "",
      acknowledged: true,
    })).toMatch(/Add a short reason/);
    expect(evidenceDecisionInputError({
      status: "dismissed",
      note: "Not provider-related.",
      acknowledged: false,
    })).toBeNull();
    expect(evidenceDecisionInputError({
      status: "validated",
      note: "x".repeat(MAX_EVIDENCE_DECISION_NOTE_LENGTH + 1),
      acknowledged: true,
    })).toMatch(/500 characters or fewer/);
  });

  it("bounds the persisted review note", () => {
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
      "x".repeat(MAX_EVIDENCE_DECISION_NOTE_LENGTH + 10),
    );
    expect(value.decisionNote).toHaveLength(MAX_EVIDENCE_DECISION_NOTE_LENGTH);
    expect(normalizeEvidenceDecision({
      ...value,
      decisionNote: "y".repeat(MAX_EVIDENCE_DECISION_NOTE_LENGTH + 10),
    })?.decisionNote).toHaveLength(MAX_EVIDENCE_DECISION_NOTE_LENGTH);
  });
});
