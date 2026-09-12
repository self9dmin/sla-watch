const PROVIDER_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const PROVIDER_CATALOG = [
  { slug: "aws", name: "AWS", detail: "Amazon Web Services" },
  { slug: "azure", name: "Azure", detail: "Microsoft Azure" },
  { slug: "gcp", name: "GCP", detail: "Google Cloud" },
  { slug: "oci", name: "OCI", detail: "Oracle Cloud Infrastructure" },
  { slug: "openai", name: "OpenAI", detail: "AI platform and APIs" },
  { slug: "anthropic", name: "Anthropic", detail: "Claude platform and APIs" },
  { slug: "elevenlabs", name: "ElevenLabs", detail: "Voice AI platform and APIs" },
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

const PROVIDER_ALIASES: Readonly<Record<string, string>> = {
  amazon: "aws",
  amazon_web_services: "aws",
  microsoft: "azure",
  microsoft_azure: "azure",
  google: "gcp",
  google_cloud: "gcp",
  oracle: "oci",
  oracle_cloud: "oci",
};

export const canonicalProviderSlug = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const canonical = PROVIDER_ALIASES[normalized] ?? normalized;
  return PROVIDER_SLUG_PATTERN.test(canonical) ? canonical : null;
};

const providerOrder = new Map<string, number>(
  PROVIDER_CATALOG.map((provider, index) => [provider.slug, index]),
);

export const sortProviderSlugs = (values: string[]): string[] => Array.from(new Set(
  values.map(canonicalProviderSlug).filter((value): value is string => Boolean(value)),
)).sort((left, right) => {
  const leftOrder = providerOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = providerOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
  return leftOrder - rightOrder || left.localeCompare(right);
}).slice(0, 12);

export const resolveEnvironmentProviderSlugs = ({
  detected = [],
  tagged = [],
  assigned = [],
  connected = [],
  fallback,
}: {
  detected?: string[];
  tagged?: string[];
  assigned?: string[];
  connected?: string[];
  fallback?: string;
}): string[] => {
  const providers = sortProviderSlugs([
    ...detected,
    ...tagged,
    ...assigned,
    ...connected,
  ]);
  if (providers.length > 0) return providers;
  const fallbackProvider = canonicalProviderSlug(fallback);
  return fallbackProvider ? [fallbackProvider] : [];
};

export const providerDisplayName = (slug: string): string => (
  PROVIDER_CATALOG.find((provider) => provider.slug === slug)?.name
  ?? slug.replace(/(^|-)([a-z])/g, (_match, separator: string, letter: string) => `${separator}${letter.toUpperCase()}`)
);

export const providerDetail = (slug: string): string => (
  PROVIDER_CATALOG.find((provider) => provider.slug === slug)?.detail ?? "sla.directory provider"
);
