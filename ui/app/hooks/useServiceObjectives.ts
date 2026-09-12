import { useCallback, useEffect, useState } from "react";
import {
  serviceLevelObjectivesClient,
  type Slo,
  type SloConfig,
} from "@dynatrace-sdk/client-service-level-objectives";
import { effectivePermissionsClient } from "@dynatrace-sdk/client-platform-management-service";

const MANAGED_FILTER = "tag.key = 'managed-by' and tag.value = 'sla-review'";

const errorMessage = (error: unknown): string => {
  if (error instanceof Error && error.name === "Forbidden") {
    return "The current user cannot read Dynatrace objectives.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Dynatrace objectives are unavailable.";
};

const loadManagedObjectives = async (): Promise<Slo[]> => {
  const objectives: Slo[] = [];
  const seenPageKeys = new Set<string>();
  let pageKey: string | undefined;

  do {
    const page = await serviceLevelObjectivesClient.getSlos({
      pageSize: 500,
      pageKey,
      filter: MANAGED_FILTER,
    });
    objectives.push(...page.slos);
    pageKey = page.nextPageKey;
    if (pageKey && seenPageKeys.has(pageKey)) break;
    if (pageKey) seenPageKeys.add(pageKey);
  } while (pageKey);

  return objectives;
};

export const useServiceObjectives = (enabled: boolean) => {
  const [objectives, setObjectives] = useState<Slo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [canRead, setCanRead] = useState<boolean | null>(null);
  const [canWrite, setCanWrite] = useState<boolean | null>(null);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!enabled) return;
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
      loadManagedObjectives(),
    ]);

    if (permissions.status === "fulfilled") {
      setCanRead(permissions.value.find((item) => item.permission === "slo:slos:read")?.granted !== "false");
      setCanWrite(permissions.value.find((item) => item.permission === "slo:slos:write")?.granted === "true");
    } else {
      setCanRead(null);
      setCanWrite(false);
    }

    if (managed.status === "fulfilled") {
      setObjectives(managed.value);
      setCanRead((value) => value ?? true);
    } else {
      setObjectives([]);
      setCanRead(false);
      setError(errorMessage(managed.reason));
    }
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setObjectives([]);
      setError(undefined);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  const createObjective = async (definition: SloConfig): Promise<Slo> => {
    if (canWrite !== true) throw new Error("Objective write access is required to create this objective.");
    setCreating(true);
    setError(undefined);
    try {
      const created = await serviceLevelObjectivesClient.createSlo({ body: definition });
      setObjectives((current) => [
        created,
        ...current.filter((objective) => objective.id !== created.id),
      ]);
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
    loading,
    creating,
    canRead,
    canWrite,
    error,
    refresh,
    createObjective,
  };
};
