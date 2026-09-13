import type { EvidenceCandidate } from "../ui/app/data/evidenceCandidates";
import {
  buildEvidenceReviewArtifact,
  evidenceReviewArtifactFilename,
  formatEvidenceFollowUpSummary,
} from "../ui/app/data/evidenceReviewArtifact";
import type { IncidentReviewCase } from "../ui/app/data/incidentReviewCases";
import type {
  EffectiveContractTerms,
  ProblemRecord,
  ServiceRecord,
  SlaProviderResponse,
} from "../ui/app/types";

const service: ServiceRecord = {
  id: "SERVICE-CHECKOUT",
  name: "Checkout",
  type: "SERVICE",
  tags: [],
};

const problem: ProblemRecord = {
  id: "P-123",
  title: "Failure rate increase",
  status: "CLOSED",
  category: "ERROR",
  affectedEntityIds: [service.id],
  affectedEntities: [{ id: service.id, name: service.name, type: "service" }],
  hasRootCause: true,
  rootCause: { id: "HOST-1", name: "host-1", type: "host" },
  affectedUsersCount: 42,
  startedAt: "2026-09-12T10:00:00-04:00",
  endedAt: "2026-09-12T10:05:00-04:00",
};

const candidate: EvidenceCandidate = {
  key: "aws|p-123",
  problem,
  affectedServices: [service],
  providerServiceIds: ["ec2"],
  providerServiceNames: ["Amazon EC2"],
  mappingBasis: "confirmed-scope",
  mappingEvidence: "Operator-confirmed provider coverage.",
  scopeConfirmed: true,
};

const reviewCase: IncidentReviewCase = {
  key: "case-123",
  problems: [problem],
  candidates: [candidate],
  affectedServices: [service],
  providerServiceIds: ["ec2"],
  providerServiceNames: ["Amazon EC2"],
  startedAt: problem.startedAt,
  endedAt: problem.endedAt,
  active: false,
  groupingBasis: "single",
  groupingEvidence: "One Problem forms this review case.",
};

const provider: SlaProviderResponse = {
  generatedAt: "2026-09-12T00:00:00.000Z",
  provider: {
    slug: "aws",
    name: "AWS",
    category: "Cloud",
    uptime: 99.99,
    status: "verified",
    lastVerified: "2026-09-12",
    exclusions: ["Customer-controlled network failures"],
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

const terms: EffectiveContractTerms = {
  availabilityTarget: 99.99,
  filingDeadlineDays: 30,
  deadlineBasis: "End of billing cycle",
  businessDays: false,
  maxCreditPercent: 100,
  claimMethod: "AWS Support Center",
  source: "sla.directory",
  appliedOverrides: [],
};

describe("evidence review artifact", () => {
  it("exports traceable Dynatrace evidence without claiming submission", () => {
    const artifact = buildEvidenceReviewArtifact({
      generatedAt: "2026-09-13T00:00:00.000Z",
      provider,
      reviewCase,
      candidate,
      state: "needs-evidence",
      terms,
      telemetry: { requestCount: 1_000, failureCount: 20 },
      telemetryAvailable: true,
      lookbackHours: 720,
      objectives: [{
        serviceId: service.id,
        serviceName: service.name,
        objectiveId: "SLO-1",
        objectiveName: "Checkout availability",
        timeframe: "Last 30 days",
        targetPercent: 99.99,
        observedPercent: 98,
        evaluationStatus: "failed",
      }],
      objectivesIncomplete: false,
      providerReportState: "not-matched",
      exclusions: ["Customer-controlled network failures"],
      requiredEvidence: ["Billing statement", "Incident timestamps"],
      acknowledgedEvidence: ["Incident timestamps"],
      structuralGaps: [],
      davisImpact: "Service impact · 42 affected users",
    });

    expect(artifact.incidentWindow.startedAtUtc).toBe("2026-09-12T14:00:00.000Z");
    expect(artifact.dynatrace.problems[0].id).toBe("P-123");
    expect(artifact.customerImpact.telemetry.observedAvailabilityPercent).toBe(98);
    expect(artifact.providerCorroboration.optional).toBe(true);
    expect(artifact.providerCorroboration.status).toBe("not-matched");
    expect(artifact.requirements.confirmedExternally).toEqual(["Incident timestamps"]);
    expect(artifact.requirements.missing).toEqual(["Provider requirement: Billing statement"]);
    expect(artifact.boundary).toContain("not a submitted claim");

    const summary = formatEvidenceFollowUpSummary(artifact);
    expect(summary).toContain("Provider corroboration (optional): not-matched");
    expect(summary).toContain("Review state: Needs evidence");
    expect(summary).toContain("Dynatrace Problems: P-123");
    expect(summary).toContain("not a submitted claim");
    expect(evidenceReviewArtifactFilename(artifact)).toBe("evidence-review-aws-case-123-2026-09-13.json");
  });
});
