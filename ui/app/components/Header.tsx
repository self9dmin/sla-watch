import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@dynatrace/strato-components/buttons";
import { AppHeader } from "@dynatrace/strato-components/layouts";
import { Tooltip } from "@dynatrace/strato-components/overlays";
import {
  DarkmodeIcon,
  GuideIcon,
  HelpIcon,
  HistoryIcon,
  LightmodeIcon,
  SettingIcon,
  SupportIcon,
} from "@dynatrace/strato-icons";
import { COMMUNITY_PROFILE, isCommunityLive } from "../data/externalLinks";
import { CommunityLink } from "./CommunityLink";

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
  const communityLive = isCommunityLive();
  const themeActionLabel = `Switch to ${theme === "dark" ? "light" : "dark"} theme`;
  const guideActionLabel = `${helpOpen ? "Close" : "Open"} review guide`;

  return (
    <>
      <AppHeader>
        <AppHeader.Navigation>
          <AppHeader.Logo as={Link} to="/" appName="SLA Review" />
        </AppHeader.Navigation>
        <AppHeader.ActionItems>
          <Tooltip
            className="header-action-tooltip"
            text={themeActionLabel}
            placement="bottom"
          >
            <AppHeader.ActionButton
              onClick={onToggleTheme}
              aria-label={themeActionLabel}
            >
              <Button.Prefix>
                {theme === "dark" ? <LightmodeIcon /> : <DarkmodeIcon />}
              </Button.Prefix>
            </AppHeader.ActionButton>
          </Tooltip>
          <Tooltip
            className="header-action-tooltip"
            text="Open workspace settings"
            placement="bottom"
          >
            <AppHeader.ActionButton
              onClick={() => {
                void navigate("/settings/intro");
              }}
              className={isSettings ? "active" : undefined}
              aria-label="Open workspace settings"
              data-tour="settings"
            >
              <Button.Prefix>
                <SettingIcon />
              </Button.Prefix>
            </AppHeader.ActionButton>
          </Tooltip>
          <Tooltip
            className="header-action-tooltip"
            text="Show quick tour"
            placement="bottom"
          >
            <AppHeader.ActionButton
              onClick={onStartTour}
              aria-label="Show quick tour"
              data-tour="tour"
            >
              <Button.Prefix>
                <GuideIcon />
              </Button.Prefix>
            </AppHeader.ActionButton>
          </Tooltip>
          <Tooltip
            className="header-action-tooltip"
            text={guideActionLabel}
            placement="bottom"
          >
            <AppHeader.ActionButton
              onClick={() => setHelpOpen((current) => !current)}
              className={helpOpen ? "active" : undefined}
              aria-label={guideActionLabel}
              aria-expanded={helpOpen}
            >
              <Button.Prefix>
                <HelpIcon />
              </Button.Prefix>
            </AppHeader.ActionButton>
          </Tooltip>
          <Tooltip
            className="header-action-tooltip"
            text="Open change log"
            placement="bottom"
          >
            <AppHeader.ActionButton
              onClick={() => {
                void navigate("/changes");
              }}
              className={isChanges ? "active" : undefined}
              aria-label="Open change log"
              data-tour="changes"
            >
              <Button.Prefix>
                <HistoryIcon />
              </Button.Prefix>
            </AppHeader.ActionButton>
          </Tooltip>
          {communityLive ? (
            <Tooltip
              className="header-action-tooltip"
              text="Open Dynatrace Community"
              placement="bottom-end"
            >
              <AppHeader.ActionButton
                as="a"
                href={COMMUNITY_PROFILE.url}
                target="_blank"
                rel="noreferrer"
                aria-label="Open Dynatrace Community profile"
                data-tour="community"
              >
                <Button.Prefix>
                  <SupportIcon />
                </Button.Prefix>
              </AppHeader.ActionButton>
            </Tooltip>
          ) : (
            <Tooltip
              className="header-action-tooltip"
              text="Dynatrace Community (coming soon)"
              placement="bottom-end"
            >
              <AppHeader.ActionButton
                disabled
                className="community-action-disabled"
                aria-label="Dynatrace Community, coming soon"
                data-tour="community"
              >
                <Button.Prefix>
                  <SupportIcon />
                </Button.Prefix>
              </AppHeader.ActionButton>
            </Tooltip>
          )}
        </AppHeader.ActionItems>
      </AppHeader>
      {helpOpen ? (
        <aside className="help-drawer" aria-label="Review guide">
          <div className="help-drawer-header">
            <div>
              <div className="eyebrow">Review guide</div>
              <h2>How SLA Review works</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setHelpOpen(false)}
              aria-label="Close guide"
            >
              Close
            </button>
          </div>
          <p>
            SLA Review opens with the providers and topology Dynatrace can see.
            Settings is optional. Use it only when the workspace needs a different
            review default, custom terms, or customer-scoped provider reports.
          </p>
          <section>
            <h3>1. Identify</h3>
            <p>Coverage opens first. Confirm only uncertain SLA matches, then choose a Dynatrace Problem in Incident cases. Provider detection alone does not prove coverage.</p>
          </section>
          <section>
            <h3>2. Evaluate</h3>
            <p>Evidence carries the case, customer impact, and applicable terms into one human decision. Performance and Provider terms are supporting views. Save Needs evidence when requirements are missing. Nothing is submitted.</p>
          </section>
          <section>
            <h3>3. Automate</h3>
            <p>A person can queue a complete reviewed case for a local routing recommendation. Automatic queueing and lane assignment start off. The model cannot decide credit eligibility or file a claim.</p>
          </section>
          <section>
            <h3>Settings are optional</h3>
            <p>Use Settings only for review defaults, private terms, or customer-scoped provider reports. Published terms and Dynatrace evidence do not need a provider credential.</p>
          </section>
          <div className="help-drawer-actions">
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setHelpOpen(false);
                void navigate("/settings/intro");
              }}
            >
              Open getting started
            </button>
            <CommunityLink
              className="link-button"
              label="Community profile"
              onClick={() => setHelpOpen(false)}
            />
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setHelpOpen(false);
                onStartTour();
              }}
            >
              Show quick tour
            </button>
          </div>
        </aside>
      ) : null}
    </>
  );
};
