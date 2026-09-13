import { buildIncidentReviewCases } from "../ui/app/data/incidentReviewCases";
import type { EvidenceCandidate } from "../ui/app/data/evidenceCandidates";
import type {
  ContractOverrideRecord,
  ProblemRecord,
  ServiceRecord,
} from "../ui/app/types";

const checkout: ServiceRecord = {
  id: "SERVICE-CHECKOUT",
  name: "Checkout",
  type: "SERVICE",
  tags: [],
};

const catalog: ServiceRecord = {
  id: "SERVICE-CATALOG",
  name: "Catalog",
  type: "SERVICE",
  tags: [],
};

const problem = ({
  id,
  service = checkout,
  providerServiceId = "ec2",
  startedAt = "2026-09-12T10:00:00.000Z",
  endedAt = "2026-09-12T10:05:00.000Z",
  rootCauseId,
}: {
  id: string;
  service?: ServiceRecord;
  providerServiceId?: string;
  startedAt?: string;
  endedAt?: string;
  rootCauseId?: string;
}): { record: ProblemRecord; candidate: EvidenceCandidate } => {
  const record: ProblemRecord = {
    id,
    title: "Failure rate increase",
    status: "CLOSED",
    category: "ERROR",
    affectedEntityIds: [service.id],
    affectedEntities: [{ id: service.id, name: service.name, type: "service" }],
    hasRootCause: Boolean(rootCauseId),
    rootCause: rootCauseId
      ? { id: rootCauseId, name: rootCauseId, type: "service" }
      : undefined,
    startedAt,
    endedAt,
  };
  return {
    record,
    candidate: {
      key: `aws|${id.toLowerCase()}`,
      problem: record,
      affectedServices: [service],
      providerServiceIds: [providerServiceId],
      providerServiceNames: [providerServiceId === "ec2" ? "Amazon EC2" : "AWS Lambda"],
      mappingBasis: "confirmed-scope",
      mappingEvidence: "Confirmed provider scope.",
      scopeConfirmed: true,
    },
  };
};

const build = (
  values: Array<{ record: ProblemRecord; candidate: EvidenceCandidate }>,
  contractOverrides: ContractOverrideRecord[] = [],
) => buildIncidentReviewCases({
  providerSlug: "aws",
  problems: values.map((value) => value.record),
  candidates: values.map((value) => value.candidate),
  services: [checkout, catalog],
  contractOverrides,
});

describe("incident review cases", () => {
  it("groups nearby Problems for the same provider service and affected service", () => {
    const first = problem({ id: "P-1" });
    const second = problem({
      id: "P-2",
      startedAt: "2026-09-12T10:20:00.000Z",
      endedAt: "2026-09-12T10:24:00.000Z",
    });

    const cases = build([first, second]);

    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({
      groupingBasis: "affected-service",
      providerServiceIds: ["ec2"],
    });
    expect(cases[0].problems.map((item) => item.id)).toEqual(["P-1", "P-2"]);
  });

  it("uses a shared Dynatrace root cause to correlate different affected services", () => {
    const first = problem({ id: "P-1", service: checkout, rootCauseId: "HOST-ROOT" });
    const second = problem({
      id: "P-2",
      service: catalog,
      rootCauseId: "HOST-ROOT",
      startedAt: "2026-09-12T10:12:00.000Z",
      endedAt: "2026-09-12T10:20:00.000Z",
    });

    const cases = build([first, second]);

    expect(cases).toHaveLength(1);
    expect(cases[0].groupingBasis).toBe("root-cause");
    expect(cases[0].affectedServices).toHaveLength(2);
  });

  it("does not group merely because Problems belong to the same vendor", () => {
    const first = problem({ id: "P-1", providerServiceId: "ec2" });
    const second = problem({
      id: "P-2",
      providerServiceId: "lambda",
      startedAt: "2026-09-12T10:10:00.000Z",
    });

    expect(build([first, second])).toHaveLength(2);
  });

  it("keeps unrelated or distant Problems in separate review cases", () => {
    const first = problem({ id: "P-1", service: checkout });
    const unrelated = problem({
      id: "P-2",
      service: catalog,
      startedAt: "2026-09-12T10:10:00.000Z",
    });
    const distant = problem({
      id: "P-3",
      service: checkout,
      startedAt: "2026-09-12T12:00:00.000Z",
    });

    expect(build([first, unrelated, distant])).toHaveLength(3);
  });

  it("groups Problems when they resolve to the same custom terms", () => {
    const first = problem({ id: "P-1" });
    const second = problem({
      id: "P-2",
      startedAt: "2026-09-12T10:20:00.000Z",
    });
    const override: ContractOverrideRecord = {
      objectId: "override-1",
      version: "1",
      overrideKey: "aws|ec2|service|service-checkout",
      providerSlug: "aws",
      providerServiceId: "ec2",
      providerServiceName: "Amazon EC2",
      scopeKind: "service",
      scopeEntityId: checkout.id,
      scopeEntityName: checkout.name,
      scopeEntityIds: [checkout.id],
      scopeEntityNames: [checkout.name],
      availabilityTarget: 99.95,
      filingDeadlineDays: null,
      deadlineBasis: null,
      businessDays: false,
      maxCreditPercent: null,
      claimMethod: null,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      sourceReference: "Enterprise agreement",
      sourceUrl: null,
      notes: null,
      enabled: true,
    };

    expect(build([first, second], [override])).toHaveLength(1);
  });

  it("keeps Problems independent when affected services resolve to different custom terms", () => {
    const first = problem({ id: "P-1", service: checkout });
    const second = problem({
      id: "P-2",
      service: catalog,
      rootCauseId: "HOST-ROOT",
      startedAt: "2026-09-12T10:20:00.000Z",
    });
    first.record.rootCause = { id: "HOST-ROOT", name: "HOST-ROOT", type: "service" };
    first.record.hasRootCause = true;
    const override: ContractOverrideRecord = {
      objectId: "override-1",
      version: "1",
      overrideKey: "aws|ec2|service|service-checkout",
      providerSlug: "aws",
      providerServiceId: "ec2",
      providerServiceName: "Amazon EC2",
      scopeKind: "service",
      scopeEntityId: checkout.id,
      scopeEntityName: checkout.name,
      scopeEntityIds: [checkout.id],
      scopeEntityNames: [checkout.name],
      availabilityTarget: 99.95,
      filingDeadlineDays: null,
      deadlineBasis: null,
      businessDays: false,
      maxCreditPercent: null,
      claimMethod: null,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      sourceReference: "Enterprise agreement",
      sourceUrl: null,
      notes: null,
      enabled: true,
    };

    expect(build([first, second], [override])).toHaveLength(2);
  });

  it("keeps an unconfirmed provider-service suggestion independent", () => {
    const first = problem({ id: "P-1" });
    const second = problem({
      id: "P-2",
      startedAt: "2026-09-12T10:20:00.000Z",
    });
    first.candidate.scopeConfirmed = false;
    first.candidate.mappingBasis = "smartscape-candidate";

    expect(build([first, second])).toHaveLength(2);
  });
});
