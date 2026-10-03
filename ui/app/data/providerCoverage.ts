import type {
  ProblemRecord,
  ProviderScopeAssignmentRecord,
  ServiceRecord,
  SlaProviderResponse,
  SmartscapeScopeEdge,
} from "../types";
import { prioritizeServicesByProblemActivity } from "./providerAttribution";
import {
  createServiceScopeAssignmentKey,
  inferProviderServiceCandidate,
  isResourceScopeAssignment,
  isServiceScopeAssignment,
  runtimeEntityIdForEdge,
  serviceEntityIdForEdge,
  type ProviderServiceCandidate,
} from "./providerScopeAssignments";
import { providerTagValues } from "./providerTags";

export type CoverageFilter = "all" | "covered" | "review";

export type ScopeCoverageRow = {
  kind: "scope";
  key: string;
  edge: SmartscapeScopeEdge;
  edges: SmartscapeScopeEdge[];
  assignments: ProviderScopeAssignmentRecord[];
  assignment?: ProviderScopeAssignmentRecord;
  mixedAssignments: boolean;
  candidate: ProviderServiceCandidate | null;
  observed: boolean;
  ambiguous: boolean;
  evidenceCount: number;
  sourceTag: boolean;
  problemCount: number;
};

export type ServiceCoverageRow = {
  kind: "service";
  key: string;
  service: ServiceRecord;
  assignment?: ProviderScopeAssignmentRecord;
  values: string[];
  sourceTag: boolean;
  conflicting: boolean;
  problemCount: number;
};

export type CoverageRow = ScopeCoverageRow | ServiceCoverageRow;

export type ProviderCoverageModel = {
  rows: CoverageRow[];
  resourceRows: ScopeCoverageRow[];
  reviewRows: CoverageRow[];
  coveredRows: CoverageRow[];
  unattributedRows: CoverageRow[];
  taggedServiceCount: number;
  observedResourceCount: number;
  linkedServiceCount: number;
  matchedServiceCount: number;
  reviewServiceCount: number;
  unlinkedServiceCount: number;
};

type BuildProviderCoverageInput = {
  provider?: SlaProviderResponse;
  providerSlug: string;
  topology: SmartscapeScopeEdge[];
  services: ServiceRecord[];
  problems: ProblemRecord[];
  providerTagKey: string;
  assignments: ProviderScopeAssignmentRecord[];
};

const unique = <T,>(items: T[]): T[] => Array.from(new Set(items));

export const rowServiceIds = (row: CoverageRow): string[] => row.kind === "scope"
  ? unique(row.edges.map(serviceEntityIdForEdge))
  : [row.service.id];

const exactProviderProduct = (id?: string): boolean => Boolean(id && id !== "*");

export const rowIsCovered = (row: CoverageRow): boolean => row.kind === "scope"
  ? !row.mixedAssignments && (row.assignment
    ? exactProviderProduct(row.assignment.providerServiceId)
    : row.observed && exactProviderProduct(row.candidate?.providerServiceId))
  : exactProviderProduct(row.assignment?.providerServiceId);

export const rowNeedsReview = (row: CoverageRow): boolean => {
  if (row.kind === "scope" && row.mixedAssignments) return true;
  if (rowIsCovered(row)) return false;
  return row.kind === "scope"
    ? Boolean(row.assignment || row.ambiguous || row.candidate || row.edge.providerSlug)
    : Boolean(row.assignment || row.sourceTag);
};

// Retained for routes that focus one impacted service. Resource rows may contain
// more than one service, so callers that need the complete set use rowServiceIds.
export const rowServiceId = (row: CoverageRow): string => rowServiceIds(row)[0] ?? "";

export const rowServiceName = (row: CoverageRow): string =>
  row.kind === "scope" ? row.edge.targetName : row.service.name;

export const rowSearchValue = (row: CoverageRow): string => (
  row.kind === "scope"
    ? `${row.edge.targetName} ${row.edge.targetType} ${row.edge.location ?? ""} ${row.edges.map((edge) => edge.serviceName).join(" ")} ${row.candidate?.providerServiceName ?? ""}`
    : `${row.service.name} ${row.service.id} ${row.values.join(" ")}`
).toLowerCase();

const rowSortRank = (row: CoverageRow): number => {
  if (rowNeedsReview(row)) return 0;
  if (row.kind === "scope" && row.problemCount > 0) return 1;
  if (rowIsCovered(row)) return 2;
  return 3;
};

const candidateResolutionForResource = (
  edges: SmartscapeScopeEdge[],
  provider?: SlaProviderResponse,
): { candidate: ProviderServiceCandidate | null; ambiguous: boolean } => {
  if (!provider) return { candidate: null, ambiguous: false };
  const candidates = edges.flatMap((edge) => {
    const candidate = inferProviderServiceCandidate(edge, provider);
    return candidate ? [candidate] : [];
  });
  const byProviderService = new Map<string, ProviderServiceCandidate[]>();
  candidates.forEach((candidate) => byProviderService.set(candidate.providerServiceId, [
    ...(byProviderService.get(candidate.providerServiceId) ?? []),
    candidate,
  ]));
  if (byProviderService.size !== 1) {
    return { candidate: null, ambiguous: byProviderService.size > 1 };
  }
  const matching = Array.from(byProviderService.values())[0];
  return {
    candidate: matching.find((candidate) => candidate.confidence === "observed") ?? matching[0],
    ambiguous: false,
  };
};

export const buildProviderCoverageModel = ({
  provider,
  providerSlug: requestedProviderSlug,
  topology,
  services,
  problems,
  providerTagKey,
  assignments,
}: BuildProviderCoverageInput): ProviderCoverageModel => {
  const providerSlug = (provider?.provider.slug ?? requestedProviderSlug).trim().toLowerCase();
  const providerAssignments = assignments.filter(
    (assignment) => assignment.enabled && assignment.providerSlug === providerSlug,
  );
  const assignmentsByService = new Map<string, ProviderScopeAssignmentRecord[]>();
  const assignmentsByRuntime = new Map<string, ProviderScopeAssignmentRecord[]>();
  providerAssignments.forEach((assignment) => {
    assignmentsByService.set(assignment.serviceEntityId, [
      ...(assignmentsByService.get(assignment.serviceEntityId) ?? []),
      assignment,
    ]);
    assignmentsByRuntime.set(assignment.runtimeEntityId, [
      ...(assignmentsByRuntime.get(assignment.runtimeEntityId) ?? []),
      assignment,
    ]);
  });
  const problemCounts = new Map(
    prioritizeServicesByProblemActivity(services, problems)
      .map(({ service, problemCount }) => [service.id, problemCount]),
  );
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const edgesByRuntime = new Map<string, SmartscapeScopeEdge[]>();

  topology.forEach((edge) => {
    const runtimeEntityId = runtimeEntityIdForEdge(edge);
    if (edge.providerSlug !== providerSlug && !assignmentsByRuntime.has(runtimeEntityId)) return;
    edgesByRuntime.set(runtimeEntityId, [
      ...(edgesByRuntime.get(runtimeEntityId) ?? []),
      edge,
    ]);
  });

  const resourceRows: ScopeCoverageRow[] = Array.from(edgesByRuntime.entries()).map(
    ([runtimeEntityId, edges]) => {
      const serviceIds = unique(edges.map(serviceEntityIdForEdge));
      const exactAssignments = (assignmentsByRuntime.get(runtimeEntityId) ?? []).filter(
        (assignment) => isResourceScopeAssignment(assignment) || serviceIds.includes(assignment.serviceEntityId),
      );
      const assignedProviderServices = unique(
        exactAssignments.map((assignment) => assignment.providerServiceId),
      );
      const mixedAssignments = assignedProviderServices.length > 1;
      const assignment = mixedAssignments
        ? undefined
        : exactAssignments.find(isResourceScopeAssignment) ?? exactAssignments[0];
      const resolution = candidateResolutionForResource(edges, provider);
      const orderedEdges = [...edges].sort((left, right) => {
        const leftProblems = problemCounts.get(serviceEntityIdForEdge(left)) ?? 0;
        const rightProblems = problemCounts.get(serviceEntityIdForEdge(right)) ?? 0;
        return rightProblems - leftProblems || left.serviceName.localeCompare(right.serviceName);
      });
      const edge = orderedEdges[0];
      const sourceTag = serviceIds.some((serviceEntityId) => providerTagValues(
        serviceById.get(serviceEntityId)?.tags ?? edges.find(
          (item) => serviceEntityIdForEdge(item) === serviceEntityId,
        )?.serviceTags ?? [],
        providerTagKey,
        providerSlug,
      ).includes(providerSlug));
      return {
        kind: "scope",
        key: `resource:${providerSlug}:${runtimeEntityId}`,
        edge,
        edges: orderedEdges,
        assignments: exactAssignments,
        assignment,
        mixedAssignments,
        candidate: resolution.candidate,
        observed: resolution.candidate?.confidence === "observed" && !resolution.ambiguous,
        ambiguous: resolution.ambiguous || mixedAssignments,
        evidenceCount: edges.length,
        sourceTag,
        problemCount: serviceIds.reduce(
          (total, serviceEntityId) => total + (problemCounts.get(serviceEntityId) ?? 0),
          0,
        ),
      };
    },
  );
  const resourceLinkedServiceIds = new Set(resourceRows.flatMap(rowServiceIds));

  // Direct service matches remain visible as an explicit fallback for providers
  // that have no provider-native Smartscape resource. Unlinked inventory alone
  // is not an SLA scope and is intentionally excluded from this worklist.
  const serviceRows: ServiceCoverageRow[] = prioritizeServicesByProblemActivity(
    services,
    problems,
  ).flatMap(({ service, problemCount }) => {
    const values = providerTagValues(service.tags, providerTagKey, providerSlug);
    const sourceTag = values.includes(providerSlug);
    const assignmentKey = createServiceScopeAssignmentKey(providerSlug, service.id);
    const assignment = (assignmentsByService.get(service.id) ?? []).find(
      (item) => item.assignmentKey === assignmentKey && isServiceScopeAssignment(item),
    );
    // A source tag is useful as a fallback, but it should not add a second
    // worklist item when the same service already has an exact resource edge.
    if (!assignment && (!sourceTag || resourceLinkedServiceIds.has(service.id))) return [];
    return [{
      kind: "service" as const,
      key: `service:${assignmentKey}`,
      service,
      assignment,
      values,
      sourceTag,
      conflicting: values.length > 0 && !sourceTag,
      problemCount,
    }];
  });

  const rows: CoverageRow[] = [...resourceRows, ...serviceRows].sort((left, right) => {
    const rank = rowSortRank(left) - rowSortRank(right);
    if (rank !== 0) return rank;
    const activity = right.problemCount - left.problemCount;
    if (activity !== 0) return activity;
    const name = rowServiceName(left).localeCompare(rowServiceName(right));
    if (name !== 0) return name;
    return left.kind.localeCompare(right.kind);
  });
  const coveredRows = rows.filter(rowIsCovered);
  const reviewRows = rows.filter(rowNeedsReview);
  const unattributedRows = rows.filter(
    (row) => !rowIsCovered(row) && !rowNeedsReview(row),
  );
  const linkedServiceIds = new Set(resourceRows.flatMap(rowServiceIds));
  const matchedServiceIds = new Set(coveredRows.flatMap(rowServiceIds));
  const reviewServiceIds = new Set(reviewRows.flatMap(rowServiceIds));

  return {
    rows,
    resourceRows,
    reviewRows,
    coveredRows,
    unattributedRows,
    taggedServiceCount: serviceRows.filter((row) => row.sourceTag).length,
    observedResourceCount: resourceRows.filter((row) => row.observed).length,
    linkedServiceCount: linkedServiceIds.size,
    matchedServiceCount: matchedServiceIds.size,
    reviewServiceCount: reviewServiceIds.size,
    unlinkedServiceCount: services.filter((service) => !linkedServiceIds.has(service.id)).length,
  };
};
