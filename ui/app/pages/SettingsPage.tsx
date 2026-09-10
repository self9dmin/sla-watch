import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAppFunction, useDql } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";
import { CommunityLink } from "../components/CommunityLink";
import { ContractOverrideEditor } from "../components/ContractOverrideEditor";
import { useSlaPreferences } from "../context/SlaPreferencesContext";
import { useContractOverrides } from "../hooks/useContractOverrides";
import { useProviderConnections } from "../hooks/useProviderConnections";
import { createOverrideKey } from "../data/contractOverrides";
import { mergeServiceInventory } from "../data/providerAttribution";
import { createProviderConnectionKey, validateProviderConnection } from "../data/providerConnections";
import { EVIDENCE_LOOKBACK_OPTIONS } from "../data/lookback";
import { createServiceMetricsQuery, SERVICES_QUERY, SMARTSCAPE_SERVICE_RUNTIME_QUERY } from "../data/queries";
import { detectedProviderSlugs, parseServiceCloudContexts, parseSmartscapeScopeEdges } from "../data/topology";
import { normalizeProviderSlug, PROVIDER_CATALOG, providerDetail, providerDisplayName } from "../data/providers";
import type { ContractOverrideValue, ContractScopeKind, EvidenceLookbackHours, GcpProviderNoticesResponse, ProviderConnectionValue, ServiceRecord, SlaProviderResponse, SlaThemePreference } from "../types";

const SETUP_LINKS = [
  ["watch", "Monitor configuration"],
  ["provider-connections", "Provider connections"],
  ["sla-overrides", "SLA overrides"],
  ["appearance", "Appearance"],
  ["intro", "Intro & walkthrough"],
] as const;

const OPERATE_LINKS = [
  ["/changes", "Change log"],
] as const;

const SettingsRail = ({ page }: { page: string }) => {
  const navigate = useNavigate();
  return (
    <aside className="settings-rail">
      <Button variant="default" onClick={() => { void navigate("/"); }}>Back to SLA Watch</Button>
      <div className="settings-rail-title">Workspace settings</div>
      <RailGroup title="MY SETUP" links={SETUP_LINKS} page={page} />
      <div className="settings-rail-group">
        <div className="settings-rail-label">OPERATE</div>
        {OPERATE_LINKS.map(([href, label]) => <NavLink key={href} to={href} className="settings-rail-link">{label}</NavLink>)}
      </div>
      <div className="settings-rail-group">
        <div className="settings-rail-label">SUPPORT</div>
        <CommunityLink className="settings-rail-link" />
      </div>
      <div className="settings-rail-note">Monitor configuration, provider connections, and SLA overrides are shared with the workspace. Theme and walkthrough state stay personal to you. The change log is read-only.</div>
    </aside>
  );
};

const RailGroup = ({ title, links, page }: { title: string; links: readonly (readonly [string, string])[]; page: string }) => (
  <div className="settings-rail-group">
    <div className="settings-rail-label">{title}</div>
    {links.map(([id, label]) => <NavLink key={id} to={`/settings/${id}`} className={`settings-rail-link ${page === id ? "active" : ""}`}>{label}</NavLink>)}
  </div>
);

const SavedNote = ({ text }: { text: string }) => <div className="saved-note" role="status">{text}</div>;

const asRecord = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
const recordText = (value: unknown, fallback: string): string => typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;

const WatchSettings = () => {
  const { preferences, updatePreferences } = useSlaPreferences();
  const [providerSlugs, setProviderSlugs] = useState(preferences.providerSlugs);
  const [providerSlug, setProviderSlug] = useState(preferences.providerSlug);
  const [providerLabelKey, setProviderLabelKey] = useState(preferences.providerLabelKey);
  const [lookbackHours, setLookbackHours] = useState<EvidenceLookbackHours>(preferences.lookbackHours);
  const [customProvider, setCustomProvider] = useState("");
  const [saved, setSaved] = useState(false);
  const topologyQuery = useDql({ query: SMARTSCAPE_SERVICE_RUNTIME_QUERY });
  const serviceCloudQueryText = useMemo(() => createServiceMetricsQuery(lookbackHours), [lookbackHours]);
  const serviceCloudQuery = useDql({ query: serviceCloudQueryText });
  const topology = useMemo(() => parseSmartscapeScopeEdges(topologyQuery.data), [topologyQuery.data]);
  const serviceCloudContexts = useMemo(() => parseServiceCloudContexts(serviceCloudQuery.data), [serviceCloudQuery.data]);
  const detectedProviders = useMemo(() => detectedProviderSlugs([...topology, ...serviceCloudContexts]), [serviceCloudContexts, topology]);
  const providerOptions = useMemo(() => Array.from(new Set([
    ...PROVIDER_CATALOG.map((provider) => provider.slug),
    ...providerSlugs,
    ...detectedProviders,
  ])), [detectedProviders, providerSlugs]);
  const directoryRequest = useMemo(() => ({ vendor: providerSlug }), [providerSlug]);
  const directoryConnection = useAppFunction<SlaProviderResponse>({ name: "slaDirectory", data: directoryRequest, responseType: "json" });
  const activeDirectory = directoryConnection.data?.provider.slug === providerSlug ? directoryConnection.data : undefined;
  const directoryChecking = directoryConnection.isLoading || Boolean(!directoryConnection.error && directoryConnection.data && !activeDirectory);

  useEffect(() => {
    setProviderSlugs(preferences.providerSlugs);
    setProviderSlug(preferences.providerSlug);
    setProviderLabelKey(preferences.providerLabelKey);
    setLookbackHours(preferences.lookbackHours);
  }, [preferences.providerLabelKey, preferences.providerSlug, preferences.providerSlugs, preferences.lookbackHours]);

  const toggleProvider = (slug: string) => {
    setProviderSlugs((current) => {
      if (current.includes(slug)) {
        if (current.length === 1) return current;
        const next = current.filter((item) => item !== slug);
        if (providerSlug === slug) setProviderSlug(next[0]);
        return next;
      }
      return [...current, slug].slice(0, 12);
    });
    setSaved(false);
  };

  const addCustomProvider = () => {
    const normalized = normalizeProviderSlug(customProvider);
    if (!normalized) return;
    setProviderSlugs((current) => Array.from(new Set([...current, normalized])).slice(0, 12));
    setProviderSlug(normalized);
    setCustomProvider("");
    setSaved(false);
  };

  const save = async () => {
    await updatePreferences({
      providerSlugs,
      providerSlug: providerSlug.trim().toLowerCase(),
      providerLabelKey: providerLabelKey.trim() || "provider",
      lookbackHours,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2600);
  };

  return (
    <section className="settings-page">
      <div className="page-intro">
        <Text className="eyebrow">Settings · monitor</Text>
        <Heading level={1}>Configure monitor defaults.</Heading>
        <Paragraph>Choose the providers to monitor, the active provider for focused views, and the evidence window. Review service assignments from Setup.</Paragraph>
      </div>
      <fieldset className="provider-monitor-fieldset">
        <legend>Monitored providers</legend>
        <p>Keep more than one provider in scope. Smartscape detections are suggestions until a service mapping is confirmed.</p>
        <div className="provider-monitor-grid">
          {providerOptions.map((slug) => {
            const monitored = providerSlugs.includes(slug);
            const detected = detectedProviders.includes(slug);
            return (
              <label className={`provider-monitor-option${monitored ? " selected" : ""}`} key={slug}>
                <input type="checkbox" checked={monitored} onChange={() => toggleProvider(slug)} aria-label={`Monitor ${providerDisplayName(slug)}`} />
                <span><strong>{providerDisplayName(slug)}</strong><small>{providerDetail(slug)}</small></span>
                <span className={`provider-monitor-signal${detected ? " detected" : ""}`}>{detected ? "Detected in Smartscape" : monitored ? "Monitored" : "Available"}</span>
              </label>
            );
          })}
        </div>
        <div className="provider-custom-row">
          <label className="field-label">Add another sla.directory provider
            <input value={customProvider} onChange={(event) => setCustomProvider(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="provider slug" autoComplete="off" />
          </label>
          <Button size="condensed" disabled={!normalizeProviderSlug(customProvider)} onClick={addCustomProvider}>Add provider</Button>
        </div>
        {!topologyQuery.isLoading && !serviceCloudQuery.isLoading && detectedProviders.length === 0 ? <small className="provider-detection-note">No cloud provider was identified from current service topology or service metric dimensions. You can still monitor a provider and assign services manually.</small> : null}
      </fieldset>
      <div className="settings-form-grid">
        <label className="field-label">Active provider
          <select value={providerSlug} onChange={(event) => setProviderSlug(event.target.value)} aria-label="Active provider for focused views">
            {providerSlugs.map((slug) => <option key={slug} value={slug}>{providerDisplayName(slug)}</option>)}
          </select>
          <small>Directory, Setup, Incidents, and Provider notices focus on this provider. Other monitored providers remain configured.</small>
        </label>
        <label className="field-label">Provider tag key
          <input value={providerLabelKey} onChange={(event) => setProviderLabelKey(event.target.value)} placeholder="provider" autoComplete="off" />
          <small>Examples the monitor understands: <code>provider:aws</code>, <code>vendor=aws</code>, or <code>[aws]</code>.</small>
        </label>
        <label className="field-label">Evidence lookback
          <select value={lookbackHours} onChange={(event) => setLookbackHours(Number(event.target.value) as EvidenceLookbackHours)}>
            {EVIDENCE_LOOKBACK_OPTIONS.map(({ value, label }) => <option key={value} value={value}>Last {label}</option>)}
          </select>
          <small>A wider window helps with slow-moving incidents but can add unrelated history.</small>
        </label>
      </div>
      <div className="settings-connection" role="status" aria-label="sla.directory connection status">
        <div>
          <span className="eyebrow">Provider data source</span>
          <strong>sla.directory API</strong>
          <small>{directoryChecking
            ? `Checking ${providerSlug}`
            : activeDirectory
              ? `${activeDirectory.provider.name} public terms are available.`
              : `The ${providerSlug} public record could not be loaded.`}</small>
        </div>
        <span className={`connection-state ${directoryChecking ? "checking" : activeDirectory ? "connected" : "unavailable"}`}>
          {directoryChecking ? "Checking" : activeDirectory ? "Connected" : "Unavailable"}
        </span>
        <Button size="condensed" disabled={directoryChecking} onClick={() => void directoryConnection.refetch()}>Check connection</Button>
      </div>
      <div className="settings-preview">
        <div className="eyebrow">Matching rules</div>
        <div className="provider-rule-list">{providerSlugs.map((slug) => <code key={slug}>{providerLabelKey || "provider"}:{slug}</code>)}</div>
        <span>SLA Watch checks these explicit tags and separately reports Smartscape candidates. Saving monitor settings does not modify Dynatrace services.</span>
        <NavLink className="text-action" to="/setup">Review service mapping in Setup</NavLink>
      </div>
      <div className="settings-actions"><Button variant="emphasized" disabled={providerSlugs.length === 0 || !providerSlug.trim()} onClick={() => void save()}>Save monitor settings</Button>{saved ? <SavedNote text="Monitor settings saved" /> : null}</div>
    </section>
  );
};

const emptyGcpConnection = (): ProviderConnectionValue => ({
  connectionKey: "",
  providerSlug: "gcp",
  displayName: "Google Cloud",
  projectId: "",
  credentialId: "",
  enabled: true,
});

const ProviderConnectionsSettings = () => {
  const providerConnections = useProviderConnections();
  const gcpConnections = useMemo(() => providerConnections.connections
    .filter((item) => item.providerSlug === "gcp")
    .sort((left, right) => left.displayName.localeCompare(right.displayName) || left.projectId.localeCompare(right.projectId)), [providerConnections.connections]);
  const [selectedConnectionKey, setSelectedConnectionKey] = useState("auto");
  const existing = gcpConnections.find((item) => item.connectionKey === selectedConnectionKey);
  const [draft, setDraft] = useState<ProviderConnectionValue>(emptyGcpConnection);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [testMessage, setTestMessage] = useState<{ tone: "positive" | "warning"; text: string }>();
  const testRequest = useMemo(() => ({
    projectId: draft.projectId.trim().toLowerCase(),
    credentialId: draft.credentialId.trim().toUpperCase(),
    lookbackHours: 24,
    requirePersonalized: true,
  }), [draft.credentialId, draft.projectId]);
  const connectionTest = useAppFunction<GcpProviderNoticesResponse>(
    { name: "gcpServiceHealth", data: testRequest, responseType: "json" },
    { autoFetch: false, autoFetchOnUpdate: false },
  );

  useEffect(() => {
    if (providerConnections.loading || selectedConnectionKey !== "auto") return;
    const first = gcpConnections[0];
    setSelectedConnectionKey(first?.connectionKey ?? "new");
    setDraft(first ? { ...first } : emptyGcpConnection());
  }, [gcpConnections, providerConnections.loading, selectedConnectionKey]);

  const selectConnection = (connectionKey: string) => {
    const selected = gcpConnections.find((item) => item.connectionKey === connectionKey);
    setSelectedConnectionKey(connectionKey);
    setDraft(selected ? { ...selected } : emptyGcpConnection());
    setFormError(undefined);
    setTestMessage(undefined);
    setSaved(false);
  };

  const normalizedDraft = (): ProviderConnectionValue => ({
    ...draft,
    connectionKey: createProviderConnectionKey("gcp", draft.projectId),
    providerSlug: "gcp",
    displayName: draft.displayName.trim() || "Google Cloud",
    projectId: draft.projectId.trim().toLowerCase(),
    credentialId: draft.credentialId.trim().toUpperCase(),
  });

  const save = async () => {
    const value = normalizedDraft();
    const errors = validateProviderConnection(value);
    if (errors.length > 0) {
      setFormError(errors[0]);
      return;
    }
    setFormError(undefined);
    const duplicate = gcpConnections.find((item) => item.connectionKey === value.connectionKey && item.objectId !== existing?.objectId);
    if (duplicate) {
      setFormError(`A connection for project '${value.projectId}' already exists.`);
      return;
    }
    if (existing) await providerConnections.updateConnection(existing, value);
    else await providerConnections.createConnection(value);
    setSelectedConnectionKey(value.connectionKey);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2600);
  };

  const testConnection = async () => {
    const value = normalizedDraft();
    const errors = validateProviderConnection(value);
    if (errors.length > 0) {
      setFormError(errors[0]);
      return;
    }
    setFormError(undefined);
    setTestMessage(undefined);
    try {
      const result = await connectionTest.refetch();
      setTestMessage({ tone: "positive", text: `${result.message} Authentication and project access are working.` });
    } catch (error: unknown) {
      setTestMessage({ tone: "warning", text: error instanceof Error ? error.message : "The personalized Google Cloud connection could not be verified." });
    }
  };

  const remove = async () => {
    if (!existing || !window.confirm(`Remove the Google Cloud connection for ${existing.projectId}? The Credential Vault entry will not be deleted.`)) return;
    await providerConnections.deleteConnection(existing);
    const next = gcpConnections.find((item) => item.objectId !== existing.objectId);
    selectConnection(next?.connectionKey ?? "new");
  };

  return (
    <section className="settings-page provider-connections-settings">
      <div className="page-intro">
        <Heading level={1}>Connect provider incident data.</Heading>
        <Paragraph>Add one or more Google Cloud projects for project-relevant service health. Public provider status sources remain available without credentials.</Paragraph>
      </div>

      <div className="provider-connection-boundary">
        <div><span className="eyebrow">Connection scope</span><strong>Google Cloud · multiple projects</strong><small>Public status for OCI, OpenAI, Anthropic, and ElevenLabs requires no credential. AWS, Azure, and OCI customer-specific connections require separate adapters.</small></div>
        <span className="connection-state connected">{gcpConnections.length} saved</span>
      </div>

      <div className="provider-connection-switcher">
        <label className="field-label">Google Cloud project connection
          <select value={selectedConnectionKey === "auto" ? "new" : selectedConnectionKey} onChange={(event) => selectConnection(event.target.value)}>
            <option value="new">Add a new project</option>
            {gcpConnections.map((item) => <option key={item.objectId} value={item.connectionKey}>{item.displayName} · {item.projectId}</option>)}
          </select>
        </label>
        <Button size="condensed" disabled={selectedConnectionKey === "new"} onClick={() => selectConnection("new")}>Add project</Button>
      </div>

      <ol className="provider-connection-steps" aria-label="Google Cloud connection requirements">
        <li><span>1</span><div><strong>Enable Service Health API</strong><small>Enable <code>servicehealth.googleapis.com</code> for the project.</small></div></li>
        <li><span>2</span><div><strong>Grant one read role</strong><small>Use a dedicated service account with <code>roles/servicehealth.viewer</code>.</small></div></li>
        <li><span>3</span><div><strong>Store the JSON key in Credential Vault</strong><small>Create a Token credential with AppEngine scope and restrict app access to SLA Watch.</small></div></li>
      </ol>

      <div className="settings-form-grid provider-connection-form">
        <label className="field-label">Connection name
          <input value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} placeholder="Google Cloud" autoComplete="off" maxLength={80} required />
          <small>Operator-facing name only.</small>
        </label>
        <label className="field-label">Google Cloud project ID
          <input value={draft.projectId} onChange={(event) => setDraft((current) => ({ ...current, projectId: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} placeholder="example-project-123" autoComplete="off" maxLength={30} pattern="[a-z][a-z0-9-]{4,28}[a-z0-9]" required />
          <small>The API returns events relevant to this project.</small>
        </label>
        <label className="field-label provider-credential-field">Dynatrace Credential Vault ID
          <input value={draft.credentialId} onChange={(event) => setDraft((current) => ({ ...current, credentialId: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") }))} placeholder="Paste the full credential ID" autoComplete="off" spellCheck={false} maxLength={34} pattern="CREDENTIALS_VAULT-[A-Fa-f0-9]{16}" required />
          <small>Enter the credential ID, not the service-account JSON. The secret remains in Credential Vault.</small>
        </label>
        <label className="provider-enabled-field"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} /><span><strong>Use personalized notices</strong><small>When disabled, Monitor uses only the public Google Cloud status feed.</small></span></label>
      </div>

      {formError ? <div className="error-box compact-error" role="alert">{formError}</div> : null}
      {providerConnections.error ? <div className="error-box compact-error" role="alert">Provider connection settings could not be read. Check App Settings access.</div> : null}
      {!providerConnections.loading && !providerConnections.canWrite ? <div className="settings-callout provider-connection-note"><strong>Read-only access</strong><span>Your current role can review this configuration but cannot create or change provider connections.</span></div> : null}
      {testMessage ? <div className={`provider-connection-test provider-connection-test-${testMessage.tone}`} role="status"><strong>{testMessage.tone === "positive" ? "Connection verified" : "Connection not verified"}</strong><span>{testMessage.text}</span></div> : null}

      <div className="settings-actions">
        <Button variant="emphasized" disabled={!providerConnections.canWrite || providerConnections.mutating || providerConnections.loading} onClick={() => void save()}>{providerConnections.mutating ? "Saving" : existing ? "Update connection" : "Save connection"}</Button>
        <Button disabled={connectionTest.isLoading || !draft.projectId || !draft.credentialId} onClick={() => void testConnection()}>{connectionTest.isLoading ? "Testing" : "Test connection"}</Button>
        {existing ? <Button disabled={!providerConnections.canWrite || providerConnections.mutating} onClick={() => void remove()}>Remove connection</Button> : null}
        {saved ? <SavedNote text="Provider connection saved" /> : null}
      </div>

      <div className="settings-callout provider-connection-note"><strong>What this connection does</strong><span>It reads provider-owned incident notices. It does not modify Google Cloud, create a Dynatrace Problem, send a notification, prove local impact, or determine SLA credit eligibility.</span></div>
    </section>
  );
};

const SlaOverrideSettings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { preferences } = useSlaPreferences();
  const directoryRequest = useMemo(() => ({ vendor: preferences.providerSlug }), [preferences.providerSlug]);
  const directoryQuery = useAppFunction<SlaProviderResponse>({ name: "slaDirectory", data: directoryRequest, responseType: "json" });
  const activeDirectory = directoryQuery.data?.provider.slug === preferences.providerSlug ? directoryQuery.data : undefined;
  const serviceQuery = useDql({ query: SERVICES_QUERY });
  const topologyQuery = useDql({ query: SMARTSCAPE_SERVICE_RUNTIME_QUERY });
  const contractSettings = useContractOverrides();

  const entityServices = useMemo<ServiceRecord[]>(() => {
    const records = Array.isArray(serviceQuery.data?.records) ? serviceQuery.data.records : [];
    return records.map((value, index) => {
      const record = asRecord(value);
      return {
        id: recordText(record.id, `service-${index + 1}`),
        name: recordText(record.name, "Unnamed service"),
        type: recordText(record.type, "SERVICE"),
        tags: [],
      };
    });
  }, [serviceQuery.data]);
  const topology = useMemo(() => parseSmartscapeScopeEdges(topologyQuery.data), [topologyQuery.data]);
  const services = useMemo(() => mergeServiceInventory(entityServices, topology), [entityServices, topology]);

  const initialValue = useMemo<ContractOverrideValue | undefined>(() => {
    const directory = activeDirectory;
    if (!directory) return undefined;
    const params = new URLSearchParams(location.search);
    const requestedProviderServiceId = params.get("providerServiceId") ?? "*";
    const providerService = directory.services.find((service) => service.id === requestedProviderServiceId);
    const providerServiceId = providerService?.id ?? "*";
    const providerServiceName = providerService?.name ?? "All provider services";
    const requestedScopeKind = params.get("scopeKind");
    let scopeKind: ContractScopeKind = requestedScopeKind === "service" || requestedScopeKind === "host" || requestedScopeKind === "location" ? requestedScopeKind : "provider";
    const requestedScopeEntityId = params.get("scopeEntityId") ?? "";
    let scopeEntityId = "*";
    let scopeEntityName = `${directory.provider.name} default`;
    let observedLocation: string | null = null;

    if (scopeKind === "service") {
      const target = services.find((service) => service.id === requestedScopeEntityId);
      if (target) {
        scopeEntityId = target.id;
        scopeEntityName = target.name;
      } else scopeKind = "provider";
    } else if (scopeKind === "host") {
      const target = topology.find((edge) => (edge.targetClassicId ?? edge.targetNodeId) === requestedScopeEntityId);
      if (target) {
        scopeEntityId = target.targetClassicId ?? target.targetNodeId;
        scopeEntityName = target.targetName;
        observedLocation = target.location ?? null;
      } else scopeKind = "provider";
    } else if (scopeKind === "location") {
      const target = topology.find((edge) => edge.location === requestedScopeEntityId);
      if (target?.location) {
        scopeEntityId = target.location;
        scopeEntityName = target.location;
        observedLocation = target.location;
      } else scopeKind = "provider";
    }

    const draft: ContractOverrideValue = {
      overrideKey: "",
      providerSlug: directory.provider.slug,
      providerServiceId,
      providerServiceName,
      scopeKind,
      scopeEntityId,
      scopeEntityName,
      scopeEntityIds: [scopeEntityId],
      scopeEntityNames: [scopeEntityName],
      location: observedLocation,
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
    return { ...draft, overrideKey: createOverrideKey(draft) };
  }, [activeDirectory, location.search, services, topology]);

  const loading = directoryQuery.isLoading || Boolean(!directoryQuery.error && directoryQuery.data && !activeDirectory) || serviceQuery.isLoading || topologyQuery.isLoading || contractSettings.loading;

  return (
    <section className="settings-page settings-page-wide">
      <div className="page-intro sla-override-page-intro">
        <Text className="eyebrow">Settings · SLA overrides</Text>
        <Heading level={1}>Add a custom SLA.</Heading>
        <Paragraph>Define operational terms for a provider service and an explicit Dynatrace scope. Public sla.directory terms remain available as the comparison baseline.</Paragraph>
      </div>
      {loading ? <div className="settings-callout" role="status"><strong>Loading contract scope</strong><span>Reading the provider record, service inventory, Smartscape topology, and tenant settings.</span></div> : null}
      {!loading && !activeDirectory ? <div className="error-box"><strong>Provider terms are unavailable.</strong><span>Return to Monitor configuration, verify the active provider and API connection, then try again.</span></div> : null}
      {!loading && activeDirectory && initialValue ? (
        <>
          {!contractSettings.canWrite ? <div className="error-box compact-error">Your current role can review SLA overrides but cannot create them. Ask a Dynatrace administrator for app-settings write access.</div> : null}
          {(serviceQuery.error || topologyQuery.error) ? <div className="settings-callout"><strong>Some Dynatrace scopes are unavailable</strong><span>You can still create a provider-level SLA override. Service, host, and location choices require the corresponding entity or Smartscape read access.</span></div> : null}
          <ContractOverrideEditor
            presentation="page"
            provider={activeDirectory}
            services={services}
            topology={topology}
            overrides={contractSettings.overrides.filter((override) => override.providerSlug === activeDirectory.provider.slug)}
            initialValue={initialValue}
            canWrite={contractSettings.canWrite}
            saving={contractSettings.mutating}
            onDismiss={() => { void navigate("/directory?tab=overrides"); }}
            onSave={async (value) => contractSettings.createOverride(value)}
            onDelete={contractSettings.deleteOverride}
          />
        </>
      ) : null}
    </section>
  );
};

const AppearanceSettings = () => {
  const { preferences, updatePreferences } = useSlaPreferences();
  const [saved, setSaved] = useState(false);
  const save = async (theme: SlaThemePreference) => {
    await updatePreferences({ theme });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };
  return (
    <section className="settings-page">
      <div className="page-intro"><Text className="eyebrow">Settings · appearance</Text><Heading level={1}>Configure the app theme.</Heading><Paragraph>Use the tenant theme or select light or dark mode. The setting follows you between sessions.</Paragraph></div>
      <div className="theme-choice-grid">
        {([
          ["system", "System", "Follow the Dynatrace tenant theme."],
          ["light", "Light", "Light surfaces with readable status contrast."],
          ["dark", "Dark", "Dark surfaces for low-light incident response."],
        ] as const).map(([value, title, detail]) => <button type="button" key={value} className={`theme-choice ${preferences.theme === value ? "selected" : ""}`} onClick={() => void save(value)}><span className={`theme-swatch theme-swatch-${value}`} /><span><strong>{title}</strong><small>{detail}</small></span><span className="theme-choice-state">{preferences.theme === value ? "Active" : "Use"}</span></button>)}
      </div>
      {saved ? <SavedNote text="Appearance saved" /> : null}
      <div className="settings-callout"><strong>Contrast is part of the feature.</strong><span>Statuses use both words and color, and the same evidence states stay readable in day and night themes.</span></div>
    </section>
  );
};

const IntroSettings = () => {
  const navigate = useNavigate();
  const { preferences, updatePreferences } = useSlaPreferences();
  const [saved, setSaved] = useState(false);
  const restartIntro = async () => {
    await updatePreferences({ onboardingComplete: false, tourCompleted: false });
    await navigate("/");
  };
  const resetTour = async () => {
    await updatePreferences({ tourCompleted: false });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };
  return (
    <section className="settings-page">
      <div className="page-intro"><Text className="eyebrow">Settings · onboarding</Text><Heading level={1}>Configure onboarding and walkthrough.</Heading><Paragraph>Use the setup when the provider boundary changes. Replay the walkthrough when the evidence model needs review.</Paragraph></div>
      <div className="onboarding-status-row"><div><span className="eyebrow">Setup status</span><strong>{preferences.onboardingComplete ? "Configured" : "Not configured"}</strong></div><div><span className="eyebrow">Walkthrough</span><strong>{preferences.tourCompleted ? "Completed" : "Ready to replay"}</strong></div><div><span className="eyebrow">Providers</span><strong>{preferences.providerSlugs.map(providerDisplayName).join(", ")}</strong></div></div>
      <div className="settings-actions"><Button variant="emphasized" onClick={() => void restartIntro()}>Restart intro setup</Button><Button onClick={() => void resetTour()}>Start walkthrough now</Button>{saved ? <SavedNote text="Walkthrough is ready" /> : null}</div>
      <div className="settings-callout"><strong>What onboarding does not do.</strong><span>It does not create an SLA claim, change telemetry, add tags, or make a provider determination for you.</span></div>
    </section>
  );
};

const SettingsLanding = () => <section className="settings-page"><div className="page-intro"><Text className="eyebrow">SLA workspace</Text><Heading level={1}>Workspace configuration</Heading><Paragraph>Configure monitor defaults, provider data, SLA evidence boundaries, and operator-facing display settings.</Paragraph></div><div className="settings-summary-grid"><NavLink to="/settings/watch" className="settings-summary"><span className="eyebrow">Monitor configuration</span><strong>Select monitored providers and the tag convention.</strong><span>Service assignments are reviewed from Setup.</span></NavLink><NavLink to="/settings/provider-connections" className="settings-summary"><span className="eyebrow">Provider connections</span><strong>Connect provider-owned incident data.</strong><span>Add multiple Google Cloud projects. Supported public status feeds require no credential.</span></NavLink><NavLink to="/settings/sla-overrides" className="settings-summary"><span className="eyebrow">SLA overrides</span><strong>Define tenant terms and evidence targets.</strong><span>Assign one SLA to exact services, runtimes, or locations.</span></NavLink><NavLink to="/settings/appearance" className="settings-summary"><span className="eyebrow">Appearance</span><strong>Select system, light, or dark.</strong><span>Theme changes immediately and keeps status contrast intact.</span></NavLink><NavLink to="/settings/intro" className="settings-summary"><span className="eyebrow">Intro & walkthrough</span><strong>Run onboarding or replay the walkthrough.</strong><span>Use when onboarding a responder or changing ownership boundaries.</span></NavLink></div></section>;

export const SettingsPage = () => {
  const { page = "watch" } = useParams();
  const content = page === "appearance" ? <AppearanceSettings /> : page === "intro" ? <IntroSettings /> : page === "provider-connections" ? <ProviderConnectionsSettings /> : page === "sla-overrides" ? <SlaOverrideSettings /> : page === "watch" ? <WatchSettings /> : <SettingsLanding />;
  return <div className="settings-layout"><SettingsRail page={page} /><main className="settings-content">{content}</main></div>;
};
