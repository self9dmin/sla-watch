import type { ServiceRecord } from "../types";

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const tagStrings = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string" && item.trim()) return [item.trim()];
      const record = asRecord(item);
      const key = optionalText(record.key ?? record.name);
      const tagValue = optionalText(record.value);
      return key && tagValue ? [`${key}:${tagValue}`] : [];
    });
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, tagValue]) => {
    if (Array.isArray(tagValue)) {
      return tagValue.flatMap((item) =>
        typeof item === "string" && item.trim() ? [`${key}:${item.trim()}`] : []);
    }
    if (typeof tagValue === "string" || typeof tagValue === "number" || typeof tagValue === "boolean")
      return [`${key}:${String(tagValue)}`];
    return [];
  });
};

export const parseServiceRecords = (
  data: { records?: unknown[] } | undefined,
): ServiceRecord[] => {
  const records = Array.isArray(data?.records) ? data.records : [];
  return records.flatMap((value) => {
    const row = asRecord(value);
    const id = optionalText(row.id);
    if (!id) return [];
    return [{
      id,
      name: optionalText(row.name) ?? id,
      type: optionalText(row.type) ?? "SERVICE",
      tags: tagStrings(row.tags),
    }];
  });
};
