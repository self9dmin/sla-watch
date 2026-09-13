import React from "react";
import { providerInventoryDetail, type ProviderInventorySummary } from "../data/providerInventory";
import { providerPresentation } from "../data/providerPresentation";

type ProviderSwitcherProps = {
  activeProviderSlug: string;
  providerSlugs: readonly string[];
  inventory?: readonly ProviderInventorySummary[];
  onSelect: (providerSlug: string) => void;
};

export const ProviderSwitcher = ({
  activeProviderSlug,
  providerSlugs,
  inventory = [],
  onSelect,
}: ProviderSwitcherProps) => {
  const providers = providerSlugs.map(providerPresentation);
  const inventoryByProvider = new Map(inventory.map((summary) => [summary.providerSlug, summary]));
  if (providers.length === 0) return null;

  return (
    <div className="provider-switcher" data-tour="provider-switcher">
      <div className="provider-switcher-list" role="group" aria-label="Provider views">
        {providers.map((provider) => {
          const active = activeProviderSlug === provider.slug;
          const state = active ? "selected provider" : "available provider";
          const inventorySummary = inventoryByProvider.get(provider.slug);
          const inventoryContext = inventorySummary
            ? `. Smartscape detected ${providerInventoryDetail(inventorySummary)}`
            : "";

          return (
            <span
              className="provider-switcher-item"
              key={provider.slug}
              title={`${provider.label}: ${state}${inventoryContext}`}
            >
              <button
                type="button"
                className={`provider-choice${active ? " active" : ""}`}
                aria-label={`${provider.label}, ${state}${inventoryContext}`}
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
