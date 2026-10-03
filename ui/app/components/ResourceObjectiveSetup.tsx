import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { openApp } from "@dynatrace-sdk/navigation";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import { resolveEffectiveContractTerms } from "../data/contractOverrides";
import type { ProviderCoverageModel } from "../data/providerCoverage";
import {
  createResourceAvailabilityPreviewQuery,
  createResourceAvailabilitySliQuery,
  createResourceObjectiveConfig,
  createResourceObjectiveExternalId,
  parseResourceAvailabilityPreview,
  resourceObjectiveCandidates,
  RESOURCE_OBJECTIVE_MAX_SERVICES,
} from "../data/resourceObjectives";
import { createServiceObjectiveExternalId } from "../data/serviceObjectives";
import { useContractOverrides } from "../hooks/useContractOverrides";
import { useServiceObjectives } from "../hooks/useServiceObjectives";
import type { ServiceRecord, SlaProviderResponse } from "../types";

type Props = {
  provider?: SlaProviderResponse;
  providerSlug: string;
  coverageModel: ProviderCoverageModel;
  services: ServiceRecord[];
  coverageLoading: boolean;
  coverageComplete: boolean;
};

const percent = (value: number | null): string =>
  value === null ? "Unavailable" : `${value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;

export const ResourceObjectiveSetup = ({
  provider,
  providerSlug,
  coverageModel,
  services,
  coverageLoading,
  coverageComplete,
}: Props) => {
  const location = useLocation();
  const candidates = useMemo(
    () => resourceObjectiveCandidates(coverageModel, services, provider),
    [coverageModel, services, provider],
  );
  const focusedService = new URLSearchParams(location.search).get("service");
  const [selectedScope, setSelectedScope] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const selected = candidates.find((item) => item.scopeId === selectedScope) ??
    candidates.find((item) => focusedService && item.serviceIds.includes(focusedService)) ?? candidates[0];
  const contract = useContractOverrides();
  const objectives = useServiceObjectives({ enabled: Boolean(provider), managedOnly: false, pageSize: 50 });
  const terms = provider && selected ? selected.members.map((member) =>
    resolveEffectiveContractTerms(provider, contract.overrides, {
      providerSlug,
      providerServiceId: selected.providerServiceId,
      serviceId: member.serviceId,
      hostId: member.resourceId,
      location: member.location,
    })) : [];
  const firstTerms = terms[0];
  const sameTerms = Boolean(firstTerms && firstTerms.availabilityTarget !== null &&
    terms.every((item) => item.availabilityTarget === firstTerms.availabilityTarget &&
      item.appliedOverrides.map((entry) => entry.overrideKey).sort().join("|") ===
      firstTerms.appliedOverrides.map((entry) => entry.overrideKey).sort().join("|")));
  const externalId = selected
    ? createResourceObjectiveExternalId(providerSlug, selected.providerServiceId, selected.accountId, selected.region)
    : null;
  const existing = objectives.objectives.find((item) => item.externalId === externalId);
  const scopeTag = externalId?.split("-").at(-1);
  const otherScopeObjectives = scopeTag ? objectives.objectives.filter((item) =>
    item.id !== existing?.id && item.tags?.includes(`scope:${scopeTag}`)) : [];
  const legacyObjectives = selected ? objectives.objectives.filter((item) =>
    item.id !== existing?.id && selected.serviceIds.some((id) =>
      item.externalId === createServiceObjectiveExternalId(providerSlug, id) ||
      item.customSli?.indicator.includes(id))) : [];
  const inventoryComplete = !objectives.loading && !objectives.error && objectives.canRead === true &&
    objectives.totalCount <= objectives.objectives.length;
  const previewQuery = selected ? createResourceAvailabilityPreviewQuery(selected.serviceIds) : null;
  const previewResult = useDql<Record<string, unknown>>(
    { query: previewQuery ?? "data record(noop = true) | limit 0" },
    { enabled: Boolean(previewQuery) && coverageComplete && inventoryComplete && !existing },
  );
  const preview = parseResourceAvailabilityPreview(previewResult.data?.records);
  const definition = provider && selected && sameTerms && firstTerms?.availabilityTarget !== null
    ? createResourceObjectiveConfig({
      providerSlug,
      providerName: provider.provider.name,
      candidate: selected,
      target: firstTerms.availabilityTarget,
    }) : null;
  const sameMembers = existing && selected
    ? selected.serviceIds.every((id) => existing.customSli?.indicator.includes(id)) &&
      (existing.customSli?.indicator.match(/SERVICE-[A-F0-9]+/g)?.length ?? 0) === selected.serviceIds.length
    : true;
  const canCreate = Boolean(definition && coverageComplete && inventoryComplete && objectives.canWrite === true &&
    !contract.loading && !contract.error && !existing && legacyObjectives.length === 0 &&
    otherScopeObjectives.length === 0 && previewQuery && !previewResult.isLoading &&
    !previewResult.error && preview.observedServices === selected?.serviceIds.length &&
    selected.serviceIds.length <= RESOURCE_OBJECTIVE_MAX_SERVICES);

  useEffect(() => {
    setSelectedScope("");
    setConfirming(false);
    setFeedback(undefined);
  }, [providerSlug]);

  const create = async () => {
    if (!canCreate || !definition || objectives.creating) return;
    setFeedback(undefined);
    try {
      await objectives.createObjective(definition);
      setConfirming(false);
      setFeedback("One customer-observed objective was created for this provider product scope.");
    } catch {
      setFeedback("The objective was not created. Refresh the objective inventory and check access.");
      await objectives.refresh();
    }
  };

  return (
    <section className="finops-setup-section" aria-labelledby="finops-objective-heading">
      <div className="finops-section-heading">
        <h4 id="finops-objective-heading">Product scope objective</h4>
        <span className="status-pill status-pill-neutral">SLO</span>
      </div>
      <p>One screening objective covers the monitored resources for one provider product, account, and region. Linked Dynatrace services supply customer telemetry. This is not a provider claim or a contract-period credit calculation.</p>
      {coverageLoading ? <p role="status">Checking exact resource relationships…</p> : candidates.length === 0 ? (
        <div className="finops-setup-empty">
          <strong>No exact provider product scope is ready.</strong>
          <span>Confirm the provider product, account, region, and service relationships in Coverage. A direct service fallback alone cannot create a product objective.</span>
          <Button as={Link} to={`/?provider=${encodeURIComponent(providerSlug)}`} size="condensed">Review Coverage</Button>
        </div>
      ) : (
        <>
          <label className="field-label" htmlFor="finops-objective-resource">Provider product scope
            <select id="finops-objective-resource" value={selected?.scopeId ?? ""}
              onChange={(event) => { setSelectedScope(event.target.value); setConfirming(false); setFeedback(undefined); }}>
              {candidates.map((candidate) => (
                <option key={candidate.scopeId} value={candidate.scopeId}>
                  {candidate.providerServiceName} · {candidate.region} · account …{candidate.accountId.slice(-4)} · {candidate.resourceIds.length} resource{candidate.resourceIds.length === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <div className="finops-objective-facts">
              <div><span>Coverage basis</span><strong>{selected.basis === "confirmed" ? "Confirmed match" : "Observed provider topology"}</strong></div>
              <div><span>Product resources</span><strong>{selected.resourceIds.length}</strong></div>
              <div><span>Customer services</span><strong>{selected.serviceIds.length}</strong></div>
              <div><span>Traffic evidence</span><strong>{previewResult.isLoading ? "Checking" : `${preview.observedServices}/${selected.serviceIds.length} services`}</strong></div>
              <div><span>Common target</span><strong>{sameTerms ? percent(firstTerms?.availabilityTarget ?? null) : "Needs review"}</strong></div>
              <div><span>Cloud scope</span><strong>Account …{selected.accountId.slice(-4)} · {selected.region}</strong></div>
            </div>
          ) : null}
          {selected ? <p className="finops-resource-members">Linked resources: {selected.resourceNames.join(", ")}. Services: {selected.serviceNames.join(", ")}.</p> : null}
          {preview.totalRequests > 0 ? (
            <p className="finops-resource-members">Customer-observed request availability: {percent(preview.reliability)} across {preview.totalRequests.toLocaleString()} requests in the last 30 days.</p>
          ) : null}
          {existing ? (
            <div className="finops-setup-empty">
              <strong>Product scope objective exists.</strong>
              <span>{sameMembers ? "Its service list matches current Coverage." : "The linked service list changed. Review this objective in Dynatrace before using it."}</span>
              <Button size="condensed" onClick={() => openApp("dynatrace.service.level.objectives")}>Open in SLOs</Button>
            </div>
          ) : null}
          {legacyObjectives.length > 0 ? <p className="finops-setup-warning" role="status">{legacyObjectives.length} existing objective{legacyObjectives.length === 1 ? "" : "s"} overlap a linked service: {legacyObjectives.map((item) => `${item.name} (${percent(item.criteria[0]?.target ?? null)})`).join(", ")}. Reconcile them before creating a product objective. No duplicate will be created.</p> : null}
          {otherScopeObjectives.length > 0 ? <p className="finops-setup-warning" role="status">Another objective already uses this account and region scope. Review its product mapping before creating a new one.</p> : null}
          {!coverageLoading && !coverageComplete ? <p className="finops-setup-warning">The service or Smartscape relationship inventory is incomplete or unavailable. Objective creation is disabled until the full scope can be checked.</p> : null}
          {!sameTerms && selected ? <p className="finops-setup-warning">Linked services do not share one verified target and terms scope. Review the contract mapping first.</p> : null}
          {selected && selected.serviceIds.length > RESOURCE_OBJECTIVE_MAX_SERVICES ? <p className="finops-setup-warning">This resource has more than {RESOURCE_OBJECTIVE_MAX_SERVICES} linked services. Review its measurement recipe before creating an objective.</p> : null}
          {previewResult.error ? <p className="finops-setup-warning">The scoped Grail preview failed. Objective creation is disabled.</p> : null}
          {selected && inventoryComplete && !previewResult.isLoading && previewQuery && preview.observedServices < selected.serviceIds.length
            ? <p className="finops-setup-warning">At least one linked service has no valid request telemetry in the 30-day preview. Creation is disabled.</p> : null}
          {contract.error ? <p className="finops-setup-warning">Custom terms could not be checked. Creation is disabled.</p> : null}
          {objectives.error || !inventoryComplete && !objectives.loading ? <p className="finops-setup-warning">The managed objective inventory is incomplete. Creation is disabled to prevent duplicates.</p> : null}
          {objectives.canWrite === false ? <p className="finops-setup-warning">Objective write access is required to create one.</p> : null}
          {selected && createResourceAvailabilitySliQuery(selected.serviceIds) ? (
            <details className="service-objective-query">
              <summary>View product scope query</summary>
              <pre>{definition?.customSli?.indicator ?? createResourceAvailabilitySliQuery(selected.serviceIds)}</pre>
            </details>
          ) : null}
          {!existing && legacyObjectives.length === 0 && otherScopeObjectives.length === 0 ? (
            <div className="service-objective-actions">
              {confirming ? (
                <>
                  <span>Create one customer-observed objective for this product scope and its {selected?.resourceIds.length} resources and {selected?.serviceIds.length} linked service{selected?.serviceIds.length === 1 ? "" : "s"}?</span>
                  <Button size="condensed" onClick={() => setConfirming(false)}>Cancel</Button>
                  <Button size="condensed" variant="emphasized" disabled={!canCreate || objectives.creating}
                    onClick={() => void create()}>{objectives.creating ? "Creating" : "Create objective"}</Button>
                </>
              ) : (
                <Button size="condensed" variant="emphasized" disabled={!canCreate}
                  onClick={() => setConfirming(true)}>Create product scope objective</Button>
              )}
            </div>
          ) : null}
          {feedback ? <p className="finops-workflow-feedback" role="status">{feedback}</p> : null}
        </>
      )}
    </section>
  );
};
