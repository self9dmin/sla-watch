export type ChangeLogEntry = {
  version: string;
  label: string;
  summary: string;
  details: readonly string[];
};

export const CHANGE_LOG_ENTRIES: readonly ChangeLogEntry[] = [
  {
    version: "0.0.24",
    label: "Current release",
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
