import {
  createCoverageReviewPath,
  createEvidenceReviewPath,
  safeWorkspaceReturnPath,
} from "../ui/app/data/reviewRoutes";

describe("review routes", () => {
  it("preserves provider, Problem, service, and return context", () => {
    const evidencePath = createEvidenceReviewPath({
      providerSlug: "AWS",
      problemId: "P-260934",
    });
    const coveragePath = createCoverageReviewPath({
      providerSlug: "AWS",
      problemId: "P-260934",
      serviceId: "SERVICE-1",
      providerServiceId: "ec2",
      returnTo: evidencePath,
    });

    expect(evidencePath).toBe("/evidence?provider=aws&problem=P-260934");
    expect(coveragePath).toBe(
      "/?provider=aws&problem=P-260934&service=SERVICE-1&providerService=ec2&return=%2Fevidence%3Fprovider%3Daws%26problem%3DP-260934",
    );
  });

  it("accepts only local return paths", () => {
    expect(safeWorkspaceReturnPath("/evidence?problem=P-1")).toBe("/evidence?problem=P-1");
    expect(safeWorkspaceReturnPath("//example.test/escape")).toBe("/evidence");
    expect(safeWorkspaceReturnPath("https://example.test/escape")).toBe("/evidence");
    expect(safeWorkspaceReturnPath(null, "/evidence")).toBe("/evidence");
  });

  it("preserves a grouped review case without breaking the Problem fallback", () => {
    expect(createEvidenceReviewPath({
      providerSlug: "AWS",
      problemId: "P-1",
      caseId: "case:ec2:p-1",
    })).toBe("/evidence?provider=aws&problem=P-1&case=case%3Aec2%3Ap-1");
  });
});
