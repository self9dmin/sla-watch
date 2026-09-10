import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components/layouts";
import {
  DarkmodeIcon,
  GuideIcon,
  HelpIcon,
  HistoryIcon,
  LightmodeIcon,
  SettingIcon,
  SupportIcon,
} from "@dynatrace/strato-icons";
import { COMMUNITY_PROFILE_URL } from "../data/externalLinks";

type AppTheme = "light" | "dark";

export const Header = ({
  theme,
  onToggleTheme,
  onStartTour,
}: {
  theme: AppTheme;
  onToggleTheme: () => void;
  onStartTour: () => void;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const isSettings = location.pathname.startsWith("/settings");
  const isChanges = location.pathname.startsWith("/changes");
  const isWatch = location.pathname === "/" || location.pathname === "/review";
  const isDirectory = location.pathname === "/directory";

  return (
    <AppHeader>
      <AppHeader.Navigation>
        <AppHeader.Logo as={Link} to="/" appName="SLA Watch" />
        <AppHeader.NavigationItem as={Link} to="/" isSelected={isWatch} className="sla-nav-primary" data-tour="watch">
          Watch
        </AppHeader.NavigationItem>
        <AppHeader.NavigationItem as={Link} to="/directory" isSelected={isDirectory} data-tour="provider">
          Provider directory
        </AppHeader.NavigationItem>
      </AppHeader.Navigation>
      <AppHeader.ActionItems>
        <AppHeader.ActionButton
          onClick={onToggleTheme}
          prefixIcon={theme === "dark" ? <LightmodeIcon /> : <DarkmodeIcon />}
          showLabel={false}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        />
        <AppHeader.ActionButton
          onClick={() => { void navigate("/settings/watch"); }}
          prefixIcon={<SettingIcon />}
          showLabel={false}
          isSelected={isSettings}
          aria-label="Settings"
          data-tour="settings"
        />
        <AppHeader.ActionButton
          onClick={onStartTour}
          prefixIcon={<GuideIcon />}
          showLabel={false}
          aria-label="Start or replay SLA Watch walkthrough"
          data-tour="tour"
        />
        <AppHeader.ActionButton
          onClick={() => setHelpOpen((current) => !current)}
          prefixIcon={<HelpIcon />}
          showLabel={false}
          isSelected={helpOpen}
          aria-label="Open SLA Watch guide"
          aria-expanded={helpOpen}
        />
        <AppHeader.ActionButton
          onClick={() => { void navigate("/changes"); }}
          prefixIcon={<HistoryIcon />}
          showLabel={false}
          isSelected={isChanges}
          aria-label="Open change log"
          data-tour="changes"
        />
        <AppHeader.ActionButton
          as="a"
          href={COMMUNITY_PROFILE_URL}
          target="_blank"
          rel="noreferrer"
          prefixIcon={<SupportIcon />}
          showLabel={false}
          aria-label="Open Dynatrace Community profile"
          data-tour="community"
        />
      </AppHeader.ActionItems>
      {helpOpen ? (
        <aside className="help-drawer" aria-label="SLA Watch guide">
          <div className="help-drawer-header">
            <div>
              <div className="eyebrow">SLA Watch guide</div>
              <h2>Provider attribution guidance</h2>
            </div>
            <button type="button" className="icon-button" onClick={() => setHelpOpen(false)} aria-label="Close guide">
              Close
            </button>
          </div>
          <p>Review the live evidence first, then check service boundary, provider identity, and contract evidence. An unidentified provider remains unidentified until a label or mapping is available.</p>
          <section>
            <h3>1. Observe</h3>
            <p>Review service inventory, Problems, logs, and spans for the selected lookback window.</p>
          </section>
          <section>
            <h3>2. Identify</h3>
            <p>Provider identity requires an explicit Dynatrace label or a mapping you can explain to the next responder.</p>
          </section>
          <section>
            <h3>3. Review</h3>
            <p>Incident review compares observed Problems with provider terms and planning dates. A matching service and active Problem do not prove provider fault or credit eligibility by themselves.</p>
          </section>
          <section>
            <h3>4. Get support</h3>
            <p>The change log documents application releases. Questions and issue discussion belong on the Dynatrace Community profile.</p>
          </section>
          <div className="help-drawer-actions">
            <button type="button" className="link-button" onClick={() => { setHelpOpen(false); void navigate("/settings/watch"); }}>Open watch settings</button>
            <a className="link-button" href={COMMUNITY_PROFILE_URL} target="_blank" rel="noreferrer" onClick={() => setHelpOpen(false)}>Open community profile</a>
            <button type="button" className="link-button" onClick={() => { setHelpOpen(false); onStartTour(); }}>Replay walkthrough</button>
          </div>
        </aside>
      ) : null}
    </AppHeader>
  );
};
