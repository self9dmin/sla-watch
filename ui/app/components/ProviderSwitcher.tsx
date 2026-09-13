import React from "react";
import { providerDisplayName } from "../data/providers";

type ProviderSwitcherProps = {
  activeProviderSlug: string;
  enabledProviderSlugs: readonly string[];
  onSelect: (providerSlug: string) => void;
};

const HYPERSCALERS = [
  { slug: "aws", label: "AWS", logo: "assets/provider-aws.svg" },
  { slug: "azure", label: "Azure", logo: "assets/provider-azure.svg" },
  { slug: "gcp", label: "GCP", logo: "assets/provider-gcp.svg" },
  { slug: "oci", label: "OCI", logo: "assets/provider-oci.svg" },
] as const;

export const ProviderSwitcher = ({
  activeProviderSlug,
  enabledProviderSlugs,
  onSelect,
}: ProviderSwitcherProps) => {
  const enabledProviders = new Set(enabledProviderSlugs);

  return (
    <div className="provider-switcher" data-tour="provider-switcher">
      <div className="provider-switcher-list" role="group" aria-label="Provider views">
        {HYPERSCALERS.map((provider) => {
          const active = activeProviderSlug === provider.slug;
          const enabled = enabledProviders.has(provider.slug);
          const state = active
            ? "selected, detected in this environment"
            : enabled
              ? "detected in this environment"
              : "not detected in this environment";

          return (
            <span
              className="provider-switcher-item"
              key={provider.slug}
              title={`${providerDisplayName(provider.slug)}: ${state}`}
            >
              <button
                type="button"
                className={`provider-choice${active ? " active" : ""}`}
                disabled={!enabled}
                aria-label={`${provider.label}, ${state}`}
                aria-pressed={active}
                onClick={() => onSelect(provider.slug)}
              >
                <span className={`provider-mark provider-mark-${provider.slug}`} aria-hidden="true">
                  <img src={provider.logo} alt="" />
                </span>
                <span className="provider-choice-label">{provider.label}</span>
                {enabled ? <span className="provider-evidence-dot" aria-hidden="true" /> : null}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
};
