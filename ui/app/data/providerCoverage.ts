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
  isServiceScopeAssignment,
  resolveProviderServiceCandidates,
  runtimeEntityIdForEdge,
  serviceEntityIdForEdge,
  type ProviderServiceCandidate,
  type ProviderServiceResolution,
} from "./providerScopeAssignments";
import { providerTagValues } from "./providerTags";
import { topologyAnchorRank } from "./topology";

export type CoverageFilter = "all" | "covered" | "review";

export type ScopeCoverageRow = {
  kind: "scope";
  key: string;
  edge: SmartscapeScopeEdge;
  assignment?: ProviderScopeAssignmentRecord;
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
  reviewRows: CoverageRow[];
  coveredRows: CoverageRow[];
  unattributedRows: CoverageRow[];
  taggedServiceCount: number;
  observedServiceCount: number;
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

export const rowIsCovered = (row: CoverageRow): boolean => Boolean(
  row.assignment || row.sourceTag || (row.kind === "scope" && row.observed),
);

export const rowNeedsReview = (row: CoverageRow): boolean => {
  if (rowIsCovered(row)) return false;
  return row.kind === "scope" && Boolean(
    row.ambiguous || row.candidate || row.edge.providerSlug,
  );
};

export const rowServiceId = (row: CoverageRow): string =>
  row.kind === "scope" ? serviceEntityIdForEdge(row.edge) : row.service.id;

export const rowServiceName = (row: CoverageRow): string =>
  row.kind === "scope" ? row.edge.serviceName : row.service.name;

export const rowSearchValue = (row: CoverageRow): string => (
  row.kind === "scope"
    ? `${row.edge.serviceName} ${row.edge.targetName} ${row.edge.targetType} ${row.edge.location ?? ""} ${row.candidate?.providerServiceName ?? ""}`
    : `${row.service.name} ${row.service.id} ${row.values.join(" ")}`
).toLowerCase();

const rowSortRank = (row: CoverageRow): number => {
  if (rowIsCovered(row)) return 3;
  if (row.problemCount > 0) return 0;
  if (row.kind === "scope" && row.candidate) return 1;
  return 2;
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
  providerAssignments.forEach((assignment) => {
    assignmentsByService.set(assignment.serviceEntityId, [
      ...(assignmentsByService.get(assignment.serviceEntityId) ?? []),
      assignment,
    ]);
  });
  const problemCounts = new Map(
    prioritizeServicesByProblemActivity(services, problems)
      .map(({ service, problemCount }) => [service.id, problemCount]),
  );
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const candidateResolutions: Map<string, ProviderServiceResolution> = provider
    ? resolveProviderServiceCandidates(topology, provider)
    : new Map<string, ProviderServiceResolution>();
  const edgesByService = new Map<string, SmartscapeScopeEdge[]>();

  topology.forEach((edge) => {
    const serviceEntityId = serviceEntityIdForEdge(edge);
    if (edge.providerSlug !== providerSlug && !assignmentsByService.has(serviceEntityId)) return;
    edgesByService.set(serviceEntityId, [
      ...(edgesByService.get(serviceEntityId) ?? []),
      edge,
    ]);
  });

  const scopeRows: ScopeCoverageRow[] = Array.from(edgesByService.entries()).map(
    ([serviceEntityId, edges]) => {
      const serviceAssignments = assignmentsByService.get(serviceEntityId) ?? [];
      const exactAssignmentByRuntime = new Map(
        serviceAssignments.map((assignment) => [assignment.runtimeEntityId, assignment]),
      );
      const resolution = candidateResolutions.get(serviceEntityId);
      const orderedEdges = [...edges].sort((left, right) => {
        const leftAssigned = exactAssignmentByRuntime.has(runtimeEntityIdForEdge(left)) ? 0 : 1;
        const rightAssigned = exactAssignmentByRuntime.has(runtimeEntityIdForEdge(right)) ? 0 : 1;
        if (leftAssigned !== rightAssigned) return leftAssigned - rightAssigned;
        const leftCandidate = provider ? inferProviderServiceCandidate(left, provider) : null;
        const rightCandidate = provider ? inferProviderServiceCandidate(right, provider) : null;
        const leftMatches = resolution?.candidate?.providerServiceId === leftCandidate?.providerServiceId ? 0 : 1;
        const rightMatches = resolution?.candidate?.providerServiceId === rightCandidate?.providerServiceId ? 0 : 1;
        return leftMatches - rightMatches || topologyAnchorRank(left) - topologyAnchorRank(right);
      });
      const edge = orderedEdges[0];
      const assignment = exactAssignmentByRuntime.get(runtimeEntityIdForEdge(edge))
        ?? serviceAssignments.find(isServiceScopeAssignment)
        ?? serviceAssignments[0];
      const values = providerTagValues(
        serviceById.get(serviceEntityId)?.tags ?? edge.serviceTags,
        providerTagKey,
        providerSlug,
      );
      return {
        kind: "scope",
        key: `scope:${providerSlug}:${serviceEntityId}`,
        edge,
        assignment,
        candidate: resolution?.candidate ?? null,
        observed: resolution?.candidate?.confidence === "observed" && !resolution.ambiguous,
        ambiguous: resolution?.ambiguous ?? false,
        evidenceCount: resolution?.evidenceCount ?? 0,
        sourceTag: values.includes(providerSlug),
        problemCount: problemCounts.get(serviceEntityId) ?? 0,
      };
    },
  );

  const topologyServiceIds = new Set(scopeRows.map(rowServiceId));
  const serviceRows: ServiceCoverageRow[] = prioritizeServicesByProblemActivity(
    services.filter((service) => !topologyServiceIds.has(service.id)),
    problems,
  ).map(({ service, problemCount }) => {
    const values = providerTagValues(service.tags, providerTagKey, providerSlug);
    const sourceTag = values.includes(providerSlug);
    const assignmentKey = createServiceScopeAssignmentKey(providerSlug, service.id);
    const assignment = (assignmentsByService.get(service.id) ?? []).find(
      (item) => item.assignmentKey === assignmentKey && isServiceScopeAssignment(item),
    );
    return {
      kind: "service",
      key: `service:${assignmentKey}`,
      service,
      assignment,
      values,
      sourceTag,
      conflicting: values.length > 0 && !sourceTag,
      problemCount,
    };
  });

  const rows: CoverageRow[] = [...scopeRows, ...serviceRows].sort((left, right) => {
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

  return {
    rows,
    reviewRows,
    coveredRows,
    unattributedRows,
    taggedServiceCount: coveredRows.filter((row) => row.sourceTag).length,
    observedServiceCount: coveredRows.filter(
      (row) => row.kind === "scope" && row.observed,
    ).length,
  };
};
