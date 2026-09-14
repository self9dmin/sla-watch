import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAppLink } from "@dynatrace-sdk/navigation";
import { Button } from "@dynatrace/strato-components/buttons";
import { HostsIcon, ServicesIcon, SmartscapeIcon } from "@dynatrace/strato-icons";
import type {
  CoverageInventoryStatus,
  ProviderScopeAssignmentRecord,
  ProviderScopeAssignmentValue,
  ServiceRecord,
  SetupRecommendation,
  SlaProviderResponse,
} from "../types";
import { resolveEffectiveContractTerms } from "../data/contractOverrides";
import {
  rowIsCovered,
  rowNeedsReview,
  rowSearchValue,
  rowServiceId,
  rowServiceName,
  type CoverageFilter,
  type CoverageRow,
  type ProviderCoverageModel,
} from "../data/providerCoverage";
import type { ProviderInfrastructureCandidate } from "../data/providerInfrastructure";
import type { ProviderInventorySummary } from "../data/providerInventory";
import {
  createProviderScopeAssignmentKey,
  createServiceScopeAssignment,
  isServiceScopeAssignment,
  runtimeEntityIdForEdge,
  serviceEntityIdForEdge,
} from "../data/providerScopeAssignments";
import { safeWorkspaceReturnPath } from "../data/reviewRoutes";
import { buildSmartscapeOverviewHref } from "../data/smartscapeNavigation";
import { providerDisplayName } from "../data/providers";
import type { ProviderHostContextSummary } from "../data/topology";
import { formatSmartscapeRelationship } from "../data/topology";
import type { ProviderScopeAssignmentsState } from "../hooks/useProviderScopeAssignments";
import { useContractOverrides } from "../hooks/useContractOverrides";
import { SetupAdvisor } from "./SetupAdvisor";
import { ServiceObjectivePreview } from "./ServiceObjectivePreview";
import { ProviderTopologyMap } from "./ProviderTopologyMap";

type Tone = "neutral" | "warning" | "positive";
type CoverageEvidenceView = "topology" | "services";

type CoverageWorkspaceProps = {
  provider?: SlaProviderResponse;
  services: ServiceRecord[];
  providerTagKey: string;
  coverageModel: ProviderCoverageModel;
  loading: boolean;
  error?: Error;
  scopeSettings: ProviderScopeAssignmentsState;
  recommendations: SetupRecommendation[];
  recommendationsLoading: boolean;
  limitedContext: boolean;
  inventory: CoverageInventoryStatus;
  infrastructureCandidate?: ProviderInfrastructureCandidate;
  providerInventory?: ProviderInventorySummary;
  providerHostContext?: ProviderHostContextSummary;
};

const StatusPill = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => (
  <span className={`status-pill status-pill-${tone}`}>{children}</span>
);

const COVERAGE_PAGE_SIZE = 50;

export const CoverageWorkspace = ({
  provider,
  services,
  providerTagKey,
  coverageModel,
  loading,
  error,
  scopeSettings,
  recommendations,
  recommendationsLoading,
  limitedContext,
  inventory,
  infrastructureCandidate,
  providerInventory,
  providerHostContext,
}: CoverageWorkspaceProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [selectedProviderServiceId, setSelectedProviderServiceId] = useState("");
  const [feedback, setFeedback] = useState<{ tone: Tone; message: string }>();
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all");
  const [evidenceView, setEvidenceView] = useState<CoverageEvidenceView>("topology");
  const [searchText, setSearchText] = useState("");
  const [topologySearchText, setTopologySearchText] = useState("");
  const [page, setPage] = useState(0);
  const lastFocusedService = useRef<string | null>(null);
  const contractSettings = useContractOverrides();
  const providerSlug = provider?.provider.slug ?? infrastructureCandidate?.providerSlug ?? "";
  const providerName = provider?.provider.name ?? providerDisplayName(providerSlug);
  const routeParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const focusedServiceId = routeParams.get("service");
  const focusedProviderServiceId = routeParams.get("providerService");
  const focusedProblemId = routeParams.get("problem");
  const returnPath = safeWorkspaceReturnPath(
    routeParams.get("return"),
    focusedProblemId ? `/incidents?provider=${encodeURIComponent(providerSlug)}&problem=${encodeURIComponent(focusedProblemId)}` : "/incidents",
  );
  const assignmentDisplayName = (assignment: ProviderScopeAssignmentRecord): string =>
    assignment.providerServiceId === "*" ? `${providerName} (provider-wide)` : assignment.providerServiceName;
  const coverageRows = coverageModel.rows;
  const reviewRows = coverageModel.reviewRows;
  const coveredRows = coverageModel.coveredRows;
  const hasProviderTopology = Boolean(
    infrastructureCandidate || providerInventory || providerHostContext,
  );
  useEffect(() => {
    setEvidenceView(focusedServiceId ? "services" : "topology");
  }, [focusedServiceId, providerSlug]);

  useEffect(() => {
    setTopologySearchText("");
  }, [providerSlug]);

  const filteredRows = useMemo(() => {
    const rows = coverageFilter === "review"
      ? reviewRows
      : coverageFilter === "covered"
        ? coveredRows
        : coverageRows;
    const query = searchText.trim().toLowerCase();
    return query ? rows.filter((row) => rowSearchValue(row).includes(query)) : rows;
  }, [coverageFilter, coverageRows, coveredRows, reviewRows, searchText]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / COVERAGE_PAGE_SIZE));
  const visibleRows = filteredRows.slice(
    page * COVERAGE_PAGE_SIZE,
    (page + 1) * COVERAGE_PAGE_SIZE,
  );
  const visibleReviewRows = visibleRows.filter(rowNeedsReview);
  const visibleCoveredRows = visibleRows.filter(rowIsCovered);
  const visibleUnscopedRows = visibleRows.filter(
    (row) => !rowIsCovered(row) && !rowNeedsReview(row),
  );
  const visibleStart = filteredRows.length === 0 ? 0 : page * COVERAGE_PAGE_SIZE + 1;
  const visibleEnd = Math.min((page + 1) * COVERAGE_PAGE_SIZE, filteredRows.length);

  useEffect(() => {
    setPage(0);
  }, [coverageFilter, providerSlug, searchText]);

  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);

  useEffect(() => {
    if (!focusedServiceId || loading || scopeSettings.loading) return;
    const focusKey = `${providerSlug}:${focusedServiceId}`;
    if (lastFocusedService.current === focusKey) return;
    const targetIndex = coverageRows.findIndex(
      (row) => rowServiceId(row) === focusedServiceId,
    );
    if (targetIndex < 0) return;
    lastFocusedService.current = focusKey;
    setCoverageFilter("all");
    setSearchText("");
    setPage(Math.floor(targetIndex / COVERAGE_PAGE_SIZE));
    setSelectedRowKey(coverageRows[targetIndex].key);
  }, [coverageRows, focusedServiceId, loading, providerSlug, scopeSettings.loading]);

  useEffect(() => {
    if (!provider || loading || scopeSettings.loading) return;
    if (!visibleRows.some((row) => row.key === selectedRowKey)) {
      setSelectedRowKey(visibleRows[0]?.key ?? null);
    }
  }, [loading, provider, scopeSettings.loading, selectedRowKey, visibleRows]);

  const selectedRow = coverageRows.find((row) => row.key === selectedRowKey);
  const selectedAssignment = selectedRow?.assignment;
  const selectedCandidate = selectedRow?.kind === "scope" ? selectedRow.candidate : null;
  const selectedObserved = selectedRow?.kind === "scope" ? selectedRow.observed : false;
  const selectedAmbiguous = selectedRow?.kind === "scope" ? selectedRow.ambiguous : false;
  const selectedSourceTag = selectedRow?.sourceTag ?? false;
  const selectedConflict = selectedRow?.kind === "service" ? selectedRow.conflicting : false;

  useEffect(() => {
    if (!selectedRow) {
      setSelectedProviderServiceId("");
    } else if (selectedRow.kind === "scope") {
      setSelectedProviderServiceId(
        (focusedServiceId === rowServiceId(selectedRow) &&
          focusedProviderServiceId &&
          (focusedProviderServiceId === "*" ||
            provider?.services.some((service) => service.id === focusedProviderServiceId))
          ? focusedProviderServiceId
          : null) ??
        selectedRow.assignment?.providerServiceId ??
        (selectedRow.ambiguous ? "" : selectedRow.candidate?.providerServiceId) ??
        (selectedRow.sourceTag ? "*" : ""),
      );
    } else {
      setSelectedProviderServiceId(
        selectedRow.assignment?.providerServiceId ??
        (selectedRow.sourceTag ? "*" : ""),
      );
    }
    setFeedback(undefined);
  }, [focusedProviderServiceId, focusedServiceId, provider, selectedRow]);

  const selectedProviderService = useMemo(() => selectedProviderServiceId === "*"
    ? { id: "*", name: providerName || "Provider" }
    : provider?.services.find((service) => service.id === selectedProviderServiceId),
  [provider, providerName, selectedProviderServiceId]);
  const selectionMatchesCandidate = Boolean(
    selectedCandidate && selectedProviderService?.id === selectedCandidate.providerServiceId,
  );
  const selectionUsesObservedMatch = selectedObserved && selectionMatchesCandidate && !selectedAssignment;
  const selectedCovered = Boolean(selectedRow && rowIsCovered(selectedRow));
  const selectedServiceClassicId = selectedRow?.kind === "scope"
    ? selectedRow.edge.serviceClassicId ?? serviceEntityIdForEdge(selectedRow.edge)
    : selectedRow?.service.id ?? null;
  const selectedServiceName = selectedRow ? rowServiceName(selectedRow) : "";
  const selectedTerms = useMemo(() => {
    if (!provider || !selectedRow || !selectedProviderService || !selectedCovered) return null;
    return resolveEffectiveContractTerms(provider, contractSettings.overrides, {
      providerSlug,
      providerServiceId: selectedProviderService.id,
      serviceId: selectedServiceClassicId ?? undefined,
    });
  }, [contractSettings.overrides, provider, providerSlug, selectedCovered, selectedProviderService, selectedRow, selectedServiceClassicId]);

  const assignmentValue = (): ProviderScopeAssignmentValue | null => {
    if (!selectedRow || !selectedProviderService || selectedConflict) return null;
    if (selectedRow.kind === "service" || (selectedAssignment && isServiceScopeAssignment(selectedAssignment))) {
      const service = selectedRow.kind === "service"
        ? selectedRow.service
        : { id: serviceEntityIdForEdge(selectedRow.edge), name: selectedRow.edge.serviceName };
      return createServiceScopeAssignment({
        providerSlug,
        providerServiceId: selectedProviderService.id,
        providerServiceName: selectedProviderService.name,
        serviceEntityId: service.id,
        serviceEntityName: service.name,
      });
    }

    const serviceEntityId = serviceEntityIdForEdge(selectedRow.edge);
    const runtimeEntityId = runtimeEntityIdForEdge(selectedRow.edge);
    return {
      assignmentKey: createProviderScopeAssignmentKey(providerSlug, serviceEntityId, runtimeEntityId),
      providerSlug,
      providerServiceId: selectedProviderService.id,
      providerServiceName: selectedProviderService.name,
      serviceEntityId,
      serviceEntityName: selectedRow.edge.serviceName,
      runtimeEntityId,
      runtimeEntityName: selectedRow.edge.targetName,
      runtimeType: selectedRow.edge.targetType,
      location: selectedRow.edge.location ?? null,
      evidence: selectedCandidate?.providerServiceId === selectedProviderService.id
        ? `Operator confirmed ${selectedCandidate.evidence}.`
        : `Operator selected ${selectedProviderService.name} for this Smartscape service-to-runtime relationship.`,
      enabled: true,
    };
  };

  const saveAssignment = async () => {
    const value = assignmentValue();
    if (!value || scopeSettings.mutating) return;
    setFeedback(undefined);
    try {
      if (selectedAssignment) await scopeSettings.updateAssignment(selectedAssignment, value);
      else await scopeSettings.createAssignment(value);
      if (focusedProblemId && focusedServiceId) {
        void navigate(returnPath);
        return;
      }
      setFeedback({
        tone: "positive",
        message: `${value.providerServiceName} will be reused for incidents affecting ${value.serviceEntityName}.`,
      });
    } catch {
      setFeedback({
        tone: "warning",
        message: "The mapping could not be saved. Check App Settings write access and try again.",
      });
    }
  };

  const removeAssignment = async () => {
    if (!selectedAssignment || scopeSettings.mutating || !window.confirm(
      `Remove the confirmed ${assignmentDisplayName(selectedAssignment)} mapping for ${selectedAssignment.serviceEntityName}?`,
    )) return;
    try {
      await scopeSettings.deleteAssignment(selectedAssignment);
      setFeedback({
        tone: "neutral",
        message: "The confirmed mapping was removed. Available evidence remains visible for another review.",
      });
    } catch {
      setFeedback({
        tone: "warning",
        message: "The mapping could not be removed. Check App Settings write access and try again.",
      });
    }
  };

  const renderRow = (row: CoverageRow) => {
    const assignment = row.assignment;
    const covered = rowIsCovered(row);
    if (row.kind === "scope") {
      return (
        <button type="button" role="option" aria-selected={selectedRowKey === row.key} className={`scope-map-row${selectedRowKey === row.key ? " selected" : ""}`} key={row.key} onClick={() => setSelectedRowKey(row.key)}>
          <span className="scope-node"><ServicesIcon /><span><small>Service</small><strong>{row.edge.serviceName}</strong></span></span>
          <span className="scope-connector"><span aria-hidden="true" /><small>{formatSmartscapeRelationship(row.edge.relationship)}</small></span>
          <span className="scope-node"><HostsIcon /><span><small>{row.edge.targetType.replaceAll("_", " ")}</small><strong>{row.edge.targetName}</strong></span></span>
          <span className="scope-connector"><span aria-hidden="true" /><small>{row.evidenceCount > 1 ? `${row.evidenceCount} signals` : "Smartscape"}</small></span>
          <span className={`scope-node scope-location${covered ? "" : " missing"}`}><span><small>{assignment ? "Confirmed" : row.sourceTag ? "Source tag" : row.observed ? "Observed" : row.ambiguous ? "Ambiguous" : row.problemCount > 0 ? `${row.problemCount} recent Problems` : row.candidate ? "Recommended" : "Needs review"}</small><strong>{assignment ? assignmentDisplayName(assignment) : row.sourceTag ? "Provider identified" : row.observed ? row.candidate?.providerServiceName : row.ambiguous ? "Review service match" : row.candidate?.providerServiceName ?? "Select provider service"}</strong></span></span>
        </button>
      );
    }

    return (
      <button type="button" role="option" aria-selected={selectedRowKey === row.key} className={`scope-map-row coverage-service-row${selectedRowKey === row.key ? " selected" : ""}`} key={row.key} onClick={() => setSelectedRowKey(row.key)}>
        <span className="scope-node"><ServicesIcon /><span><small>Service</small><strong>{row.service.name}</strong></span></span>
        <span className="scope-connector"><span aria-hidden="true" /><small>found in</small></span>
        <span className="scope-node coverage-source-node"><ServicesIcon /><span><small>Coverage source</small><strong>{row.sourceTag ? `${providerTagKey}:${providerSlug}` : row.conflicting ? "Different provider tag" : "Service inventory"}</strong></span></span>
        <span className="scope-connector"><span aria-hidden="true" /><small>{assignment || row.sourceTag ? "No runtime" : `No ${providerName} link`}</small></span>
        <span className={`scope-node scope-location${covered ? "" : " missing"}`}><span><small>{assignment ? "Confirmed" : row.sourceTag ? "Source tag" : row.conflicting ? "Different provider tag" : `No ${providerName} relationship`}</small><strong>{assignment ? assignmentDisplayName(assignment) : row.sourceTag ? "Provider identified" : row.conflicting ? row.values.join(", ") : "Not linked"}</strong></span></span>
      </button>
    );
  };

  const renderGroup = (label: string, rows: CoverageRow[]) => rows.length > 0 ? (
    <React.Fragment key={label}>
      <div className="coverage-list-group" role="presentation"><strong>{label}</strong></div>
      {rows.map(renderRow)}
    </React.Fragment>
  ) : null;

  const stateTone: Tone = selectedAssignment || selectedSourceTag || selectionUsesObservedMatch
    ? "positive"
    : selectedConflict || selectedAmbiguous || selectionMatchesCandidate
      ? "warning"
      : "neutral";
  const stateLabel = selectedAssignment
    ? "Confirmed mapping"
    : selectedSourceTag
      ? "Source tag"
      : selectionUsesObservedMatch
        ? "Observed topology"
      : selectedConflict
        ? "Different provider tag"
        : selectedAmbiguous
          ? "Ambiguous match"
        : selectionMatchesCandidate
          ? "Recommended match"
          : selectedRow?.kind === "service"
            ? selectedProviderService
              ? "Manual selection"
              : "Not linked"
            : "Needs review";
  const stateTitle = selectedAssignment
    ? `Confirmed provider service: ${assignmentDisplayName(selectedAssignment)}`
    : selectedSourceTag
      ? `Matched by ${providerTagKey}:${providerSlug}`
      : selectionUsesObservedMatch
        ? `Observed provider service: ${selectedProviderService?.name}`
      : selectedConflict
        ? "Source tag points to another provider"
        : selectedAmbiguous
          ? "More than one provider service is possible"
        : selectionMatchesCandidate
          ? `Smartscape recommends: ${selectedProviderService?.name}`
          : selectedRow?.kind === "service" && !selectedProviderService
            ? `No ${providerName} service relationship found`
          : selectedProviderService
            ? `Selected provider service: ${selectedProviderService.name}`
            : "Choose the provider service for this Dynatrace service";
  const stateDetail = selectedAssignment?.evidence
    ?? (selectedConflict && selectedRow?.kind === "service"
      ? `Detected tags: ${selectedRow.values.join(", ")}. Review the matching rule before assigning ${providerName}.`
      : selectedSourceTag
        ? "The source-owned tag confirms the provider. SLA Review does not change it."
        : selectionUsesObservedMatch
          ? `${selectedCandidate?.evidence}. SLA Review can use this provider-native topology without saving one mapping per service.`
        : selectedAmbiguous
          ? "Dynatrace found more than one possible provider service. Select one only after reviewing the affected runtime paths."
        : selectedRow?.kind === "scope" && selectionMatchesCandidate
          ? selectedCandidate?.evidence
          : selectedRow?.kind === "scope" && selectedCandidate && selectedProviderService
            ? `This differs from the Smartscape recommendation of ${selectedCandidate.providerServiceName}. Verify the scope before confirming.`
            : selectedRow?.kind === "scope"
              ? "Smartscape identified the provider boundary but not a specific provider service."
              : `Dynatrace sees provider inventory in the environment, but no Smartscape runtime relationship or source tag links this service to ${providerName}. Confirm only if the service depends on it.`);

  const showSaveAction = Boolean(
    selectedRow &&
    selectedProviderService &&
    !selectedConflict &&
    !selectionUsesObservedMatch &&
    (!selectedSourceTag || selectedAssignment || selectedProviderService.id !== "*"),
  );
  const topologyTypeCounts = providerInventory?.nodeTypeCounts ?? [];
  const smartscapeHref = buildSmartscapeOverviewHref(
    getAppLink("dynatrace.smartscape"),
    providerSlug,
  );

  return (
    <section className="scope-map-view setup-scope-map" aria-labelledby="service-coverage-title">
      <div className="scope-map-toolbar">
        <div className="scope-map-title"><SmartscapeIcon /><div><strong id="service-coverage-title">Provider coverage</strong><span>Start with what Dynatrace found, then review only the service relationships that matter.</span></div></div>
        <div className="scope-map-toolbar-actions">
          <Button
            as="a"
            href={smartscapeHref}
            target="_blank"
            rel="noreferrer"
            size="condensed"
            aria-label={`Open ${providerName} overview in Smartscape`}
          ><Button.Prefix><SmartscapeIcon /></Button.Prefix>Open Smartscape</Button>
        </div>
      </div>
      <div className="scope-map-boundary"><strong>How it is used</strong><span>Provider-native topology, confirmed mappings, and matching source tags identify the provider service. Incidents and Evidence then resolve the applicable terms automatically. Coverage does not establish provider fault, local impact, or credit eligibility.</span></div>
      {hasProviderTopology ? (
        <div className="coverage-evidence-tabs" role="group" aria-label="Coverage evidence views">
          <button type="button" className={evidenceView === "topology" ? "active" : ""} aria-pressed={evidenceView === "topology"} onClick={() => setEvidenceView("topology")}>
            <span>Detected topology</span>
            <strong>{providerInventory?.nodeTypes.length.toLocaleString() ?? "1"}</strong>
          </button>
          <button type="button" className={evidenceView === "services" ? "active" : ""} aria-pressed={evidenceView === "services"} onClick={() => setEvidenceView("services")}>
            <span>Service links</span>
            <strong>{coveredRows.length.toLocaleString()}</strong>
          </button>
        </div>
      ) : null}
      {focusedProblemId ? (
        <div className="coverage-review-context" role="status">
          <div>
            <strong>Resolve coverage for {focusedProblemId}</strong>
            <span>
              {focusedServiceId
                ? `Review ${services.find((service) => service.id === focusedServiceId)?.name ?? focusedServiceId}. Saving a mapping returns you to the same review.`
                : "Review the affected service, then return to the same incident."}
            </span>
          </div>
          <Button as={Link} to={returnPath} size="condensed">Back to review</Button>
        </div>
      ) : null}
      {inventory.incomplete || inventory.unverified ? (
        <div className="coverage-inventory-warning" role="status">
          <strong>{inventory.incomplete ? "Inventory incomplete" : "Inventory could not be verified"}</strong>
          <span>{inventory.reasons.length > 0 ? inventory.reasons.join("; ") : "The inventory count query did not complete."} Only loaded exceptions are shown, and SLA Review will not report complete coverage.</span>
        </div>
      ) : null}
      {error ? <div className="error-box compact-error">Smartscape topology is unavailable. Service inventory remains available for coverage review.</div> : null}
      {scopeSettings.error ? <div className="error-box compact-error">Confirmed mappings are unavailable. Check App Settings read access.</div> : null}
      {loading || scopeSettings.loading ? (
        <div className="directory-loading" role="status"><strong>Loading provider coverage</strong><span>Reading provider topology, service inventory, and confirmed mappings.</span></div>
      ) : evidenceView === "topology" && hasProviderTopology ? (
        <section className="coverage-topology-view" aria-label={`${providerName} detected topology`}>
          {topologyTypeCounts.length > 0 ? (
            <ProviderTopologyMap
              providerSlug={providerSlug}
              providerName={providerName}
              nodeTypeCounts={topologyTypeCounts}
              searchText={topologySearchText}
              onSearchTextChange={setTopologySearchText}
            />
          ) : (
            <div className="coverage-topology-empty">
              <HostsIcon />
              <span>Dynatrace returned provider metadata on monitored hosts, but no provider-native node-type summary.</span>
            </div>
          )}
          <div className="coverage-topology-boundary">
            <div>
              <strong>{coveredRows.length > 0 ? `${coveredRows.length.toLocaleString()} verified service link${coveredRows.length === 1 ? "" : "s"}` : `No ${providerName} service links found`}</strong>
              <span>{coveredRows.length > 0
                ? `Service links are shown separately because provider inventory does not establish which Dynatrace service inherits ${providerName} terms.`
                : `${coverageRows.length.toLocaleString()} environment service${coverageRows.length === 1 ? " was" : "s were"} checked. None is attributed from provider presence alone.`}</span>
            </div>
          </div>
        </section>
      ) : !provider ? (
        <div className="contract-empty"><strong>Provider terms are unavailable</strong><span>Load the selected provider before confirming service coverage.</span></div>
      ) : coverageRows.length === 0 ? (
        <div className="contract-empty"><strong>No services returned</strong><span>Check service detection and entity access before assigning provider terms.</span></div>
      ) : (
        <div className="scope-map-layout" id="service-coverage-list">
          <div className="coverage-worklist">
            <div className="coverage-list-toolbar">
              <input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Find a service or runtime" aria-label="Search provider coverage" />
              <div className="coverage-filter-tabs" role="group" aria-label="Coverage worklist views">
                {([
                  ["all", "All", coverageRows.length],
                  ["covered", "Covered", coveredRows.length],
                  ["review", "Needs review", reviewRows.length],
                ] as const).map(([value, label, count]) => (
                  <button
                    type="button"
                    key={value}
                    className={coverageFilter === value ? "active" : ""}
                    aria-pressed={coverageFilter === value}
                    onClick={() => setCoverageFilter(value)}
                  >
                    <span>{label}</span>
                    <strong>{count.toLocaleString()}</strong>
                  </button>
                ))}
              </div>
            </div>
            <div className="scope-map-list" role="listbox" aria-label="Provider coverage worklist">
              {visibleRows.length > 0 ? (
                <>
                  {renderGroup("Needs review", visibleReviewRows)}
                  {renderGroup("Covered", visibleCoveredRows)}
                  {renderGroup(`Not linked to ${providerName}`, visibleUnscopedRows)}
                </>
              ) : (
                <div className="coverage-list-empty">
                  <strong>{coverageFilter === "review" ? "No evidence-backed exceptions in the loaded inventory" : "No matching services"}</strong>
                  <span>{inventory.incomplete ? "This is not a complete-coverage result because the inventory is bounded." : coverageFilter === "review" ? "Choose All to inspect covered services and services without a provider link." : "Change the view or search to review another service."}</span>
                  {coverageFilter === "review" && coveredRows.length > 0 ? <Button size="condensed" onClick={() => setCoverageFilter("covered")}>Inspect covered services</Button> : coverageFilter === "review" && coverageRows.length > 0 ? <Button size="condensed" onClick={() => setCoverageFilter("all")}>View all loaded services</Button> : null}
                </div>
              )}
            </div>
            <div className="coverage-list-footer">
              <span>Showing {visibleStart}-{visibleEnd} of {filteredRows.length} loaded</span>
              <div>
                <Button size="condensed" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</Button>
                <Button size="condensed" disabled={page >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>Next</Button>
              </div>
            </div>
          </div>
          <aside className="scope-detail" aria-label="Provider coverage for selected service">
            {selectedRow ? (
              <>
                <label className="field-label">{selectedRow.kind === "service" && !selectedAssignment && !selectedSourceTag ? "Assign provider service" : "Provider service"}
                  <select value={selectedProviderServiceId} onChange={(event) => { setSelectedProviderServiceId(event.target.value); setFeedback(undefined); }} disabled={selectedConflict}>
                    {selectedRow.kind === "service" ? <><option value="">Choose a provider service</option><option value="*">{providerName} (provider-wide)</option></> : <option value="">Select a provider service</option>}
                    {provider.services.map((service, index) => <option key={`${service.id}:${service.name}:${index}`} value={service.id}>{service.name}</option>)}
                  </select>
                </label>
                <div className="scope-mapping-state">
                  <StatusPill tone={stateTone}>{stateLabel}</StatusPill>
                  <strong>{stateTitle}</strong>
                  <span>{stateDetail}</span>
                </div>
                <div className="scope-selection">
                  <span>{selectedRow.kind === "scope" ? "Selected Dynatrace scope" : "Selected Dynatrace service"}</span>
                  <strong>{selectedRow.kind === "scope" ? `${selectedRow.edge.serviceName} → ${selectedRow.edge.targetName}` : selectedRow.service.name}</strong>
                  <small>{selectedRow.kind === "scope" ? selectedRow.edge.location ?? "No location field returned" : selectedRow.problemCount > 0 ? `${selectedRow.problemCount} recent Problem${selectedRow.problemCount === 1 ? "" : "s"}` : "No Smartscape runtime relationship returned"}</small>
                </div>
                <div className="scope-detail-actions">
                  {selectedConflict ? <Link className="text-action" to="/settings/watch">Review matching rules</Link> : null}
                  {showSaveAction ? <Button size="condensed" variant="emphasized" disabled={!scopeSettings.canWrite || scopeSettings.mutating} onClick={() => void saveAssignment()}>{scopeSettings.mutating ? "Saving" : selectedAssignment ? "Update mapping" : selectionMatchesCandidate ? `Confirm ${selectedProviderService?.name}` : selectedRow.kind === "service" && selectedProviderService?.id === "*" ? "Confirm provider coverage" : `Use ${selectedProviderService?.name}`}</Button> : null}
                  {selectedAssignment ? <Button size="condensed" disabled={!scopeSettings.canWrite || scopeSettings.mutating} onClick={() => void removeAssignment()}>Remove mapping</Button> : null}
                </div>
                {feedback ? <div className={`scope-map-feedback scope-map-feedback-${feedback.tone}`} role={feedback.tone === "warning" ? "alert" : "status"}>{feedback.message}</div> : null}
                {selectedCovered && selectedProviderService && selectedTerms ? (
                  <ServiceObjectivePreview
                    serviceClassicId={selectedServiceClassicId}
                    serviceName={selectedServiceName}
                    providerSlug={providerSlug}
                    providerName={providerName}
                    providerServiceName={selectedProviderService.name}
                    target={selectedTerms.availabilityTarget}
                    termsSource={selectedTerms.source}
                  />
                ) : null}
              </>
            ) : (
              <div className="scope-mapping-state">
                <StatusPill tone="positive">No exceptions</StatusPill>
                <strong>No provider match needs review</strong>
                <span>Choose Covered to inspect automatic matches, or All to map a service without a service-level provider link.</span>
              </div>
            )}
            <div className="coverage-detail-checks">
              <SetupAdvisor recommendations={recommendations} loading={recommendationsLoading} limitedContext={limitedContext} />
            </div>
          </aside>
        </div>
      )}
    </section>
  );
};
