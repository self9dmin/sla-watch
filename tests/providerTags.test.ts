import { detectedProviderTagSlugs, providerTagValue, providerTagValues } from "../ui/app/data/providerTags";

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

  it("finds canonical environment providers across service tag groups", () => {
    expect(detectedProviderTagSlugs([
      ["provider:amazon", "team:checkout"],
      ["cloud.provider:google", "provider:openai"],
    ], "provider")).toEqual(["aws", "gcp", "openai"]);
  });

});
