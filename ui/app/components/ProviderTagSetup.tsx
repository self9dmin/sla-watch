import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@dynatrace/strato-components/buttons";
import type { ServiceRecord, SlaProviderResponse } from "../types";
import { providerTagValues } from "../data/providerTags";
import {
  createServiceScopeAssignment,
  createServiceScopeAssignmentKey,
  isServiceScopeAssignment,
} from "../data/providerScopeAssignments";
import type { ProviderScopeAssignmentsState } from "../hooks/useProviderScopeAssignments";

type ReviewStep = "summary" | "select";
type WriteFeedback = { tone: "positive" | "warning" | "neutral"; title: string; detail: string };

export const ProviderTagSetup = ({
  services,
  provider,
  providerSlug,
  providerTagKey,
  topologyServiceIds,
  loading,
  scopeSettings,
}: {
  services: ServiceRecord[];
  provider?: SlaProviderResponse;
  providerSlug: string;
  providerTagKey: string;
  topologyServiceIds: string[];
  loading: boolean;
  scopeSettings: ProviderScopeAssignmentsState;
}) => {
  const location = useLocation();
  const [step, setStep] = useState<ReviewStep>("summary");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedProviderServiceId, setSelectedProviderServiceId] = useState("*");
  const [feedback, setFeedback] = useState<WriteFeedback | null>(null);
  const providerName = provider?.provider.name ?? providerSlug;

  useEffect(() => {
    setStep("summary");
    setSelectedServiceId("");
    setSelectedProviderServiceId("*");
    setFeedback(null);
  }, [providerSlug, providerTagKey]);

  useEffect(() => {
    const review = new URLSearchParams(location.search).get("review");
    if ((review === "provider" || location.hash === "#provider-mapping" || location.hash === "#provider-service-tags") && services.length > 0) setStep("select");
  }, [location.hash, location.search, services.length]);

  const topologyIds = useMemo(() => new Set(topologyServiceIds), [topologyServiceIds]);
  const rows = useMemo(() => services
    .filter((service) => !topologyIds.has(service.id))
    .map((service) => {
      const values = providerTagValues(service.tags, providerTagKey, providerSlug);
      const sourceTag = values.includes(providerSlug.toLowerCase());
      const conflicting = values.length > 0 && !sourceTag;
      const assignmentKey = createServiceScopeAssignmentKey(providerSlug, service.id);
      const assignment = scopeSettings.assignments.find((item) =>
        item.enabled &&
        item.providerSlug === providerSlug &&
        item.assignmentKey === assignmentKey &&
        isServiceScopeAssignment(item),
      );
      return { service, values, sourceTag, conflicting, assignment };
    }), [providerSlug, providerTagKey, scopeSettings.assignments, services, topologyIds]);

  const selectedRow = rows.find((row) => row.service.id === selectedServiceId);
  const appMappedCount = rows.filter((row) => row.assignment).length;
  const sourceTagCount = rows.filter((row) => row.sourceTag).length;
  const coveredCount = rows.filter((row) => row.assignment || row.sourceTag).length;
  const canWrite = scopeSettings.canWrite && Boolean(provider);

  const saveCoverage = async () => {
    if (!selectedRow || !provider || !canWrite || scopeSettings.mutating) return;
    const providerService = selectedProviderServiceId === "*"
      ? { id: "*", name: "Provider-level terms" }
      : provider.services.find((service) => service.id === selectedProviderServiceId);
    if (!providerService) return;
    const value = createServiceScopeAssignment({
      providerSlug,
      providerServiceId: providerService.id,
      providerServiceName: providerService.name,
      serviceEntityId: selectedRow.service.id,
      serviceEntityName: selectedRow.service.name,
    });
    setFeedback(null);
    try {
      if (selectedRow.assignment) await scopeSettings.updateAssignment(selectedRow.assignment, value);
      else await scopeSettings.createAssignment(value);
      setFeedback({
        tone: "positive",
        title: "Coverage saved",
        detail: `${selectedRow.service.name} will be matched to ${providerName} in Incidents and Evidence.`,
      });
    } catch {
      setFeedback({
        tone: "warning",
        title: "Coverage could not be saved",
        detail: "Check App Settings write access and try again. The Dynatrace service was not changed.",
      });
    }
  };

  const removeCoverage = async () => {
    if (!selectedRow?.assignment || scopeSettings.mutating || !window.confirm(`Remove ${providerName} coverage for ${selectedRow.service.name}?`)) return;
    setFeedback(null);
    try {
      await scopeSettings.deleteAssignment(selectedRow.assignment);
      setFeedback({
        tone: "neutral",
        title: "Coverage removed",
        detail: `${selectedRow.service.name} is no longer assigned to ${providerName} by SLA Review.`,
      });
    } catch {
      setFeedback({
        tone: "warning",
        title: "Coverage could not be removed",
        detail: "Check App Settings write access and try again.",
      });
    }
  };

  return (
    <section className="provider-setup" id="provider-service-tags" aria-labelledby="provider-service-tags-title">
      <div className="setup-section-heading">
        <div>
          <h3 id="provider-service-tags-title">Manual coverage</h3>
          <p>Confirm services that Smartscape does not place in the scope map. The mapping stays in SLA Review.</p>
        </div>
        <span className={`status-pill ${coveredCount > 0 ? "status-pill-positive" : "status-pill-warning"}`}>
          {loading || scopeSettings.loading ? "Checking" : `${coveredCount} of ${rows.length} covered`}
        </span>
      </div>

      <dl className="provider-rule-summary">
        <div><dt>Other services</dt><dd>{rows.length}</dd></div>
        <div><dt>App mappings</dt><dd>{appMappedCount}</dd></div>
        <div><dt>Source tags</dt><dd>{sourceTagCount}</dd></div>
      </dl>

      {step === "summary" ? (
        <div className="provider-setup-actions">
          <Button size="condensed" variant="emphasized" disabled={loading || rows.length === 0} onClick={() => setStep("select")}>Review other services</Button>
          <Link className="text-action" to="/settings/watch">Review matching rules</Link>
          <span>This does not change service names, tags, telemetry, or cloud resources.</span>
        </div>
      ) : null}

      {step === "select" ? (
        <div className="provider-service-review">
          <div className="provider-service-toolbar">
            <strong>Select one service</strong>
            <span>{rows.length} outside Scope map</span>
          </div>
          <div className="provider-service-list" role="radiogroup" aria-label={`Services available for ${providerName} coverage`}>
            {rows.map(({ service, values, sourceTag, conflicting, assignment }) => {
              const selectable = !sourceTag && !conflicting;
              return (
                <label className={`provider-service-row${selectable ? "" : " provider-service-row-disabled"}`} key={service.id}>
                  <input type="radio" name="manual-coverage-service" checked={selectedServiceId === service.id} disabled={!selectable} onChange={() => {
                    setSelectedServiceId(service.id);
                    setSelectedProviderServiceId(assignment?.providerServiceId ?? "*");
                    setFeedback(null);
                  }} />
                  <span className="provider-service-name"><strong>{service.name}</strong><small>{service.id}</small></span>
                  <span className={`provider-service-state ${assignment || sourceTag ? "positive" : conflicting ? "warning" : "neutral"}`}>
                    <strong>{assignment ? "Covered in app" : sourceTag ? "Covered by source tag" : conflicting ? "Tag points elsewhere" : "Needs review"}</strong>
                    {assignment ? <small>{assignment.providerServiceName}</small> : conflicting ? <small>{values.join(", ")}</small> : null}
                  </span>
                </label>
              );
            })}
          </div>

          {selectedRow ? (
            <div className="provider-confirmation" role="region" aria-label="Confirm service coverage">
              <strong>{selectedRow.service.name}</strong>
              <label className="field-label">Terms to use
                <select value={selectedProviderServiceId} onChange={(event) => setSelectedProviderServiceId(event.target.value)} disabled={!canWrite || scopeSettings.mutating}>
                  <option value="*">Provider-level terms</option>
                  {provider?.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
              </label>
              <p>This records an operator-confirmed boundary for Incidents and Evidence. It does not modify the Dynatrace service or prove provider fault.</p>
              <div className="provider-review-actions">
                {selectedRow.assignment ? <Button size="condensed" disabled={!canWrite || scopeSettings.mutating} onClick={() => void removeCoverage()}>Remove coverage</Button> : null}
                <Button size="condensed" variant="emphasized" disabled={!canWrite || scopeSettings.mutating} onClick={() => void saveCoverage()}>{scopeSettings.mutating ? "Saving" : selectedRow.assignment ? "Update coverage" : "Confirm coverage"}</Button>
              </div>
            </div>
          ) : null}

          <div className="provider-review-actions">
            <Button size="condensed" onClick={() => { setStep("summary"); setSelectedServiceId(""); setFeedback(null); }}>Done</Button>
          </div>
        </div>
      ) : null}

      {scopeSettings.error ? (
        <div className="provider-write-message provider-write-message-warning" role="status">
          <div><strong>Coverage settings are unavailable</strong><span>Check App Settings read access. Existing source tags remain visible.</span></div>
        </div>
      ) : null}
      {feedback ? (
        <div className={`provider-write-message provider-write-message-${feedback.tone}`} role={feedback.tone === "warning" ? "alert" : "status"}>
          <div><strong>{feedback.title}</strong><span>{feedback.detail}</span></div>
        </div>
      ) : null}
      {!scopeSettings.loading && !scopeSettings.canWrite ? <div className="provider-write-message" role="status"><div><strong>Read-only</strong><span>App Settings write access is required to save manual coverage.</span></div></div> : null}
    </section>
  );
};
