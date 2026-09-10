import { parseDirectoryEnvelope } from "../api/slaDirectory.function";

const validEnvelope = {
  generated_at: "2026-09-10T00:00:00.000Z",
  result: {
    slug: "aws",
    name: "Amazon Web Services",
    category_name: "Cloud",
    uptime: 99.99,
    sla_status_label: "verified",
    last_verified: "2026-09-09",
    services: [
      {
        id: "aws-s3",
        name: "Amazon S3",
        category: "Storage",
        uptime: 99.99,
        sla_eligible: true,
        sla_url: "https://sla.directory/vendors/aws/services/aws-s3",
      },
    ],
  },
};

describe("parseDirectoryEnvelope", () => {
  it("accepts the documented directory shape", () => {
    expect(parseDirectoryEnvelope(validEnvelope)).toEqual(validEnvelope);
  });

  it("rejects malformed provider data before it reaches the UI", () => {
    expect(() => parseDirectoryEnvelope({ ...validEnvelope, result: { ...validEnvelope.result, services: "not-an-array" } })).toThrow("invalid response");
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
});
