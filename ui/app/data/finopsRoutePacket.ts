import type { EvidenceReviewArtifact } from "./evidenceReviewArtifact";

/** Only one Problem and one provider service can be routed in the first release. */
export const finopsRoutePacket = (artifact: EvidenceReviewArtifact) => {
  const problem = artifact.dynatrace.problems[0];
  const providerServiceId = artifact.provider.serviceIds[0];
  if (artifact.dynatrace.problems.length !== 1 ||
      artifact.provider.serviceIds.length !== 1 ||
      artifact.dynatrace.affectedServices.length !== 1 ||
      !problem || !providerServiceId ||
      artifact.review.decisionStatus !== "validated" ||
      !artifact.review.reviewedAtUtc ||
      artifact.incidentWindow.ongoing ||
      !artifact.coverage.confirmed ||
      artifact.customerImpact.telemetry.status !== "collected" ||
      artifact.customerImpact.telemetry.observedAvailabilityPercent === null ||
      artifact.terms.availabilityTargetPercent === null ||
      artifact.customerImpact.telemetry.observedAvailabilityPercent >= artifact.terms.availabilityTargetPercent ||
      artifact.requirements.missing.length > 0) return null;
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
