import {
  assessProblemRootCause,
  bulkDismissalEligibility,
  createBulkDismissalNote,
  createRootCauseReviewGroups,
} from "../ui/app/data/incidentTriage";
import type { EvidenceCandidate } from "../ui/app/data/evidenceCandidates";
import type {
  EvidenceDecisionRecord,
  ProblemRecord,
  ServiceRecord,
  SmartscapeScopeEdge,
} from "../ui/app/types";

const service: ServiceRecord = {
  id: "SERVICE-AFFECTED",
  name: "Checkout",
  type: "SERVICE",
  tags: [],
};

const problem = (id: string, rootCauseId = "SERVICE-ROOT"): ProblemRecord => ({
  id,
  title: "Failure rate increase",
  status: "CLOSED",
  category: "ERROR",
  affectedEntityIds: [service.id],
  affectedEntities: [{ id: service.id, name: service.name, type: "service" }],
  hasRootCause: true,
  rootCause: { id: rootCauseId, name: "Payments", type: "service" },
  startedAt: "2026-09-12T10:00:00Z",
});

const candidate = (record: ProblemRecord): EvidenceCandidate => ({
  key: `aws|${record.id.toLowerCase()}`,
  problem: record,
  affectedServices: [service],
  providerServiceIds: ["ec2"],
  providerServiceNames: ["Amazon EC2"],
  mappingBasis: "confirmed-scope",
  mappingEvidence: "Confirmed scope overlaps the affected service.",
  scopeConfirmed: true,
});

const edge = (providerSlug: string): SmartscapeScopeEdge => ({
  serviceNodeId: "service-root-node",
  serviceClassicId: "SERVICE-ROOT",
  serviceName: "Payments",
  serviceTags: [],
  targetNodeId: "runtime-node",
  targetClassicId: "HOST-1",
  targetName: "worker-1",
  targetType: "HOST",
  relationship: "runs_on",
  providerSlug,
});

const assessment = (
  record: ProblemRecord,
  topology: SmartscapeScopeEdge[] = [],
  contextComplete = true,
) => assessProblemRootCause({
  problem: record,
  providerSlug: "aws",
  providerName: "AWS",
  services: [service],
  topology,
  assignments: [],
  providerLabelKey: "provider",
  contextComplete,
});

describe("incident root-cause triage", () => {
  it("keeps a root cause linked to the active provider out of bulk dismissal", () => {
    const record = problem("P-1");
    const rootCause = assessment(record, [edge("aws")]);

    expect(rootCause.relation).toBe("provider-linked");
    expect(bulkDismissalEligibility({
      problem: record,
      candidate: candidate(record),
      assessment: rootCause,
      contextComplete: true,
    })).toEqual({
      eligible: false,
      reason: "The root cause is linked to this provider.",
    });
  });

  it("identifies another provider without treating topology as contractual proof", () => {
    const record = problem("P-2");
    const rootCause = assessment(record, [edge("azure")]);

    expect(rootCause).toMatchObject({
      relation: "other-provider",
      label: "Azure link found",
      linkedProviderSlugs: ["azure"],
    });
    expect(bulkDismissalEligibility({
      problem: record,
      candidate: candidate(record),
      assessment: rootCause,
      contextComplete: true,
    }).eligible).toBe(true);
    expect(createBulkDismissalNote({
      problem: record,
      assessment: rootCause,
      providerName: "AWS",
    })).toContain("links it to Azure");
  });

  it("requires a closed confirmed candidate and complete relationship context", () => {
    const record = problem("P-3");
    const rootCause = assessment(record);
    const base = {
      problem: record,
      candidate: candidate(record),
      assessment: rootCause,
      contextComplete: true,
    };

    expect(bulkDismissalEligibility(base).eligible).toBe(true);
    expect(bulkDismissalEligibility({
      ...base,
      problem: { ...record, status: "ACTIVE" },
    }).eligible).toBe(false);
    expect(bulkDismissalEligibility({
      ...base,
      problem: { ...record, status: "UNKNOWN" },
    }).eligible).toBe(false);
    expect(bulkDismissalEligibility({
      ...base,
      candidate: { ...candidate(record), scopeConfirmed: false },
    }).eligible).toBe(false);
    expect(bulkDismissalEligibility({
      ...base,
      assessment: assessment(record, [], false),
      contextComplete: false,
    }).eligible).toBe(false);
  });

  it("allows explicit manual bulk review when Dynatrace returns no root cause", () => {
    const record = {
      ...problem("P-NO-ROOT"),
      hasRootCause: false,
      rootCause: undefined,
    };
    const rootCause = assessment(record);
    const item = {
      problem: record,
      candidate: candidate(record),
      assessment: rootCause,
      contextComplete: true,
    };

    expect(bulkDismissalEligibility(item)).toEqual({
      eligible: true,
      reason: "Available for manual bulk review. Dynatrace did not return a root cause.",
    });
    expect(createRootCauseReviewGroups([item])).toEqual([]);
    expect(createBulkDismissalNote({
      problem: record,
      assessment: rootCause,
      providerName: "AWS",
    })).toContain("was not inferred from root-cause data");
    expect(bulkDismissalEligibility({
      ...item,
      contextComplete: false,
    }).eligible).toBe(false);
  });

  it("does not overwrite an existing current review decision", () => {
    const record = problem("P-4");
    const decision = {
      decisionKey: "aws|p-4",
      providerSlug: "aws",
      problemId: "P-4",
    } as EvidenceDecisionRecord;

    expect(bulkDismissalEligibility({
      problem: record,
      candidate: candidate(record),
      decision,
      assessment: assessment(record),
      contextComplete: true,
    })).toEqual({
      eligible: false,
      reason: "This Problem already has a review decision.",
    });
  });

  it("groups only eligible Problems that share the exact root-cause entity", () => {
    const first = problem("P-5");
    const second = problem("P-6");
    const singleton = problem("P-7", "SERVICE-OTHER");
    const items = [first, second, singleton].map((record) => ({
      problem: record,
      candidate: candidate(record),
      assessment: assessment(record),
      contextComplete: true,
    }));

    expect(createRootCauseReviewGroups(items)).toEqual([{
      rootCauseEntityId: "SERVICE-ROOT",
      rootCauseEntityName: "Payments",
      problemIds: ["P-5", "P-6"],
    }]);
  });
});
