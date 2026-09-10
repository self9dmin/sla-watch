import { useMemo } from "react";
import {
  useCreateSettingsV2,
  useDeleteSettingsV2,
  useEffectivePermissionsV2,
  useSettingsObjectsV2,
  useUpdateSettingsV2,
} from "@dynatrace-sdk/react-hooks";
import type { ContractOverrideRecord, ContractOverrideValue } from "../types";
import { CONTRACT_OVERRIDES_SCHEMA_ID, normalizeContractOverride } from "../data/contractOverrides";

export const useContractOverrides = () => {
  const query = useSettingsObjectsV2({
    schemaId: CONTRACT_OVERRIDES_SCHEMA_ID,
    addFields: "value,summary,modificationInfo,schemaId",
    pageSize: 500,
  });
  const permissions = useEffectivePermissionsV2({
    body: {
      permissions: [
        { permission: "app-settings:objects:read", context: { schemaId: CONTRACT_OVERRIDES_SCHEMA_ID } },
        { permission: "app-settings:objects:write", context: { schemaId: CONTRACT_OVERRIDES_SCHEMA_ID } },
      ],
    },
  });
  const create = useCreateSettingsV2();
  const update = useUpdateSettingsV2();
  const remove = useDeleteSettingsV2();

  const overrides = useMemo<ContractOverrideRecord[]>(() => (query.data?.items ?? []).flatMap((item) => {
    const value = normalizeContractOverride(item.value);
    if (!value) return [];
    return [{
      ...value,
      objectId: item.objectId,
      version: item.version,
      lastModifiedBy: item.modificationInfo?.lastModifiedBy,
      lastModifiedTime: item.modificationInfo?.lastModifiedTime instanceof Date
        ? item.modificationInfo.lastModifiedTime.toISOString()
        : String(item.modificationInfo?.lastModifiedTime ?? "") || undefined,
    }];
  }), [query.data?.items]);

  const canRead = permissions.data?.find((item) => item.permission === "app-settings:objects:read")?.granted !== "false";
  const canWrite = permissions.data?.find((item) => item.permission === "app-settings:objects:write")?.granted === "true";
  const mutating = create.isLoading || update.isLoading || remove.isLoading;

  const createOverride = async (value: ContractOverrideValue): Promise<void> => {
    await create.execute({ body: { schemaId: CONTRACT_OVERRIDES_SCHEMA_ID, value } });
    await query.refetch();
  };

  const updateOverride = async (record: ContractOverrideRecord, value: ContractOverrideValue): Promise<void> => {
    await update.execute({
      objectId: record.objectId,
      optimisticLockingVersion: record.version,
      body: { value },
    });
    await query.refetch();
  };

  const deleteOverride = async (record: ContractOverrideRecord): Promise<void> => {
    await remove.execute({ objectId: record.objectId, optimisticLockingVersion: record.version });
    await query.refetch();
  };

  return {
    overrides,
    loading: query.isLoading || permissions.isLoading,
    mutating,
    canRead,
    canWrite,
    error: query.error ?? permissions.error,
    createOverride,
    updateOverride,
    deleteOverride,
    refetch: query.refetch,
  };
};
