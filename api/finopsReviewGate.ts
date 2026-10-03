type SettingsPage = {
  items?: Array<{ value?: unknown }>;
  totalCount?: number;
  nextPageKey?: string | null;
  error?: unknown;
};

export type ReviewGateRequest = {
  providerSlug: string;
  problemId: string;
  providerServiceId: string;
  reviewedAt: string;
  triggerMode: "manual" | "automatic";
  autoAssignLane: boolean;
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const completePage = (value: SettingsPage): value is SettingsPage & {
  items: Array<{ value?: unknown }>;
  totalCount: number;
} => !value.error && !value.nextPageKey && Array.isArray(value.items) &&
  Number.isInteger(value.totalCount) && value.items.length === value.totalCount;

export const currentFinopsReviewIsValid = (
  request: ReviewGateRequest,
  routing: SettingsPage,
  decisions: SettingsPage,
): boolean => {
  if (!record(request) ||
      typeof request.providerSlug !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(request.providerSlug) ||
      typeof request.problemId !== "string" || !request.problemId || request.problemId.length > 160 ||
      typeof request.providerServiceId !== "string" || !request.providerServiceId || request.providerServiceId.length > 160 ||
      typeof request.reviewedAt !== "string" || !Number.isFinite(Date.parse(request.reviewedAt)) ||
      !["manual", "automatic"].includes(request.triggerMode) ||
      typeof request.autoAssignLane !== "boolean" ||
      !completePage(routing) || routing.totalCount > 1 || !completePage(decisions)) return false;

  const controls = routing.totalCount === 0
    ? { autoQueueAfterReady: false, autoAssignLane: false }
    : routing.items[0].value;
  if (!record(controls) ||
      (routing.totalCount === 1 && controls.configurationKey !== "workspace") ||
      typeof controls.autoQueueAfterReady !== "boolean" ||
      typeof controls.autoAssignLane !== "boolean" ||
      (request.triggerMode === "automatic" && !controls.autoQueueAfterReady) ||
      request.autoAssignLane !== controls.autoAssignLane) return false;

  const decisionKey = `${request.providerSlug}|${request.problemId}`.toLowerCase();
  const matches = decisions.items.map(({ value }) => value).filter((value) =>
    record(value) && value.decisionKey === decisionKey);
  if (matches.length !== 1 || !record(matches[0])) return false;
  const decision = matches[0];
  return decision.status === "validated" &&
    decision.reviewedAt === request.reviewedAt &&
    decision.providerSlug === request.providerSlug &&
    decision.problemId === request.problemId &&
    Array.isArray(decision.providerServiceIds) &&
    decision.providerServiceIds.length === 1 &&
    decision.providerServiceIds[0] === request.providerServiceId;
};
