export type ChangeLogEntry = {
  version: string;
  label: string;
  summary: string;
  details: readonly string[];
};

export const CHANGE_LOG_ENTRIES: readonly ChangeLogEntry[] = [
  {
    version: "0.0.42",
    label: "Current release",
    summary: "Made coverage reliable for both Smartscape and service-only scopes.",
    details: [
      "Added Manual coverage for services that do not have a usable Smartscape runtime relationship.",
      "Stored manual confirmations in App Settings and reused them in Incidents and Evidence without changing service tags or telemetry.",
      "Kept source-owned provider tags as read-only matching evidence and removed the broad entity-write permission from the app.",
      "Added a reset action for saved evidence decisions so an operator can correct or remove a previous review.",
      "Preserved Scope map as the primary Coverage workflow and kept provider-level terms as the safe default for manual mappings.",
    ],
  },
  {
    version: "0.0.41",
    label: "Previous release",
    summary: "Reduced Evidence to one explainable SRE decision loop.",
    details: [
      "Replaced the four evidence gate cards with one direct explanation of why a candidate appears and links to its supporting records.",
      "Kept candidates limited to exact affected-service overlap with confirmed coverage, an exact provider tag, or a Smartscape suggestion.",
      "Simplified each review to Validate or Dismiss, with acknowledgement required for validation and a reason required for dismissal.",
      "Returns a saved decision to Needs review when its mapping basis, affected scope, or provider-service scope changes.",
      "Bounded review notes and added focused false-positive and stale-decision tests.",
    ],
  },
  {
    version: "0.0.40",
    label: "Previous release",
    summary: "Made Coverage the landing workspace and consolidated evidence review.",
    details: [
      "Replaced the separate Monitor landing card with Coverage as the default workspace.",
      "Placed compact provider, service, incident, and filing facts above Scope map, with Service tags as the secondary Coverage view.",
      "Expanded Evidence with Dynatrace-derived review candidates and a separate provider-reports view.",
      "Added shared validate and dismiss decisions with explicit fault, eligibility, and privacy boundaries.",
      "Added a disabled FinOps Agent handoff marked as planned without exposing an unavailable capability.",
      "Reduced workspace actions to one Review terms button and kept redundant refresh and configuration actions out of the header.",
    ],
  },
  {
    version: "0.0.39",
    label: "Previous release",
    summary: "Renamed the app and simplified its operational language.",
    details: [
      "Renamed the product to SLA Review while keeping the existing application ID and tenant configuration intact.",
      "Replaced repeated SLA labels with review, published terms, custom terms, coverage, and service credit where those labels are clearer.",
      "Shortened onboarding and workspace headings without changing the evidence or attribution boundaries.",
      "Updated settings, help, accessibility labels, tests, and operator documentation to use the same terminology.",
    ],
  },
  {
    version: "0.0.38",
    label: "Previous release",
    summary: "Unified the operating shell and expanded the provider record.",
    details: [
      "Placed Overview, Setup, Incidents, Provider notices, and Directory in one task-ordered shell while reserving the global header for app identity and utilities.",
      "Expanded Directory with published terms, credit and claim policies, service-level coverage, support plans, response-target boundaries, record provenance, and tenant overrides.",
      "Added strict parsing for nested support and SLA-tier records before external data reaches the interface.",
      "Added searchable, expandable service coverage inside a bounded panel that does not extend the page.",
      "Restored the application logo and shortened the first-run explanation and finish-later destination.",
    ],
  },
  {
    version: "0.0.37",
    label: "Previous release",
    summary: "Made provider connection setup explicit, optional, and verifiable.",
    details: [
      "Separated automatic published terms and Dynatrace evidence from optional provider-reported incident connections in first-run onboarding.",
      "Added a direct onboarding path to Provider connections for AWS accounts, Azure subscriptions, Google Cloud projects, and OCI tenancies.",
      "Required a successful connection test before a new or access-modified provider connection can be saved.",
      "Made the Smartscape scope map the Setup landing view and kept reusable provider tags in a secondary Service tags view.",
      "Clarified External requests, Credential Vault, least-privilege IAM, multiple-scope, and credential-removal responsibilities.",
      "Shortened the responder walkthrough and stopped it from opening automatically after onboarding or Finish later.",
    ],
  },
  {
    version: "0.0.36",
    label: "Previous release",
    summary: "Added account-specific incident sources for four core cloud providers.",
    details: [
      "Established AWS, Microsoft Azure, Google Cloud, and OCI as peer core providers. AWS is only the initial focused view for a fresh workspace.",
      "Added optional read-only AWS Health account events, Azure Service Health subscription events, Google Cloud Personalized Service Health, and OCI Announcements.",
      "Allowed multiple accounts, subscriptions, projects, and tenancies while keeping every provider secret in Dynatrace Credential Vault.",
      "Mapped explicit AWS, Azure, and OCI service names to candidate sla.directory services without resolving ambiguous provider products automatically.",
      "Added provider-specific scope validation, fixed outbound endpoints, bounded requests, and visible authentication or IAM failures without silent source substitution.",
    ],
  },
  {
    version: "0.0.35",
    label: "Previous release",
    summary: "Expanded provider incident evidence and clarified setup failures.",
    details: [
      "Added credential-free public incident sources for OCI, OpenAI, Anthropic, and ElevenLabs, with an explicit non-customer-specific evidence label.",
      "Allowed multiple Google Cloud project connections and a project-specific source selector in Provider notices.",
      "Moved the Smartscape service scope map into Setup and stored operator-confirmed provider-service mappings for reuse in Incident review.",
      "Incident review now selects exact tenant contract scopes first, then confirmed scope mappings, and labels any remaining Smartscape result as an unconfirmed candidate.",
      "Replaced the generic provider-tag failure with distinct session, permission, entity, request, and unverified-outcome guidance.",
      "Changed the ownership recommendation to current Dynatrace Smartscape ownership documentation instead of an unreliable settings route.",
    ],
  },
  {
    version: "0.0.34",
    label: "Previous release",
    summary: "Added multi-provider monitoring with evidence-backed service candidates.",
    details: [
      "Multiple providers can now be monitored while one active provider controls the focused Monitor and Directory views.",
      "Smartscape cloud-runtime relationships produce exact-service provider candidates without treating service names as evidence or changing tags automatically.",
      "Setup includes topology-backed services and requires an explicit operator confirmation before applying a provider tag.",
      "Directory responses are isolated by provider so a previous selection cannot appear under the active provider.",
    ],
  },
  {
    version: "0.0.33",
    label: "Previous release",
    summary: "Hardened provider-notice loading and release-scope copy.",
    details: [
      "Provider notices now load after shared connection settings finish initializing.",
      "A stable loading state replaces the previously empty provider-notice workspace.",
      "The interface states only the provider adapters available in the current release.",
    ],
  },
  {
    version: "0.0.32",
    label: "Previous release",
    summary: "Added an optional read-only Google Cloud provider-notice connection.",
    details: [
      "Added Google Cloud Personalized Service Health as an optional project-scoped provider source, with public Google Cloud Status as a clearly labeled fallback.",
      "Kept service-account JSON in Dynatrace Credential Vault and stored only the project and credential identifiers in App Settings.",
      "Added a separate Provider notices workspace so provider reports remain distinct from Dynatrace-observed Problems.",
      "Mapped stable Google product IDs to explicit sla.directory service IDs without inferring provider ownership or credit eligibility.",
    ],
  },
  {
    version: "0.0.31",
    label: "Previous release",
    summary: "Added custom terms with explicit Dynatrace evidence boundaries.",
    details: [
      "Added shared tenant overrides while retaining sla.directory as the read-only public baseline.",
      "Allowed one custom SLA to target multiple exact services, hosts, runtimes, or observed locations from the tenant.",
      "Added a Smartscape-backed scope map and conservative incident matching that never treats names or topology as proof of provider fault.",
      "Renamed the primary workspaces to Monitor and Directory, simplified the header actions, and expanded incident lookback options through 90 days.",
    ],
  },
  {
    version: "0.0.30",
    label: "Previous release",
    summary: "Reorganized Watch around setup, status, and incident work.",
    details: [
      "Replaced the Evidence and Incident review navigation with focused Setup and Incidents workspaces.",
      "Added a permission-gated, per-service provider-tag review with conflict detection and rollback.",
      "Reduced panel height and moved long service and Problem collections into bounded lists.",
    ],
  },
  {
    version: "0.0.29",
    label: "Previous release",
    summary: "Restored header icons alongside their tooltips.",
    details: [
      "Composed each icon through the Strato button-prefix slot so tooltip wrappers cannot drop it.",
      "Applied a consistent high-contrast tooltip surface in light and dark themes.",
      "Added browser checks that require both the SVG icon and its action tooltip.",
    ],
  },
  {
    version: "0.0.28",
    label: "Previous release",
    summary: "Added accessible guidance for header actions.",
    details: [
      "Added concise Strato tooltips to every icon-only header action.",
      "Kept action names available to keyboard and assistive-technology users in both themes.",
      "Preserved the disabled pre-launch state for the Dynatrace Community destination.",
    ],
  },
  {
    version: "0.0.27",
    label: "Previous release",
    summary: "Held Community destinations until public launch.",
    details: [
      "Muted and disabled Community actions in the header, settings, guide, and release history.",
      "Centralized the launch gate so Community links can be enabled deliberately from one source.",
      "Restored the header guide as a visible side panel so its pre-launch support state can be reviewed.",
    ],
  },
  {
    version: "0.0.26",
    label: "Previous release",
    summary: "Corrected the evidence-stage status markers.",
    details: [
      "Centered every step number inside a fixed circular marker in both themes.",
      "Added explicit list semantics to the four-stage evidence path.",
    ],
  },
  {
    version: "0.0.25",
    label: "Previous release",
    summary: "Refocused Watch on the current environment state and next action.",
    details: [
      "Replaced the long Overview with one assessment, four supporting facts, and one primary action.",
      "Moved detailed diagnostics and setup recommendations to a dedicated Evidence view.",
      "Changed the shared-state fallback from an overlay to an inline status message.",
      "Corrected state expiration and header-action runtime warnings found during verification.",
    ],
  },
  {
    version: "0.0.24",
    label: "Previous release",
    summary: "Clarified support and release history in the application shell.",
    details: [
      "Replaced the operational change register with a read-only release history.",
      "Changed the support action to open the Dynatrace Community profile.",
      "Removed in-app bug intake so the app keeps evidence review separate from support conversations.",
    ],
  },
  {
    version: "0.0.23",
    label: "Provider filing guidance",
    summary: "Kept provider-anchored filing terms as planning references.",
    details: [
      "Billing-cycle terms are no longer converted into a tenant-derived deadline.",
      "The directory's stated credit-application text is shown in filing review details.",
    ],
  },
  {
    version: "0.0.22",
    label: "Incident review",
    summary: "Added a review surface for observed Problems and provider terms.",
    details: [
      "Exposed published credit tiers, filing method, evidence requirements, review timing, and exclusions.",
      "Added observed Problem timestamps and an impact timeline without making an eligibility decision.",
    ],
  },
  {
    version: "0.0.21",
    label: "Evidence posture",
    summary: "Aligned the operator experience with the directory's evidence model.",
    details: [
      "Replaced promotional wording with neutral SRE language.",
      "Aligned onboarding, setup checks, settings, and guidance with the distinction between contract terms and tenant evidence.",
    ],
  },
];
