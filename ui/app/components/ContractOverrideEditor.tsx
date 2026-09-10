import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@dynatrace/strato-components/buttons";
import { Modal } from "@dynatrace/strato-components/overlays";
import type {
  ContractOverrideRecord,
  ContractOverrideValue,
  ContractScopeKind,
  ServiceRecord,
  SlaProviderResponse,
  SmartscapeScopeEdge,
} from "../types";
import {
  createOverrideKey,
  getOverrideScopeIds,
  getOverrideScopeNames,
  sameOverrideIdentity,
  validateContractOverride,
} from "../data/contractOverrides";
import { uniqueLocations, uniqueRuntimeTargets } from "../data/topology";

type ScopeTarget = { id: string; name: string; location?: string; type?: string; unavailable?: boolean };

type ContractOverrideEditorProps = {
  show?: boolean;
  presentation?: "modal" | "page";
  provider: SlaProviderResponse;
  services: ServiceRecord[];
  topology: SmartscapeScopeEdge[];
  overrides: ContractOverrideRecord[];
  existing?: ContractOverrideRecord;
  initialValue?: ContractOverrideValue;
  canWrite: boolean;
  saving: boolean;
  onDismiss: () => void;
  onSave: (value: ContractOverrideValue, existing?: ContractOverrideRecord) => Promise<void>;
  onDelete: (record: ContractOverrideRecord) => Promise<void>;
};

const today = (): string => new Date().toISOString().slice(0, 10);
const numberOrNull = (value: string): number | null => value.trim() === "" ? null : Number(value);

const createDraft = (provider: SlaProviderResponse, existing?: ContractOverrideRecord, initialValue?: ContractOverrideValue): ContractOverrideValue => existing ?? initialValue ?? {
  overrideKey: `${provider.provider.slug}|*|provider|*`,
  providerSlug: provider.provider.slug,
  providerServiceId: "*",
  providerServiceName: "All provider services",
  scopeKind: "provider",
  scopeEntityId: "*",
  scopeEntityName: `${provider.provider.name} default`,
  scopeEntityIds: ["*"],
  scopeEntityNames: [`${provider.provider.name} default`],
  location: null,
  availabilityTarget: null,
  filingDeadlineDays: null,
  deadlineBasis: null,
  businessDays: false,
  maxCreditPercent: null,
  claimMethod: null,
  effectiveFrom: today(),
  effectiveTo: null,
  sourceReference: "",
  sourceUrl: null,
  notes: null,
  enabled: true,
};

const termsSummary = (value: ContractOverrideValue): string => {
  const terms = [
    value.availabilityTarget !== null && value.availabilityTarget !== undefined ? `${value.availabilityTarget}% availability` : null,
    value.filingDeadlineDays !== null && value.filingDeadlineDays !== undefined ? `${value.filingDeadlineDays}-day filing window` : null,
    value.maxCreditPercent !== null && value.maxCreditPercent !== undefined ? `${value.maxCreditPercent}% maximum credit` : null,
    value.claimMethod?.trim() ? `claim via ${value.claimMethod.trim()}` : null,
  ].filter((item): item is string => Boolean(item));
  return terms.length > 0 ? terms.join(" · ") : "No custom operational term entered";
};

const scopeSummary = (value: ContractOverrideValue): string => {
  if (value.scopeKind === "provider") return value.scopeEntityName;
  const names = getOverrideScopeNames(value);
  if (names.length <= 1) return names[0] ?? "No evidence target";
  return `${names[0]} and ${names.length - 1} more`;
};

export const ContractOverrideEditor = ({
  show = true,
  presentation = "modal",
  provider,
  services,
  topology,
  overrides,
  existing,
  initialValue,
  canWrite,
  saving,
  onDismiss,
  onSave,
  onDelete,
}: ContractOverrideEditorProps) => {
  const [draft, setDraft] = useState<ContractOverrideValue>(() => createDraft(provider, existing, initialValue));
  const [errors, setErrors] = useState<string[]>([]);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scopeFilter, setScopeFilter] = useState("");

  useEffect(() => {
    if (!show) return;
    setDraft(createDraft(provider, existing, initialValue));
    setErrors([]);
    setRequestError(null);
    setConfirmDelete(false);
    setScopeFilter("");
  }, [existing, initialValue, provider, show]);

  const runtimeTargets = useMemo<ScopeTarget[]>(() => uniqueRuntimeTargets(topology).map((edge) => ({
    id: edge.targetClassicId ?? edge.targetNodeId,
    name: edge.targetName,
    location: edge.location,
    type: edge.targetType.replaceAll("_", " "),
  })), [topology]);
  const locationTargets = useMemo<ScopeTarget[]>(() => uniqueLocations(topology).map((location) => ({ id: location, name: location })), [topology]);
  const serviceTargets = useMemo<ScopeTarget[]>(() => services.map((service) => ({ id: service.id, name: service.name, type: "Service" })), [services]);

  const availableScopeTargets = draft.scopeKind === "service"
    ? serviceTargets
    : draft.scopeKind === "host"
      ? runtimeTargets
      : draft.scopeKind === "location"
        ? locationTargets
        : [];
  const selectedScopeIds = getOverrideScopeIds(draft).filter((id) => id !== "*");
  const selectedScopeNames = getOverrideScopeNames(draft);
  const scopeTargets = [...availableScopeTargets];
  const knownScopeIds = new Set(scopeTargets.map((target) => target.id));
  selectedScopeIds.forEach((id, index) => {
    if (!knownScopeIds.has(id)) scopeTargets.push({ id, name: selectedScopeNames[index] ?? id, type: "Saved target", unavailable: true });
  });
  const normalizedFilter = scopeFilter.trim().toLowerCase();
  const visibleScopeTargets = scopeTargets.filter((target) => !normalizedFilter || [target.name, target.id, target.location, target.type].some((value) => value?.toLowerCase().includes(normalizedFilter)));
  const allVisibleSelected = visibleScopeTargets.length > 0 && visibleScopeTargets.every((target) => selectedScopeIds.includes(target.id));

  const selectedPublishedService = provider.services.find((service) => service.id === draft.providerServiceId);
  const publishedTarget = selectedPublishedService?.uptime ?? provider.provider.uptime;

  const patchDraft = (patch: Partial<ContractOverrideValue>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors([]);
    setRequestError(null);
  };

  const selectProviderService = (providerServiceId: string) => {
    const service = provider.services.find((item) => item.id === providerServiceId);
    patchDraft({
      providerServiceId,
      providerServiceName: service?.name ?? "All provider services",
    });
  };

  const selectScopeKind = (scopeKind: ContractScopeKind) => {
    setScopeFilter("");
    if (scopeKind === "provider") {
      patchDraft({
        scopeKind,
        scopeEntityId: "*",
        scopeEntityName: `${provider.provider.name} default`,
        scopeEntityIds: ["*"],
        scopeEntityNames: [`${provider.provider.name} default`],
        location: null,
      });
      return;
    }
    patchDraft({
      scopeKind,
      scopeEntityId: "",
      scopeEntityName: "",
      scopeEntityIds: [],
      scopeEntityNames: [],
      location: null,
    });
  };

  const setScopeTargets = (scopeEntityIds: string[]) => {
    const uniqueIds = [...new Set(scopeEntityIds)].slice(0, 100);
    const currentNames = new Map(selectedScopeIds.map((id, index) => [id, selectedScopeNames[index] ?? id]));
    const selectedTargets = uniqueIds.map((id) => scopeTargets.find((item) => item.id === id));
    const scopeEntityNames = uniqueIds.map((id, index) => selectedTargets[index]?.name ?? currentNames.get(id) ?? id);
    const first = selectedTargets[0];
    patchDraft({
      scopeEntityId: uniqueIds[0] ?? "",
      scopeEntityName: scopeEntityNames[0] ?? "",
      scopeEntityIds: uniqueIds,
      scopeEntityNames,
      location: first?.location ?? (draft.scopeKind === "location" ? uniqueIds[0] ?? null : null),
    });
  };

  const toggleScopeTarget = (scopeEntityId: string) => {
    setScopeTargets(selectedScopeIds.includes(scopeEntityId)
      ? selectedScopeIds.filter((id) => id !== scopeEntityId)
      : [...selectedScopeIds, scopeEntityId]);
  };

  const toggleVisibleScopeTargets = () => {
    const visibleIds = new Set(visibleScopeTargets.map((target) => target.id));
    setScopeTargets(allVisibleSelected
      ? selectedScopeIds.filter((id) => !visibleIds.has(id))
      : [...selectedScopeIds, ...visibleScopeTargets.map((target) => target.id)]);
  };

  const save = async () => {
    const next = { ...draft, overrideKey: createOverrideKey(draft) };
    const validationErrors = validateContractOverride(next);
    const duplicate = overrides.find((item) => sameOverrideIdentity(item, next) && item.objectId !== existing?.objectId);
    if (duplicate) validationErrors.push("An override already exists for this provider service and scope. Edit that record instead.");
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    try {
      await onSave(next, existing);
      onDismiss();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Dynatrace did not save the override. Refresh and try again.");
    }
  };

  const remove = async () => {
    if (!existing) return;
    try {
      await onDelete(existing);
      onDismiss();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Dynatrace did not remove the override. Refresh and try again.");
    }
  };

  const footer = confirmDelete ? (
    <div className="contract-editor-footer contract-editor-footer-danger">
      <span>This removes the tenant SLA override. The public directory baseline remains available.</span>
      <div>
        <Button disabled={saving} onClick={() => setConfirmDelete(false)}>Keep override</Button>
        <Button className="danger-action" variant="emphasized" disabled={saving} onClick={() => void remove()}>{saving ? "Removing" : "Remove SLA override"}</Button>
      </div>
    </div>
  ) : (
    <div className="contract-editor-footer">
      <div>{existing ? <Button className="danger-text-action" disabled={!canWrite || saving} onClick={() => setConfirmDelete(true)}>Remove</Button> : null}</div>
      <div>
        <Button disabled={saving} onClick={onDismiss}>Cancel</Button>
        <Button variant="emphasized" disabled={!canWrite || saving} onClick={() => void save()}>{saving ? "Saving" : existing ? "Save changes" : "Add SLA override"}</Button>
      </div>
    </div>
  );

  const editorBody = confirmDelete ? (
        <div className="contract-delete-confirmation">
          <strong>Remove {draft.providerServiceName} for {scopeSummary(draft)}?</strong>
          <p>The app will fall back to the next matching tenant SLA override, then to the public sla.directory record.</p>
          {requestError ? <div className="error-box compact-error" role="alert">{requestError}</div> : null}
        </div>
      ) : (
        <form className="contract-editor" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="contract-source-boundary">
            <div><span>Public baseline</span><strong>{publishedTarget === null || publishedTarget === undefined ? "No availability target" : `${publishedTarget}% availability`}</strong></div>
            <p>The public record is retained for comparison. This tenant SLA override is applied only to the explicit scope and effective dates below.</p>
          </div>

          <div className="contract-form-grid">
            <label className="field-label">
              Provider service
              <select value={draft.providerServiceId} onChange={(event) => selectProviderService(event.target.value)}>
                <option value="*">All provider services</option>
                {provider.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
              <small>Choose a directory service when the custom term is service-specific.</small>
            </label>
            <label className="field-label">
              Evidence boundary
              <select value={draft.scopeKind} onChange={(event) => selectScopeKind(event.target.value as ContractScopeKind)}>
                <option value="provider">Provider-wide fallback</option>
                <option value="service">Selected Dynatrace services</option>
                <option value="host">Selected hosts or runtimes</option>
                <option value="location">Cloud region or datacenter</option>
              </select>
              <small>Choose where this SLA may be applied. More specific boundaries take precedence.</small>
            </label>
          </div>

          {draft.scopeKind !== "provider" ? (
            <section className="contract-scope-picker" aria-labelledby="evidence-target-heading">
              <div className="contract-scope-picker-heading">
                <div>
                  <strong id="evidence-target-heading">{draft.scopeKind === "service" ? "Dynatrace services" : draft.scopeKind === "host" ? "Hosts and runtimes" : "Observed locations"}</strong>
                  <span>{selectedScopeIds.length} selected</span>
                </div>
                <div>
                  {scopeTargets.length > 6 ? <input aria-label="Filter evidence targets" type="search" value={scopeFilter} placeholder="Filter targets" onChange={(event) => setScopeFilter(event.target.value)} /> : null}
                  {visibleScopeTargets.length > 0 ? <Button size="condensed" onClick={toggleVisibleScopeTargets}>{allVisibleSelected ? "Clear visible" : "Select visible"}</Button> : null}
                </div>
              </div>
              <div className="contract-scope-options" role="group" aria-label="Dynatrace evidence targets">
                {visibleScopeTargets.length === 0 ? <div className="contract-scope-empty">{scopeTargets.length === 0 ? "No matching Dynatrace scope was returned." : "No targets match this filter."}</div> : null}
                {visibleScopeTargets.map((target) => (
                  <label className={`contract-scope-option${selectedScopeIds.includes(target.id) ? " selected" : ""}${target.unavailable ? " unavailable" : ""}`} key={target.id}>
                    <input type="checkbox" checked={selectedScopeIds.includes(target.id)} onChange={() => toggleScopeTarget(target.id)} />
                    <span><strong>{target.name}</strong><small>{[target.type, target.location && target.location !== target.name ? target.location : null, target.id].filter(Boolean).join(" · ")}</small></span>
                  </label>
                ))}
              </div>
              <div className="contract-evidence-boundary">
                <div><span>Evidence assignment</span><strong>{selectedScopeIds.length === 0 ? "No target selected" : `${selectedScopeIds.length} exact ${selectedScopeIds.length === 1 ? "target" : "targets"}`}</strong></div>
                <p>When a Problem includes a selected service, or Smartscape links an affected service to a selected host, runtime, or location, this SLA becomes applicable. The assignment does not determine provider fault.</p>
              </div>
            </section>
          ) : (
            <div className="contract-evidence-boundary contract-evidence-boundary-provider">
              <div><span>Evidence assignment</span><strong>Provider-wide fallback</strong></div>
              <p>This SLA is not tied to a specific Dynatrace entity. It applies only after more specific host, location, and service assignments are considered.</p>
            </div>
          )}

          <fieldset className="contract-fieldset">
            <legend>Operational terms</legend>
            <div className="contract-form-grid contract-terms-grid">
              <label className="field-label">Availability target (%)<input type="number" min="0" max="100" step="0.001" value={draft.availabilityTarget ?? ""} placeholder={publishedTarget?.toString() ?? "Not published"} onChange={(event) => patchDraft({ availabilityTarget: numberOrNull(event.target.value) })} /></label>
              <label className="field-label">Maximum credit (%)<input type="number" min="0" max="100" step="0.01" value={draft.maxCreditPercent ?? ""} placeholder={provider.provider.maxCreditPercent?.toString() ?? "Not published"} onChange={(event) => patchDraft({ maxCreditPercent: numberOrNull(event.target.value) })} /></label>
              <label className="field-label">Filing deadline (days)<input type="number" min="0" max="365" step="1" value={draft.filingDeadlineDays ?? ""} placeholder={provider.provider.claimProcess?.deadlineDays?.toString() ?? "Not published"} onChange={(event) => patchDraft({ filingDeadlineDays: numberOrNull(event.target.value) })} /></label>
              <label className="field-label">Deadline basis<input type="text" value={draft.deadlineBasis ?? ""} placeholder="Incident end, billing cycle, provider-defined" onChange={(event) => patchDraft({ deadlineBasis: event.target.value || null })} /></label>
              <label className="field-label contract-checkbox"><input type="checkbox" checked={draft.businessDays} onChange={(event) => patchDraft({ businessDays: event.target.checked })} /> Count the filing window in business days</label>
              <label className="field-label">Claim method<input type="text" value={draft.claimMethod ?? ""} placeholder="Support case, account team, portal" onChange={(event) => patchDraft({ claimMethod: event.target.value || null })} /></label>
            </div>
          </fieldset>

          <fieldset className="contract-fieldset">
            <legend>Validity and source</legend>
            <div className="contract-form-grid">
              <label className="field-label">Effective from<input type="date" value={draft.effectiveFrom} onChange={(event) => patchDraft({ effectiveFrom: event.target.value })} /></label>
              <label className="field-label">Effective to (optional)<input type="date" value={draft.effectiveTo ?? ""} onChange={(event) => patchDraft({ effectiveTo: event.target.value || null })} /></label>
              <label className="field-label">Contract or amendment reference<input type="text" value={draft.sourceReference} placeholder="Enterprise agreement 2026, section 4.2" onChange={(event) => patchDraft({ sourceReference: event.target.value })} /><small>Use a concise, verifiable reference. Do not paste contract text.</small></label>
              <label className="field-label">Source URL (optional)<input type="url" value={draft.sourceUrl ?? ""} placeholder="https://internal.example/contract" onChange={(event) => patchDraft({ sourceUrl: event.target.value || null })} /></label>
            </div>
            <label className="field-label contract-note-field">Operational note (optional)<textarea rows={2} value={draft.notes ?? ""} placeholder="Information an on-call engineer needs to apply this term" onChange={(event) => patchDraft({ notes: event.target.value || null })} /></label>
            <label className="field-label contract-checkbox"><input type="checkbox" checked={draft.enabled} onChange={(event) => patchDraft({ enabled: event.target.checked })} /> Apply this override when it is in its effective date range</label>
          </fieldset>

          <div className="contract-preview"><span>Effective change</span><strong>{termsSummary(draft)}</strong><small>All authenticated SLA Watch users can read this shared setting. Do not store confidential text, credentials, or personal data.</small></div>
          {errors.length > 0 ? <div className="error-box compact-error" role="alert"><strong>Review the SLA override</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
          {requestError ? <div className="error-box compact-error" role="alert">{requestError}</div> : null}
        </form>
      );

  if (presentation === "page") {
    return <section className="contract-editor-page" aria-label={existing ? "Edit SLA override" : "Add SLA override"}>{editorBody}{footer}</section>;
  }

  return (
    <Modal
      show={show}
      size="large"
      className="sla-contract-modal"
      title={existing ? "Edit SLA override" : "Add SLA override"}
      onDismiss={onDismiss}
      dismissible={!saving}
      footer={footer}
    >
      {editorBody}
    </Modal>
  );
};
