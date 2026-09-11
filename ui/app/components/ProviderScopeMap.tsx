import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { openApp } from "@dynatrace-sdk/navigation";
import { Button } from "@dynatrace/strato-components/buttons";
import { HostsIcon, ServicesIcon, SmartscapeIcon } from "@dynatrace/strato-icons";
import type {
  ContractOverrideValue,
  EffectiveContractTerms,
  ProviderScopeAssignmentValue,
  SlaProviderResponse,
  SmartscapeScopeEdge,
} from "../types";
import { resolveEffectiveContractTerms } from "../data/contractOverrides";
import {
  createProviderScopeAssignmentKey,
  inferProviderServiceCandidate,
  runtimeEntityIdForEdge,
  serviceEntityIdForEdge,
} from "../data/providerScopeAssignments";
import { useContractOverrides } from "../hooks/useContractOverrides";
import type { ProviderScopeAssignmentsState } from "../hooks/useProviderScopeAssignments";

type Tone = "neutral" | "warning" | "positive";

type ProviderScopeMapProps = {
  provider?: SlaProviderResponse;
  topology: SmartscapeScopeEdge[];
  loading: boolean;
  error?: Error;
  scopeSettings: ProviderScopeAssignmentsState;
};

const StatusPill = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => <span className={`status-pill status-pill-${tone}`}>{children}</span>;
const formatPercent = (value: number | null | undefined): string => value === null || value === undefined ? "Not published" : `${value}%`;

const TermsStrip = ({ terms }: { terms: EffectiveContractTerms }) => (
  <dl className="effective-terms-strip">
    <div><dt>Availability</dt><dd>{formatPercent(terms.availabilityTarget)}</dd></div>
    <div><dt>Filing window</dt><dd>{terms.filingDeadlineDays === null ? "Not published" : `${terms.filingDeadlineDays} ${terms.businessDays ? "business" : "calendar"} days`}</dd></div>
    <div><dt>Maximum credit</dt><dd>{formatPercent(terms.maxCreditPercent)}</dd></div>
    <div><dt>Applied source</dt><dd className={terms.source === "tenant override" ? "source-tenant" : ""}>{terms.source === "tenant override" ? "Tenant override" : "sla.directory"}</dd></div>
  </dl>
);

export const ProviderScopeMap = ({ provider, topology, loading, error, scopeSettings }: ProviderScopeMapProps) => {
  const navigate = useNavigate();
  const contractSettings = useContractOverrides();
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const [selectedProviderServiceId, setSelectedProviderServiceId] = useState("");
  const [feedback, setFeedback] = useState<{ tone: Tone; message: string }>();
  const providerSlug = provider?.provider.slug ?? "";

  const providerAssignments = useMemo(() => scopeSettings.assignments.filter((assignment) => (
    assignment.enabled && assignment.providerSlug === providerSlug
  )), [providerSlug, scopeSettings.assignments]);

  const topologyRows = useMemo(() => {
    const seen = new Set<string>();
    return topology.filter((edge) => {
      const key = createProviderScopeAssignmentKey(providerSlug, serviceEntityIdForEdge(edge), runtimeEntityIdForEdge(edge));
      const belongsToProvider = edge.providerSlug === providerSlug || providerAssignments.some((assignment) => assignment.assignmentKey === key);
      if (!belongsToProvider || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 50);
  }, [providerAssignments, providerSlug, topology]);

  useEffect(() => {
    if (topologyRows.length === 0) {
      setSelectedEdgeKey(null);
      return;
    }
    const selectedExists = topologyRows.some((edge) => createProviderScopeAssignmentKey(
      providerSlug,
      serviceEntityIdForEdge(edge),
      runtimeEntityIdForEdge(edge),
    ) === selectedEdgeKey);
    if (!selectedExists) {
      const first = topologyRows[0];
      setSelectedEdgeKey(createProviderScopeAssignmentKey(providerSlug, serviceEntityIdForEdge(first), runtimeEntityIdForEdge(first)));
    }
  }, [providerSlug, selectedEdgeKey, topologyRows]);

  const selectedEdge = topologyRows.find((edge) => createProviderScopeAssignmentKey(
    providerSlug,
    serviceEntityIdForEdge(edge),
    runtimeEntityIdForEdge(edge),
  ) === selectedEdgeKey);
  const selectedAssignment = providerAssignments.find((assignment) => assignment.assignmentKey === selectedEdgeKey);
  const candidate = selectedEdge && provider ? inferProviderServiceCandidate(selectedEdge, provider) : null;

  useEffect(() => {
    setSelectedProviderServiceId(selectedAssignment?.providerServiceId ?? candidate?.providerServiceId ?? "");
    setFeedback(undefined);
  }, [candidate?.providerServiceId, selectedAssignment?.providerServiceId, selectedEdgeKey]);

  const providerOverrides = useMemo(() => provider
    ? contractSettings.overrides.filter((override) => override.providerSlug === provider.provider.slug)
    : [], [contractSettings.overrides, provider]);
  const selectedProviderService = provider?.services.find((service) => service.id === selectedProviderServiceId);
  const selectionMatchesCandidate = Boolean(candidate && selectedProviderService?.id === candidate.providerServiceId);
  const effectiveTerms = provider && selectedEdge && selectedProviderService
    ? resolveEffectiveContractTerms(provider, providerOverrides, {
        providerSlug,
        providerServiceId: selectedProviderService.id,
        serviceId: serviceEntityIdForEdge(selectedEdge),
        hostId: runtimeEntityIdForEdge(selectedEdge),
        location: selectedEdge.location,
      })
    : undefined;

  const assignmentValue = (): ProviderScopeAssignmentValue | null => {
    if (!selectedEdge || !selectedProviderService) return null;
    const serviceEntityId = serviceEntityIdForEdge(selectedEdge);
    const runtimeEntityId = runtimeEntityIdForEdge(selectedEdge);
    return {
      assignmentKey: createProviderScopeAssignmentKey(providerSlug, serviceEntityId, runtimeEntityId),
      providerSlug,
      providerServiceId: selectedProviderService.id,
      providerServiceName: selectedProviderService.name,
      serviceEntityId,
      serviceEntityName: selectedEdge.serviceName,
      runtimeEntityId,
      runtimeEntityName: selectedEdge.targetName,
      runtimeType: selectedEdge.targetType,
      location: selectedEdge.location ?? null,
      evidence: candidate?.providerServiceId === selectedProviderService.id
        ? `Operator confirmed ${candidate.evidence}.`
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
      setFeedback({ tone: "positive", message: `${value.providerServiceName} will be reused for incidents affecting this scope.` });
    } catch {
      setFeedback({ tone: "warning", message: "The mapping could not be saved. Check App Settings write access and try again." });
    }
  };

  const removeAssignment = async () => {
    if (!selectedAssignment || scopeSettings.mutating || !window.confirm(`Remove the confirmed ${selectedAssignment.providerServiceName} mapping for ${selectedAssignment.serviceEntityName}?`)) return;
    try {
      await scopeSettings.deleteAssignment(selectedAssignment);
      setFeedback({ tone: "neutral", message: "The confirmed mapping was removed. Smartscape may still show a candidate." });
    } catch {
      setFeedback({ tone: "warning", message: "The mapping could not be removed. Check App Settings write access and try again." });
    }
  };

  const openCreateSettings = () => {
    if (!selectedEdge || !selectedProviderService) return;
    const seed: ContractOverrideValue = {
      overrideKey: `${providerSlug}|${selectedProviderService.id}|host|${runtimeEntityIdForEdge(selectedEdge)}`,
      providerSlug,
      providerServiceId: selectedProviderService.id,
      providerServiceName: selectedProviderService.name,
      scopeKind: "host",
      scopeEntityId: runtimeEntityIdForEdge(selectedEdge),
      scopeEntityName: selectedEdge.targetName,
      scopeEntityIds: [runtimeEntityIdForEdge(selectedEdge)],
      scopeEntityNames: [selectedEdge.targetName],
      location: selectedEdge.location ?? null,
      availabilityTarget: null,
      filingDeadlineDays: null,
      deadlineBasis: null,
      businessDays: false,
      maxCreditPercent: null,
      claimMethod: null,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: null,
      sourceReference: "",
      sourceUrl: null,
      notes: null,
      enabled: true,
    };
    const params = new URLSearchParams({
      providerServiceId: seed.providerServiceId,
      scopeKind: seed.scopeKind,
      scopeEntityId: seed.scopeEntityId,
    });
    void navigate(`/settings/sla-overrides?${params.toString()}`);
  };

  const mappedCount = topologyRows.filter((edge) => providerAssignments.some((assignment) => assignment.assignmentKey === createProviderScopeAssignmentKey(
    providerSlug,
    serviceEntityIdForEdge(edge),
    runtimeEntityIdForEdge(edge),
  ))).length;

  return (
    <section className="scope-map-view setup-scope-map" aria-labelledby="scope-map-title">
      <div className="scope-map-toolbar">
        <div className="scope-map-title"><SmartscapeIcon /><div><strong id="scope-map-title">Service scope map</strong><span>Confirm which provider service applies to each Smartscape runtime relationship.</span></div></div>
        <div className="scope-map-toolbar-actions">
          <StatusPill tone={mappedCount === topologyRows.length && topologyRows.length > 0 ? "positive" : "neutral"}>{mappedCount} of {topologyRows.length} confirmed</StatusPill>
          <Button size="condensed" onClick={() => openApp("dynatrace.smartscape", "view/dynatrace.smartscape.smartscape-on-grail")}><Button.Prefix><SmartscapeIcon /></Button.Prefix>Open Smartscape</Button>
        </div>
      </div>
      <div className="scope-map-boundary"><strong>How it is used</strong><span>A confirmed mapping is reused in Incidents and Evidence. A Smartscape suggestion is a coverage aid only and does not establish provider fault, local impact, or credit eligibility.</span></div>
      {error ? <div className="error-box compact-error">Smartscape topology is unavailable. Check the storage:smartscape:read permission.</div> : null}
      {scopeSettings.error ? <div className="error-box compact-error">Confirmed scope mappings are unavailable. Check App Settings read access.</div> : null}
      {loading || scopeSettings.loading ? (
        <div className="directory-loading" role="status"><strong>Loading service topology</strong><span>Reading Smartscape relationships and confirmed mappings.</span></div>
      ) : !provider ? (
        <div className="contract-empty"><strong>Provider terms are unavailable</strong><span>Load the selected provider before confirming service mappings.</span></div>
      ) : topologyRows.length === 0 ? (
        <div className="contract-empty"><strong>No {provider.provider.name} runtime relationships returned</strong><span>Open Smartscape to verify that cloud runtime metadata is available for this tenant.</span></div>
      ) : (
        <div className="scope-map-layout">
          <div className="scope-map-list" role="listbox" aria-label="Smartscape service and runtime scopes">
            {topologyRows.map((edge) => {
              const key = createProviderScopeAssignmentKey(providerSlug, serviceEntityIdForEdge(edge), runtimeEntityIdForEdge(edge));
              const assignment = providerAssignments.find((item) => item.assignmentKey === key);
              const inferred = provider ? inferProviderServiceCandidate(edge, provider) : null;
              return (
                <button type="button" role="option" aria-selected={selectedEdgeKey === key} className={`scope-map-row${selectedEdgeKey === key ? " selected" : ""}`} key={key} onClick={() => setSelectedEdgeKey(key)}>
                  <span className="scope-node"><ServicesIcon /><span><small>Service</small><strong>{edge.serviceName}</strong></span></span>
                  <span className="scope-connector"><span aria-hidden="true" /><small>{edge.relationship === "belongs_to" ? "belongs to" : "runs on"}</small></span>
                  <span className="scope-node"><HostsIcon /><span><small>{edge.targetType.replaceAll("_", " ")}</small><strong>{edge.targetName}</strong></span></span>
                  <span className="scope-connector"><span aria-hidden="true" /><small>observed in</small></span>
                  <span className={`scope-node scope-location${edge.location ? "" : " missing"}`}><span><small>{assignment ? "Confirmed" : inferred ? "Candidate" : "Location"}</small><strong>{assignment?.providerServiceName ?? inferred?.providerServiceName ?? edge.location ?? "Not exposed"}</strong></span></span>
                </button>
              );
            })}
          </div>
          <aside className="scope-detail" aria-label="Provider service mapping for selected scope">
            <label className="field-label">Provider service for this scope
              <select value={selectedProviderServiceId} onChange={(event) => { setSelectedProviderServiceId(event.target.value); setFeedback(undefined); }}>
                <option value="">Select a provider service</option>
                {provider.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </label>
            {selectedEdge ? (
              <>
                <div className="scope-mapping-state">
                  <StatusPill tone={selectedAssignment ? "positive" : selectionMatchesCandidate ? "warning" : "neutral"}>{selectedAssignment ? "Confirmed mapping" : selectionMatchesCandidate ? "Recommended match" : selectedProviderService ? "Manual selection" : "Needs review"}</StatusPill>
                  {selectedProviderService ? <strong>{selectedAssignment ? "Applied provider service" : selectionMatchesCandidate ? "Smartscape recommends" : "Selected provider service"}: {selectedProviderService.name}</strong> : null}
                  <span>{selectedAssignment?.evidence ?? (selectionMatchesCandidate ? candidate?.evidence : candidate && selectedProviderService ? `This differs from the Smartscape recommendation of ${candidate.providerServiceName}. Verify the scope before confirming.` : "Smartscape identified the provider boundary but not a specific provider service.")}</span>
                </div>
                <div className="scope-selection"><span>Selected Dynatrace scope</span><strong>{selectedEdge.serviceName} → {selectedEdge.targetName}</strong><small>{selectedEdge.location ?? "No location field returned"}</small></div>
                {effectiveTerms ? <TermsStrip terms={effectiveTerms} /> : null}
                <div className="scope-detail-actions">
                  <Button size="condensed" variant="emphasized" disabled={!scopeSettings.canWrite || scopeSettings.mutating || !selectedProviderService} onClick={() => void saveAssignment()}>{scopeSettings.mutating ? "Saving" : selectedAssignment ? "Update confirmed mapping" : selectionMatchesCandidate ? `Confirm ${selectedProviderService?.name}` : "Confirm selected service"}</Button>
                  <Button size="condensed" disabled={!selectedProviderService} onClick={openCreateSettings}>Add custom terms</Button>
                  {selectedAssignment ? <Button size="condensed" disabled={!scopeSettings.canWrite || scopeSettings.mutating} onClick={() => void removeAssignment()}>Remove mapping</Button> : null}
                </div>
                {feedback ? <div className={`scope-map-feedback scope-map-feedback-${feedback.tone}`} role={feedback.tone === "warning" ? "alert" : "status"}>{feedback.message}</div> : null}
              </>
            ) : null}
          </aside>
        </div>
      )}
    </section>
  );
};
