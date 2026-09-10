export type WatchSection = "overview" | "setup" | "directory" | "incidents";
export type SlaThemePreference = "system" | "light" | "dark";
export type RecommendationPriority = "high" | "medium" | "low";
export type EvidenceLookbackHours = 24 | 72 | 168 | 360 | 720 | 1440 | 2160;

export type SlaPreferences = {
  theme: SlaThemePreference;
  providerSlug: string;
  providerLabelKey: string;
  lookbackHours: EvidenceLookbackHours;
  onboardingComplete: boolean;
  tourCompleted: boolean;
};

export type ServiceRecord = { id: string; name: string; type: string; tags: string[] };

export type ContractScopeKind = "provider" | "service" | "host" | "location";

export type ContractOverrideValue = {
  overrideKey: string;
  providerSlug: string;
  providerServiceId: string;
  providerServiceName: string;
  scopeKind: ContractScopeKind;
  scopeEntityId: string;
  scopeEntityName: string;
  scopeEntityIds: string[];
  scopeEntityNames: string[];
  location?: string | null;
  availabilityTarget?: number | null;
  filingDeadlineDays?: number | null;
  deadlineBasis?: string | null;
  businessDays: boolean;
  maxCreditPercent?: number | null;
  claimMethod?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  sourceReference: string;
  sourceUrl?: string | null;
  notes?: string | null;
  enabled: boolean;
};

export type ContractOverrideRecord = ContractOverrideValue & {
  objectId: string;
  version: string;
  lastModifiedBy?: string;
  lastModifiedTime?: string;
};

export type SmartscapeScopeEdge = {
  serviceNodeId: string;
  serviceClassicId?: string;
  serviceName: string;
  targetNodeId: string;
  targetClassicId?: string;
  targetName: string;
  targetType: string;
  relationship: "runs_on" | "belongs_to";
  location?: string;
};

export type ContractContext = {
  providerSlug: string;
  providerServiceId: string;
  serviceId?: string;
  hostId?: string;
  location?: string;
};

export type EffectiveContractTerms = {
  availabilityTarget: number | null;
  filingDeadlineDays: number | null;
  deadlineBasis: string | null;
  businessDays: boolean;
  maxCreditPercent: number | null;
  claimMethod: string | null;
  source: "sla.directory" | "tenant override";
  appliedOverrides: ContractOverrideRecord[];
};

export type SetupRecommendation = {
  id: string;
  priority: RecommendationPriority;
  title: string;
  detail: string;
  evidence: string;
  action: string;
  href?: string;
  platformAction?: "ownership-settings";
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
