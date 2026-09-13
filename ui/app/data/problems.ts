import type {
  ProblemRecord,
  SmartscapeEntityReference,
} from "../types";

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};

const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;

const stringList = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return Array.from(new Set(
    values
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean),
  ));
};

const uniqueEntityIds = (values: string[]): string[] =>
  Array.from(values.reduce((byId, value) => {
    const normalized = value.trim().toLowerCase();
    if (normalized && !byId.has(normalized)) byId.set(normalized, value.trim());
    return byId;
  }, new Map<string, string>()).values());

export const parseSmartscapeEntityReference = (
  value: unknown,
): SmartscapeEntityReference | undefined => {
  if (typeof value === "string") {
    const id = value.trim();
    return id ? { id, name: id, type: "unknown" } : undefined;
  }
  const row = asRecord(value);
  const id = optionalText(row.id);
  if (!id) return undefined;
  return {
    id,
    name: optionalText(row.name) ?? id,
    type: optionalText(row.type) ?? "unknown",
  };
};

const parseSmartscapeEntityReferences = (
  value: unknown,
): SmartscapeEntityReference[] => {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, SmartscapeEntityReference>();
  value.forEach((item) => {
    const entity = parseSmartscapeEntityReference(item);
    if (entity) byId.set(entity.id.toLowerCase(), entity);
  });
  return Array.from(byId.values());
};

export const parseProblemRecords = (
  data: { records?: unknown[] } | undefined,
): ProblemRecord[] => {
  const records = Array.isArray(data?.records) ? data.records : [];
  return records.map((record, index) => {
    const row = asRecord(record);
    const affectedEntities = parseSmartscapeEntityReferences(row.affected_entities);
    const affectedEntityIds = uniqueEntityIds([
      ...affectedEntities.map((entity) => entity.id),
      ...stringList(row.affected_entity_ids),
    ]);
    const stableRootCause = parseSmartscapeEntityReference(row.root_cause);
    const legacyRootCauseId = optionalText(row.root_cause_entity_id);
    const rootCause = stableRootCause ?? (legacyRootCauseId
      ? {
          id: legacyRootCauseId,
          name: optionalText(row.root_cause_entity_name) ?? legacyRootCauseId,
          type: optionalText(row.root_cause_entity_type) ?? "unknown",
        }
      : undefined);

    return {
      id: optionalText(row.display_id) ?? `problem-${index + 1}`,
      title: optionalText(row.title) ?? "Untitled problem",
      status: (optionalText(row.status) ?? "UNKNOWN").toUpperCase(),
      category: optionalText(row.category) ?? "UNKNOWN",
      affectedEntityIds,
      affectedEntities,
      hasRootCause: Boolean(rootCause),
      rootCause,
      startedAt: optionalText(row.start_time),
      endedAt: optionalText(row.end_time),
    };
  });
};
