import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAppFunction, useDql } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";
import { CommunityLink } from "../components/CommunityLink";
import { ContractOverrideEditor } from "../components/ContractOverrideEditor";
import { useSlaPreferences } from "../context/SlaPreferencesContext";
import { useContractOverrides } from "../hooks/useContractOverrides";
import { createOverrideKey } from "../data/contractOverrides";
import { EVIDENCE_LOOKBACK_OPTIONS } from "../data/lookback";
import { SERVICES_QUERY, SMARTSCAPE_SERVICE_RUNTIME_QUERY } from "../data/queries";
import { parseSmartscapeScopeEdges } from "../data/topology";
import type { ContractOverrideValue, ContractScopeKind, EvidenceLookbackHours, ServiceRecord, SlaProviderResponse, SlaThemePreference } from "../types";

const SETUP_LINKS = [
  ["watch", "Monitor configuration"],
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
      <div className="settings-rail-note">Monitor configuration and SLA overrides are shared with the workspace. Theme and walkthrough state stay personal to you. The change log is read-only.</div>
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
  const [providerSlug, setProviderSlug] = useState(preferences.providerSlug);
  const [providerLabelKey, setProviderLabelKey] = useState(preferences.providerLabelKey);
  const [lookbackHours, setLookbackHours] = useState<EvidenceLookbackHours>(preferences.lookbackHours);
  const [saved, setSaved] = useState(false);
  const directoryRequest = useMemo(() => ({ vendor: preferences.providerSlug }), [preferences.providerSlug]);
  const directoryConnection = useAppFunction<SlaProviderResponse>({ name: "slaDirectory", data: directoryRequest, responseType: "json" });

  useEffect(() => {
    setProviderSlug(preferences.providerSlug);
    setProviderLabelKey(preferences.providerLabelKey);
    setLookbackHours(preferences.lookbackHours);
  }, [preferences.providerLabelKey, preferences.providerSlug, preferences.lookbackHours]);

  const save = async () => {
    await updatePreferences({
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
        <Paragraph>Choose the contract, Dynatrace tag convention, and evidence window. Review service assignments from Setup.</Paragraph>
      </div>
      <div className="settings-form-grid">
        <label className="field-label">Provider directory slug
          <input value={providerSlug} onChange={(event) => setProviderSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="aws" autoComplete="off" />
          <small>Use the slug from sla.directory, such as <code>aws</code> or <code>azure</code>.</small>
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
          <small>{directoryConnection.isLoading
            ? `Checking ${preferences.providerSlug}`
            : directoryConnection.data
              ? `${directoryConnection.data.provider.name} public terms are available.`
              : `The ${preferences.providerSlug} public record could not be loaded.`}</small>
        </div>
        <span className={`connection-state ${directoryConnection.isLoading ? "checking" : directoryConnection.data ? "connected" : "unavailable"}`}>
          {directoryConnection.isLoading ? "Checking" : directoryConnection.data ? "Connected" : "Unavailable"}
        </span>
        <Button size="condensed" disabled={directoryConnection.isLoading} onClick={() => void directoryConnection.refetch()}>Check connection</Button>
      </div>
      <div className="settings-preview">
        <div className="eyebrow">Matching rule preview</div>
        <strong>{providerLabelKey || "provider"}:{providerSlug || "provider-slug"}</strong>
        <span>SLA Watch will look for this tag. Saving the rule does not modify Dynatrace services.</span>
        <NavLink className="text-action" to="/setup">Review service mapping in Setup</NavLink>
      </div>
      <div className="settings-actions"><Button variant="emphasized" disabled={!providerSlug.trim()} onClick={() => void save()}>Save monitor settings</Button>{saved ? <SavedNote text="Monitor settings saved" /> : null}</div>
    </section>
  );
};

const SlaOverrideSettings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { preferences } = useSlaPreferences();
  const directoryRequest = useMemo(() => ({ vendor: preferences.providerSlug }), [preferences.providerSlug]);
  const directoryQuery = useAppFunction<SlaProviderResponse>({ name: "slaDirectory", data: directoryRequest, responseType: "json" });
  const serviceQuery = useDql({ query: SERVICES_QUERY });
  const topologyQuery = useDql({ query: SMARTSCAPE_SERVICE_RUNTIME_QUERY });
  const contractSettings = useContractOverrides();

  const services = useMemo<ServiceRecord[]>(() => {
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

  const initialValue = useMemo<ContractOverrideValue | undefined>(() => {
    const directory = directoryQuery.data;
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
  }, [directoryQuery.data, location.search, services, topology]);

  const loading = directoryQuery.isLoading || serviceQuery.isLoading || topologyQuery.isLoading || contractSettings.loading;

  return (
    <section className="settings-page settings-page-wide">
      <div className="page-intro sla-override-page-intro">
        <Text className="eyebrow">Settings · SLA overrides</Text>
        <Heading level={1}>Add a custom SLA.</Heading>
        <Paragraph>Define operational terms for a provider service and an explicit Dynatrace scope. Public sla.directory terms remain available as the comparison baseline.</Paragraph>
      </div>
      {loading ? <div className="settings-callout" role="status"><strong>Loading contract scope</strong><span>Reading the provider record, service inventory, Smartscape topology, and tenant settings.</span></div> : null}
      {!loading && !directoryQuery.data ? <div className="error-box"><strong>Provider terms are unavailable.</strong><span>Return to Monitor configuration, verify the provider slug and API connection, then try again.</span></div> : null}
      {!loading && directoryQuery.data && initialValue ? (
        <>
          {!contractSettings.canWrite ? <div className="error-box compact-error">Your current role can review SLA overrides but cannot create them. Ask a Dynatrace administrator for app-settings write access.</div> : null}
          {(serviceQuery.error || topologyQuery.error) ? <div className="settings-callout"><strong>Some Dynatrace scopes are unavailable</strong><span>You can still create a provider-level SLA override. Service, host, and location choices require the corresponding entity or Smartscape read access.</span></div> : null}
          <ContractOverrideEditor
            presentation="page"
            provider={directoryQuery.data}
            services={services}
            topology={topology}
            overrides={contractSettings.overrides.filter((override) => override.providerSlug === directoryQuery.data?.provider.slug)}
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
      <div className="onboarding-status-row"><div><span className="eyebrow">Setup status</span><strong>{preferences.onboardingComplete ? "Configured" : "Not configured"}</strong></div><div><span className="eyebrow">Walkthrough</span><strong>{preferences.tourCompleted ? "Completed" : "Ready to replay"}</strong></div><div><span className="eyebrow">Provider</span><strong>{preferences.providerSlug}</strong></div></div>
      <div className="settings-actions"><Button variant="emphasized" onClick={() => void restartIntro()}>Restart intro setup</Button><Button onClick={() => void resetTour()}>Start walkthrough now</Button>{saved ? <SavedNote text="Walkthrough is ready" /> : null}</div>
      <div className="settings-callout"><strong>What onboarding does not do.</strong><span>It does not create an SLA claim, change telemetry, add tags, or make a provider determination for you.</span></div>
    </section>
  );
};

const SettingsLanding = () => <section className="settings-page"><div className="page-intro"><Text className="eyebrow">SLA workspace</Text><Heading level={1}>Workspace configuration</Heading><Paragraph>Configure monitor defaults, SLA evidence boundaries, and operator-facing display settings.</Paragraph></div><div className="settings-summary-grid"><NavLink to="/settings/watch" className="settings-summary"><span className="eyebrow">Monitor configuration</span><strong>Select the provider and tag convention.</strong><span>Service assignments are reviewed from Setup.</span></NavLink><NavLink to="/settings/sla-overrides" className="settings-summary"><span className="eyebrow">SLA overrides</span><strong>Define tenant terms and evidence targets.</strong><span>Assign one SLA to exact services, runtimes, or locations.</span></NavLink><NavLink to="/settings/appearance" className="settings-summary"><span className="eyebrow">Appearance</span><strong>Select system, light, or dark.</strong><span>Theme changes immediately and keeps status contrast intact.</span></NavLink><NavLink to="/settings/intro" className="settings-summary"><span className="eyebrow">Intro & walkthrough</span><strong>Run onboarding or replay the walkthrough.</strong><span>Use when onboarding a responder or changing ownership boundaries.</span></NavLink></div></section>;

export const SettingsPage = () => {
  const { page = "watch" } = useParams();
  const content = page === "appearance" ? <AppearanceSettings /> : page === "intro" ? <IntroSettings /> : page === "sla-overrides" ? <SlaOverrideSettings /> : page === "watch" ? <WatchSettings /> : <SettingsLanding />;
  return <div className="settings-layout"><SettingsRail page={page} /><main className="settings-content">{content}</main></div>;
};
