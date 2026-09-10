# Changelog

## 0.0.35

- Added credential-free public provider notices for OCI, OpenAI, Anthropic, and ElevenLabs with explicit non-customer-specific source labels.
- Added multiple saved Google Cloud project connections and a project selector for Personalized Service Health.
- Moved the Smartscape service scope map into Setup and added versioned, operator-confirmed provider-service mappings in App Settings.
- Updated Incident review to prefer exact tenant SLA scopes, then confirmed Setup mappings, then a clearly labeled unique Smartscape candidate.
- Replaced generic provider-tag failures with distinct session, permission, entity, request, and unverified-outcome guidance.
- Linked ownership guidance to current Dynatrace documentation.

## 0.0.34

- Replaced the single global provider setting with a monitored-provider collection and a separate active provider for focused views.
- Added exact-ID Smartscape provider candidates from cloud runtime relationships without using service names as evidence or changing tags automatically.
- Merged topology-backed services into Setup so service records visible only through Smartscape are not omitted from provider review.
- Added a confirmation-first workflow for applying provider tags to selected candidates while preserving existing tags and unresolved services.
- Kept provider monitoring separate from optional provider-account connections and blocked stale directory data from crossing provider views.

## 0.0.33

- Fixed Provider notices so the selected source loads after shared connection settings finish initializing.
- Added a stable loading state instead of allowing an empty provider-notice workspace.
- Removed forward-looking provider promises from the interface and clarified which settings are shared with the workspace.

## 0.0.32

- Added an optional Google Cloud Personalized Service Health connection using a customer-owned, AppEngine-scoped Credential Vault record.
- Added a separate Provider notices workspace with explicit project-specific, public, and fallback source states.
- Added stable Google product-ID mappings to sla.directory service IDs without inferring service ownership, local impact, provider fault, or credit eligibility.
- Added public Google Cloud Status as a no-credential fallback and kept Test connection strict so authentication failures are never hidden.

## 0.0.31

- Added tenant-owned SLA overrides in App Settings while preserving `sla.directory` as the public comparison baseline.
- Added explicit multi-entity evidence boundaries for Dynatrace services, hosts, runtimes, and observed locations. Entity IDs establish the assignment; names are display context only.
- Added a Smartscape-backed scope map and precedence for host, location, service, provider, then public terms.
- Added conservative incident matching that can select one uniquely applicable custom SLA from affected service and topology evidence without declaring provider fault.
- Moved new and custom SLA creation into Settings. Existing records retain a compact quick-edit dialog.
- Renamed the primary workspaces to Monitor and Directory, simplified the Monitor header actions, and added inline incident lookback choices from 24 hours through 90 days.

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

- Reserved for changes after the `0.0.35` release candidate.
