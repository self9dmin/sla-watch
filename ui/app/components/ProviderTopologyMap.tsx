import React, { useEffect, useMemo, useState } from "react";
import { providerInventoryNodeTypeLabel } from "../data/providerInventory";
import {
  buildProviderTopologyFamilies,
  type ProviderTopologyFamily,
  type ProviderTopologyFamilyId,
  type ProviderTopologyNodeTypeCount,
} from "../data/providerTopologyMap";
import { providerPresentation } from "../data/providerPresentation";

type ProviderTopologyMapProps = {
  providerSlug: string;
  providerName: string;
  nodeTypeCounts: readonly ProviderTopologyNodeTypeCount[];
  searchText: string;
  onSearchTextChange: (value: string) => void;
};

type MapPosition = { x: number; y: number };

const INSPECTOR_ITEM_LIMIT = 2;

const countLabel = (count: number, noun: string): string =>
  `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;

const familyPosition = (index: number, total: number): MapPosition => {
  const angle = -Math.PI / 2 + (index / Math.max(total, 1)) * Math.PI * 2;
  return {
    x: 50 + Math.cos(angle) * 35,
    y: 50 + Math.sin(angle) * 30,
  };
};

const satellitePosition = (
  family: MapPosition,
  index: number,
  total: number,
): MapPosition => {
  const ringIndex = Math.floor(index / 12);
  const ringStart = ringIndex * 12;
  const ringTotal = Math.min(12, total - ringStart);
  const angle = -Math.PI / 2 + ((index - ringStart) / Math.max(ringTotal, 1)) * Math.PI * 2;
  const radius = 6.6 + ringIndex * 2.7;
  return {
    x: family.x + Math.cos(angle) * radius,
    y: family.y + Math.sin(angle) * radius,
  };
};

const familyMatchesSearch = (
  family: ProviderTopologyFamily,
  query: string,
): boolean => family.nodeTypes.some(({ nodeType, nodeCount }) =>
  `${providerInventoryNodeTypeLabel(nodeType, nodeCount)} ${nodeType}`
    .toLowerCase()
    .includes(query),
);

const matchingNodes = (
  family: ProviderTopologyFamily,
  query: string,
): ProviderTopologyNodeTypeCount[] => query
  ? family.nodeTypes.filter(({ nodeType, nodeCount }) =>
      `${providerInventoryNodeTypeLabel(nodeType, nodeCount)} ${nodeType}`
        .toLowerCase()
        .includes(query),
    )
  : family.nodeTypes;

const familyStyle = (family: ProviderTopologyFamily): React.CSSProperties => ({
  "--topology-family": family.color,
} as React.CSSProperties);

export const ProviderTopologyMap = ({
  providerSlug,
  providerName,
  nodeTypeCounts,
  searchText,
  onSearchTextChange,
}: ProviderTopologyMapProps) => {
  const families = useMemo(
    () => buildProviderTopologyFamilies(nodeTypeCounts),
    [nodeTypeCounts],
  );
  const largestFamily = useMemo(
    () => [...families].sort((left, right) =>
      right.nodeTypes.length - left.nodeTypes.length || right.nodeCount - left.nodeCount)[0],
    [families],
  );
  const [selectedFamilyId, setSelectedFamilyId] = useState<ProviderTopologyFamilyId | undefined>(
    largestFamily?.id,
  );
  const normalizedSearch = searchText.trim().toLowerCase();
  const selectedFamily = families.find((family) => family.id === selectedFamilyId) ?? largestFamily;
  const firstMatchingFamily = normalizedSearch
    ? families.find((family) => familyMatchesSearch(family, normalizedSearch))
    : undefined;
  const effectiveFamily = selectedFamily
    && (!normalizedSearch || familyMatchesSearch(selectedFamily, normalizedSearch))
    ? selectedFamily
    : firstMatchingFamily ?? selectedFamily;
  const selectedNodes = effectiveFamily
    ? matchingNodes(effectiveFamily, normalizedSearch)
    : [];
  const visibleSelectedNodes = selectedNodes.slice(0, INSPECTOR_ITEM_LIMIT);
  const totalMatches = normalizedSearch
    ? families.reduce((total, family) => total + matchingNodes(family, normalizedSearch).length, 0)
    : undefined;
  const presentation = providerPresentation(providerSlug);

  useEffect(() => {
    setSelectedFamilyId(largestFamily?.id);
  }, [largestFamily?.id, providerSlug]);

  return (
    <div className="coverage-topology-explorer">
      <aside className="coverage-topology-inspector" aria-label="Explore detected Smartscape types">
        <label className="coverage-topology-search">
          <span className="visually-hidden">Find Smartscape node types</span>
          <input
            type="search"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="Find a resource or Smartscape type"
            aria-label="Find Smartscape node types"
          />
        </label>
        <div className="coverage-topology-inspector-heading">
          <span
            className="coverage-topology-family-swatch"
            style={effectiveFamily ? familyStyle(effectiveFamily) : undefined}
            aria-hidden="true"
          />
          <div>
            <strong>{effectiveFamily?.label ?? "Detected resources"}</strong>
            <span aria-live="polite">
              {normalizedSearch
                ? `${totalMatches?.toLocaleString() ?? "0"} matching type${totalMatches === 1 ? "" : "s"}`
                : effectiveFamily
                  ? `${countLabel(effectiveFamily.nodeTypes.length, "type")} · ${countLabel(effectiveFamily.nodeCount, "record")}`
                  : "No resource types returned"}
            </span>
          </div>
        </div>
        {visibleSelectedNodes.length > 0 ? (
          <div
            className="coverage-topology-type-list"
            role="list"
            aria-label={`${providerName} Smartscape node types`}
          >
            {visibleSelectedNodes.map(({ nodeType, nodeCount }) => (
              <div key={nodeType} role="listitem" className="coverage-topology-type">
                <span>
                  <strong>{providerInventoryNodeTypeLabel(nodeType, nodeCount)}</strong>
                  <small>{nodeType}</small>
                </span>
                <strong>{nodeCount.toLocaleString()}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="coverage-topology-empty" role="status">
            <span>No Smartscape node types match “{searchText.trim()}”.</span>
          </div>
        )}
        {selectedNodes.length > INSPECTOR_ITEM_LIMIT ? (
          <p className="coverage-topology-inspector-note">
            {selectedNodes.length - INSPECTOR_ITEM_LIMIT} more in this family. Search for an exact type or open Smartscape.
          </p>
        ) : null}
      </aside>

      <div
        className="coverage-topology-canvas"
        aria-label={`${providerName} topology inventory map. Resource families visually group returned Smartscape types; lines do not represent runtime relationships.`}
      >
        <svg className="coverage-topology-spokes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {families.map((family, index) => {
            const position = familyPosition(index, families.length);
            const searched = !normalizedSearch || familyMatchesSearch(family, normalizedSearch);
            return (
              <line
                key={family.id}
                x1="50"
                y1="50"
                x2={position.x}
                y2={position.y}
                className={searched ? "matched" : "muted"}
              />
            );
          })}
        </svg>

        <div className="coverage-topology-provider-node" aria-hidden="true">
          <span className={`provider-mark provider-mark-${presentation.slug}${presentation.logo ? "" : " provider-mark-monogram"}`}>
            {presentation.logo
              ? <img src={presentation.logo} alt="" />
              : <span>{presentation.monogram}</span>}
          </span>
          <strong>{providerName}</strong>
        </div>

        {families.flatMap((family, familyIndex) => {
          const position = familyPosition(familyIndex, families.length);
          return family.nodeTypes.map(({ nodeType, nodeCount }, nodeIndex) => {
            const satellite = satellitePosition(position, nodeIndex, family.nodeTypes.length);
            const label = providerInventoryNodeTypeLabel(nodeType, nodeCount);
            const matches = !normalizedSearch
              || `${label} ${nodeType}`.toLowerCase().includes(normalizedSearch);
            const size = Math.min(10, 5 + Math.log10(nodeCount + 1) * 1.8);
            return (
              <span
                key={`${family.id}:${nodeType}`}
                className={`coverage-topology-satellite${matches ? " matched" : " muted"}`}
                style={{
                  ...familyStyle(family),
                  left: `${satellite.x}%`,
                  top: `${satellite.y}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                }}
                title={`${label}: ${nodeCount.toLocaleString()} topology record${nodeCount === 1 ? "" : "s"}`}
                aria-hidden="true"
              />
            );
          });
        })}

        {families.map((family, index) => {
          const position = familyPosition(index, families.length);
          const active = effectiveFamily?.id === family.id;
          const matches = !normalizedSearch || familyMatchesSearch(family, normalizedSearch);
          return (
            <button
              type="button"
              key={family.id}
              className={`coverage-topology-family${active ? " active" : ""}${matches ? " matched" : " muted"}`}
              style={{
                ...familyStyle(family),
                left: `${position.x}%`,
                top: `${position.y}%`,
              }}
              aria-pressed={active}
              aria-label={`${family.label}, ${countLabel(family.nodeTypes.length, "Smartscape type")}, ${countLabel(family.nodeCount, "topology record")}`}
              onClick={() => setSelectedFamilyId(family.id)}
            >
              <span aria-hidden="true" />
              <strong>{family.label}</strong>
              <small>{countLabel(family.nodeTypes.length, "type")}</small>
            </button>
          );
        })}

        <div className="coverage-topology-canvas-note">
          One dot per returned type. Visual grouping only, not a dependency graph.
        </div>
      </div>
    </div>
  );
};
