const PROVIDER_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const PROVIDER_CATALOG = [
  { slug: "aws", name: "AWS", detail: "Amazon Web Services" },
  { slug: "azure", name: "Azure", detail: "Microsoft Azure" },
  { slug: "gcp", name: "GCP", detail: "Google Cloud" },
] as const;

export const normalizeProviderSlug = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return PROVIDER_SLUG_PATTERN.test(normalized) ? normalized : null;
};

export const normalizeProviderSlugs = (value: unknown, fallback: string[] = ["aws"]): string[] => {
  const values = Array.isArray(value) ? value : [];
  const normalized = Array.from(new Set(values.map(normalizeProviderSlug).filter((item): item is string => Boolean(item))));
  return normalized.length > 0 ? normalized.slice(0, 12) : fallback;
};

export const providerDisplayName = (slug: string): string => (
  PROVIDER_CATALOG.find((provider) => provider.slug === slug)?.name
  ?? slug.replace(/(^|-)([a-z])/g, (_match, separator: string, letter: string) => `${separator}${letter.toUpperCase()}`)
);

export const providerDetail = (slug: string): string => (
  PROVIDER_CATALOG.find((provider) => provider.slug === slug)?.detail ?? "sla.directory provider"
);
