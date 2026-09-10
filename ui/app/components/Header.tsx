import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components/layouts";
import { Tooltip } from "@dynatrace/strato-components-preview/overlays";
import {
  BugReportIcon,
  DarkmodeIcon,
  GuideIcon,
  HelpIcon,
  HistoryIcon,
  LightmodeIcon,
  SettingIcon,
} from "@dynatrace/strato-icons";

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
  const isBugs = location.pathname.startsWith("/bugs");
  const isChanges = location.pathname.startsWith("/changes");
  const isWatch = location.pathname === "/";
  const isDirectory = location.pathname === "/directory";

  return (
    <AppHeader>
      <AppHeader.Navigation>
        <AppHeader.Logo as={Link} to="/" appName="SLA Watch" />
        <AppHeader.NavigationItem as={Link} to="/" isSelected={isWatch} data-tour="watch">
          SLA Watch
        </AppHeader.NavigationItem>
        <AppHeader.NavigationItem as={Link} to="/directory" isSelected={isDirectory} data-tour="provider">
          Provider directory
        </AppHeader.NavigationItem>
      </AppHeader.Navigation>
      <AppHeader.ActionItems>
        <Tooltip text="Open change management">
          <AppHeader.ActionButton
            onClick={() => { void navigate("/changes"); }}
            prefixIcon={<HistoryIcon />}
            showLabel={false}
            isSelected={isChanges}
            aria-label="Change management"
            data-tour="changes"
          />
        </Tooltip>
        <Tooltip text="Report and manage bugs">
          <AppHeader.ActionButton
            onClick={() => { void navigate("/bugs"); }}
            prefixIcon={<BugReportIcon />}
            showLabel={false}
            isSelected={isBugs}
            aria-label="Bug management"
            data-tour="bugs"
          />
        </Tooltip>
        <Tooltip text={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
          <AppHeader.ActionButton
            onClick={onToggleTheme}
            prefixIcon={theme === "dark" ? <LightmodeIcon /> : <DarkmodeIcon />}
            showLabel={false}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          />
        </Tooltip>
        <Tooltip text="Open settings">
          <AppHeader.ActionButton
            onClick={() => { void navigate("/settings/watch"); }}
            prefixIcon={<SettingIcon />}
            showLabel={false}
            isSelected={isSettings}
            aria-label="Settings"
            data-tour="settings"
          />
        </Tooltip>
        <Tooltip text="Start or replay the walkthrough">
          <AppHeader.ActionButton
            onClick={onStartTour}
            prefixIcon={<GuideIcon />}
            showLabel={false}
            aria-label="Start or replay SLA Watch walkthrough"
            data-tour="tour"
          />
        </Tooltip>
        <Tooltip text="Open the SLA Watch guide">
          <AppHeader.ActionButton
            onClick={() => setHelpOpen((current) => !current)}
            prefixIcon={<HelpIcon />}
            showLabel={false}
            isSelected={helpOpen}
            aria-label="Open SLA Watch guide"
            aria-expanded={helpOpen}
          />
        </Tooltip>
      </AppHeader.ActionItems>
      {helpOpen ? (
        <aside className="help-drawer" aria-label="SLA Watch guide">
          <div className="help-drawer-header">
            <div>
              <div className="eyebrow">SLA Watch guide</div>
              <h2>Make a defensible provider call</h2>
            </div>
            <button type="button" className="icon-button" onClick={() => setHelpOpen(false)} aria-label="Close guide">
              Close
            </button>
          </div>
          <p>Start with the live evidence, then move through the attribution ladder. The app will tell you when a provider is unidentified instead of guessing.</p>
          <section>
            <h3>1. Watch</h3>
            <p>Review service inventory, Problems, logs, and spans for the selected lookback window.</p>
          </section>
          <section>
            <h3>2. Identify</h3>
            <p>Provider identity requires an explicit Dynatrace label or a mapping you can explain to the next responder.</p>
          </section>
          <section>
            <h3>3. Verify</h3>
            <p>A matching service and active Problem create a candidate for review. They do not prove provider fault or credit eligibility by themselves.</p>
          </section>
          <div className="help-drawer-actions">
            <button type="button" className="link-button" onClick={() => { setHelpOpen(false); void navigate("/settings/watch"); }}>Open watch settings</button>
            <button type="button" className="link-button" onClick={() => { setHelpOpen(false); onStartTour(); }}>Replay walkthrough</button>
          </div>
        </aside>
      ) : null}
    </AppHeader>
  );
};
