import {
  canonicalProviderSlug,
  normalizeProviderSlug,
  normalizeProviderSlugs,
  PROVIDER_CATALOG,
  providerDisplayName,
  resolveEnvironmentProviderSlugs,
} from "../ui/app/data/providers";

describe("provider configuration", () => {
  it("normalizes and deduplicates monitored providers", () => {
    expect(normalizeProviderSlugs(["AWS", "gcp", "aws", "bad slug"])).toEqual(["aws", "gcp"]);
  });

  it("rejects invalid provider slugs", () => {
    expect(normalizeProviderSlug("gcp")).toBe("gcp");
    expect(normalizeProviderSlug("gcp cloud")).toBeNull();
  });

  it("keeps one focused fallback while retaining four peer core cloud providers", () => {
    expect(normalizeProviderSlugs(undefined)).toEqual(["aws"]);
    expect(PROVIDER_CATALOG.slice(0, 4).map(({ slug }) => slug)).toEqual(["aws", "azure", "gcp", "oci"]);
  });

  it("uses catalog display names and readable custom names", () => {
    expect(providerDisplayName("aws")).toBe("AWS");
    expect(providerDisplayName("cloudflare-enterprise")).toBe("Cloudflare-Enterprise");
  });

  it("normalizes common provider aliases used by telemetry", () => {
    expect(canonicalProviderSlug("amazon")).toBe("aws");
    expect(canonicalProviderSlug("microsoft_azure")).toBe("azure");
    expect(canonicalProviderSlug("google")).toBe("gcp");
    expect(canonicalProviderSlug("oracle_cloud")).toBe("oci");
  });

  it("enables only providers supported by environment evidence or a connection", () => {
    expect(resolveEnvironmentProviderSlugs({
      detected: ["aws"],
      tagged: ["google"],
      assigned: ["oci"],
      connected: ["azure"],
      fallback: "anthropic",
    })).toEqual(["aws", "azure", "gcp", "oci"]);
  });

  it("keeps one usable fallback when detection returns no provider", () => {
    expect(resolveEnvironmentProviderSlugs({ fallback: "anthropic" })).toEqual(["anthropic"]);
  });
});
