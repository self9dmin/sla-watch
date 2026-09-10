import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { openApp } from "@dynatrace-sdk/navigation";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { HostsIcon, ServicesIcon, SmartscapeIcon } from "@dynatrace/strato-icons";
import type {
  ContractOverrideRecord,
  ContractOverrideValue,
  EffectiveContractTerms,
  ServiceRecord,
  SlaProviderResponse,
} from "../types";
import { SMARTSCAPE_SERVICE_RUNTIME_QUERY } from "../data/queries";
import { parseSmartscapeScopeEdges } from "../data/topology";
import { getOverrideScopeNames, resolveEffectiveContractTerms } from "../data/contractOverrides";
import { useContractOverrides } from "../hooks/useContractOverrides";
import { ContractOverrideEditor } from "./ContractOverrideEditor";

type DirectoryTab = "published" | "overrides" | "scope";
type Tone = "neutral" | "warning" | "positive";

type ProviderDirectoryWorkspaceProps = {
  directory?: SlaProviderResponse;
  directoryLoading: boolean;
  directoryError?: Error;
  services: ServiceRecord[];
  servicesLoading: boolean;
  serviceError?: Error;
};

const TABS: ReadonlyArray<{ id: DirectoryTab; label: string }> = [
  { id: "published", label: "Published terms" },
  { id: "overrides", label: "SLA overrides" },
  { id: "scope", label: "Scope map" },
];

const StatusPill = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => <span className={`status-pill status-pill-${tone}`}>{children}</span>;
const formatPercent = (value: number | null | undefined): string => value === null || value === undefined ? "Not published" : `${value}%`;
const safeExternalUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const overrideState = (override: ContractOverrideRecord, now = new Date()): { label: string; tone: Tone } => {
  const date = now.toISOString().slice(0, 10);
  if (!override.enabled) return { label: "Disabled", tone: "neutral" };
  if (override.effectiveFrom > date) return { label: "Scheduled", tone: "neutral" };
  if (override.effectiveTo && override.effectiveTo < date) return { label: "Expired", tone: "neutral" };
  return { label: "Active", tone: "positive" };
};

const overrideTerms = (override: ContractOverrideRecord): string => [
  override.availabilityTarget !== null && override.availabilityTarget !== undefined ? `${override.availabilityTarget}% availability` : null,
  override.filingDeadlineDays !== null && override.filingDeadlineDays !== undefined ? `${override.filingDeadlineDays}d filing` : null,
  override.maxCreditPercent !== null && override.maxCreditPercent !== undefined ? `${override.maxCreditPercent}% max credit` : null,
  override.claimMethod?.trim() ? override.claimMethod : null,
].filter((item): item is string => Boolean(item)).join(" · ") || "No operational value";

const overrideScopeSummary = (override: ContractOverrideRecord): string => {
  if (override.scopeKind === "provider") return "Provider-wide fallback";
  const names = getOverrideScopeNames(override);
  const kind = override.scopeKind === "service" ? "Services" : override.scopeKind === "host" ? "Hosts or runtimes" : "Locations";
  if (names.length === 0) return `${kind}: no target`;
  return `${kind}: ${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ""}`;
};

const TermsStrip = ({ terms }: { terms: EffectiveContractTerms }) => (
  <dl className="effective-terms-strip">
    <div><dt>Availability</dt><dd>{formatPercent(terms.availabilityTarget)}</dd></div>
    <div><dt>Filing window</dt><dd>{terms.filingDeadlineDays === null ? "Not published" : `${terms.filingDeadlineDays} ${terms.businessDays ? "business" : "calendar"} days`}</dd></div>
    <div><dt>Maximum credit</dt><dd>{formatPercent(terms.maxCreditPercent)}</dd></div>
    <div><dt>Applied source</dt><dd className={terms.source === "tenant override" ? "source-tenant" : ""}>{terms.source === "tenant override" ? "Tenant override" : "sla.directory"}</dd></div>
  </dl>
);

export const ProviderDirectoryWorkspace = ({
  directory,
  directoryLoading,
  directoryError,
  services,
  servicesLoading,
  serviceError,
}: ProviderDirectoryWorkspaceProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedTab = new URLSearchParams(location.search).get("tab");
  const [tab, setTab] = useState<DirectoryTab>(requestedTab === "overrides" || requestedTab === "scope" ? requestedTab : "published");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ContractOverrideRecord | undefined>();
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const [selectedProviderServiceId, setSelectedProviderServiceId] = useState<string>("*");
  const topologyQuery = useDql({ query: SMARTSCAPE_SERVICE_RUNTIME_QUERY });
  const topology = useMemo(() => parseSmartscapeScopeEdges(topologyQuery.data), [topologyQuery.data]);
  const contractSettings = useContractOverrides();

  useEffect(() => {
    if (requestedTab === "overrides" || requestedTab === "scope" || requestedTab === "published") setTab(requestedTab);
  }, [requestedTab]);

  const providerOverrides = useMemo(() => (directory
    ? contractSettings.overrides.filter((override) => override.providerSlug === directory.provider.slug)
    : []), [contractSettings.overrides, directory]);

  const topologyRows = useMemo(() => {
    const seen = new Set<string>();
    return topology.filter((edge) => {
      const key = `${edge.serviceNodeId}|${edge.targetNodeId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 50);
  }, [topology]);

  useEffect(() => {
    if (!directory) return;
    if (selectedProviderServiceId === "*" && directory.services.length > 0) setSelectedProviderServiceId(directory.services[0].id);
  }, [directory, selectedProviderServiceId]);

  useEffect(() => {
    if (topologyRows.length === 0) {
      setSelectedEdgeKey(null);
      return;
    }
    const exists = topologyRows.some((edge) => `${edge.serviceNodeId}|${edge.targetNodeId}` === selectedEdgeKey);
    if (!exists) setSelectedEdgeKey(`${topologyRows[0].serviceNodeId}|${topologyRows[0].targetNodeId}`);
  }, [selectedEdgeKey, topologyRows]);

  const selectedEdge = topologyRows.find((edge) => `${edge.serviceNodeId}|${edge.targetNodeId}` === selectedEdgeKey);
  const selectedProviderService = directory?.services.find((service) => service.id === selectedProviderServiceId);
  const effectiveTerms = directory && selectedEdge && selectedProviderService
    ? resolveEffectiveContractTerms(directory, providerOverrides, {
        providerSlug: directory.provider.slug,
        providerServiceId: selectedProviderService.id,
        serviceId: selectedEdge.serviceClassicId ?? selectedEdge.serviceNodeId,
        hostId: selectedEdge.targetClassicId ?? selectedEdge.targetNodeId,
        location: selectedEdge.location,
      })
    : undefined;

  const openCreateSettings = (seed?: ContractOverrideValue) => {
    const params = new URLSearchParams();
    if (seed?.providerServiceId && seed.providerServiceId !== "*") params.set("providerServiceId", seed.providerServiceId);
    if (seed?.scopeKind && seed.scopeKind !== "provider") params.set("scopeKind", seed.scopeKind);
    if (seed?.scopeEntityId && seed.scopeEntityId !== "*") params.set("scopeEntityId", seed.scopeEntityId);
    void navigate(`/settings/sla-overrides${params.size > 0 ? `?${params.toString()}` : ""}`);
  };

  const openEdit = (override: ContractOverrideRecord) => {
    setEditing(override);
    setEditorOpen(true);
  };

  const openCreateForProviderService = (service: SlaProviderResponse["services"][number]) => {
    if (!directory) return;
    setSelectedProviderServiceId(service.id);
    openCreateSettings({
      overrideKey: `${directory.provider.slug}|${service.id}|provider|*`,
      providerSlug: directory.provider.slug,
      providerServiceId: service.id,
      providerServiceName: service.name,
      scopeKind: "provider",
      scopeEntityId: "*",
      scopeEntityName: `${directory.provider.name} default`,
      scopeEntityIds: ["*"],
      scopeEntityNames: [`${directory.provider.name} default`],
      location: null,
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
    });
  };

  const scopeSeed = selectedEdge && selectedProviderService ? {
    overrideKey: `${directory?.provider.slug ?? ""}|${selectedProviderService.id}|host|${selectedEdge.targetClassicId ?? selectedEdge.targetNodeId}`,
    providerSlug: directory?.provider.slug ?? "",
    providerServiceId: selectedProviderService.id,
    providerServiceName: selectedProviderService.name,
    scopeKind: "host" as const,
    scopeEntityId: selectedEdge.targetClassicId ?? selectedEdge.targetNodeId,
    scopeEntityName: selectedEdge.targetName,
    scopeEntityIds: [selectedEdge.targetClassicId ?? selectedEdge.targetNodeId],
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
  } satisfies ContractOverrideValue : undefined;

  if (directoryLoading && !directory) {
    return <div className="directory-loading" role="status"><strong>Loading vendor terms</strong><span>Reading the public record and tenant settings.</span></div>;
  }

  if (!directory) {
    return <div className="error-box"><strong>Directory unavailable.</strong><span>{directoryError?.message ?? "Check the environment External requests allowlist and retry."}</span></div>;
  }

  const providerPolicy = directory.provider.defaultCreditPolicy;
  const providerMaxCredit = directory.provider.maxCreditPercent ?? providerPolicy?.maxCreditPercent;

  return (
    <div className="directory-workspace">
      <div className="directory-heading">
        <div>
          <Heading level={2}>Vendor</Heading>
          <Paragraph>Compare the public sla.directory record with terms configured for this Dynatrace environment.</Paragraph>
        </div>
        <div className="directory-heading-status">
          <StatusPill tone="positive">{directory.provider.name} connected</StatusPill>
          <span>{providerOverrides.length} tenant override{providerOverrides.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className="directory-tabs" role="tablist" aria-label="Provider term views">
        {TABS.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`directory-panel-${item.id}`}
            className={tab === item.id ? "directory-tab active" : "directory-tab"}
            key={item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}{item.id === "overrides" && providerOverrides.length > 0 ? <span>{providerOverrides.length}</span> : null}
          </button>
        ))}
      </div>

      <div className="directory-tab-panel" id={`directory-panel-${tab}`} role="tabpanel">
        {tab === "published" ? (
          <div className="published-terms-view">
            <div className="published-summary">
              <div className="published-summary-copy">
                <div><strong>Public reference</strong><StatusPill tone="neutral">Read-only</StatusPill></div>
                <p>These terms come from sla.directory. They are not assumed to match a private enterprise agreement.</p>
              </div>
              <Button size="condensed" variant="emphasized" disabled={!contractSettings.canWrite} onClick={() => openCreateSettings()}>Add SLA override</Button>
            </div>

            <dl className="published-facts">
              <div><dt>Provider target</dt><dd>{formatPercent(directory.provider.uptime)}</dd></div>
              <div><dt>Filing window</dt><dd>{directory.provider.claimProcess?.deadlineDays ? `${directory.provider.claimProcess.deadlineDays} days` : "Not published"}</dd></div>
              <div><dt>Maximum credit</dt><dd>{formatPercent(providerMaxCredit)}</dd></div>
              <div><dt>Last verified</dt><dd>{directory.provider.lastVerified}</dd></div>
            </dl>

            {serviceError ? <div className="error-box compact-error">Dynatrace service inventory could not be loaded: {serviceError.message}</div> : null}
            <div className="published-service-list" role="table" aria-label="Published provider service terms">
              <div className="published-service-row published-service-header" role="row"><span>Provider service</span><span>Availability</span><span>Source</span><span>Tenant scope</span></div>
              {directory.services.slice(0, 50).map((service) => {
                const overrideCount = providerOverrides.filter((override) => override.providerServiceId === "*" || override.providerServiceId === service.id).length;
                return (
                  <div className="published-service-row" role="row" key={service.id}>
                    <div><strong>{service.name}</strong><small>{service.id}</small></div>
                    <span>{formatPercent(service.uptime)}</span>
                    <span>{service.eligible ? "Published SLA" : "Reference"}</span>
                    <button type="button" className="inline-action table-action" onClick={() => {
                      setSelectedProviderServiceId(service.id);
                      if (overrideCount > 0) setTab("overrides");
                      else openCreateForProviderService(service);
                    }}>
                      {overrideCount > 0 ? `${overrideCount} override${overrideCount === 1 ? "" : "s"}` : "Add SLA override"}
                    </button>
                  </div>
                );
              })}
            </div>
            {servicesLoading ? <div className="directory-inline-status" role="status">Loading Dynatrace service inventory...</div> : null}
          </div>
        ) : null}

        {tab === "overrides" ? (
          <div className="contract-overrides-view">
            <div className="contract-overrides-toolbar">
              <div><strong>Tenant SLA terms</strong><span>Shared in this environment. Public records remain unchanged.</span></div>
              <Button size="condensed" variant="emphasized" disabled={!contractSettings.canWrite || contractSettings.mutating} onClick={() => openCreateSettings()}>Add SLA override</Button>
            </div>
            {!contractSettings.canRead || contractSettings.error ? <div className="error-box compact-error">Contract settings are unavailable for this user. Ask a Dynatrace administrator for app-settings read access.</div> : null}
            {!contractSettings.loading && !contractSettings.canWrite ? <div className="settings-permission-note">You can review overrides, but your role cannot change them.</div> : null}
            <div className="contract-security-note"><strong>Data boundary</strong><span>Store operational values and a reference only. All authenticated SLA Watch users can read these settings, so do not paste confidential contract text or credentials.</span></div>
            {contractSettings.loading ? (
              <div className="directory-loading" role="status"><strong>Loading SLA overrides</strong><span>Reading shared App Settings.</span></div>
            ) : providerOverrides.length === 0 ? (
              <div className="contract-empty"><strong>No tenant overrides for {directory.provider.name}</strong><span>Until an override is added, SLA Watch uses the public directory record.</span><Button size="condensed" disabled={!contractSettings.canWrite} onClick={() => openCreateSettings()}>Add the first SLA override</Button></div>
            ) : (
              <div className="contract-override-list" role="list" aria-label={`${directory.provider.name} SLA overrides`}>
                {providerOverrides.map((override) => {
                  const state = overrideState(override);
                  const sourceUrl = safeExternalUrl(override.sourceUrl);
                  return (
                    <article className="contract-override-row" role="listitem" key={override.objectId}>
                      <div className="contract-override-scope"><strong>{override.providerServiceName}</strong><span>{overrideScopeSummary(override)}</span></div>
                      <div className="contract-override-terms"><strong>{overrideTerms(override)}</strong><span>Effective {override.effectiveFrom}{override.effectiveTo ? ` to ${override.effectiveTo}` : ""}</span></div>
                      <div className="contract-override-source"><span>Source</span>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">{override.sourceReference}</a> : <strong>{override.sourceReference}</strong>}</div>
                      <StatusPill tone={state.tone}>{state.label}</StatusPill>
                      <Button size="condensed" disabled={!contractSettings.canWrite} onClick={() => openEdit(override)}>Edit</Button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {tab === "scope" ? (
          <div className="scope-map-view">
            <div className="scope-map-toolbar">
              <div className="scope-map-title"><SmartscapeIcon /><div><strong>Smartscape-backed scope map</strong><span>Service-to-runtime relationships returned by the current tenant.</span></div></div>
              <Button size="condensed" onClick={() => openApp("dynatrace.smartscape", "view/dynatrace.smartscape.smartscape-on-grail")}><Button.Prefix><SmartscapeIcon /></Button.Prefix>Open Smartscape</Button>
            </div>
            <div className="scope-map-boundary"><strong>Attribution boundary</strong><span>Topology identifies where a customer scope applies. It does not prove that a provider publishes a host-level SLA or caused an incident.</span></div>
            {topologyQuery.error ? <div className="error-box compact-error">Smartscape topology is unavailable. Check the storage:smartscape:read permission.</div> : null}
            {topologyQuery.isLoading ? (
              <div className="directory-loading" role="status"><strong>Loading Smartscape topology</strong><span>Reading service-to-runtime relationships.</span></div>
            ) : topologyRows.length === 0 ? (
              <div className="contract-empty"><strong>No service-to-runtime relationships returned</strong><span>Open Smartscape to verify that the service and host boundary is available in this tenant.</span></div>
            ) : (
              <div className="scope-map-layout">
                <div className="scope-map-list" role="listbox" aria-label="Smartscape service and runtime scopes">
                  {topologyRows.map((edge) => {
                    const key = `${edge.serviceNodeId}|${edge.targetNodeId}`;
                    return (
                      <button type="button" role="option" aria-selected={selectedEdgeKey === key} className={`scope-map-row${selectedEdgeKey === key ? " selected" : ""}`} key={key} onClick={() => setSelectedEdgeKey(key)}>
                        <span className="scope-node"><ServicesIcon /><span><small>Service</small><strong>{edge.serviceName}</strong></span></span>
                        <span className="scope-connector"><span aria-hidden="true" /><small>{edge.relationship === "belongs_to" ? "belongs to" : "runs on"}</small></span>
                        <span className="scope-node"><HostsIcon /><span><small>{edge.targetType.replaceAll("_", " ")}</small><strong>{edge.targetName}</strong></span></span>
                        <span className="scope-connector"><span aria-hidden="true" /><small>observed in</small></span>
                        <span className={`scope-node scope-location${edge.location ? "" : " missing"}`}><span><small>Location</small><strong>{edge.location ?? "Not exposed"}</strong></span></span>
                      </button>
                    );
                  })}
                </div>
                <aside className="scope-detail" aria-label="Effective contract terms for selected scope">
                  <label className="field-label">Provider service<select value={selectedProviderServiceId} onChange={(event) => setSelectedProviderServiceId(event.target.value)}>{directory.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
                  {selectedEdge && effectiveTerms ? (
                    <>
                      <div className="scope-selection"><span>Selected Dynatrace scope</span><strong>{selectedEdge.serviceName} → {selectedEdge.targetName}</strong><small>{selectedEdge.location ?? "No location field returned"}</small></div>
                      <TermsStrip terms={effectiveTerms} />
                      <div className="scope-source-chain"><strong>{effectiveTerms.appliedOverrides.length > 0 ? `${effectiveTerms.appliedOverrides.length} tenant override${effectiveTerms.appliedOverrides.length === 1 ? "" : "s"} applied` : "Public baseline applied"}</strong><span>Precedence: host, location, service, provider, then sla.directory.</span></div>
                      <Button size="condensed" variant="emphasized" disabled={!contractSettings.canWrite} onClick={() => openCreateSettings(scopeSeed)}>Add SLA override for this scope</Button>
                    </>
                  ) : null}
                </aside>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <ContractOverrideEditor
        show={editorOpen}
        provider={directory}
        services={services}
        topology={topology}
        overrides={providerOverrides}
        existing={editing}
        canWrite={contractSettings.canWrite}
        saving={contractSettings.mutating}
        onDismiss={() => { if (!contractSettings.mutating) { setEditorOpen(false); setEditing(undefined); } }}
        onSave={async (value: ContractOverrideValue, existing?: ContractOverrideRecord) => {
          if (existing) await contractSettings.updateOverride(existing, value);
          else await contractSettings.createOverride(value);
        }}
        onDelete={contractSettings.deleteOverride}
      />
    </div>
  );
};
