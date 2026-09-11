import { useMemo } from "react";
import {
  useCreateSettingsV2,
  useDeleteSettingsV2,
  useEffectivePermissionsV2,
  useSettingsObjectsV2,
  useUpdateSettingsV2,
} from "@dynatrace-sdk/react-hooks";
import type { ProviderScopeAssignmentRecord, ProviderScopeAssignmentValue } from "../types";
import { normalizeProviderScopeAssignment, PROVIDER_SCOPE_ASSIGNMENTS_SCHEMA_ID } from "../data/providerScopeAssignments";

export const useProviderScopeAssignments = () => {
  const query = useSettingsObjectsV2({
    schemaId: PROVIDER_SCOPE_ASSIGNMENTS_SCHEMA_ID,
    addFields: "value,summary,modificationInfo,schemaId",
    pageSize: 500,
  });
  const permissions = useEffectivePermissionsV2({
    body: {
      permissions: [
        { permission: "app-settings:objects:read", context: { schemaId: PROVIDER_SCOPE_ASSIGNMENTS_SCHEMA_ID } },
        { permission: "app-settings:objects:write", context: { schemaId: PROVIDER_SCOPE_ASSIGNMENTS_SCHEMA_ID } },
      ],
    },
  });
  const create = useCreateSettingsV2();
  const update = useUpdateSettingsV2();
  const remove = useDeleteSettingsV2();

  const assignments = useMemo<ProviderScopeAssignmentRecord[]>(() => (query.data?.items ?? []).flatMap((item) => {
    const value = normalizeProviderScopeAssignment(item.value);
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

  const createAssignment = async (value: ProviderScopeAssignmentValue): Promise<void> => {
    await create.execute({ body: { schemaId: PROVIDER_SCOPE_ASSIGNMENTS_SCHEMA_ID, value } });
    await query.refetch();
  };

  const updateAssignment = async (record: ProviderScopeAssignmentRecord, value: ProviderScopeAssignmentValue): Promise<void> => {
    await update.execute({
      objectId: record.objectId,
      optimisticLockingVersion: record.version,
      body: { value },
    });
    await query.refetch();
  };

  const deleteAssignment = async (record: ProviderScopeAssignmentRecord): Promise<void> => {
    await remove.execute({ objectId: record.objectId, optimisticLockingVersion: record.version });
    await query.refetch();
  };

  return {
    assignments,
    loading: query.isLoading || permissions.isLoading,
    mutating,
    canRead,
    canWrite,
    error: query.error ?? permissions.error,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    refetch: query.refetch,
  };
};

export type ProviderScopeAssignmentsState = ReturnType<typeof useProviderScopeAssignments>;
