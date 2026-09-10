# Changelog

## 0.0.30

- Reorganized Watch into Overview, Setup, and Incidents so each page has one operational purpose.
- Added a permission-gated provider-tag review for explicitly selected services, including conflict detection and rollback.
- Replaced expanded incident cards with a bounded Problem queue and one focused incident detail view.
- Reduced spacing and panel height so normal desktop states fit without page scrolling.

## 0.0.29

- Restored every header SVG by composing icons through the Strato button-prefix slot used by tooltip-wrapped actions.
- Added a consistent high-contrast tooltip surface for light and dark themes.
- Extended the browser smoke test to require both each header icon and its tooltip.

## 0.0.28

- Added concise Strato tooltips to every icon-only header action.
- Kept header actions understandable on hover and keyboard focus in both themes.
- Preserved the disabled pre-launch Community state while explaining its availability.

## 0.0.27

- Added a single public-launch gate for the Dynatrace Community destination.
- Rendered Community actions as muted, disabled “Coming soon” items across the header, settings, guide, walkthrough, and release history.
- Removed Community URLs and keyboard interaction from the pre-launch interface.
- Restored the header guide as a visible side panel so support guidance remains reachable.

## 0.0.26

- Corrected the evidence-stage marker layout so each step number remains centered inside its status circle.
- Added explicit evidence-list semantics and consistent marker geometry across light and dark themes.

## 0.0.25

- Replaced the long Watch landing page with a compact, action-led environment assessment.
- Moved the full evidence ladder, telemetry diagnostics, provider identity checks, and setup recommendations into a dedicated Evidence view.
- Removed the duplicate Provider directory tab from Watch while preserving the Telemetry Grand Prix shell navigation.
- Changed the shared-state fallback message from a fixed overlay to an inline status that does not cover evidence.
- Added a safety margin to app-state expiration and removed invalid header properties observed during browser verification.

## 0.0.24

- Replaced the operational change register with a read-only application change log.
- Replaced in-app bug intake with a direct link to the Dynatrace Community profile for support and issue discussion.
- Removed obsolete workflow state and aligned the settings, walkthrough, help guidance, and documentation with the read-only boundary.

## 0.0.23

- Guarded incident-window calculations so billing-cycle or otherwise provider-anchored terms are shown as planning references rather than converted into a tenant-derived deadline.
- Added the directory's stated credit-application text to the filing review details.

## 0.0.22

- Added an Incident review tab for comparing observed Dynatrace Problems with the selected provider record.
- Exposed directory-published credit tiers, filing method, stated filing window, required evidence, review timing, and exclusions without treating them as an eligibility or approval decision.
- Added observed Problem timestamps and a compact impact timeline, then moved the dense Problems table out of the Overview surface.
- Reduced evidence ladder height and updated contract language to distinguish a directory record from verified provider fault.

## 0.0.21

- Replaced promotional UI copy with neutral SRE language for provider identity, tenant evidence, contract records, and review status.
- Aligned onboarding, walkthrough, setup checks, settings, and guidance with the directory's distinction between contract eligibility and measured tenant evidence.

## 0.0.20

- Fixed light and dark emphasized-button tokens so refresh, save, and setup actions keep readable contrast in either theme.

## 0.0.19

- Tightened the visual system for light and dark themes with a denser dashboard, smaller type scale, and clearer status contrast.
- Matched the Telemetry Grand Prix shell pattern with a compact app breadcrumb and visible icon actions for theme, settings, guide, change log, and community support.

## 0.0.18

- Clarified that service eligibility is supplied by the provider directory and is not an app-issued credit decision.

## 0.0.17

- Parameterized the Dynatrace environment target for public-repository and CI use.
- Added explicit release guidance for `DT_APP_ENVIRONMENT_URL` and debugger configuration.

## 0.0.16

- Hardened the `sla.directory` function with bounded requests and response validation.
- Added focused unit coverage, typecheck scripts, App Toolkit analysis, CI, and Hub-readiness documentation.
- Added a maintained app icon and release metadata for the Hub review package.

## 0.0.15

- Added conservative tenant setup recommendations for provider labeling, ownership metadata, service naming, and SLO follow-up.
- Split personal preferences from shared workspace configuration and workflow records.
- Added explicit access-incomplete and provider-identification states.
- Added day and night theme support, onboarding, walkthrough, and the initial operator guidance surfaces.

## Unreleased

- Reserved for changes after the `0.0.30` release candidate.
