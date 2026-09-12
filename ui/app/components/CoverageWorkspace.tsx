import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { openApp } from "@dynatrace-sdk/navigation";
import { Button } from "@dynatrace/strato-components/buttons";
import { HostsIcon, ServicesIcon, SmartscapeIcon } from "@dynatrace/strato-icons";
import type {
  CoverageInventoryStatus,
  ProblemRecord,
  ProviderScopeAssignmentRecord,
  ProviderScopeAssignmentValue,
  ServiceRecord,
  SetupRecommendation,
  SlaProviderResponse,
  SmartscapeScopeEdge,
} from "../types";
import { prioritizeServicesByProblemActivity } from "../data/providerAttribution";
import {
  createProviderScopeAssignmentKey,
  createServiceScopeAssignment,
  createServiceScopeAssignmentKey,
  inferProviderServiceCandidate,
  isServiceScopeAssignment,
  resolveProviderServiceCandidates,
  runtimeEntityIdForEdge,
  serviceEntityIdForEdge,
  type ProviderServiceCandidate,
  type ProviderServiceResolution,
} from "../data/providerScopeAssignments";
import { providerTagValues } from "../data/providerTags";
import { topologyAnchorRank } from "../data/topology";
import type { ProviderScopeAssignmentsState } from "../hooks/useProviderScopeAssignments";
import { SetupAdvisor } from "./SetupAdvisor";

type Tone = "neutral" | "warning" | "positive";

type ScopeCoverageRow = {
  kind: "scope";
  key: string;
  edge: SmartscapeScopeEdge;
  assignment?: ProviderScopeAssignmentRecord;
  candidate: ProviderServiceCandidate | null;
  observed: boolean;
  ambiguous: boolean;
  evidenceCount: number;
  sourceTag: boolean;
  problemCount: number;
};

type ServiceCoverageRow = {
  kind: "service";
  key: string;
  service: ServiceRecord;
  assignment?: ProviderScopeAssignmentRecord;
  values: string[];
  sourceTag: boolean;
  conflicting: boolean;
  problemCount: number;
};

type CoverageRow = ScopeCoverageRow | ServiceCoverageRow;

type CoverageWorkspaceProps = {
  provider?: SlaProviderResponse;
  topology: SmartscapeScopeEdge[];
  services: ServiceRecord[];
  problems: ProblemRecord[];
  providerTagKey: string;
  loading: boolean;
  error?: Error;
  scopeSettings: ProviderScopeAssignmentsState;
  recommendations: SetupRecommendation[];
  recommendationsLoading: boolean;
  limitedContext: boolean;
  inventory: CoverageInventoryStatus;
};

const StatusPill = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => (
  <span className={`status-pill status-pill-${tone}`}>{children}</span>
);

const rowIsCovered = (row: CoverageRow): boolean => Boolean(
  row.assignment || row.sourceTag || (row.kind === "scope" && row.observed),
);

const rowNeedsReview = (row: CoverageRow): boolean => {
  if (rowIsCovered(row)) return false;
  return row.kind === "scope" && Boolean(
    row.ambiguous || row.candidate || row.edge.providerSlug,
  );
};

const rowServiceName = (row: CoverageRow): string =>
  row.kind === "scope" ? row.edge.serviceName : row.service.name;

const rowSortRank = (row: CoverageRow): number => {
  if (rowIsCovered(row)) return 3;
  if (row.problemCount > 0) return 0;
  if (row.kind === "scope" && row.candidate) return 1;
  return 2;
};

const COVERAGE_PAGE_SIZE = 50;

const rowSearchValue = (row: CoverageRow): string => (
  row.kind === "scope"
    ? `${row.edge.serviceName} ${row.edge.targetName} ${row.edge.targetType} ${row.edge.location ?? ""} ${row.candidate?.providerServiceName ?? ""}`
    : `${row.service.name} ${row.service.id} ${row.values.join(" ")}`
).toLowerCase();

export const CoverageWorkspace = ({
  provider,
  topology,
  services,
  problems,
  providerTagKey,
  loading,
  error,
  scopeSettings,
  recommendations,
  recommendationsLoading,
  limitedContext,
  inventory,
}: CoverageWorkspaceProps) => {
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [selectedProviderServiceId, setSelectedProviderServiceId] = useState("");
  const [feedback, setFeedback] = useState<{ tone: Tone; message: string }>();
  const [coverageFilter, setCoverageFilter] = useState<"review" | "covered" | "all">("review");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(0);
  const providerSlug = provider?.provider.slug ?? "";
  const providerName = provider?.provider.name ?? providerSlug;
  const assignmentDisplayName = (assignment: ProviderScopeAssignmentRecord): string =>
    assignment.providerServiceId === "*" ? `${providerName} (provider-wide)` : assignment.providerServiceName;

  const providerAssignments = useMemo(
    () => scopeSettings.assignments.filter((assignment) =>
      assignment.enabled && assignment.providerSlug === providerSlug,
    ),
    [providerSlug, scopeSettings.assignments],
  );

  const problemCounts = useMemo(
    () => new Map(
      prioritizeServicesByProblemActivity(services, problems)
        .map(({ service, problemCount }) => [service.id, problemCount]),
    ),
    [problems, services],
  );

  const serviceById = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
  );

  const candidateResolutions = useMemo<Map<string, ProviderServiceResolution>>(
    () => provider ? resolveProviderServiceCandidates(topology, provider) : new Map<string, ProviderServiceResolution>(),
    [provider, topology],
  );

  const scopeRows = useMemo<ScopeCoverageRow[]>(() => {
    const edgesByService = new Map<string, SmartscapeScopeEdge[]>();
    topology.forEach((edge) => {
      const serviceEntityId = serviceEntityIdForEdge(edge);
      const hasAssignment = providerAssignments.some((assignment) => assignment.serviceEntityId === serviceEntityId);
      if (edge.providerSlug !== providerSlug && !hasAssignment) return;
      edgesByService.set(serviceEntityId, [
        ...(edgesByService.get(serviceEntityId) ?? []),
        edge,
      ]);
    });

    return Array.from(edgesByService.entries()).map(([serviceEntityId, edges]) => {
      const serviceAssignments = providerAssignments.filter((assignment) => assignment.serviceEntityId === serviceEntityId);
      const exactAssignmentByRuntime = new Map(serviceAssignments.map((assignment) => [assignment.runtimeEntityId, assignment]));
      const resolution = candidateResolutions.get(serviceEntityId);
      const orderedEdges = [...edges].sort((left, right) => {
        const leftAssigned = exactAssignmentByRuntime.has(runtimeEntityIdForEdge(left)) ? 0 : 1;
        const rightAssigned = exactAssignmentByRuntime.has(runtimeEntityIdForEdge(right)) ? 0 : 1;
        if (leftAssigned !== rightAssigned) return leftAssigned - rightAssigned;
        const leftCandidate = provider ? inferProviderServiceCandidate(left, provider) : null;
        const rightCandidate = provider ? inferProviderServiceCandidate(right, provider) : null;
        const leftMatches = resolution?.candidate?.providerServiceId === leftCandidate?.providerServiceId ? 0 : 1;
        const rightMatches = resolution?.candidate?.providerServiceId === rightCandidate?.providerServiceId ? 0 : 1;
        return leftMatches - rightMatches || topologyAnchorRank(left) - topologyAnchorRank(right);
      });
      const edge = orderedEdges[0];
      const assignment = exactAssignmentByRuntime.get(runtimeEntityIdForEdge(edge))
        ?? serviceAssignments.find(isServiceScopeAssignment)
        ?? serviceAssignments[0];
      const values = providerTagValues(
        serviceById.get(serviceEntityId)?.tags ?? edge.serviceTags,
        providerTagKey,
        providerSlug,
      );
      return {
        kind: "scope" as const,
        key: `scope:${providerSlug}:${serviceEntityId}`,
        edge,
        assignment,
        candidate: resolution?.candidate ?? null,
        observed: resolution?.candidate?.confidence === "observed" && !resolution.ambiguous,
        ambiguous: resolution?.ambiguous ?? false,
        evidenceCount: resolution?.evidenceCount ?? 0,
        sourceTag: values.includes(providerSlug.toLowerCase()),
        problemCount: problemCounts.get(serviceEntityId) ?? 0,
      };
    });
  }, [candidateResolutions, problemCounts, provider, providerAssignments, providerSlug, providerTagKey, serviceById, topology]);

  const topologyServiceIds = useMemo(
    () => new Set(scopeRows.map((row) => serviceEntityIdForEdge(row.edge))),
    [scopeRows],
  );

  const serviceRows = useMemo<ServiceCoverageRow[]>(() =>
    prioritizeServicesByProblemActivity(
      services.filter((service) => !topologyServiceIds.has(service.id)),
      problems,
    ).map(({ service, problemCount }) => {
      const values = providerTagValues(service.tags, providerTagKey, providerSlug);
      const sourceTag = values.includes(providerSlug.toLowerCase());
      const assignmentKey = createServiceScopeAssignmentKey(providerSlug, service.id);
      const assignment = providerAssignments.find((item) =>
        item.assignmentKey === assignmentKey && isServiceScopeAssignment(item),
      );
      return {
        kind: "service" as const,
        key: `service:${assignmentKey}`,
        service,
        assignment,
        values,
        sourceTag,
        conflicting: values.length > 0 && !sourceTag,
        problemCount,
      };
    }),
  [problems, providerAssignments, providerSlug, providerTagKey, services, topologyServiceIds]);

  const coverageRows = useMemo(
    () => [...scopeRows, ...serviceRows].sort((left, right) => {
      const rank = rowSortRank(left) - rowSortRank(right);
      if (rank !== 0) return rank;
      const activity = right.problemCount - left.problemCount;
      if (activity !== 0) return activity;
      const name = rowServiceName(left).localeCompare(rowServiceName(right));
      if (name !== 0) return name;
      return left.kind.localeCompare(right.kind);
    }),
    [scopeRows, serviceRows],
  );

  const reviewRows = coverageRows.filter(rowNeedsReview);
  const coveredRows = coverageRows.filter(rowIsCovered);

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
        selectedRow.assignment?.providerServiceId ??
        (selectedRow.ambiguous ? "" : selectedRow.candidate?.providerServiceId) ??
        (selectedRow.sourceTag ? "*" : ""),
      );
    } else {
      setSelectedProviderServiceId(selectedRow.assignment?.providerServiceId ?? "*");
    }
    setFeedback(undefined);
  }, [selectedRow]);

  const selectedProviderService = selectedProviderServiceId === "*"
    ? { id: "*", name: providerName || "Provider" }
    : provider?.services.find((service) => service.id === selectedProviderServiceId);
  const selectionMatchesCandidate = Boolean(
    selectedCandidate && selectedProviderService?.id === selectedCandidate.providerServiceId,
  );
  const selectionUsesObservedMatch = selectedObserved && selectionMatchesCandidate && !selectedAssignment;

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
          <span className="scope-connector"><span aria-hidden="true" /><small>{row.edge.relationship === "belongs_to" ? "belongs to" : "runs on"}</small></span>
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
        <span className="scope-connector"><span aria-hidden="true" /><small>No runtime</small></span>
        <span className={`scope-node scope-location${covered ? "" : " missing"}`}><span><small>{assignment ? "Confirmed" : row.sourceTag ? "Source tag" : row.conflicting ? "Different provider tag" : "No provider evidence"}</small><strong>{assignment ? assignmentDisplayName(assignment) : row.sourceTag ? "Provider identified" : row.conflicting ? row.values.join(", ") : "Not attributed"}</strong></span></span>
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
            ? "Manual mapping"
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
              : "No Smartscape runtime relationship was returned. Confirm only if this service depends on the selected provider.");

  const showSaveAction = Boolean(
    selectedRow &&
    selectedProviderService &&
    !selectedConflict &&
    !selectionUsesObservedMatch &&
    (!selectedSourceTag || selectedAssignment || selectedProviderService.id !== "*"),
  );

  return (
    <section className="scope-map-view setup-scope-map" aria-labelledby="service-coverage-title">
      <div className="scope-map-toolbar">
        <div className="scope-map-title"><ServicesIcon /><div><strong id="service-coverage-title">Coverage exceptions</strong><span>Dynatrace applies provider-native matches. Review only provider evidence that needs a service match.</span></div></div>
        <div className="scope-map-toolbar-actions">
          <Button size="condensed" onClick={() => openApp("dynatrace.smartscape", "view/dynatrace.smartscape.smartscape-on-grail")}><Button.Prefix><SmartscapeIcon /></Button.Prefix>Open Smartscape</Button>
        </div>
      </div>
      <div className="scope-map-boundary"><strong>How it is used</strong><span>Provider-native topology, confirmed mappings, and matching source tags identify the provider service. Incidents and Evidence then resolve the applicable terms automatically. Coverage does not establish provider fault, local impact, or credit eligibility.</span></div>
      {inventory.incomplete || inventory.unverified ? (
        <div className="coverage-inventory-warning" role="status">
          <strong>{inventory.incomplete ? "Inventory incomplete" : "Inventory could not be verified"}</strong>
          <span>{inventory.reasons.length > 0 ? inventory.reasons.join("; ") : "The inventory count query did not complete."} Only loaded exceptions are shown, and SLA Review will not report complete coverage.</span>
        </div>
      ) : null}
      {error ? <div className="error-box compact-error">Smartscape topology is unavailable. Service inventory remains available for coverage review.</div> : null}
      {scopeSettings.error ? <div className="error-box compact-error">Confirmed mappings are unavailable. Check App Settings read access.</div> : null}
      {loading || scopeSettings.loading ? (
        <div className="directory-loading" role="status"><strong>Loading service coverage</strong><span>Reading service inventory, Smartscape relationships, and confirmed mappings.</span></div>
      ) : !provider ? (
        <div className="contract-empty"><strong>Provider terms are unavailable</strong><span>Load the selected provider before confirming service coverage.</span></div>
      ) : coverageRows.length === 0 ? (
        <div className="contract-empty"><strong>No services returned</strong><span>Check service detection and entity access before assigning provider terms.</span></div>
      ) : (
        <div className="scope-map-layout" id="service-coverage-list">
          <div className="coverage-worklist">
            <div className="coverage-list-toolbar">
              <input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Find a service or runtime" aria-label="Search provider coverage" />
              <select value={coverageFilter} onChange={(event) => setCoverageFilter(event.target.value as "review" | "covered" | "all")} aria-label="Coverage worklist filter">
                <option value="review">Needs review ({reviewRows.length})</option>
                <option value="covered">Covered ({coveredRows.length})</option>
                <option value="all">All loaded ({coverageRows.length})</option>
              </select>
            </div>
            <div className="scope-map-list" role="listbox" aria-label="Provider coverage worklist">
              {visibleRows.length > 0 ? (
                <>
                  {renderGroup("Needs review", visibleReviewRows)}
                  {renderGroup("Covered", visibleCoveredRows)}
                  {renderGroup("No provider evidence", visibleUnscopedRows)}
                </>
              ) : (
                <div className="coverage-list-empty">
                  <strong>{coverageFilter === "review" ? "No evidence-backed exceptions in the loaded inventory" : "No matching services"}</strong>
                  <span>{inventory.incomplete ? "This is not a complete-coverage result because the inventory is bounded." : coverageFilter === "review" ? "Use All loaded only when you need to map a service without provider evidence." : "Change the filter or search to review another service."}</span>
                  {coverageFilter === "review" && coverageRows.length > 0 ? <Button size="condensed" onClick={() => setCoverageFilter("all")}>View all loaded services</Button> : null}
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
                <label className="field-label">Provider service
                  <select value={selectedProviderServiceId} onChange={(event) => { setSelectedProviderServiceId(event.target.value); setFeedback(undefined); }} disabled={selectedConflict}>
                    {selectedRow.kind === "service" ? <option value="*">{providerName} (provider-wide)</option> : <option value="">Select a provider service</option>}
                    {provider.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
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
              </>
            ) : (
              <div className="scope-mapping-state">
                <StatusPill tone="positive">No exceptions</StatusPill>
                <strong>No provider match needs review</strong>
                <span>Switch to Covered to inspect automatic matches, or All loaded to map a service without provider evidence.</span>
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
