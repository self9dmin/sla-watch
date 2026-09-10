import { useMemo } from "react";
import {
  useCreateSettingsV2,
  useDeleteSettingsV2,
  useEffectivePermissionsV2,
  useSettingsObjectsV2,
  useUpdateSettingsV2,
} from "@dynatrace-sdk/react-hooks";
import type { ProviderConnectionRecord, ProviderConnectionValue } from "../types";
import { normalizeProviderConnection, PROVIDER_CONNECTIONS_SCHEMA_ID } from "../data/providerConnections";

export const useProviderConnections = () => {
  const query = useSettingsObjectsV2({
    schemaId: PROVIDER_CONNECTIONS_SCHEMA_ID,
    addFields: "value,summary,modificationInfo,schemaId",
    pageSize: 50,
  });
  const permissions = useEffectivePermissionsV2({
    body: {
      permissions: [
        { permission: "app-settings:objects:read", context: { schemaId: PROVIDER_CONNECTIONS_SCHEMA_ID } },
        { permission: "app-settings:objects:write", context: { schemaId: PROVIDER_CONNECTIONS_SCHEMA_ID } },
      ],
    },
  });
  const create = useCreateSettingsV2();
  const update = useUpdateSettingsV2();
  const remove = useDeleteSettingsV2();

  const connections = useMemo<ProviderConnectionRecord[]>(() => (query.data?.items ?? []).flatMap((item) => {
    const value = normalizeProviderConnection(item.value);
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

  const createConnection = async (value: ProviderConnectionValue): Promise<void> => {
    await create.execute({ body: { schemaId: PROVIDER_CONNECTIONS_SCHEMA_ID, value } });
    await query.refetch();
  };

  const updateConnection = async (record: ProviderConnectionRecord, value: ProviderConnectionValue): Promise<void> => {
    await update.execute({
      objectId: record.objectId,
      optimisticLockingVersion: record.version,
      body: { value },
    });
    await query.refetch();
  };

  const deleteConnection = async (record: ProviderConnectionRecord): Promise<void> => {
    await remove.execute({ objectId: record.objectId, optimisticLockingVersion: record.version });
    await query.refetch();
  };

  return {
    connections,
    loading: query.isLoading || permissions.isLoading,
    mutating,
    canRead,
    canWrite,
    error: query.error ?? permissions.error,
    createConnection,
    updateConnection,
    deleteConnection,
    refetch: query.refetch,
  };
};
