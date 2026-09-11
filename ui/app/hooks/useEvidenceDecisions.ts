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

  const saveDecision = async (value: EvidenceDecisionValue): Promise<void> => {
    const current = decisions.find(
      (decision) => decision.decisionKey === value.decisionKey,
    );
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
    await query.refetch();
  };

  const deleteDecision = async (
    record: EvidenceDecisionRecord,
  ): Promise<void> => {
    await remove.execute({
      objectId: record.objectId,
      optimisticLockingVersion: record.version,
    });
    await query.refetch();
  };

  return {
    decisions,
    loading: query.isLoading || permissions.isLoading,
    mutating,
    canRead,
    canWrite,
    error: query.error ?? permissions.error,
    saveDecision,
    deleteDecision,
    refetch: query.refetch,
  };
};

export type EvidenceDecisionsState = ReturnType<typeof useEvidenceDecisions>;
