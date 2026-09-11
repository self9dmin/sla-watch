import { parseDirectoryEnvelope } from "../api/slaDirectory.function";

const validEnvelope = {
  schema_version: "1.2.0",
  generated_at: "2026-09-10T00:00:00.000Z",
  last_modified: "2026-09-09",
  result: {
    slug: "aws",
    name: "Amazon Web Services",
    vendor: "Amazon Web Services, Inc.",
    category: "cloud-infrastructure",
    category_name: "Cloud",
    tags: ["iaas", "paas"],
    uptime: 99.99,
    sla_status: "credit",
    sla_status_label: "verified",
    sla_help_wanted: false,
    status_page: "https://health.aws.amazon.com/health/status",
    needs_review: false,
    last_verified: "2026-09-09",
    sla_url: "https://sla.directory/vendors/aws/",
    website: "https://aws.amazon.com/",
    scope: "AWS services covered by the published provider terms.",
    max_credit_percent: 100,
    max_credit: { kind: "capped", label: "100%", value: 100, unit: "percent" },
    has_automatic_credits: false,
    min_plan_for_sla: "Business",
    default_credit_policy: {
      calculation: "monthly spend",
      remedy: "Credit",
      max_credit_percent: 100,
      unit: "percent",
      note: "Credit is subject to provider review.",
      automatic: false,
      credit_tiers: [
        { below: 99.99, credit: 10 },
        { below: 99, credit: 30 },
      ],
    },
    claim_process: {
      deadline_days: 30,
      deadline_basis: "incident end",
      business_days: false,
      method: "Support Center",
      url: "https://support.aws.amazon.com/",
      required_evidence: ["Account ID", "Incident timestamps"],
      review_days: 5,
      credit_application: "next billing cycle",
    },
    exclusions: ["Scheduled maintenance", "Customer misconfiguration"],
    support: {
      tiers: ["Business", "Enterprise"],
      has_24x7: true,
      fastest_response: "15 min",
      response_is_sla: false,
      designated_contact: "tam",
      architecture_review: true,
      professional_services: true,
      success_program: true,
      training: true,
      pricing: "percent_of_spend",
      source_url: "https://aws.amazon.com/premiumsupport/plans/",
      note: "Response targets are not credit-backed.",
    },
    support_tiers: [
      {
        name: "Business",
        slug: "business",
        price: "$100/month",
        sla_eligible: true,
        response_time: "< 1 hour",
      },
    ],
    sla_tiers: [
      {
        name: "Premium",
        requirement: "Premium plan",
        uptime: 99.999,
        max_credit_percent: 100,
        sla_url: "https://aws.amazon.com/legal/",
      },
    ],
    notes: "Terms vary by service.",
    services: [
      {
        id: "aws-s3",
        name: "Amazon S3",
        category: "Storage",
        uptime: 99.99,
        sla_eligible: true,
        sla_url: "https://sla.directory/vendors/aws/services/aws-s3",
        description: "Object storage service.",
        uptime_scope: "Regional service availability",
        last_verified: "2026-09-09",
        credit_policy: {
          calculation: "monthly spend",
          remedy: "Credit",
          max_credit_percent: 100,
          unit: "percent",
          note: null,
          automatic: false,
          credit_tiers: [{ below: 99.99, credit: 10 }],
        },
        exclusions: ["Single-region deployment"],
      },
    ],
  },
};

describe("parseDirectoryEnvelope", () => {
  it("accepts the documented directory shape", () => {
    expect(parseDirectoryEnvelope(validEnvelope)).toEqual(validEnvelope);
  });

  it("rejects malformed provider data before it reaches the UI", () => {
    expect(() =>
      parseDirectoryEnvelope({
        ...validEnvelope,
        result: { ...validEnvelope.result, services: "not-an-array" },
      }),
    ).toThrow("invalid response");
  });

  it("rejects service records without a stable id", () => {
    const malformed = {
      ...validEnvelope,
      result: {
        ...validEnvelope.result,
        services: [{ ...validEnvelope.result.services[0], id: "" }],
      },
    };

    expect(() => parseDirectoryEnvelope(malformed)).toThrow("invalid response");
  });

  it("preserves provider contract and claim-planning fields", () => {
    const parsed = parseDirectoryEnvelope(validEnvelope);
    expect(parsed.result.claim_process?.deadline_days).toBe(30);
    expect(parsed.result.default_credit_policy?.credit_tiers[0]).toEqual({
      below: 99.99,
      credit: 10,
    });
    expect(parsed.result.services[0].credit_policy?.automatic).toBe(false);
    expect(parsed.result.support?.response_is_sla).toBe(false);
    expect(parsed.result.support_tiers?.[0].response_time).toBe("< 1 hour");
    expect(parsed.result.sla_tiers?.[0].uptime).toBe(99.999);
    expect(parsed.result.services[0].exclusions).toEqual([
      "Single-region deployment",
    ]);
  });

  it("rejects malformed claim process fields", () => {
    const malformed = {
      ...validEnvelope,
      result: {
        ...validEnvelope.result,
        claim_process: {
          ...validEnvelope.result.claim_process,
          deadline_days: "30",
        },
      },
    };

    expect(() => parseDirectoryEnvelope(malformed)).toThrow("invalid response");
  });

  it("rejects malformed support records", () => {
    const malformed = {
      ...validEnvelope,
      result: {
        ...validEnvelope.result,
        support: { ...validEnvelope.result.support, response_is_sla: "false" },
      },
    };

    expect(() => parseDirectoryEnvelope(malformed)).toThrow("invalid response");
  });

  it("rejects malformed higher SLA tiers", () => {
    const malformed = {
      ...validEnvelope,
      result: {
        ...validEnvelope.result,
        sla_tiers: [{ ...validEnvelope.result.sla_tiers[0], uptime: "99.999" }],
      },
    };

    expect(() => parseDirectoryEnvelope(malformed)).toThrow("invalid response");
  });
});
