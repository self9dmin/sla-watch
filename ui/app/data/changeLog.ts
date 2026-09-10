export type ChangeLogEntry = {
  version: string;
  label: string;
  summary: string;
  details: readonly string[];
};

export const CHANGE_LOG_ENTRIES: readonly ChangeLogEntry[] = [
  {
    version: "0.0.30",
    label: "Current release",
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
