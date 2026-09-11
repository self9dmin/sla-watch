import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { openApp } from "@dynatrace-sdk/navigation";
import { Button } from "@dynatrace/strato-components/buttons";
import { HostsIcon, ServicesIcon, SmartscapeIcon } from "@dynatrace/strato-icons";
import type {
  EffectiveContractTerms,
  ProblemRecord,
  ProviderScopeAssignmentRecord,
  ProviderScopeAssignmentValue,
  ServiceRecord,
  SetupRecommendation,
  SlaProviderResponse,
  SmartscapeScopeEdge,
} from "../types";
import { resolveEffectiveContractTerms } from "../data/contractOverrides";
import { prioritizeServicesByProblemActivity } from "../data/providerAttribution";
import {
  createProviderScopeAssignmentKey,
  createServiceScopeAssignment,
  createServiceScopeAssignmentKey,
  inferProviderServiceCandidate,
  isServiceScopeAssignment,
  runtimeEntityIdForEdge,
  serviceEntityIdForEdge,
  type ProviderServiceCandidate,
} from "../data/providerScopeAssignments";
import { providerTagValues } from "../data/providerTags";
import { useContractOverrides } from "../hooks/useContractOverrides";
import type { ProviderScopeAssignmentsState } from "../hooks/useProviderScopeAssignments";
import { SetupAdvisor } from "./SetupAdvisor";

type Tone = "neutral" | "warning" | "positive";

type ScopeCoverageRow = {
  kind: "scope";
  key: string;
  edge: SmartscapeScopeEdge;
  assignment?: ProviderScopeAssignmentRecord;
  candidate: ProviderServiceCandidate | null;
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
};

const StatusPill = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => (
  <span className={`status-pill status-pill-${tone}`}>{children}</span>
);

const formatPercent = (value: number | null | undefined): string =>
  value === null || value === undefined ? "Not published" : `${value}%`;

const TermsStrip = ({ terms }: { terms: EffectiveContractTerms }) => (
  <dl className="effective-terms-strip">
    <div><dt>Availability</dt><dd>{formatPercent(terms.availabilityTarget)}</dd></div>
    <div><dt>Filing window</dt><dd>{terms.filingDeadlineDays === null ? "Not published" : `${terms.filingDeadlineDays} ${terms.businessDays ? "business" : "calendar"} days`}</dd></div>
    <div><dt>Maximum credit</dt><dd>{formatPercent(terms.maxCreditPercent)}</dd></div>
    <div><dt>Applied source</dt><dd className={terms.source === "tenant override" ? "source-tenant" : ""}>{terms.source === "tenant override" ? "Tenant override" : "sla.directory"}</dd></div>
  </dl>
);

const rowIsCovered = (row: CoverageRow): boolean => Boolean(row.assignment || row.sourceTag);

const rowServiceId = (row: CoverageRow): string =>
  row.kind === "scope" ? serviceEntityIdForEdge(row.edge) : row.service.id;

const rowServiceName = (row: CoverageRow): string =>
  row.kind === "scope" ? row.edge.serviceName : row.service.name;

const rowSortRank = (row: CoverageRow): number => {
  if (rowIsCovered(row)) return 3;
  if (row.problemCount > 0) return 0;
  if (row.kind === "scope" && row.candidate) return 1;
  return 2;
};

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
}: CoverageWorkspaceProps) => {
  const navigate = useNavigate();
  const contractSettings = useContractOverrides();
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [selectedProviderServiceId, setSelectedProviderServiceId] = useState("");
  const [feedback, setFeedback] = useState<{ tone: Tone; message: string }>();
  const providerSlug = provider?.provider.slug ?? "";
  const providerName = provider?.provider.name ?? providerSlug;

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

  const scopeRows = useMemo<ScopeCoverageRow[]>(() => {
    const seen = new Set<string>();
    return topology.flatMap((edge) => {
      const serviceEntityId = serviceEntityIdForEdge(edge);
      const assignmentKey = createProviderScopeAssignmentKey(
        providerSlug,
        serviceEntityId,
        runtimeEntityIdForEdge(edge),
      );
      const assignment = providerAssignments.find((item) => item.assignmentKey === assignmentKey);
      const belongsToProvider = edge.providerSlug === providerSlug || Boolean(assignment);
      if (!belongsToProvider || seen.has(assignmentKey)) return [];
      seen.add(assignmentKey);
      const values = providerTagValues(
        serviceById.get(serviceEntityId)?.tags ?? [],
        providerTagKey,
        providerSlug,
      );
      return [{
        kind: "scope" as const,
        key: `scope:${assignmentKey}`,
        edge,
        assignment,
        candidate: provider ? inferProviderServiceCandidate(edge, provider) : null,
        sourceTag: values.includes(providerSlug.toLowerCase()),
        problemCount: problemCounts.get(serviceEntityId) ?? 0,
      }];
    }).slice(0, 50);
  }, [problemCounts, provider, providerAssignments, providerSlug, providerTagKey, serviceById, topology]);

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

  const reviewRows = coverageRows.filter((row) => !rowIsCovered(row));
  const coveredRows = coverageRows.filter(rowIsCovered);

  useEffect(() => {
    if (!provider || loading || scopeSettings.loading) return;
    if (!coverageRows.some((row) => row.key === selectedRowKey)) {
      setSelectedRowKey(coverageRows[0]?.key ?? null);
    }
  }, [coverageRows, loading, provider, scopeSettings.loading, selectedRowKey]);

  const selectedRow = coverageRows.find((row) => row.key === selectedRowKey);
  const selectedAssignment = selectedRow?.assignment;
  const selectedCandidate = selectedRow?.kind === "scope" ? selectedRow.candidate : null;
  const selectedSourceTag = selectedRow?.sourceTag ?? false;
  const selectedConflict = selectedRow?.kind === "service" ? selectedRow.conflicting : false;

  useEffect(() => {
    if (!selectedRow) {
      setSelectedProviderServiceId("");
    } else if (selectedRow.kind === "scope") {
      setSelectedProviderServiceId(
        selectedRow.assignment?.providerServiceId ??
        selectedRow.candidate?.providerServiceId ??
        (selectedRow.sourceTag ? "*" : ""),
      );
    } else {
      setSelectedProviderServiceId(selectedRow.assignment?.providerServiceId ?? "*");
    }
    setFeedback(undefined);
  }, [selectedRow]);

  const selectedProviderService = selectedProviderServiceId === "*"
    ? { id: "*", name: "Provider-level terms" }
    : provider?.services.find((service) => service.id === selectedProviderServiceId);
  const selectionMatchesCandidate = Boolean(
    selectedCandidate && selectedProviderService?.id === selectedCandidate.providerServiceId,
  );

  const providerOverrides = useMemo(
    () => provider
      ? contractSettings.overrides.filter((override) => override.providerSlug === provider.provider.slug)
      : [],
    [contractSettings.overrides, provider],
  );

  const effectiveTerms = provider && selectedRow && selectedProviderService && !selectedConflict
    ? resolveEffectiveContractTerms(provider, providerOverrides, {
        providerSlug,
        providerServiceId: selectedProviderService.id,
        serviceId: rowServiceId(selectedRow),
        hostId: selectedRow.kind === "scope" ? runtimeEntityIdForEdge(selectedRow.edge) : undefined,
        location: selectedRow.kind === "scope" ? selectedRow.edge.location : undefined,
      })
    : undefined;

  const assignmentValue = (): ProviderScopeAssignmentValue | null => {
    if (!selectedRow || !selectedProviderService || selectedConflict) return null;
    if (selectedRow.kind === "service") {
      return createServiceScopeAssignment({
        providerSlug,
        providerServiceId: selectedProviderService.id,
        providerServiceName: selectedProviderService.name,
        serviceEntityId: selectedRow.service.id,
        serviceEntityName: selectedRow.service.name,
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
      `Remove the confirmed ${selectedAssignment.providerServiceName} mapping for ${selectedAssignment.serviceEntityName}?`,
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

  const openCreateSettings = () => {
    if (!selectedRow || !selectedProviderService) return;
    const scopeKind = selectedRow.kind === "scope" ? "host" : "service";
    const scopeEntityId = selectedRow.kind === "scope"
      ? runtimeEntityIdForEdge(selectedRow.edge)
      : selectedRow.service.id;
    const params = new URLSearchParams({
      providerServiceId: selectedProviderService.id,
      scopeKind,
      scopeEntityId,
    });
    void navigate(`/settings/sla-overrides?${params.toString()}`);
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
          <span className="scope-connector"><span aria-hidden="true" /><small>Smartscape</small></span>
          <span className={`scope-node scope-location${covered ? "" : " missing"}`}><span><small>{assignment ? "Confirmed" : row.sourceTag ? "Source tag" : row.problemCount > 0 ? `${row.problemCount} recent Problems` : row.candidate ? "Recommended" : "Needs review"}</small><strong>{assignment?.providerServiceName ?? (row.sourceTag ? "Provider-level terms" : row.candidate?.providerServiceName ?? "Select terms")}</strong></span></span>
        </button>
      );
    }

    return (
      <button type="button" role="option" aria-selected={selectedRowKey === row.key} className={`scope-map-row coverage-service-row${selectedRowKey === row.key ? " selected" : ""}`} key={row.key} onClick={() => setSelectedRowKey(row.key)}>
        <span className="scope-node"><ServicesIcon /><span><small>Service</small><strong>{row.service.name}</strong></span></span>
        <span className="scope-connector"><span aria-hidden="true" /><small>found in</small></span>
        <span className="scope-node coverage-source-node"><ServicesIcon /><span><small>Coverage source</small><strong>{row.sourceTag ? `${providerTagKey}:${providerSlug}` : row.conflicting ? "Different provider tag" : "Service inventory"}</strong></span></span>
        <span className="scope-connector"><span aria-hidden="true" /><small>No runtime</small></span>
        <span className={`scope-node scope-location${covered ? "" : " missing"}`}><span><small>{assignment ? "Confirmed" : row.sourceTag ? "Source tag" : row.conflicting ? "Review tag" : row.problemCount > 0 ? `${row.problemCount} recent Problems` : "Needs review"}</small><strong>{assignment?.providerServiceName ?? (row.sourceTag ? "Provider-level terms" : row.conflicting ? row.values.join(", ") : "Select terms")}</strong></span></span>
      </button>
    );
  };

  const renderGroup = (label: string, rows: CoverageRow[]) => rows.length > 0 ? (
    <React.Fragment key={label}>
      <div className="coverage-list-group" role="presentation"><strong>{label}</strong></div>
      {rows.map(renderRow)}
    </React.Fragment>
  ) : null;

  const stateTone: Tone = selectedAssignment || selectedSourceTag
    ? "positive"
    : selectedConflict || selectionMatchesCandidate
      ? "warning"
      : "neutral";
  const stateLabel = selectedAssignment
    ? "Confirmed mapping"
    : selectedSourceTag
      ? "Source tag"
      : selectedConflict
        ? "Different provider tag"
        : selectionMatchesCandidate
          ? "Recommended match"
          : "Needs review";
  const stateTitle = selectedAssignment
    ? `Applied terms: ${selectedAssignment.providerServiceName}`
    : selectedSourceTag
      ? `Matched by ${providerTagKey}:${providerSlug}`
      : selectedConflict
        ? "Source tag points to another provider"
        : selectionMatchesCandidate
          ? `Smartscape recommends: ${selectedProviderService?.name}`
          : selectedProviderService
            ? `Selected terms: ${selectedProviderService.name}`
            : "Choose the provider terms for this service";
  const stateDetail = selectedAssignment?.evidence
    ?? (selectedConflict && selectedRow?.kind === "service"
      ? `Detected tags: ${selectedRow.values.join(", ")}. Review the matching rule before assigning ${providerName}.`
      : selectedSourceTag
        ? "The source-owned tag confirms the provider. SLA Review does not change it."
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
    (!selectedSourceTag || selectedAssignment || selectedProviderService.id !== "*"),
  );

  return (
    <section className="scope-map-view setup-scope-map" aria-labelledby="service-coverage-title">
      <div className="scope-map-toolbar">
        <div className="scope-map-title"><ServicesIcon /><div><strong id="service-coverage-title">Service coverage</strong><span>Review Smartscape recommendations and services without runtime context in one place.</span></div></div>
        <div className="scope-map-toolbar-actions">
          <Button size="condensed" onClick={() => openApp("dynatrace.smartscape", "view/dynatrace.smartscape.smartscape-on-grail")}><Button.Prefix><SmartscapeIcon /></Button.Prefix>Open Smartscape</Button>
        </div>
      </div>
      <div className="scope-map-boundary"><strong>How it is used</strong><span>Confirmed mappings and matching source tags are reused in Incidents and Evidence. Saving a mapping changes only SLA Review. Smartscape suggestions do not establish provider fault, local impact, or credit eligibility.</span></div>
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
          <div className="scope-map-list" role="listbox" aria-label="Provider coverage worklist">
            {renderGroup("Needs review", reviewRows)}
            {renderGroup("Covered", coveredRows)}
          </div>
          <aside className="scope-detail" aria-label="Provider terms for selected service">
            <label className="field-label">{selectedRow?.kind === "scope" ? "Provider service for this scope" : "Terms for this service"}
              <select value={selectedProviderServiceId} onChange={(event) => { setSelectedProviderServiceId(event.target.value); setFeedback(undefined); }} disabled={selectedConflict}>
                {selectedRow?.kind === "service" ? <option value="*">Provider-level terms</option> : <option value="">Select a provider service</option>}
                {provider.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </label>
            {selectedRow ? (
              <>
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
                {effectiveTerms ? <TermsStrip terms={effectiveTerms} /> : null}
                <div className="scope-detail-actions">
                  {selectedConflict ? <Link className="text-action" to="/settings/watch">Review matching rules</Link> : null}
                  {showSaveAction ? <Button size="condensed" variant="emphasized" disabled={!scopeSettings.canWrite || scopeSettings.mutating} onClick={() => void saveAssignment()}>{scopeSettings.mutating ? "Saving" : selectedAssignment ? "Update mapping" : selectionMatchesCandidate ? `Confirm ${selectedProviderService?.name}` : selectedRow.kind === "service" && selectedProviderService?.id === "*" ? "Confirm provider coverage" : `Use ${selectedProviderService?.name}`}</Button> : null}
                  <Button size="condensed" disabled={!selectedProviderService || selectedConflict} onClick={openCreateSettings}>Add custom terms</Button>
                  {selectedAssignment ? <Button size="condensed" disabled={!scopeSettings.canWrite || scopeSettings.mutating} onClick={() => void removeAssignment()}>Remove mapping</Button> : null}
                </div>
                {feedback ? <div className={`scope-map-feedback scope-map-feedback-${feedback.tone}`} role={feedback.tone === "warning" ? "alert" : "status"}>{feedback.message}</div> : null}
              </>
            ) : null}
            <div className="coverage-detail-checks">
              <SetupAdvisor recommendations={recommendations} loading={recommendationsLoading} limitedContext={limitedContext} />
            </div>
          </aside>
        </div>
      )}
    </section>
  );
};
