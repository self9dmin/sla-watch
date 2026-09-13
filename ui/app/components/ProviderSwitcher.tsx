import React from "react";
import { providerPresentation } from "../data/providerPresentation";

type ProviderSwitcherProps = {
  activeProviderSlug: string;
  providerSlugs: readonly string[];
  onSelect: (providerSlug: string) => void;
};

export const ProviderSwitcher = ({
  activeProviderSlug,
  providerSlugs,
  onSelect,
}: ProviderSwitcherProps) => {
  const providers = providerSlugs.map(providerPresentation);
  if (providers.length === 0) return null;

  return (
    <div className="provider-switcher" data-tour="provider-switcher">
      <div className="provider-switcher-list" role="group" aria-label="Provider views">
        {providers.map((provider) => {
          const active = activeProviderSlug === provider.slug;
          const state = active ? "selected provider" : "available provider";

          return (
            <span
              className="provider-switcher-item"
              key={provider.slug}
              title={`${provider.label}: ${state}`}
            >
              <button
                type="button"
                className={`provider-choice${active ? " active" : ""}`}
                aria-label={`${provider.label}, ${state}`}
                aria-pressed={active}
                onClick={() => onSelect(provider.slug)}
                data-provider-slug={provider.slug}
              >
                <span className={`provider-mark provider-mark-${provider.slug}${provider.logo ? "" : " provider-mark-monogram"}`} aria-hidden="true">
                  {provider.logo
                    ? <img src={provider.logo} alt="" />
                    : <span>{provider.monogram}</span>}
                </span>
                <span className="provider-choice-label">{provider.label}</span>
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
};
