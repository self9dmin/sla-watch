import {
  buildSmartscapeOverviewHref,
  smartscapeViewForProvider,
} from "../ui/app/data/smartscapeNavigation";

describe("Smartscape provider navigation", () => {
  it.each([
    ["aws", "dynatrace.smartscape.aws-overview"],
    ["azure", "dynatrace.smartscape.azure-overview"],
    ["gcp", "dynatrace.smartscape.gcp-overview"],
  ])("selects the %s provider overview", (providerSlug, expectedView) => {
    expect(smartscapeViewForProvider(providerSlug)).toBe(expectedView);
  });

  it("falls back to Smartscape on Grail when no provider overview exists", () => {
    expect(smartscapeViewForProvider("oci")).toBe("dynatrace.smartscape.smartscape-on-grail");
  });

  it("turns an AppEngine app link into the supported Smartscape route", () => {
    expect(buildSmartscapeOverviewHref(
      "https://example.apps.dynatrace.com/ui/openApp/dynatrace.smartscape/?unused=true#state",
      "azure",
    )).toBe(
      "https://example.apps.dynatrace.com/ui/apps/dynatrace.smartscape/view/dynatrace.smartscape.azure-overview",
    );
  });

  it("preserves a relative AppShell link", () => {
    expect(buildSmartscapeOverviewHref(
      "/ui/apps/dynatrace.smartscape/",
      "aws",
    )).toBe(
      "/ui/apps/dynatrace.smartscape/view/dynatrace.smartscape.aws-overview",
    );
  });
});
