import { canonicalProviderSlug, providerDisplayName } from "./providers";

export type ProviderPresentation = {
  slug: string;
  label: string;
  logo?: string;
  monogram: string;
};

const PROVIDER_LOGOS: Readonly<Record<string, string>> = {
  aws: "assets/provider-aws.svg",
  azure: "assets/provider-azure.svg",
  gcp: "assets/provider-gcp.svg",
  oci: "assets/provider-oci.svg",
};

const providerMonogram = (label: string): string => {
  const words = label
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);

  if (words.length > 1) {
    return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  }

  return (words[0] ?? "P").slice(0, 2).toUpperCase();
};

export const providerPresentation = (value: string): ProviderPresentation => {
  const slug = canonicalProviderSlug(value) ?? "provider";
  const label = providerDisplayName(slug);

  return {
    slug,
    label,
    logo: PROVIDER_LOGOS[slug],
    monogram: providerMonogram(label),
  };
};
