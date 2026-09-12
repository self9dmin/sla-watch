type ProblemRouteContext = {
  providerSlug: string;
  problemId: string;
};

type CoverageRouteContext = ProblemRouteContext & {
  serviceId?: string;
  providerServiceId?: string;
  returnTo: string;
};

const withParams = (pathname: string, values: Record<string, string | undefined>): string => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value?.trim()) params.set(key, value.trim());
  });
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
};

export const createIncidentReviewPath = ({
  providerSlug,
  problemId,
}: ProblemRouteContext): string => withParams("/incidents", {
  provider: providerSlug.toLowerCase(),
  problem: problemId,
});

export const createEvidenceReviewPath = ({
  providerSlug,
  problemId,
}: ProblemRouteContext): string => withParams("/evidence", {
  provider: providerSlug.toLowerCase(),
  problem: problemId,
});

export const createCoverageReviewPath = ({
  providerSlug,
  problemId,
  serviceId,
  providerServiceId,
  returnTo,
}: CoverageRouteContext): string => withParams("/", {
  provider: providerSlug.toLowerCase(),
  problem: problemId,
  service: serviceId,
  providerService: providerServiceId,
  return: returnTo,
});

export const safeWorkspaceReturnPath = (
  value: string | null,
  fallback = "/incidents",
): string => value && value.startsWith("/") && !value.startsWith("//")
  ? value
  : fallback;
