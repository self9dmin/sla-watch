export type WatchSection = "overview" | "directory" | "review";
export type SlaThemePreference = "system" | "light" | "dark";
export type BugCategory = "data" | "provider-matching" | "access" | "ux";
export type BugSeverity = "low" | "medium" | "high";
export type BugStatus = "open" | "triaged" | "resolved";
export type ChangeRisk = "low" | "medium" | "high";
export type ChangeStatus = "planned" | "in-progress" | "complete" | "rolled-back";
export type RecommendationPriority = "high" | "medium" | "low";

export type SlaBug = {
  id: string;
  title: string;
  category: BugCategory;
  severity: BugSeverity;
  details: string;
  status: BugStatus;
  createdAt: string;
  evidence: string;
};

export type SlaChange = {
  id: string;
  title: string;
  scope: string;
  risk: ChangeRisk;
  owner: string;
  rollbackPlan: string;
  status: ChangeStatus;
  createdAt: string;
};

export type SlaPreferences = {
  theme: SlaThemePreference;
  providerSlug: string;
  providerLabelKey: string;
  lookbackHours: 24 | 72;
  onboardingComplete: boolean;
  tourCompleted: boolean;
  bugs: SlaBug[];
  changes: SlaChange[];
};

export type ServiceRecord = { id: string; name: string; type: string; tags: string[] };

export type SetupRecommendation = {
  id: string;
  priority: RecommendationPriority;
  title: string;
  detail: string;
  evidence: string;
  action: string;
  href?: string;
};

export type ProblemRecord = {
  id: string;
  title: string;
  status: string;
  category: string;
  affectedEntityIds: string[];
  hasRootCause: boolean;
  startedAt?: string;
  endedAt?: string;
};

export type SlaCreditTier = { below: number; credit: number };

export type SlaCreditPolicy = {
  calculation: string;
  remedy: string | null;
  maxCreditPercent: number | null;
  unit: string;
  note: string | null;
  automatic: boolean;
  creditTiers: SlaCreditTier[];
};

export type SlaClaimProcess = {
  deadlineDays: number | null;
  deadlineBasis: string | null;
  businessDays: boolean;
  method: string | null;
  url: string | null;
  requiredEvidence: string[];
  reviewDays: number | null;
  creditApplication: string | null;
};

export type SlaProviderResponse = {
  generatedAt: string;
  provider: {
    slug: string;
    name: string;
    category: string;
    uptime: number | null;
    status: string;
    lastVerified: string;
    slaUrl?: string | null;
    website?: string | null;
    scope?: string | null;
    maxCreditPercent?: number | null;
    hasAutomaticCredits?: boolean;
    minPlanForSla?: string | null;
    defaultCreditPolicy?: SlaCreditPolicy | null;
    claimProcess?: SlaClaimProcess | null;
    exclusions?: string[];
  };
  services: Array<{
    id: string;
    name: string;
    category: string | null;
    uptime: number | null;
    eligible: boolean;
    slaUrl: string;
    description?: string | null;
    uptimeScope?: string | null;
    lastVerified?: string | null;
    creditPolicy?: SlaCreditPolicy | null;
  }>;
};

export type SlaDirectoryConnection = {
  source: "sla.directory API";
  lastSyncAt?: string;
  message: string;
};

export const slaDirectoryConnection: SlaDirectoryConnection = {
  source: "sla.directory API",
  message: "Provider and service SLA records are loaded from the versioned sla.directory API.",
};

export const DEFAULT_SLA_PREFERENCES: SlaPreferences = {
  theme: "system",
  providerSlug: "aws",
  providerLabelKey: "provider",
  lookbackHours: 24,
  onboardingComplete: false,
  tourCompleted: false,
  bugs: [],
  changes: [
    {
      id: "CHG-BASELINE-01",
      title: "Evidence-first provider attribution",
      scope: "Separates telemetry presence, service inventory, provider labels, and Problems before a claim is considered.",
      risk: "low",
      owner: "SLA workspace",
      rollbackPlan: "Disable the watch and return to the previous dashboard while preserving raw evidence.",
      status: "complete",
      createdAt: "Baseline",
    },
    {
      id: "CHG-BASELINE-02",
      title: "sla.directory contract lookup",
      scope: "Loads provider and service targets through the versioned directory API from an AppEngine function.",
      risk: "medium",
      owner: "SLA workspace",
      rollbackPlan: "Use the last verified contract snapshot and mark the directory as unavailable.",
      status: "complete",
      createdAt: "Baseline",
    },
  ],
};
