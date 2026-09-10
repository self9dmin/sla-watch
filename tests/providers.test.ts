import { normalizeProviderSlug, normalizeProviderSlugs, PROVIDER_CATALOG, providerDisplayName } from "../ui/app/data/providers";

describe("provider configuration", () => {
  it("normalizes and deduplicates monitored providers", () => {
    expect(normalizeProviderSlugs(["AWS", "gcp", "aws", "bad slug"])).toEqual(["aws", "gcp"]);
  });

  it("rejects invalid provider slugs", () => {
    expect(normalizeProviderSlug("gcp")).toBe("gcp");
    expect(normalizeProviderSlug("gcp cloud")).toBeNull();
  });

  it("starts a new workspace with four peer core cloud providers", () => {
    expect(normalizeProviderSlugs(undefined)).toEqual(["aws", "azure", "gcp", "oci"]);
    expect(PROVIDER_CATALOG.slice(0, 4).map(({ slug }) => slug)).toEqual(["aws", "azure", "gcp", "oci"]);
  });

  it("uses catalog display names and readable custom names", () => {
    expect(providerDisplayName("aws")).toBe("AWS");
    expect(providerDisplayName("cloudflare-enterprise")).toBe("Cloudflare-Enterprise");
  });
});
