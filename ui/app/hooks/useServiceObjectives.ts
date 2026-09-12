import { useCallback, useEffect, useRef, useState } from "react";
import {
  serviceLevelObjectivesClient,
  type Slo,
  type SloConfig,
} from "@dynatrace-sdk/client-service-level-objectives";
import { effectivePermissionsClient } from "@dynatrace-sdk/client-platform-management-service";
import { createManagedObjectiveFilter } from "../data/serviceObjectives";

type ServiceObjectiveQuery = {
  enabled: boolean;
  providerSlug?: string;
  serviceClassicId?: string | null;
  page?: number;
  pageSize?: number;
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error && error.name === "Forbidden") {
    return "The current user cannot read Dynatrace objectives.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Dynatrace objectives are unavailable.";
};

export const useServiceObjectives = ({
  enabled,
  providerSlug,
  serviceClassicId,
  page = 1,
  pageSize = 8,
}: ServiceObjectiveQuery) => {
  const [objectives, setObjectives] = useState<Slo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [canRead, setCanRead] = useState<boolean | null>(null);
  const [canWrite, setCanWrite] = useState<boolean | null>(null);
  const [error, setError] = useState<string>();
  const requestId = useRef(0);
  const boundedPage = Math.max(1, Math.floor(page));
  const boundedPageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(undefined);

    const [permissions, managed] = await Promise.allSettled([
      effectivePermissionsClient.resolveEffectivePermissions({
        body: {
          permissions: [
            { permission: "slo:slos:read" },
            { permission: "slo:slos:write" },
          ],
        },
      }),
      serviceLevelObjectivesClient.getSlos({
        pageSize: boundedPageSize,
        page: boundedPage,
        filter: createManagedObjectiveFilter({
          providerSlug,
          serviceClassicId,
        }),
        sort: "name",
      }),
    ]);

    if (currentRequest !== requestId.current) return;

    if (permissions.status === "fulfilled") {
      setCanRead(permissions.value.find((item) => item.permission === "slo:slos:read")?.granted !== "false");
      setCanWrite(permissions.value.find((item) => item.permission === "slo:slos:write")?.granted === "true");
    } else {
      setCanRead(null);
      setCanWrite(false);
    }

    if (managed.status === "fulfilled") {
      setObjectives(managed.value.slos);
      setTotalCount(managed.value.totalCount);
      setCanRead((value) => value ?? true);
    } else {
      setObjectives([]);
      setTotalCount(0);
      setCanRead(false);
      setError(errorMessage(managed.reason));
    }
    setLoading(false);
  }, [
    boundedPage,
    boundedPageSize,
    enabled,
    providerSlug,
    serviceClassicId,
  ]);

  useEffect(() => {
    if (!enabled) {
      requestId.current += 1;
      setObjectives([]);
      setTotalCount(0);
      setCanRead(null);
      setCanWrite(null);
      setError(undefined);
      setLoading(false);
      return;
    }
    setObjectives([]);
    setTotalCount(0);
    void refresh();
  }, [enabled, refresh]);

  const createObjective = async (definition: SloConfig): Promise<Slo> => {
    if (canWrite !== true) {
      throw new Error(
        "Objective write access is required to create this objective.",
      );
    }
    setCreating(true);
    setError(undefined);
    try {
      const created = await serviceLevelObjectivesClient.createSlo({ body: definition });
      setObjectives((current) => [
        created,
        ...current.filter((objective) => objective.id !== created.id),
      ].slice(0, boundedPageSize));
      setTotalCount((current) => current + 1);
      return created;
    } catch (createError) {
      setError(errorMessage(createError));
      throw createError;
    } finally {
      setCreating(false);
    }
  };

  return {
    objectives,
    totalCount,
    page: boundedPage,
    pageSize: boundedPageSize,
    loading,
    creating,
    canRead,
    canWrite,
    error,
    refresh,
    createObjective,
  };
};
