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
import { CONNECTED_PROVIDER_OPTIONS, createProviderConnectionKey, providerConnectionScopeId, providerConnectionScopeLabel, providerConnectionVerificationKey, validateProviderConnection, type ConnectedProvider } from "../data/providerConnections";
import { EVIDENCE_LOOKBACK_OPTIONS } from "../data/lookback";
import { createServiceMetricsQuery, SERVICES_QUERY, SMARTSCAPE_SERVICE_RUNTIME_QUERY } from "../data/queries";
import { detectedProviderSlugs, parseServiceCloudContexts, parseSmartscapeScopeEdges } from "../data/topology";
import { normalizeProviderSlug, PROVIDER_CATALOG, providerDetail, providerDisplayName } from "../data/providers";
import type { AwsProviderNoticesResponse, AzureProviderNoticesResponse, ContractOverrideValue, ContractScopeKind, EvidenceLookbackHours, GcpProviderNoticesResponse, OciProviderNoticesResponse, ProviderConnectionValue, ServiceRecord, SlaProviderResponse, SlaThemePreference } from "../types";

const SETUP_LINKS = [
  ["watch", "Provider configuration"],
  ["provider-connections", "Provider connections"],
  ["sla-overrides", "Custom terms"],
  ["appearance", "Appearance"],
  ["intro", "Onboarding & walkthrough"],
] as const;

const OPERATE_LINKS = [
  ["/changes", "Change log"],
] as const;

const SettingsRail = ({ page }: { page: string }) => {
  const navigate = useNavigate();
  return (
    <aside className="settings-rail">
      <Button variant="default" onClick={() => { void navigate("/"); }}>Back to SLA Review</Button>
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
      <div className="settings-rail-note">Provider configuration, connections, custom terms, and evidence decisions are shared with the workspace. Theme and walkthrough state stay personal to you. The change log is read-only.</div>
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
        <Text className="eyebrow">Settings · providers</Text>
        <Heading level={1}>Configure provider defaults.</Heading>
        <Paragraph>Choose the providers to monitor, the active provider for focused views, and the evidence window. Review service assignments in Coverage.</Paragraph>
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
          <small>Coverage, Incidents, Evidence, and Directory focus on this provider. Other monitored providers remain configured.</small>
        </label>
        <label className="field-label">Provider tag key
          <input value={providerLabelKey} onChange={(event) => setProviderLabelKey(event.target.value)} placeholder="provider" autoComplete="off" />
          <small>Examples the app understands: <code>provider:aws</code>, <code>vendor=aws</code>, or <code>[aws]</code>.</small>
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
        <span>The app checks these explicit tags and separately reports Smartscape candidates. Saving provider settings does not modify Dynatrace services.</span>
        <NavLink className="text-action" to="/">Review service mapping in Coverage</NavLink>
      </div>
      <div className="settings-actions"><Button variant="emphasized" disabled={providerSlugs.length === 0 || !providerSlug.trim()} onClick={() => void save()}>Save provider settings</Button>{saved ? <SavedNote text="Provider settings saved" /> : null}</div>
    </section>
  );
};

const connectionScopeNoun = (providerSlug: ConnectedProvider): string => {
  return CONNECTED_PROVIDER_OPTIONS.find((provider) => provider.slug === providerSlug)?.scopeNoun ?? "project";
};

const connectionDefaultName = (providerSlug: ConnectedProvider): string => {
  if (providerSlug === "aws") return "AWS account";
  if (providerSlug === "azure") return "Azure subscription";
  if (providerSlug === "oci") return "OCI tenancy";
  return "Google Cloud project";
};

const connectionUseLabel = (providerSlug: ConnectedProvider): string => {
  if (providerSlug === "aws") return "Use account Health events";
  if (providerSlug === "azure") return "Use subscription Service Health events";
  if (providerSlug === "oci") return "Use tenancy announcements";
  return "Use project-specific notices";
};

const disabledConnectionDetail = (providerSlug: ConnectedProvider): string => {
  if (providerSlug === "aws" || providerSlug === "azure") return "When disabled, account-specific provider evidence is not read. Dynatrace evidence and sla.directory terms remain available.";
  return `When disabled, Evidence uses only the public ${providerSlug === "oci" ? "OCI regional" : "Google Cloud"} status source.`;
};

const emptyProviderConnection = (providerSlug: ConnectedProvider): ProviderConnectionValue => ({
  connectionKey: "",
  providerSlug,
  displayName: connectionDefaultName(providerSlug),
  accountId: "",
  subscriptionId: "",
  projectId: "",
  tenancyId: "",
  region: providerSlug === "oci" ? "us-ashburn-1" : "",
  credentialId: "",
  enabled: true,
});

const shortConnectionScope = (value: ProviderConnectionValue): string => {
  const scope = providerConnectionScopeLabel(value);
  return scope.length > 54 ? `${scope.slice(0, 30)}…${scope.slice(-18)}` : scope;
};

const ProviderConnectionsSettings = () => {
  const providerConnections = useProviderConnections();
  const [connectionProvider, setConnectionProvider] = useState<ConnectedProvider>("aws");
  const connections = useMemo(() => providerConnections.connections
    .filter((item) => item.providerSlug === connectionProvider)
    .sort((left, right) => left.displayName.localeCompare(right.displayName) || providerConnectionScopeId(left).localeCompare(providerConnectionScopeId(right))), [connectionProvider, providerConnections.connections]);
  const [selectedConnectionKey, setSelectedConnectionKey] = useState("auto");
  const existing = connections.find((item) => item.connectionKey === selectedConnectionKey);
  const [draft, setDraft] = useState<ProviderConnectionValue>(() => emptyProviderConnection("aws"));
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [testMessage, setTestMessage] = useState<{ tone: "positive" | "warning"; text: string }>();
  const [verifiedConnectionKey, setVerifiedConnectionKey] = useState<string>();
  const gcpTestRequest = useMemo(() => ({
    projectId: draft.projectId.trim().toLowerCase(),
    credentialId: draft.credentialId.trim().toUpperCase(),
    lookbackHours: 24,
    requirePersonalized: true,
  }), [draft.credentialId, draft.projectId]);
  const ociTestRequest = useMemo(() => ({
    tenancyId: draft.tenancyId.trim().toLowerCase(),
    region: draft.region.trim().toLowerCase(),
    credentialId: draft.credentialId.trim().toUpperCase(),
    lookbackHours: 24,
  }), [draft.credentialId, draft.region, draft.tenancyId]);
  const awsTestRequest = useMemo(() => ({
    accountId: draft.accountId.trim(),
    credentialId: draft.credentialId.trim().toUpperCase(),
    lookbackHours: 24,
  }), [draft.accountId, draft.credentialId]);
  const azureTestRequest = useMemo(() => ({
    subscriptionId: draft.subscriptionId.trim().toLowerCase(),
    credentialId: draft.credentialId.trim().toUpperCase(),
    lookbackHours: 24,
  }), [draft.credentialId, draft.subscriptionId]);
  const gcpConnectionTest = useAppFunction<GcpProviderNoticesResponse>(
    { name: "gcpServiceHealth", data: gcpTestRequest, responseType: "json" },
    { autoFetch: false, autoFetchOnUpdate: false },
  );
  const ociConnectionTest = useAppFunction<OciProviderNoticesResponse>(
    { name: "ociAnnouncements", data: ociTestRequest, responseType: "json" },
    { autoFetch: false, autoFetchOnUpdate: false },
  );
  const awsConnectionTest = useAppFunction<AwsProviderNoticesResponse>(
    { name: "awsHealth", data: awsTestRequest, responseType: "json" },
    { autoFetch: false, autoFetchOnUpdate: false },
  );
  const azureConnectionTest = useAppFunction<AzureProviderNoticesResponse>(
    { name: "azureServiceHealth", data: azureTestRequest, responseType: "json" },
    { autoFetch: false, autoFetchOnUpdate: false },
  );
  const connectionTest = connectionProvider === "aws"
    ? awsConnectionTest
    : connectionProvider === "azure"
      ? azureConnectionTest
      : connectionProvider === "oci"
        ? ociConnectionTest
        : gcpConnectionTest;
  const scopeNoun = connectionScopeNoun(connectionProvider);
  const outboundHost = `announcements.${draft.region || "us-ashburn-1"}.oraclecloud.com`;

  useEffect(() => {
    if (providerConnections.loading || selectedConnectionKey !== "auto") return;
    const first = connections[0];
    setSelectedConnectionKey(first?.connectionKey ?? "new");
    setDraft(first ? { ...first } : emptyProviderConnection(connectionProvider));
  }, [connectionProvider, connections, providerConnections.loading, selectedConnectionKey]);

  const selectProvider = (providerSlug: ConnectedProvider) => {
    setConnectionProvider(providerSlug);
    setSelectedConnectionKey("auto");
    setDraft(emptyProviderConnection(providerSlug));
    setFormError(undefined);
    setTestMessage(undefined);
    setVerifiedConnectionKey(undefined);
    setSaved(false);
  };

  const selectConnection = (connectionKey: string) => {
    const selected = connections.find((item) => item.connectionKey === connectionKey);
    setSelectedConnectionKey(connectionKey);
    setDraft(selected ? { ...selected } : emptyProviderConnection(connectionProvider));
    setFormError(undefined);
    setTestMessage(undefined);
    setVerifiedConnectionKey(undefined);
    setSaved(false);
  };

  const updateDraft = (patch: Partial<ProviderConnectionValue>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setFormError(undefined);
    setTestMessage(undefined);
    setVerifiedConnectionKey(undefined);
    setSaved(false);
  };

  const normalizedDraft = (): ProviderConnectionValue => ({
    ...draft,
    connectionKey: createProviderConnectionKey(connectionProvider, providerConnectionScopeId(draft)),
    providerSlug: connectionProvider,
    displayName: draft.displayName.trim() || connectionDefaultName(connectionProvider),
    accountId: draft.accountId.trim(),
    subscriptionId: draft.subscriptionId.trim().toLowerCase(),
    projectId: draft.projectId.trim().toLowerCase(),
    tenancyId: draft.tenancyId.trim().toLowerCase(),
    region: draft.region.trim().toLowerCase(),
    credentialId: draft.credentialId.trim().toUpperCase(),
  });

  const currentVerificationKey = providerConnectionVerificationKey(normalizedDraft());
  const existingVerificationKey = existing ? providerConnectionVerificationKey(existing) : undefined;
  const verificationRequired = !existing || currentVerificationKey !== existingVerificationKey;
  const connectionVerified = verifiedConnectionKey === currentVerificationKey;
  const connectionFieldsComplete = validateProviderConnection(normalizedDraft()).length === 0;
  const connectionMayBeSaved = !verificationRequired || connectionVerified;

  const save = async () => {
    const value = normalizedDraft();
    const errors = validateProviderConnection(value);
    if (errors.length > 0) {
      setFormError(errors[0]);
      return;
    }
    if (verificationRequired && !connectionVerified) {
      setFormError(`Test this ${connectionProvider.toUpperCase()} ${scopeNoun} connection before saving it.`);
      return;
    }
    setFormError(undefined);
    const duplicate = providerConnections.connections.find((item) => item.connectionKey === value.connectionKey && item.objectId !== existing?.objectId);
    if (duplicate) {
      setFormError(`A connection for this ${scopeNoun} already exists.`);
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
      setVerifiedConnectionKey(providerConnectionVerificationKey(value));
      setTestMessage({ tone: "positive", text: `${result.message} Authentication and ${scopeNoun} access are working.` });
    } catch (error: unknown) {
      setVerifiedConnectionKey(undefined);
      setTestMessage({ tone: "warning", text: error instanceof Error ? error.message : `The ${connectionProvider.toUpperCase()} connection could not be verified.` });
    }
  };

  const remove = async () => {
    if (!existing || !window.confirm(`Remove the ${connectionProvider.toUpperCase()} connection for ${shortConnectionScope(existing)}? The Credential Vault entry will not be deleted.`)) return;
    await providerConnections.deleteConnection(existing);
    const next = connections.find((item) => item.objectId !== existing.objectId);
    selectConnection(next?.connectionKey ?? "new");
  };

  return (
    <section className="settings-page provider-connections-settings">
      <div className="page-intro">
        <Heading level={1}>Connect provider incident data.</Heading>
        <Paragraph>Add account-specific incident sources for AWS, Azure, Google Cloud, or OCI. Each connection is optional and read-only.</Paragraph>
      </div>

      <div className="provider-connection-boundary">
        <div><span className="eyebrow">Optional provider evidence</span><strong>AWS Health · Azure Service Health · Google Cloud Personalized Service Health · OCI Announcements</strong><small>Published terms work without these connections. Add more than one account, subscription, project, or tenancy when required.</small></div>
        <span className="connection-state connected">{providerConnections.connections.filter((item) => CONNECTED_PROVIDER_OPTIONS.some((provider) => provider.slug === item.providerSlug)).length} saved</span>
      </div>

      <div className="provider-connection-prerequisite"><strong>Before you connect</strong><span>Allow the listed provider hosts under Dynatrace Settings &gt; General &gt; External requests. Create a Token in Credential Vault with AppEngine scope, access limited to SLA Review, and access for the administrators who will test it. Paste only the credential ID below.</span></div>

      <div className="provider-connection-switcher">
        <label className="field-label">Connection type
          <select value={connectionProvider} onChange={(event) => selectProvider(event.target.value as ConnectedProvider)}>
            {CONNECTED_PROVIDER_OPTIONS.map((provider) => <option key={provider.slug} value={provider.slug}>{provider.label}</option>)}
          </select>
        </label>
        <label className="field-label">Saved {scopeNoun} connection
          <select value={selectedConnectionKey === "auto" ? "new" : selectedConnectionKey} onChange={(event) => selectConnection(event.target.value)}>
            <option value="new">Add a new {scopeNoun}</option>
            {connections.map((item) => <option key={item.objectId} value={item.connectionKey}>{item.displayName} · {shortConnectionScope(item)}</option>)}
          </select>
        </label>
        {existing ? <Button size="condensed" onClick={() => selectConnection("new")}>Add another {scopeNoun}</Button> : null}
      </div>

      {connectionProvider === "aws" ? (
        <ol className="provider-connection-steps" aria-label="AWS connection requirements">
          <li><span>1</span><div><strong>Confirm AWS Health API access</strong><small>The account needs Business Support+, Enterprise Support, or Unified Operations.</small></div></li>
          <li><span>2</span><div><strong>Grant two read actions</strong><small>Use a dedicated identity with <code>health:DescribeEvents</code> and <code>health:DescribeEventDetails</code>.</small></div></li>
          <li><span>3</span><div><strong>Vault the signing JSON</strong><small>Store <code>accessKeyId</code>, <code>secretAccessKey</code>, and optional <code>sessionToken</code>. Allow <code>sts.us-east-1.amazonaws.com</code> and <code>health.us-east-1.amazonaws.com</code>.</small></div></li>
        </ol>
      ) : connectionProvider === "azure" ? (
        <ol className="provider-connection-steps" aria-label="Azure connection requirements">
          <li><span>1</span><div><strong>Create a dedicated app registration</strong><small>Create a client secret for a non-interactive service principal.</small></div></li>
          <li><span>2</span><div><strong>Grant one read action</strong><small>Assign <code>Microsoft.ResourceHealth/events/read</code> on the subscription.</small></div></li>
          <li><span>3</span><div><strong>Vault the client credential JSON</strong><small>Store <code>tenantId</code>, <code>clientId</code>, and <code>clientSecret</code>. Allow <code>login.microsoftonline.com</code> and <code>management.azure.com</code>.</small></div></li>
        </ol>
      ) : connectionProvider === "oci" ? (
        <ol className="provider-connection-steps" aria-label="OCI connection requirements">
          <li><span>1</span><div><strong>Create a dedicated API user</strong><small>Upload an RSA API signing key. Do not use a Console password or auth token.</small></div></li>
          <li><span>2</span><div><strong>Grant Announcements read access</strong><small><code>Allow group AnnouncementListers to inspect announcements in tenancy</code></small></div></li>
          <li><span>3</span><div><strong>Vault the signing JSON</strong><small>Use a Token credential restricted to SLA Review, then allow outbound host <code>{outboundHost}</code>.</small></div></li>
        </ol>
      ) : (
        <ol className="provider-connection-steps" aria-label="Google Cloud connection requirements">
          <li><span>1</span><div><strong>Enable Service Health API</strong><small>Enable <code>servicehealth.googleapis.com</code> for the project.</small></div></li>
          <li><span>2</span><div><strong>Grant the two required roles</strong><small>Use a dedicated service account with <code>roles/servicehealth.viewer</code> and <code>roles/serviceusage.serviceUsageConsumer</code>.</small></div></li>
          <li><span>3</span><div><strong>Vault the service-account JSON</strong><small>Create an AppEngine-scoped Token restricted to SLA Review. Allow <code>oauth2.googleapis.com</code> and <code>servicehealth.googleapis.com</code>.</small></div></li>
        </ol>
      )}

      <div className="settings-form-grid provider-connection-form">
        <label className="field-label">Connection name
          <input value={draft.displayName} onChange={(event) => updateDraft({ displayName: event.target.value })} placeholder={connectionDefaultName(connectionProvider)} autoComplete="off" maxLength={80} required />
          <small>Operator-facing name only.</small>
        </label>
        {connectionProvider === "aws" ? <label className="field-label">AWS account ID
          <input value={draft.accountId} onChange={(event) => updateDraft({ accountId: event.target.value.replace(/\D/g, "") })} placeholder="123456789012" autoComplete="off" inputMode="numeric" maxLength={12} pattern="[0-9]{12}" required />
          <small>STS verifies that the vaulted credential belongs to this account.</small>
        </label> : connectionProvider === "azure" ? <label className="field-label">Azure subscription ID
          <input value={draft.subscriptionId} onChange={(event) => updateDraft({ subscriptionId: event.target.value.toLowerCase().replace(/[^a-f0-9-]/g, "") })} placeholder="00000000-0000-0000-0000-000000000000" autoComplete="off" spellCheck={false} maxLength={36} required />
          <small>Service Health events are scoped to this subscription.</small>
        </label> : connectionProvider === "oci" ? <>
          <label className="field-label">OCI tenancy OCID
            <input value={draft.tenancyId} onChange={(event) => updateDraft({ tenancyId: event.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, "") })} placeholder="ocid1.tenancy.oc1.." autoComplete="off" spellCheck={false} maxLength={255} required />
            <small>Announcements are returned for this tenancy.</small>
          </label>
          <label className="field-label">OCI commercial region
            <input value={draft.region} onChange={(event) => updateDraft({ region: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="us-ashburn-1" autoComplete="off" spellCheck={false} maxLength={64} required />
            <small>Used only to select the regional Announcements endpoint.</small>
          </label>
        </> : <label className="field-label">Google Cloud project ID
          <input value={draft.projectId} onChange={(event) => updateDraft({ projectId: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="example-project-123" autoComplete="off" maxLength={30} pattern="[a-z][a-z0-9-]{4,28}[a-z0-9]" required />
          <small>The API returns events relevant to this project.</small>
        </label>}
        <label className={`field-label${connectionProvider !== "oci" ? " provider-credential-field" : ""}`}>Dynatrace Credential Vault ID
          <input value={draft.credentialId} onChange={(event) => updateDraft({ credentialId: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} placeholder="Paste the full credential ID" autoComplete="off" spellCheck={false} maxLength={34} pattern="CREDENTIALS_VAULT-[A-Fa-f0-9]{16}" required />
          <small>{connectionProvider === "aws"
            ? <>The Token value must be JSON with <code>accessKeyId</code>, <code>secretAccessKey</code>, and an optional <code>sessionToken</code>. Enter only its credential ID here.</>
            : connectionProvider === "azure"
              ? <>The Token value must be JSON with <code>tenantId</code>, <code>clientId</code>, and <code>clientSecret</code>. Enter only its credential ID here.</>
              : connectionProvider === "oci"
                ? <>The Token value must be JSON with <code>userOcid</code>, <code>fingerprint</code>, and an unencrypted RSA <code>privateKey</code>. Enter only its credential ID here.</>
                : "Enter the credential ID, not the service-account JSON. The secret remains in Credential Vault."}</small>
        </label>
        <label className="provider-enabled-field"><input type="checkbox" checked={draft.enabled} onChange={(event) => updateDraft({ enabled: event.target.checked })} /><span><strong>{connectionUseLabel(connectionProvider)}</strong><small>{disabledConnectionDetail(connectionProvider)}</small></span></label>
      </div>

      {formError ? <div className="error-box compact-error" role="alert">{formError}</div> : null}
      {providerConnections.error ? <div className="error-box compact-error" role="alert">Provider connection settings could not be read. Check App Settings access.</div> : null}
      {!providerConnections.loading && !providerConnections.canWrite ? <div className="settings-callout provider-connection-note"><strong>Read-only access</strong><span>Your current role can review this configuration but cannot create or change provider connections.</span></div> : null}
      {testMessage ? <div className={`provider-connection-test provider-connection-test-${testMessage.tone}`} role="status"><strong>{testMessage.tone === "positive" ? "Connection verified" : "Connection not verified"}</strong><span>{testMessage.text}</span></div> : null}

      <div className="settings-actions">
        <Button variant={connectionMayBeSaved ? "default" : "emphasized"} disabled={connectionTest.isLoading || !connectionFieldsComplete} onClick={() => void testConnection()}>{connectionTest.isLoading ? "Testing connection" : connectionVerified ? "Test again" : "Test connection"}</Button>
        <Button variant={connectionMayBeSaved ? "emphasized" : "default"} disabled={!providerConnections.canWrite || providerConnections.mutating || providerConnections.loading || !connectionFieldsComplete || !connectionMayBeSaved} onClick={() => void save()}>{providerConnections.mutating ? "Saving" : existing ? "Update connection" : "Save connection"}</Button>
        {existing ? <Button disabled={!providerConnections.canWrite || providerConnections.mutating} onClick={() => void remove()}>Remove connection</Button> : null}
        {saved ? <SavedNote text="Provider connection saved" /> : null}
      </div>
      <div className="provider-connection-action-note" role="status">{!connectionFieldsComplete
        ? `Enter the ${scopeNoun} identifier and Credential Vault ID to test this connection.`
        : verificationRequired && !connectionVerified
          ? `Test this ${scopeNoun} connection before saving it.`
          : connectionVerified
            ? "Connection verified. Save it to make this source available in Evidence."
            : "The provider scope and credential are unchanged. Test again at any time."}</div>
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
        <Text className="eyebrow">Settings · custom terms</Text>
        <Heading level={1}>Add custom terms.</Heading>
        <Paragraph>Define operational terms for a provider service and an explicit Dynatrace scope. Published terms remain available as the comparison baseline.</Paragraph>
      </div>
      {loading ? <div className="settings-callout" role="status"><strong>Loading contract scope</strong><span>Reading the provider record, service inventory, Smartscape topology, and tenant settings.</span></div> : null}
      {!loading && !activeDirectory ? <div className="error-box"><strong>Provider terms are unavailable.</strong><span>Return to Provider configuration, verify the active provider and API connection, then try again.</span></div> : null}
      {!loading && activeDirectory && initialValue ? (
        <>
          {!contractSettings.canWrite ? <div className="error-box compact-error">Your current role can review custom terms but cannot create them. Ask a Dynatrace administrator for app-settings write access.</div> : null}
          {(serviceQuery.error || topologyQuery.error) ? <div className="settings-callout"><strong>Some Dynatrace scopes are unavailable</strong><span>You can still create a provider-level override. Service, host, and location choices require the corresponding entity or Smartscape read access.</span></div> : null}
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
      <div className="page-intro"><Text className="eyebrow">Settings · onboarding</Text><Heading level={1}>Review first-run guidance.</Heading><Paragraph>Run onboarding when the monitored provider list changes. Use the shorter walkthrough when a responder needs a tour of the operating views.</Paragraph></div>
      <div className="onboarding-status-row"><div><span className="eyebrow">Onboarding</span><strong>{preferences.onboardingComplete ? "Completed" : "Not completed"}</strong></div><div><span className="eyebrow">Walkthrough</span><strong>Available anytime</strong></div><div><span className="eyebrow">Providers</span><strong>{preferences.providerSlugs.map(providerDisplayName).join(", ")}</strong></div></div>
      <div className="settings-actions"><Button variant="emphasized" onClick={() => void restartIntro()}>Restart onboarding</Button><Button onClick={() => void resetTour()}>Start walkthrough now</Button>{saved ? <SavedNote text="Opening walkthrough" /> : null}</div>
      <div className="settings-callout"><strong>What onboarding changes</strong><span>It saves the monitored providers and active view as workspace settings. It does not create provider credentials, connect a cloud account, change telemetry, add tags, create a claim, or determine provider fault.</span></div>
    </section>
  );
};

const SettingsLanding = () => <section className="settings-page"><div className="page-intro"><Text className="eyebrow">Review workspace</Text><Heading level={1}>Workspace configuration</Heading><Paragraph>Configure providers, optional incident data, evidence boundaries, and operator-facing display settings.</Paragraph></div><div className="settings-summary-grid"><NavLink to="/settings/watch" className="settings-summary"><span className="eyebrow">Provider configuration</span><strong>Select monitored providers and the tag convention.</strong><span>Service assignments are reviewed in Coverage.</span></NavLink><NavLink to="/settings/provider-connections" className="settings-summary"><span className="eyebrow">Provider connections</span><strong>Connect optional provider incident data.</strong><span>Add multiple AWS accounts, Azure subscriptions, Google Cloud projects, or OCI tenancies. Published terms do not require a connection.</span></NavLink><NavLink to="/settings/sla-overrides" className="settings-summary"><span className="eyebrow">Custom terms</span><strong>Define tenant terms and evidence targets.</strong><span>Assign one terms record to exact services, runtimes, or locations.</span></NavLink><NavLink to="/settings/appearance" className="settings-summary"><span className="eyebrow">Appearance</span><strong>Select system, light, or dark.</strong><span>Theme changes immediately and keeps status contrast intact.</span></NavLink><NavLink to="/settings/intro" className="settings-summary"><span className="eyebrow">Onboarding & walkthrough</span><strong>Review first-run setup or tour the operating views.</strong><span>Use onboarding for provider choices and the walkthrough for responder orientation.</span></NavLink></div></section>;

export const SettingsPage = () => {
  const { page = "watch" } = useParams();
  const content = page === "appearance" ? <AppearanceSettings /> : page === "intro" ? <IntroSettings /> : page === "provider-connections" ? <ProviderConnectionsSettings /> : page === "sla-overrides" ? <SlaOverrideSettings /> : page === "watch" ? <WatchSettings /> : <SettingsLanding />;
  return <div className="settings-layout"><SettingsRail page={page} /><main className={`settings-content settings-content-${page}`}>{content}</main></div>;
};
