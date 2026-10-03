import type { EvidenceReviewArtifact } from "./evidenceReviewArtifact";

/** Only one Problem and one provider service can be routed in the first release. */
export const finopsRouteBlockers = (artifact: EvidenceReviewArtifact): string[] => {
  const blockers: string[] = [];
  if (artifact.review.decisionStatus !== "validated" || !artifact.review.reviewedAtUtc)
    blockers.push("Save a complete human evidence review.");
  if (artifact.dynatrace.problems.length !== 1)
    blockers.push("This pilot routes one Dynatrace Problem per request.");
  if (artifact.incidentWindow.ongoing)
    blockers.push("Wait for the Problem to close.");
  if (artifact.dynatrace.affectedServices.length !== 1)
    blockers.push("Resolve one affected Dynatrace service.");
  if (artifact.provider.serviceIds.length !== 1)
    blockers.push("Resolve one provider service.");
  if (!artifact.coverage.confirmed)
    blockers.push("Confirm the provider scope in Coverage.");
  if (artifact.customerImpact.telemetry.status !== "collected" ||
      artifact.customerImpact.telemetry.observedAvailabilityPercent === null)
    blockers.push("Collect request telemetry with measured availability.");
  if (artifact.terms.availabilityTargetPercent === null)
    blockers.push("Confirm an applicable provider availability target.");
  if (artifact.customerImpact.telemetry.observedAvailabilityPercent !== null &&
      artifact.terms.availabilityTargetPercent !== null &&
      artifact.customerImpact.telemetry.observedAvailabilityPercent >= artifact.terms.availabilityTargetPercent)
    blockers.push("Measured availability is not below the reference SLA target.");
  if (artifact.requirements.missing.length > 0)
    blockers.push("Confirm all required provider evidence items.");
  return blockers;
};

export const finopsRoutePacket = (artifact: EvidenceReviewArtifact) => {
  const problem = artifact.dynatrace.problems[0];
  const providerServiceId = artifact.provider.serviceIds[0];
  if (finopsRouteBlockers(artifact).length > 0 || !problem || !providerServiceId) return null;
  return {
    schemaVersion: 1,
    requestId: `${artifact.review.caseId}|${artifact.review.reviewedAtUtc}`,
    reviewedAt: artifact.review.reviewedAtUtc,
    caseId: artifact.review.caseId,
    problemId: problem.id,
    providerSlug: artifact.provider.slug,
    providerServiceId,
    problemClosed: !artifact.incidentWindow.ongoing,
    reviewStatus: "validated",
    reviewCurrent: true,
    scopeConfirmed: artifact.coverage.confirmed,
    customerTelemetryAvailable: artifact.customerImpact.telemetry.status === "collected",
    observedAvailabilityPercent: artifact.customerImpact.telemetry.observedAvailabilityPercent,
    slaTargetPercent: artifact.terms.availabilityTargetPercent,
    missingRequirementsCount: artifact.requirements.missing.length,
    providerReportStatus: artifact.providerCorroboration.status,
    davisImpact: artifact.dynatrace.davisImpact,
  } as const;
};
