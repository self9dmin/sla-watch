import { normalizeProviderSlug, normalizeProviderSlugs, providerDisplayName } from "../ui/app/data/providers";

describe("provider configuration", () => {
  it("normalizes and deduplicates monitored providers", () => {
    expect(normalizeProviderSlugs(["AWS", "gcp", "aws", "bad slug"])).toEqual(["aws", "gcp"]);
  });

  it("rejects invalid provider slugs", () => {
    expect(normalizeProviderSlug("gcp")).toBe("gcp");
    expect(normalizeProviderSlug("gcp cloud")).toBeNull();
  });

  it("uses catalog display names and readable custom names", () => {
    expect(providerDisplayName("aws")).toBe("AWS");
    expect(providerDisplayName("cloudflare-enterprise")).toBe("Cloudflare-Enterprise");
  });
});
