import {
  createOverrideKey,
  normalizeContractOverride,
  resolveEffectiveContractTerms,
  validateContractOverride,
} from "../ui/app/data/contractOverrides";
import type { ContractOverrideRecord, SlaProviderResponse } from "../ui/app/types";

const directory: SlaProviderResponse = {
  generatedAt: "2026-09-10T12:00:00Z",
  provider: {
    slug: "aws",
    name: "AWS",
    category: "cloud",
    uptime: 99.9,
    status: "verified",
    lastVerified: "2026-09-01",
    maxCreditPercent: 10,
    claimProcess: {
      deadlineDays: 30,
      deadlineBasis: "incident end",
      businessDays: false,
      method: "Support case",
      url: null,
      requiredEvidence: [],
      reviewDays: null,
      creditApplication: null,
    },
  },
  services: [{
    id: "ec2",
    name: "EC2",
    category: "compute",
    uptime: 99.99,
    eligible: true,
    slaUrl: "https://example.com/ec2",
  }],
};

const baseOverride = (patch: Partial<ContractOverrideRecord> = {}): ContractOverrideRecord => ({
  objectId: "object-1",
  version: "1",
  overrideKey: "aws|*|provider|*",
  providerSlug: "aws",
  providerServiceId: "*",
  providerServiceName: "All provider services",
  scopeKind: "provider",
  scopeEntityId: "*",
  scopeEntityName: "AWS default",
  scopeEntityIds: ["*"],
  scopeEntityNames: ["AWS default"],
  location: null,
  availabilityTarget: null,
  filingDeadlineDays: null,
  deadlineBasis: null,
  businessDays: false,
  maxCreditPercent: null,
  claimMethod: null,
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  sourceReference: "Enterprise agreement 2026",
  sourceUrl: null,
  notes: null,
  enabled: true,
  ...patch,
});

describe("contract override precedence", () => {
  it("builds a stable key from the explicit provider scope", () => {
    expect(createOverrideKey(baseOverride())).toBe("aws|*|provider|*");
  });

  it("builds the same key when a target set is selected in a different order", () => {
    const first = baseOverride({ scopeKind: "service", scopeEntityId: "SERVICE-1", scopeEntityIds: ["SERVICE-1", "SERVICE-2"] });
    const second = baseOverride({ scopeKind: "service", scopeEntityId: "SERVICE-2", scopeEntityIds: ["SERVICE-2", "SERVICE-1"] });
    expect(createOverrideKey(first)).toBe(createOverrideKey(second));
  });

  it("keeps legacy single-target settings readable", () => {
    const legacy = { ...baseOverride() } as Record<string, unknown>;
    delete legacy.scopeEntityIds;
    delete legacy.scopeEntityNames;
    legacy.scopeKind = "service";
    legacy.scopeEntityId = "SERVICE-1";
    legacy.scopeEntityName = "Checkout";
    const normalized = normalizeContractOverride(legacy);
    expect(normalized?.scopeEntityIds).toEqual(["SERVICE-1"]);
    expect(normalized?.scopeEntityNames).toEqual(["Checkout"]);
  });

  it("keeps the public directory as the baseline", () => {
    const result = resolveEffectiveContractTerms(directory, [], {
      providerSlug: "aws",
      providerServiceId: "ec2",
      serviceId: "SERVICE-1",
    });
    expect(result.source).toBe("sla.directory");
    expect(result.availabilityTarget).toBe(99.99);
    expect(result.filingDeadlineDays).toBe(30);
  });

  it("layers provider, service, location, and host overrides in that order", () => {
    const overrides = [
      baseOverride({ filingDeadlineDays: 45 }),
      baseOverride({ objectId: "object-2", overrideKey: "service", scopeKind: "service", scopeEntityId: "SERVICE-1", scopeEntityName: "Checkout", scopeEntityIds: ["SERVICE-1"], scopeEntityNames: ["Checkout"], maxCreditPercent: 25 }),
      baseOverride({ objectId: "object-3", overrideKey: "location", scopeKind: "location", scopeEntityId: "us-east-1", scopeEntityName: "us-east-1", scopeEntityIds: ["us-east-1"], scopeEntityNames: ["us-east-1"], availabilityTarget: 99.95 }),
      baseOverride({ objectId: "object-4", overrideKey: "host", scopeKind: "host", scopeEntityId: "HOST-1", scopeEntityName: "host-1", scopeEntityIds: ["HOST-1"], scopeEntityNames: ["host-1"], availabilityTarget: 99.97 }),
    ];
    const result = resolveEffectiveContractTerms(directory, overrides, {
      providerSlug: "aws",
      providerServiceId: "ec2",
      serviceId: "SERVICE-1",
      hostId: "HOST-1",
      location: "us-east-1",
    }, new Date("2026-09-10T12:00:00Z"));

    expect(result.source).toBe("tenant override");
    expect(result.availabilityTarget).toBe(99.97);
    expect(result.filingDeadlineDays).toBe(45);
    expect(result.maxCreditPercent).toBe(25);
    expect(result.appliedOverrides).toHaveLength(4);
  });

  it("ignores disabled, expired, and unrelated records", () => {
    const result = resolveEffectiveContractTerms(directory, [
      baseOverride({ availabilityTarget: 98, enabled: false }),
      baseOverride({ objectId: "expired", availabilityTarget: 97, effectiveTo: "2025-12-31" }),
      baseOverride({ objectId: "azure", providerSlug: "azure", availabilityTarget: 96 }),
    ], { providerSlug: "aws", providerServiceId: "ec2" }, new Date("2026-09-10T12:00:00Z"));

    expect(result.source).toBe("sla.directory");
    expect(result.availabilityTarget).toBe(99.99);
  });

  it("applies one SLA override to any explicitly assigned service", () => {
    const sharedServiceOverride = baseOverride({
      objectId: "shared-services",
      overrideKey: "aws|ec2|service|set",
      providerServiceId: "ec2",
      providerServiceName: "EC2",
      scopeKind: "service",
      scopeEntityId: "SERVICE-1",
      scopeEntityName: "Checkout",
      scopeEntityIds: ["SERVICE-1", "SERVICE-2"],
      scopeEntityNames: ["Checkout", "Catalog"],
      availabilityTarget: 99.95,
    });

    const first = resolveEffectiveContractTerms(directory, [sharedServiceOverride], {
      providerSlug: "aws",
      providerServiceId: "ec2",
      serviceId: "SERVICE-1",
    });
    const second = resolveEffectiveContractTerms(directory, [sharedServiceOverride], {
      providerSlug: "aws",
      providerServiceId: "ec2",
      serviceId: "SERVICE-2",
    });
    const unrelated = resolveEffectiveContractTerms(directory, [sharedServiceOverride], {
      providerSlug: "aws",
      providerServiceId: "ec2",
      serviceId: "SERVICE-3",
    });

    expect(first.availabilityTarget).toBe(99.95);
    expect(second.availabilityTarget).toBe(99.95);
    expect(unrelated.availabilityTarget).toBe(99.99);
  });
});

describe("contract override validation", () => {
  it("requires a verifiable source and at least one operational term", () => {
    const errors = validateContractOverride(baseOverride({ sourceReference: "" }));
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/reference/i),
      expect.stringMatching(/operational term/i),
    ]));
  });
});
