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
                void navigate("/settings/watch");
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
            text="Start or replay walkthrough"
            placement="bottom"
          >
            <AppHeader.ActionButton
              onClick={onStartTour}
              aria-label="Start or replay product walkthrough"
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
              <h2>Provider attribution guidance</h2>
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
            Use Coverage to confirm the provider boundary, Incidents to inspect
            Dynatrace Problems, and Evidence to validate review candidates or
            compare provider reports. FinOps Agent is planned and is not
            available in this release.
          </p>
          <section>
            <h3>1. Confirm coverage</h3>
            <p>
              Start with Scope map for Smartscape relationships. Use Manual
              coverage only for services without a usable runtime relationship.
            </p>
          </section>
          <section>
            <h3>2. Review incidents</h3>
            <p>
              Select one Problem at a time and compare its observed impact with
              provider terms. A matching service does not prove provider fault
              or credit eligibility.
            </p>
          </section>
          <section>
            <h3>3. Validate evidence</h3>
            <p>
              Evidence lists Problems that overlap confirmed or suggested
              provider coverage. Record a human validation or dismissal, then
              review any provider-owned report as separate supporting evidence.
            </p>
          </section>
          <section>
            <h3>4. Review provider terms</h3>
            <p>
              Directory separates availability terms, service-level coverage,
              support options, and tenant overrides for the active provider.
            </p>
          </section>
          <section>
            <h3>5. Get support</h3>
            <p>
              {communityLive
                ? "The change log documents application releases. Questions and issue discussion belong on the Dynatrace Community profile."
                : "The change log documents application releases. Dynatrace Community support will be enabled at public launch."}
            </p>
          </section>
          <div className="help-drawer-actions">
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setHelpOpen(false);
                void navigate("/settings/watch");
              }}
            >
              Open workspace settings
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
              Replay walkthrough
            </button>
          </div>
        </aside>
      ) : null}
    </>
  );
};
