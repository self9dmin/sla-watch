import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { BUNDLED_PROVIDER_LOGO_SLUGS } from "../ui/app/data/providerLogoSlugs";
import { providerPresentation } from "../ui/app/data/providerPresentation";

describe("provider presentation", () => {
  it("uses locally bundled directory marks for detected providers", () => {
    expect(["aws", "azure", "gcp", "oci"].map((slug) => providerPresentation(slug).logo)).toEqual([
      "assets/providers/aws.svg",
      "assets/providers/azure.svg",
      "assets/providers/gcp.svg",
      "assets/providers/oci.svg",
    ]);
    expect(providerPresentation("anthropic").logo).toBe("assets/providers/anthropic.svg");
    expect(providerPresentation("openai").logo).toBe("assets/providers/openai.svg");
  });

  it("creates a stable monogram when a detected provider has no bundled mark", () => {
    expect(providerPresentation("cloudflare-enterprise")).toMatchObject({ label: "Cloudflare-Enterprise", monogram: "CE", logo: undefined });
  });

  it("keeps the generated manifest and checked-in SVG pack complete and safe", () => {
    const logoDirectory = path.resolve(__dirname, "../ui/assets/providers");
    const logoSlugs = readdirSync(logoDirectory)
      .filter((file) => file.endsWith(".svg"))
      .map((file) => file.slice(0, -4))
      .sort();
    expect(logoSlugs).toEqual([...BUNDLED_PROVIDER_LOGO_SLUGS]);

    for (const logoSlug of logoSlugs) {
      const svg = readFileSync(path.join(logoDirectory, `${logoSlug}.svg`), "utf8");
      expect(svg).toMatch(/<svg(?:\s|>)/i);
      expect(svg).not.toMatch(/<\s*(?:script|foreignObject|iframe|object|embed)\b/i);
      expect(svg).not.toMatch(/\son[a-z]+\s*=|javascript\s*:|<!DOCTYPE\b|<!ENTITY\b|@import\b/i);
    }
  });
});
