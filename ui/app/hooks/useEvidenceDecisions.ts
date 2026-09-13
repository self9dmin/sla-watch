import { useMemo } from "react";
import {
  useCreateSettingsV2,
  useDeleteSettingsV2,
  useEffectivePermissionsV2,
  useSettingsObjectsV2,
  useUpdateSettingsV2,
} from "@dynatrace-sdk/react-hooks";
import type {
  EvidenceDecisionRecord,
  EvidenceDecisionValue,
} from "../types";
import {
  EVIDENCE_DECISIONS_SCHEMA_ID,
  normalizeEvidenceDecision,
} from "../data/evidenceCandidates";

export type EvidenceDecisionSaveResult = {
  savedDecisionKeys: string[];
  failures: Array<{ decisionKey: string; message: string }>;
  refreshError?: string;
};

export const useEvidenceDecisions = () => {
  const query = useSettingsObjectsV2({
    schemaId: EVIDENCE_DECISIONS_SCHEMA_ID,
    addFields: "value,summary,modificationInfo,schemaId",
    pageSize: 500,
  });
  const permissions = useEffectivePermissionsV2({
    body: {
      permissions: [
        {
          permission: "app-settings:objects:read",
          context: { schemaId: EVIDENCE_DECISIONS_SCHEMA_ID },
        },
        {
          permission: "app-settings:objects:write",
          context: { schemaId: EVIDENCE_DECISIONS_SCHEMA_ID },
        },
      ],
    },
  });
  const create = useCreateSettingsV2();
  const update = useUpdateSettingsV2();
  const remove = useDeleteSettingsV2();

  const decisions = useMemo<EvidenceDecisionRecord[]>(
    () =>
      (query.data?.items ?? []).flatMap((item) => {
        const value = normalizeEvidenceDecision(item.value);
        if (!value) return [];
        return [{
          ...value,
          objectId: item.objectId,
          version: item.version,
          lastModifiedBy: item.modificationInfo?.lastModifiedBy,
          lastModifiedTime:
            item.modificationInfo?.lastModifiedTime instanceof Date
              ? item.modificationInfo.lastModifiedTime.toISOString()
              : String(item.modificationInfo?.lastModifiedTime ?? "") ||
                undefined,
        }];
      }),
    [query.data?.items],
  );

  const canRead = permissions.data?.find(
    (item) => item.permission === "app-settings:objects:read",
  )?.granted !== "false";
  const canWrite = permissions.data?.find(
    (item) => item.permission === "app-settings:objects:write",
  )?.granted === "true";
  const mutating = create.isLoading || update.isLoading || remove.isLoading;
  const totalCount = query.data?.totalCount ?? decisions.length;
  const incomplete = Boolean(
    query.data?.error ||
    query.data?.nextPageKey ||
    totalCount > decisions.length
  );

  const saveDecisions = async (
    values: EvidenceDecisionValue[],
  ): Promise<EvidenceDecisionSaveResult> => {
    const uniqueValues = Array.from(
      new Map(values.map((value) => [value.decisionKey, value])).values(),
    );
    const currentByKey = new Map(
      decisions.map((decision) => [decision.decisionKey, decision]),
    );
    const savedDecisionKeys: string[] = [];
    const failures: EvidenceDecisionSaveResult["failures"] = [];

    for (const value of uniqueValues) {
      const current = currentByKey.get(value.decisionKey);
      try {
        if (current) {
          await update.execute({
            objectId: current.objectId,
            optimisticLockingVersion: current.version,
            body: { value },
          });
        } else {
          await create.execute({
            body: { schemaId: EVIDENCE_DECISIONS_SCHEMA_ID, value },
          });
        }
        savedDecisionKeys.push(value.decisionKey);
      } catch (error) {
        failures.push({
          decisionKey: value.decisionKey,
          message: error instanceof Error
            ? error.message
            : "The evidence decision could not be saved.",
        });
      }
    }

    let refreshError: string | undefined;
    if (uniqueValues.length > 0) {
      try {
        await query.refetch();
      } catch (error) {
        refreshError = error instanceof Error
          ? error.message
          : "The evidence decisions could not be refreshed.";
      }
    }
    return { savedDecisionKeys, failures, refreshError };
  };

  const saveDecision = async (value: EvidenceDecisionValue): Promise<void> => {
    const result = await saveDecisions([value]);
    const failure = result.failures[0];
    if (failure) throw new Error(failure.message);
    if (result.refreshError) throw new Error(result.refreshError);
  };

  const deleteDecision = async (
    record: EvidenceDecisionRecord,
  ): Promise<void> => {
    await deleteDecisions([record]);
  };

  const deleteDecisions = async (
    records: EvidenceDecisionRecord[],
  ): Promise<void> => {
    const failures: string[] = [];
    for (const record of records) {
      try {
        await remove.execute({
          objectId: record.objectId,
          optimisticLockingVersion: record.version,
        });
      } catch (error) {
        failures.push(error instanceof Error
          ? error.message
          : `The decision for ${record.problemId} could not be reset.`);
      }
    }
    if (records.length > 0) await query.refetch();
    if (failures.length > 0)
      throw new Error(`${records.length - failures.length} decision${records.length - failures.length === 1 ? " was" : "s were"} reset. ${failures.length} failed.`);
  };

  return {
    decisions,
    loading: query.isLoading || permissions.isLoading,
    mutating,
    canRead,
    canWrite,
    totalCount,
    incomplete,
    error: query.error ?? permissions.error,
    saveDecision,
    saveDecisions,
    deleteDecision,
    deleteDecisions,
    refetch: query.refetch,
  };
};

export type EvidenceDecisionsState = ReturnType<typeof useEvidenceDecisions>;
