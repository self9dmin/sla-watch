import { buildEntityIdSelector, providerTagValue, providerTagValues, providerTagWriteIssue } from "../ui/app/data/providerTags";

describe("provider tag helpers", () => {
  it.each([
    ["provider:aws", "provider", "aws"],
    ["vendor=Azure", "provider", "azure"],
    ["[AWS]", "provider", "aws"],
    ["cloud.provider:gcp", "provider", "gcp"],
    ["AWS", "provider", "aws"],
    ["team:platform", "provider", null],
  ])("parses %s", (tag, key, expected) => {
    expect(providerTagValue(tag as string, key as string)).toBe(expected);
  });

  it("returns unique provider values", () => {
    expect(providerTagValues(["provider:aws", "vendor=AWS", "team:sre"], "provider")).toEqual(["aws"]);
  });

  it("does not treat an unrelated contextless tag as a provider conflict", () => {
    expect(providerTagValues(["[production]", "team:sre"], "provider", "aws")).toEqual([]);
    expect(providerTagValues(["[fastly]"], "provider", "fastly")).toEqual(["fastly"]);
  });

  it("builds a selector from exact entity IDs", () => {
    expect(buildEntityIdSelector(["SERVICE-1", "SERVICE-2", "SERVICE-1"]))
      .toBe('entityId("SERVICE-1","SERVICE-2")');
  });

  it("rejects an empty service selection", () => {
    expect(() => buildEntityIdSelector([])).toThrow("At least one service");
  });

  it("rejects non-service entity IDs", () => {
    expect(() => buildEntityIdSelector(["HOST-ABC123"])).toThrow("Only Dynatrace service entity IDs");
  });

  it("turns a denied tag write into actionable permission guidance", () => {
    expect(providerTagWriteIssue({
      response: { status: 403 },
      body: { error: { code: 403, message: "Forbidden" } },
    })).toEqual({
      title: "Tag change denied",
      detail: "Ask a tenant administrator to grant Manage monitoring settings access and confirm that SLA Watch is authorized to write entity tags.",
      code: 403,
    });
  });

  it("does not claim that an unknown failed write changed nothing", () => {
    const issue = providerTagWriteIssue(new Error("Network request failed"));
    expect(issue.title).toBe("Tag change could not be verified");
    expect(issue.detail).toContain("Refresh the service inventory before retrying");
  });

  it("recognizes an expired Dynatrace session", () => {
    expect(providerTagWriteIssue({ name: "401", message: "JWT expired" })).toMatchObject({
      title: "Dynatrace session expired",
      code: 401,
    });
  });
});
