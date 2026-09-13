const SMARTSCAPE_VIEW_BY_PROVIDER: Readonly<Record<string, string>> = {
  aws: "dynatrace.smartscape.aws-overview",
  azure: "dynatrace.smartscape.azure-overview",
  gcp: "dynatrace.smartscape.gcp-overview",
};

const SMARTSCAPE_FALLBACK_VIEW = "dynatrace.smartscape.smartscape-on-grail";

export const smartscapeViewForProvider = (providerSlug: string): string => (
  SMARTSCAPE_VIEW_BY_PROVIDER[providerSlug.toLowerCase()] ?? SMARTSCAPE_FALLBACK_VIEW
);

export const buildSmartscapeOverviewHref = (appLink: string, providerSlug: string): string => {
  const appRoot = appLink
    .split(/[?#]/, 1)[0]
    .replace(/\/+$/, "")
    .replace(
      /\/ui\/(?:openApp|apps)\/dynatrace\.smartscape$/,
      "/ui/apps/dynatrace.smartscape",
    );

  return `${appRoot}/view/${smartscapeViewForProvider(providerSlug)}`;
};
