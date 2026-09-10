import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { Button } from "@dynatrace/strato-components/buttons";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";
import { useSlaPreferences } from "../context/SlaPreferencesContext";
import type { SlaThemePreference } from "../types";

const SETUP_LINKS = [
  ["watch", "Watch configuration"],
  ["appearance", "Appearance"],
  ["intro", "Intro & walkthrough"],
] as const;

const OPERATE_LINKS = [
  ["/bugs", "Bug management"],
  ["/changes", "Change management"],
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
      <div className="settings-rail-note">Watch configuration and workflow records are shared with the workspace. Theme and walkthrough state stay personal to you.</div>
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

const WatchSettings = () => {
  const { preferences, updatePreferences } = useSlaPreferences();
  const [providerSlug, setProviderSlug] = useState(preferences.providerSlug);
  const [providerLabelKey, setProviderLabelKey] = useState(preferences.providerLabelKey);
  const [lookbackHours, setLookbackHours] = useState<24 | 72>(preferences.lookbackHours);
  const [saved, setSaved] = useState(false);

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
        <Text className="eyebrow">Settings · watch</Text>
        <Heading level={1}>Configure the evidence boundary.</Heading>
        <Paragraph>Choose the contract to compare, the Dynatrace label convention to look for, and the time window used by the watch.</Paragraph>
      </div>
      <div className="settings-form-grid">
        <label className="field-label">Provider directory slug
          <input value={providerSlug} onChange={(event) => setProviderSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="aws" autoComplete="off" />
          <small>Use the slug from sla.directory, such as <code>aws</code> or <code>azure</code>.</small>
        </label>
        <label className="field-label">Provider label key
          <input value={providerLabelKey} onChange={(event) => setProviderLabelKey(event.target.value)} placeholder="provider" autoComplete="off" />
          <small>Examples the watch understands: <code>provider:aws</code>, <code>vendor=aws</code>, or <code>[aws]</code>.</small>
        </label>
        <label className="field-label">Evidence lookback
          <select value={lookbackHours} onChange={(event) => setLookbackHours(Number(event.target.value) === 72 ? 72 : 24)}>
            <option value={24}>Last 24 hours</option>
            <option value={72}>Last 72 hours</option>
          </select>
          <small>A wider window helps with slow-moving incidents but can add unrelated history.</small>
        </label>
      </div>
      <div className="settings-preview">
        <div className="eyebrow">Attribution preview</div>
        <strong>{providerLabelKey || "provider"}:{providerSlug || "provider-slug"}</strong>
        <span>The watch will report “Labeling missing” when services exist but no configured provider label is found.</span>
      </div>
      <div className="settings-actions"><Button variant="emphasized" disabled={!providerSlug.trim()} onClick={() => void save()}>Save watch settings</Button>{saved ? <SavedNote text="Watch settings saved" /> : null}</div>
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
      <div className="page-intro"><Text className="eyebrow">Settings · appearance</Text><Heading level={1}>Make the watch comfortable at 2 a.m.</Heading><Paragraph>Use the tenant theme by default, or pin the app to light or dark mode. The setting follows you between sessions.</Paragraph></div>
      <div className="theme-choice-grid">
        {([
          ["system", "System", "Follow the Dynatrace tenant theme."],
          ["light", "Daylight", "High-contrast light surfaces for bright rooms."],
          ["dark", "Night shift", "Low-glare dark surfaces for incident response."],
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
      <div className="page-intro"><Text className="eyebrow">Settings · onboarding</Text><Heading level={1}>Keep the first run useful.</Heading><Paragraph>Replay the short setup when the provider boundary changes. The walkthrough can be replayed independently whenever a new teammate joins the watch.</Paragraph></div>
      <div className="onboarding-status-row"><div><span className="eyebrow">Setup status</span><strong>{preferences.onboardingComplete ? "Configured" : "Not configured"}</strong></div><div><span className="eyebrow">Walkthrough</span><strong>{preferences.tourCompleted ? "Completed" : "Ready to replay"}</strong></div><div><span className="eyebrow">Provider</span><strong>{preferences.providerSlug}</strong></div></div>
      <div className="settings-actions"><Button variant="emphasized" onClick={() => void restartIntro()}>Restart intro setup</Button><Button onClick={() => void resetTour()}>Start walkthrough now</Button>{saved ? <SavedNote text="Walkthrough is ready" /> : null}</div>
      <div className="settings-callout"><strong>What the setup does not do.</strong><span>It does not create an SLA claim, change telemetry, add labels, or make a provider determination for you.</span></div>
    </section>
  );
};

const SettingsLanding = () => <section className="settings-page"><div className="page-intro"><Text className="eyebrow">SLA workspace</Text><Heading level={1}>Settings that protect the investigation.</Heading><Paragraph>Configure the provider boundary, tune the evidence window, and keep the operator handoff consistent.</Paragraph></div><div className="settings-summary-grid"><NavLink to="/settings/watch" className="settings-summary"><span className="eyebrow">Watch configuration</span><strong>Choose your contract and label convention.</strong><span>Current provider settings are visible before every investigation.</span></NavLink><NavLink to="/settings/appearance" className="settings-summary"><span className="eyebrow">Appearance</span><strong>Daylight, night shift, or system.</strong><span>Theme changes immediately and keeps status contrast intact.</span></NavLink><NavLink to="/settings/intro" className="settings-summary"><span className="eyebrow">Intro & walkthrough</span><strong>Replay the moment that explains the model.</strong><span>Useful for new responders and changing ownership boundaries.</span></NavLink></div></section>;

export const SettingsPage = () => {
  const { page = "watch" } = useParams();
  const content = page === "appearance" ? <AppearanceSettings /> : page === "intro" ? <IntroSettings /> : page === "watch" ? <WatchSettings /> : <SettingsLanding />;
  return <div className="settings-layout"><SettingsRail page={page} /><main className="settings-content">{content}</main></div>;
};
