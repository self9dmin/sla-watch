import { providerPresentation } from "../ui/app/data/providerPresentation";

describe("provider presentation", () => {
  it("uses bundled brand marks for the four supported hyperscalers", () => {
    expect(["aws", "azure", "gcp", "oci"].map((slug) => providerPresentation(slug).logo)).toEqual([
      "assets/provider-aws.svg",
      "assets/provider-azure.svg",
      "assets/provider-gcp.svg",
      "assets/provider-oci.svg",
    ]);
  });

  it("creates a stable monogram for dynamically detected providers", () => {
    expect(providerPresentation("openai")).toMatchObject({ label: "OpenAI", monogram: "OA", logo: undefined });
    expect(providerPresentation("cloudflare-enterprise")).toMatchObject({ label: "Cloudflare-Enterprise", monogram: "CE", logo: undefined });
  });
});
