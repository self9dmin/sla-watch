import { finopsRouteBlockers, finopsRoutePacket } from "../ui/app/data/finopsRoutePacket";
import type { EvidenceReviewArtifact } from "../ui/app/data/evidenceReviewArtifact";

const artifact = (): EvidenceReviewArtifact => ({
  review: { caseId: "aws|P-123", decisionStatus: "validated", reviewedAtUtc: "2026-10-02T12:00:00.000Z", decisionNote: "private operator note" },
  provider: { slug: "aws", serviceIds: ["amazon-rds"] },
  dynatrace: { problems: [{ id: "P-123" }], affectedServices: [{ id: "SERVICE-123" }], davisImpact: "Availability degradation" },
  incidentWindow: { ongoing: false },
  coverage: { confirmed: true },
  customerImpact: { telemetry: { status: "collected", observedAvailabilityPercent: 98.5 } },
  terms: { availabilityTargetPercent: 99.9 },
  requirements: { missing: [] },
  providerCorroboration: { status: "not-matched" },
} as unknown as EvidenceReviewArtifact);

describe("FinOps candidate trigger", () => {
  it("emits a bounded route packet only for a completed human-ready case", () => {
    const packet = finopsRoutePacket(artifact());
    expect(packet).toMatchObject({
      requestId: "aws|P-123|2026-10-02T12:00:00.000Z",
      problemId: "P-123",
      reviewStatus: "validated",
      problemClosed: true,
    });
    expect(JSON.stringify(packet)).not.toContain("private operator note");
  });

  it("rejects open, ambiguous, incomplete, or target-meeting cases", () => {
    const base = artifact();
    const changes = [
      { ...base, review: { ...base.review, decisionStatus: "not-ready" } },
      { ...base, incidentWindow: { ...base.incidentWindow, ongoing: true } },
      { ...base, provider: { ...base.provider, serviceIds: ["amazon-rds", "amazon-ec2"] } },
      { ...base, coverage: { ...base.coverage, confirmed: false } },
      { ...base, customerImpact: { ...base.customerImpact, telemetry: { ...base.customerImpact.telemetry, observedAvailabilityPercent: null } } },
      { ...base, customerImpact: { ...base.customerImpact, telemetry: { ...base.customerImpact.telemetry, observedAvailabilityPercent: 99.95 } } },
      { ...base, requirements: { ...base.requirements, missing: ["Provider requirement"] } },
    ];
    for (const value of changes) expect(finopsRoutePacket(value as EvidenceReviewArtifact)).toBeNull();
  });

  it("explains each missing routing gate without weakening the packet", () => {
    const base = artifact();
    const incomplete = {
      ...base,
      incidentWindow: { ongoing: true },
      dynatrace: { ...base.dynatrace, problems: [{ id: "P-1" }, { id: "P-2" }] },
      requirements: { missing: ["Resource ARN"] },
    } as unknown as EvidenceReviewArtifact;
    expect(finopsRouteBlockers(incomplete)).toEqual(expect.arrayContaining([
      "This pilot routes one Dynatrace Problem per request.",
      "Wait for the Problem to close.",
      "Confirm all required provider evidence items.",
    ]));
    expect(finopsRoutePacket(incomplete)).toBeNull();
  });
});
