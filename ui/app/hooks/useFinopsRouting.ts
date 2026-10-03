import { useCreateSettingsV2, useEffectivePermissionsV2, useSettingsObjectsV2, useUpdateSettingsV2 } from "@dynatrace-sdk/react-hooks";

const SCHEMA_ID = "finops-routing";
type Config = { configurationKey: "workspace"; autoQueueAfterReady: boolean; autoAssignLane: boolean };
const OFF: Config = { configurationKey: "workspace", autoQueueAfterReady: false, autoAssignLane: false };

export const useFinopsRouting = () => {
  const query = useSettingsObjectsV2({ schemaId: SCHEMA_ID, addFields: "value,summary,schemaId", pageSize: 2 });
  const permissions = useEffectivePermissionsV2({ body: { permissions: [
    { permission: "app-settings:objects:read", context: { schemaId: SCHEMA_ID } },
    { permission: "app-settings:objects:write", context: { schemaId: SCHEMA_ID } },
  ] } });
  const create = useCreateSettingsV2();
  const update = useUpdateSettingsV2();
  const item = query.data?.items?.length === 1 ? query.data.items[0] : undefined;
  const raw = item?.value;
  const valid = raw && typeof raw === "object" && !Array.isArray(raw) &&
    (raw as Record<string, unknown>).configurationKey === "workspace" &&
    typeof (raw as Record<string, unknown>).autoQueueAfterReady === "boolean" &&
    typeof (raw as Record<string, unknown>).autoAssignLane === "boolean";
  const canRead = permissions.data?.find((entry) => entry.permission === "app-settings:objects:read")?.granted === "true";
  const canWrite = permissions.data?.find((entry) => entry.permission === "app-settings:objects:write")?.granted === "true";
  const reliable = Boolean(canRead && query.data && !query.isLoading && !permissions.isLoading && !query.error && !permissions.error &&
    !query.data?.nextPageKey && (query.data?.totalCount ?? 0) <= 1 && (!item || valid));
  const config: Config = reliable && valid ? {
    configurationKey: "workspace",
    autoQueueAfterReady: (raw as Config).autoQueueAfterReady,
    autoAssignLane: (raw as Config).autoAssignLane,
  } : OFF;
  const save = async (next: Config) => {
    if (!canWrite || !reliable) throw new Error("FinOps routing settings are unavailable or read-only.");
    if (item) await update.execute({ objectId: item.objectId, optimisticLockingVersion: item.version, body: { value: next } });
    else await create.execute({ body: { schemaId: SCHEMA_ID, value: next } });
    await query.refetch();
  };
  return { config, reliable, canWrite, loading: query.isLoading || permissions.isLoading,
    mutating: create.isLoading || update.isLoading, error: query.error ?? permissions.error, save };
};
