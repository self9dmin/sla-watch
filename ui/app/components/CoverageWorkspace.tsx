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
  rowServiceIds,
  type CoverageFilter,
  type CoverageRow,
  type ProviderCoverageModel,
} from "../data/providerCoverage";
import type { ProviderInfrastructureCandidate } from "../data/providerInfrastructure";
import type { ProviderInventorySummary } from "../data/providerInventory";
import {
  createResourceScopeAssignment,
  createServiceScopeAssignment,
  runtimeEntityIdForEdge,
  serviceEntityIdForEdge,
} from "../data/providerScopeAssignments";
import { safeWorkspaceReturnPath } from "../data/reviewRoutes";
import { buildSmartscapeOverviewHref } from "../data/smartscapeNavigation";
import { providerDisplayName } from "../data/providers";
import type { ProviderHostContextSummary } from "../data/topology";
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

const formatResourceType = (value: string): string => {
  if (value.toUpperCase() === "HOST") return "Monitored host";
  return value
    .replace(/^(AWS|AZURE|GCP|GOOGLE|OCI|ORACLE)_/i, "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const impactServicesForRow = (row: CoverageRow): Array<{ id: string; name: string }> => {
  if (row.kind === "service") return [{ id: row.service.id, name: row.service.name }];
  const servicesById = new Map<string, string>();
  row.edges.forEach((edge) => servicesById.set(serviceEntityIdForEdge(edge), edge.serviceName));
  return Array.from(servicesById, ([id, name]) => ({ id, name }));
};

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
  const leavingFocusedService = useRef<string | null>(null);
  const contractSettings = useContractOverrides();
  const providerSlug = provider?.provider.slug ?? infrastructureCandidate?.providerSlug ?? "";
  const providerName = provider?.provider.name ?? providerDisplayName(providerSlug);
  const routeParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const focusedServiceId = routeParams.get("service");
  const focusedProviderServiceId = routeParams.get("providerService");
  const focusedProblemId = routeParams.get("problem");
  const returnPath = safeWorkspaceReturnPath(
    routeParams.get("return"),
    focusedProblemId ? `/evidence?provider=${encodeURIComponent(providerSlug)}&problem=${encodeURIComponent(focusedProblemId)}` : "/evidence",
  );
  const assignmentDisplayName = (assignment: ProviderScopeAssignmentRecord): string =>
    assignment.providerServiceId === "*" ? `${providerName} default terms` : assignment.providerServiceName;
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
  const focusedRowIndex = focusedServiceId
    ? coverageRows.findIndex((row) => rowServiceIds(row).includes(focusedServiceId))
    : -1;
  const focusedRow = focusedRowIndex >= 0 ? coverageRows[focusedRowIndex] : undefined;

  const selectRow = (row: CoverageRow) => {
    if (focusedServiceId && !rowServiceIds(row).includes(focusedServiceId)) {
      leavingFocusedService.current = focusedServiceId;
      const params = new URLSearchParams(location.search);
      ["case", "problem", "service", "providerService", "return"].forEach((key) => params.delete(key));
      void navigate({ pathname: "/", search: `?${params.toString()}` }, { replace: true });
    }
    setSelectedRowKey(row.key);
  };

  useEffect(() => {
    setPage(0);
  }, [coverageFilter, providerSlug, searchText]);

  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);

  useEffect(() => {
    if (!focusedServiceId) {
      lastFocusedService.current = null;
      leavingFocusedService.current = null;
      return;
    }
    if (leavingFocusedService.current === focusedServiceId) return;
    leavingFocusedService.current = null;
    if (!focusedServiceId || loading || scopeSettings.loading) return;
    const focusKey = `${providerSlug}:${focusedServiceId}`;
    if (lastFocusedService.current === focusKey) return;
    if (focusedRowIndex < 0) {
      setSelectedRowKey(null);
      return;
    }
    lastFocusedService.current = focusKey;
    setCoverageFilter("all");
    setSearchText("");
    setPage(Math.floor(focusedRowIndex / COVERAGE_PAGE_SIZE));
    setSelectedRowKey(focusedRow?.key ?? null);
  }, [focusedRow?.key, focusedRowIndex, focusedServiceId, loading, providerSlug, scopeSettings.loading]);

  useEffect(() => {
    if (!provider || loading || scopeSettings.loading) return;
    if (focusedServiceId) {
      if (leavingFocusedService.current === focusedServiceId) return;
      if (!focusedRow) {
        if (selectedRowKey !== null) setSelectedRowKey(null);
        return;
      }
      if (coverageFilter !== "all" || searchText || page !== Math.floor(focusedRowIndex / COVERAGE_PAGE_SIZE)) return;
      const selectedVisibleRow = visibleRows.find((row) => row.key === selectedRowKey);
      if (!selectedVisibleRow || !rowServiceIds(selectedVisibleRow).includes(focusedServiceId)) {
        setSelectedRowKey(focusedRow.key);
      }
      return;
    }
    if (!visibleRows.some((row) => row.key === selectedRowKey)) {
      setSelectedRowKey(visibleRows[0]?.key ?? null);
    }
  }, [coverageFilter, focusedRow, focusedRowIndex, focusedServiceId, loading, page, provider, scopeSettings.loading, searchText, selectedRowKey, visibleRows]);

  const selectedRow = coverageRows.find((row) => row.key === selectedRowKey);
  const focusedSelectionMismatch = Boolean(
    focusedServiceId && selectedRow && !rowServiceIds(selectedRow).includes(focusedServiceId),
  );
  const selectedAssignments = selectedRow?.kind === "scope"
    ? selectedRow.assignments
    : selectedRow?.assignment
      ? [selectedRow.assignment]
      : [];
  const selectedAssignment = selectedRow?.assignment;
  const selectedCandidate = selectedRow?.kind === "scope" ? selectedRow.candidate : null;
  const selectedObserved = selectedRow?.kind === "scope" ? selectedRow.observed : false;
  const selectedAmbiguous = selectedRow?.kind === "scope" ? selectedRow.ambiguous : false;
  const selectedMixedAssignments = selectedRow?.kind === "scope" ? selectedRow.mixedAssignments : false;
  const selectedSourceTag = selectedRow?.sourceTag ?? false;
  const selectedServiceSourceTag = selectedRow?.kind === "service" && selectedSourceTag;
  const selectedConflict = selectedRow?.kind === "service" ? selectedRow.conflicting : false;

  useEffect(() => {
    if (!selectedRow) {
      setSelectedProviderServiceId("");
    } else if (selectedRow.kind === "scope") {
      setSelectedProviderServiceId(
        (focusedServiceId && rowServiceIds(selectedRow).includes(focusedServiceId) &&
          focusedProviderServiceId &&
          (focusedProviderServiceId === "*" ||
            provider?.services.some((service) => service.id === focusedProviderServiceId))
          ? focusedProviderServiceId
          : null) ??
        (selectedRow.mixedAssignments ? "" : selectedRow.assignment?.providerServiceId) ??
        (selectedRow.ambiguous ? "" : selectedRow.candidate?.providerServiceId) ??
        "",
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
  const selectedImpactServices = selectedRow ? impactServicesForRow(selectedRow) : [];
  const selectedImpactService = selectedImpactServices.find(
    (service) => service.id === focusedServiceId,
  ) ?? (selectedImpactServices.length === 1 ? selectedImpactServices[0] : null);
  const selectedServiceClassicId = selectedImpactService?.id ?? null;
  const selectedServiceName = selectedImpactService?.name ?? "";
  const selectedTerms = useMemo(() => {
    if (!provider || !selectedRow || !selectedProviderService || !selectedCovered) return null;
    return resolveEffectiveContractTerms(provider, contractSettings.overrides, {
      providerSlug,
      providerServiceId: selectedProviderService.id,
      serviceId: selectedServiceClassicId ?? undefined,
    });
  }, [contractSettings.overrides, provider, providerSlug, selectedCovered, selectedProviderService, selectedRow, selectedServiceClassicId]);

  const assignmentValues = (): ProviderScopeAssignmentValue[] => {
    if (!selectedRow || !selectedProviderService || selectedConflict) return [];
    if (selectedRow.kind === "service") {
      return [createServiceScopeAssignment({
        providerSlug,
        providerServiceId: selectedProviderService.id,
        providerServiceName: selectedProviderService.name,
        serviceEntityId: selectedRow.service.id,
        serviceEntityName: selectedRow.service.name,
      })];
    }

    if (selectedRow.assignments.length === 0) {
      return [createResourceScopeAssignment({
        providerSlug,
        providerServiceId: selectedProviderService.id,
        providerServiceName: selectedProviderService.name,
        runtimeEntityId: runtimeEntityIdForEdge(selectedRow.edge),
        runtimeEntityName: selectedRow.edge.targetName,
        runtimeType: selectedRow.edge.targetType,
        location: selectedRow.edge.location,
      })];
    }

    return selectedRow.assignments.map((assignment) => ({
      assignmentKey: assignment.assignmentKey,
      providerSlug,
      providerServiceId: selectedProviderService.id,
      providerServiceName: selectedProviderService.name,
      serviceEntityId: assignment.serviceEntityId,
      serviceEntityName: assignment.serviceEntityName,
      runtimeEntityId: assignment.runtimeEntityId,
      runtimeEntityName: assignment.runtimeEntityName,
      runtimeType: assignment.runtimeType,
      location: assignment.location,
      evidence: selectedCandidate?.providerServiceId === selectedProviderService.id
        ? `Operator confirmed ${selectedCandidate.evidence}.`
        : `Operator selected ${selectedProviderService.name} for provider resource ${selectedRow.edge.targetName}.`,
      enabled: true,
    }));
  };

  const saveAssignment = async () => {
    if (focusedSelectionMismatch) {
      setFeedback({ tone: "warning", message: "The selected scope does not include the service in this case. Return to that service before saving an SLA match." });
      return;
    }
    const values = assignmentValues();
    if (values.length === 0 || scopeSettings.mutating) return;
    setFeedback(undefined);
    try {
      if (selectedAssignments.length > 0)
        await scopeSettings.updateAssignments(selectedAssignments, values);
      else await scopeSettings.createAssignments(values);
      if (focusedProblemId && focusedServiceId) {
        void navigate(returnPath);
        return;
      }
      setFeedback({
        tone: "positive",
        message: selectedRow?.kind === "scope"
          ? `SLA match saved for ${selectedRow.edge.targetName}. It will be reused when linked services are affected.`
          : `SLA match saved. ${values[0].providerServiceName} will be reused for incidents affecting ${values[0].serviceEntityName}.`,
      });
    } catch {
      setFeedback({
        tone: "warning",
        message: "The SLA match could not be saved. Check App Settings write access and try again.",
      });
    }
  };

  const removeAssignment = async () => {
    if (focusedSelectionMismatch || selectedAssignments.length === 0 || scopeSettings.mutating || !window.confirm(
      selectedRow?.kind === "scope"
        ? `Remove the confirmed SLA match for ${selectedRow.edge.targetName}?`
        : `Remove the confirmed SLA match between ${selectedAssignments[0].serviceEntityName} and ${assignmentDisplayName(selectedAssignments[0])}?`,
    )) return;
    try {
      await scopeSettings.deleteAssignments(selectedAssignments);
      setFeedback({
        tone: "neutral",
        message: "The SLA match was removed. Available evidence remains visible for another review.",
      });
    } catch {
      setFeedback({
        tone: "warning",
        message: "The SLA match could not be removed. Check App Settings write access and try again.",
      });
    }
  };

  const renderRow = (row: CoverageRow) => {
    const assignment = row.assignment;
    const covered = rowIsCovered(row);
    if (row.kind === "scope") {
      const impactServices = impactServicesForRow(row);
      const impactNames = impactServices.map((service) => service.name);
      const impactSummary = impactNames.length > 2
        ? `${impactNames.slice(0, 2).join(", ")} +${impactNames.length - 2}`
        : impactNames.join(", ");
      return (
        <button type="button" role="option" aria-selected={selectedRowKey === row.key} className={`scope-map-row${selectedRowKey === row.key ? " selected" : ""}`} key={row.key} onClick={() => selectRow(row)}>
          <span className="scope-node">{row.edge.targetType === "HOST" ? <HostsIcon /> : <SmartscapeIcon />}<span><small>{formatResourceType(row.edge.targetType)}</small><strong>{row.edge.targetName}</strong></span></span>
          <span className="scope-connector"><span aria-hidden="true" /><small>used by</small></span>
          <span className="scope-node"><ServicesIcon /><span><small>{impactServices.length} dependent service{impactServices.length === 1 ? "" : "s"}</small><strong>{impactSummary}</strong></span></span>
          <span className="scope-connector"><span aria-hidden="true" /><small>SLA terms</small></span>
          <span className={`scope-node scope-location${covered ? "" : " missing"}`}><span><small>{row.mixedAssignments ? "Conflicting matches" : assignment ? "Confirmed resource" : row.observed ? "Observed resource" : row.ambiguous ? "Ambiguous" : row.problemCount > 0 ? `${row.problemCount} recent Problems` : row.candidate ? "Recommended" : "Needs review"}</small><strong>{row.mixedAssignments ? "Review saved terms" : assignment ? assignmentDisplayName(assignment) : row.observed ? row.candidate?.providerServiceName : row.ambiguous ? "Review SLA match" : row.candidate?.providerServiceName ?? "Select provider service"}</strong></span></span>
        </button>
      );
    }

    return (
      <button type="button" role="option" aria-selected={selectedRowKey === row.key} className={`scope-map-row coverage-service-row${selectedRowKey === row.key ? " selected" : ""}`} key={row.key} onClick={() => selectRow(row)}>
        <span className="scope-node"><ServicesIcon /><span><small>Service</small><strong>{row.service.name}</strong></span></span>
        <span className="scope-connector"><span aria-hidden="true" /><small>found in</small></span>
        <span className="scope-node coverage-source-node"><ServicesIcon /><span><small>Coverage source</small><strong>{row.sourceTag ? `${providerTagKey}:${providerSlug}` : row.conflicting ? "Different provider tag" : "Service inventory"}</strong></span></span>
        <span className="scope-connector"><span aria-hidden="true" /><small>{assignment || row.sourceTag ? "No runtime" : `No ${providerName} match`}</small></span>
        <span className={`scope-node scope-location${covered ? "" : " missing"}`}><span><small>{assignment ? "Confirmed" : row.sourceTag ? "Source tag" : row.conflicting ? "Different provider tag" : "No SLA match"}</small><strong>{assignment ? assignmentDisplayName(assignment) : row.sourceTag ? "Provider identified" : row.conflicting ? row.values.join(", ") : "Not matched"}</strong></span></span>
      </button>
    );
  };

  const renderGroup = (label: string, rows: CoverageRow[]) => rows.length > 0 ? (
    <React.Fragment key={label}>
      <div className="coverage-list-group" role="presentation"><strong>{label}</strong></div>
      {rows.map(renderRow)}
    </React.Fragment>
  ) : null;

  const stateTone: Tone = selectedMixedAssignments || selectedConflict || selectedAmbiguous
    ? "warning"
    : selectedAssignment || selectedServiceSourceTag || selectionUsesObservedMatch
    ? "positive"
    : selectionMatchesCandidate
      ? "warning"
      : "neutral";
  const stateLabel = selectedMixedAssignments
    ? "Conflicting saved matches"
    : selectedAssignment
    ? "Confirmed SLA match"
    : selectedServiceSourceTag
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
              ? "New SLA match"
              : "No SLA match"
            : "Needs review";
  const stateTitle = selectedMixedAssignments
    ? "This resource has conflicting saved terms"
    : selectedAssignment
    ? `Confirmed SLA match: ${assignmentDisplayName(selectedAssignment)}`
    : selectedServiceSourceTag
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
            : "Choose the provider service for this resource";
  const stateDetail = selectedMixedAssignments
    ? "Older service-level decisions disagree for this resource. Review its terms before applying one resource-level match."
    : selectedAssignment?.evidence
    ?? (selectedConflict && selectedRow?.kind === "service"
      ? `Detected tags: ${selectedRow.values.join(", ")}. Review the matching rule before assigning ${providerName}.`
      : selectedServiceSourceTag
        ? "The source-owned tag confirms the provider. SLA Review does not change it."
        : selectionUsesObservedMatch
          ? `${selectedCandidate?.evidence}. SLA Review can use this provider-native topology without a manual confirmation.`
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
    (!selectedServiceSourceTag || selectedAssignment || selectedProviderService.id !== "*"),
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
      <div className="scope-map-boundary"><strong>How it is used</strong><span>Provider-native topology, confirmed SLA matches, and matching source tags identify the provider service. Evidence then brings the matched terms into each Problem review. Coverage does not establish provider fault, local impact, or credit eligibility.</span></div>
      {hasProviderTopology ? (
        <div className="coverage-evidence-tabs" role="group" aria-label="Coverage evidence views">
          <button type="button" className={evidenceView === "topology" ? "active" : ""} aria-pressed={evidenceView === "topology"} onClick={() => setEvidenceView("topology")}>
            <span>Detected topology</span>
            <strong>{providerInventory?.nodeTypes.length.toLocaleString() ?? "1"}</strong>
          </button>
          <button type="button" className={evidenceView === "services" ? "active" : ""} aria-pressed={evidenceView === "services"} onClick={() => setEvidenceView("services")}>
            <span>SLA matches</span>
            <strong>{coveredRows.length.toLocaleString()}</strong>
          </button>
        </div>
      ) : null}
      {focusedProblemId ? (
        <div className="coverage-review-context" role="status">
          <div>
            <strong>{focusedRow ? "Review coverage" : "Coverage scope not found"} for {focusedProblemId}</strong>
            <span>
              {focusedServiceId && !focusedRow && !loading && !scopeSettings.loading
                ? `${services.find((service) => service.id === focusedServiceId)?.name ?? focusedServiceId} has no loaded scope for ${providerName}. No other service is selected. Return to the case or inspect provider topology before making a match.`
                : focusedServiceId
                ? `Review ${services.find((service) => service.id === focusedServiceId)?.name ?? focusedServiceId}. Saving an SLA match returns you to the same review.`
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
      {scopeSettings.error ? <div className="error-box compact-error">Saved SLA matches are unavailable. Check App Settings read access.</div> : null}
      {loading || scopeSettings.loading ? (
        <div className="directory-loading" role="status"><strong>Loading provider coverage</strong><span>Reading provider topology, service inventory, and saved SLA matches.</span></div>
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
            <strong>{coveredRows.length > 0 ? `${coveredRows.length.toLocaleString()} SLA match${coveredRows.length === 1 ? "" : "es"}` : `No ${providerName} SLA matches found`}</strong>
              <span>{coveredRows.length > 0
                ? `Review linked provider resources and any direct service fallbacks separately. Provider inventory alone does not establish impact.`
                : `No exact resource or source-tag match was found. Provider presence alone does not assign an SLA to a service.`}</span>
            </div>
          </div>
        </section>
      ) : !provider ? (
        <div className="contract-empty"><strong>Provider terms are unavailable</strong><span>Load the selected provider before reviewing SLA matches.</span></div>
      ) : coverageRows.length === 0 ? (
        <div className="contract-empty"><strong>No exact SLA match scope found</strong><span>Smartscape has not returned a provider-linked resource or source-tagged service for this provider. Check provider topology before creating a match.</span></div>
      ) : (
        <div className="scope-map-layout" id="service-coverage-list">
          <div className="coverage-worklist">
            <div className="coverage-list-toolbar">
              <input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Find a resource or dependent service" aria-label="Search provider coverage" />
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
            <div className="scope-map-list" role="listbox" aria-label="SLA match worklist">
              {visibleRows.length > 0 ? (
                <>
                  {renderGroup("Needs review", visibleReviewRows)}
                  {renderGroup("Covered", visibleCoveredRows)}
                  {renderGroup(`No ${providerName} SLA match`, visibleUnscopedRows)}
                </>
              ) : (
                <div className="coverage-list-empty">
                  <strong>{coverageFilter === "review" ? "No resource match needs review" : "No matching resources or direct service matches"}</strong>
                  <span>{inventory.incomplete ? "This is not a complete-coverage result because the inventory is bounded." : coverageFilter === "review" ? "Choose All to inspect every linked resource and direct service match." : "Change the view or search to review another resource."}</span>
                  {coverageFilter === "review" && coveredRows.length > 0 ? <Button size="condensed" onClick={() => setCoverageFilter("covered")}>Inspect covered scopes</Button> : coverageFilter === "review" && coverageRows.length > 0 ? <Button size="condensed" onClick={() => setCoverageFilter("all")}>View all linked scopes</Button> : null}
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
          <aside className="scope-detail" aria-label="SLA match for selected scope">
            {selectedRow ? (
              <>
                <label className="field-label">{selectedRow.kind === "service" && !selectedAssignment && !selectedSourceTag ? "Match to provider service" : "Provider service"}
                  <select value={selectedProviderServiceId} onChange={(event) => { setSelectedProviderServiceId(event.target.value); setFeedback(undefined); }} disabled={selectedConflict}>
                    {selectedRow.kind === "service" ? <><option value="">Choose a provider service</option><option value="*">{providerName} default terms</option></> : <option value="">Select a provider service</option>}
                    {provider.services.map((service, index) => <option key={`${service.id}:${service.name}:${index}`} value={service.id}>{service.name}</option>)}
                  </select>
                </label>
                <div className="scope-mapping-state">
                  <StatusPill tone={stateTone}>{stateLabel}</StatusPill>
                  <strong>{stateTitle}</strong>
                  <span>{stateDetail}</span>
                </div>
                <div className="scope-selection">
                  <span>{selectedRow.kind === "scope" ? "Selected provider resource" : "Selected Dynatrace service"}</span>
                  <strong>{selectedRow.kind === "scope" ? selectedRow.edge.targetName : selectedRow.service.name}</strong>
                  <small>{selectedRow.kind === "scope" ? `${selectedImpactServices.length} dependent service${selectedImpactServices.length === 1 ? "" : "s"}: ${selectedImpactServices.map((service) => service.name).join(", ")}${selectedRow.edge.location ? ` · ${selectedRow.edge.location}` : ""}` : selectedRow.problemCount > 0 ? `${selectedRow.problemCount} recent Problem${selectedRow.problemCount === 1 ? "" : "s"}` : "No Smartscape runtime relationship returned"}</small>
                </div>
                <div className="scope-detail-actions">
                  {selectedConflict ? <Link className="text-action" to="/settings/watch">Review matching rules</Link> : null}
                  {showSaveAction ? <Button size="condensed" variant="emphasized" disabled={!scopeSettings.canWrite || scopeSettings.mutating || focusedSelectionMismatch} onClick={() => void saveAssignment()}>{scopeSettings.mutating ? "Saving" : selectedAssignment ? "Update SLA match" : selectionMatchesCandidate || (selectedRow.kind === "service" && selectedProviderService?.id === "*") ? "Confirm SLA match" : `Match ${selectedProviderService?.name}`}</Button> : null}
                  {selectedAssignment ? <Button size="condensed" disabled={!scopeSettings.canWrite || scopeSettings.mutating || focusedSelectionMismatch} onClick={() => void removeAssignment()}>Remove SLA match</Button> : null}
                </div>
                {feedback ? <div className={`scope-map-feedback scope-map-feedback-${feedback.tone}`} role={feedback.tone === "warning" ? "alert" : "status"}>{feedback.message}</div> : null}
                {selectedCovered && selectedProviderService && selectedTerms ? (
                  <ServiceObjectivePreview
                    allowCreate={false}
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
            ) : focusedServiceId && !loading && !scopeSettings.loading ? (
              <div className="scope-mapping-state" role="status">
                <StatusPill tone="warning">Scope unavailable</StatusPill>
                <strong>No loaded SLA match for this service</strong>
                <span>Return to the case. Do not assign a different service to resolve this review.</span>
              </div>
            ) : (
              <div className="scope-mapping-state">
                <StatusPill tone="positive">No exceptions</StatusPill>
                <strong>No SLA match needs review</strong>
                <span>Choose Covered to inspect observed provider resources, or All to review exact links and direct service matches.</span>
              </div>
            )}
            <div className="coverage-detail-checks">
              {selectedRow && rowNeedsReview(selectedRow) ? (
                <div className="coverage-primary-guidance">Choose the provider service for the selected scope first. Ownership metadata can help later routing, but it does not confirm an SLA match.</div>
              ) : null}
              {recommendations.some((item) => item.priority === "high") ? (
                <SetupAdvisor recommendations={recommendations} loading={recommendationsLoading} limitedContext={limitedContext} />
              ) : (
                <details className="coverage-secondary-guidance">
                  <summary>Other coverage guidance</summary>
                  <SetupAdvisor recommendations={recommendations} loading={recommendationsLoading} limitedContext={limitedContext} />
                </details>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
};
