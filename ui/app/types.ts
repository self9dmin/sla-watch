export type WatchSection = "overview" | "setup" | "directory" | "incidents";
export type SlaThemePreference = "system" | "light" | "dark";
export type RecommendationPriority = "high" | "medium" | "low";

export type SlaPreferences = {
  theme: SlaThemePreference;
  providerSlug: string;
  providerLabelKey: string;
  lookbackHours: 24 | 72;
  onboardingComplete: boolean;
  tourCompleted: boolean;
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
};
