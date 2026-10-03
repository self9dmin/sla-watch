import type {
  ProviderNotice,
  ProviderNoticeAffectedResource,
  ProviderNoticesResponse,
} from "../types";
import { mapAwsServiceToDirectoryIds } from "./awsNoticeMappings";

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};

const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;

const unique = (values: Array<string | undefined>): string[] =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value))));

const unknownList = (value: unknown): unknown[] =>
  Array.isArray(value) ? value as unknown[] : [];

const compactText = (value: unknown, fallback: string): string => {
  const text = optionalText(value)?.replace(/\s+/g, " ") ?? fallback;
  return text.length > 600 ? `${text.slice(0, 597)}...` : text;
};

const isoDate = (value: unknown): string | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1_000;
    const parsed = new Date(milliseconds);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  const text = optionalText(value);
  if (!text) return undefined;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

const noticeState = (value: unknown): ProviderNotice["state"] => {
  const normalized = optionalText(value)?.toLowerCase();
  if (normalized === "open" || normalized === "upcoming") return "ACTIVE";
  if (normalized === "closed") return "CLOSED";
  return "UNKNOWN";
};

const displayService = (value: string): string => value
  .replace(/^AWS_/, "")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (character) => character.toUpperCase());

const displayEventType = (value: string, service: string): string => value
  .replace(new RegExp(`^AWS_${service.replace(/[^A-Z0-9]/gi, "").toUpperCase()}_`), "")
  .replace(/^AWS_[A-Z0-9]+_/, "")
  .replace(/_/g, " ")
  .toLowerCase();

const resourceIdFromArn = (arn: string): string => {
  const resource = arn.split(":").slice(5).join(":");
  return resource.split(/[/:]/).filter(Boolean).pop() ?? arn;
};

const resourceFromValue = (
  value: unknown,
  accountId?: string,
): ProviderNoticeAffectedResource | undefined => {
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return undefined;
    return {
      id: raw.startsWith("arn:") ? resourceIdFromArn(raw) : raw,
      ...(raw.startsWith("arn:") ? { arn: raw } : {}),
      accountId,
    };
  }
  const row = asRecord(value);
  const arn = optionalText(row.entityArn ?? row.arn);
  const id = optionalText(row.entityValue ?? row.id) ?? (arn ? resourceIdFromArn(arn) : undefined);
  if (!id) return undefined;
  return {
    id,
    ...(arn ? { arn } : {}),
    accountId: optionalText(row.awsAccountId ?? row.accountId) ?? accountId,
    status: optionalText(row.statusCode ?? row.status),
    updateTime: isoDate(row.lastUpdatedTime ?? row.updateTime),
  };
};

const affectedResources = (row: Record<string, unknown>, accountId?: string): ProviderNoticeAffectedResource[] => {
  const explicitValues = [
    ...unknownList(row.affected_entities),
    ...unknownList(row.resources),
  ];
  const resources = explicitValues
    .map((value) => resourceFromValue(value, accountId))
    .filter((value): value is ProviderNoticeAffectedResource => Boolean(value));
  const smartscapeSourceId = optionalText(row.smartscape_source_id);
  if (resources.length > 0 && smartscapeSourceId) {
    resources.push({ id: smartscapeSourceId, accountId });
  }
  return Array.from(resources.reduce((byId, resource) => {
    const key = resource.id.toLowerCase();
    const existing = byId.get(key);
    byId.set(key, existing ? {
      ...existing,
      ...resource,
      arn: resource.arn ?? existing.arn,
      accountId: resource.accountId ?? existing.accountId,
      status: resource.status ?? existing.status,
      updateTime: resource.updateTime ?? existing.updateTime,
    } : resource);
    return byId;
  }, new Map<string, ProviderNoticeAffectedResource>()).values());
};

const parseNotice = (value: unknown, index: number): ProviderNotice | undefined => {
  const row = asRecord(value);
  const service = optionalText(row.service);
  const eventTypeCode = optionalText(row.event_type_code);
  const id = optionalText(row.event_arn ?? row.event_id);
  if (!service || !eventTypeCode || !id) return undefined;
  const accountId = optionalText(row.affected_account ?? row.source_account);
  const scopeCode = optionalText(row.event_scope_code);
  const serviceName = displayService(service);
  const eventType = displayEventType(eventTypeCode, service);
  const category = optionalText(row.event_type_category)?.toLowerCase() ?? "event";
  const resources = affectedResources(row, accountId);
  return {
    id: id || `aws-health-${index + 1}`,
    source: "aws-health",
    sourceScope: accountId,
    title: `${serviceName}: ${eventType || category}`,
    summary: compactText(
      row.event_description,
      `AWS Health reported ${scopeCode === "ACCOUNT_SPECIFIC" ? "an account-specific" : "a"} ${category} for ${serviceName}.`,
    ),
    state: noticeState(row.status_code),
    detailedState: optionalText(row.status_code),
    relevance: scopeCode === "ACCOUNT_SPECIFIC"
      ? "Account-specific event"
      : scopeCode
        ? `${scopeCode.toLowerCase().replace(/_/g, " ")} event`
        : "AWS Health event",
    severity: optionalText(row.event_type_category),
    startTime: isoDate(row.event_start ?? row.timestamp),
    endTime: isoDate(row.event_end),
    updateTime: isoDate(row.event_updated ?? row.timestamp),
    products: [{
      id: service,
      name: serviceName,
      directoryServiceIds: mapAwsServiceToDirectoryIds(service),
    }],
    locations: unique([
      optionalText(row.event_region),
      optionalText(row.source_region),
    ]),
    affectedResources: resources,
    url: "https://health.aws.amazon.com/health/home#/account/dashboard/open-issues",
  };
};

export const parseAwsHealthEventRecords = (
  data: { records?: unknown[] } | undefined,
  now: Date = new Date(),
): ProviderNoticesResponse => {
  const records = Array.isArray(data?.records) ? data.records : [];
  const notices = new Map<string, ProviderNotice>();
  records.forEach((record, index) => {
    const notice = parseNotice(record, index);
    if (!notice) return;
    const current = notices.get(notice.id);
    if (!current) {
      notices.set(notice.id, notice);
      return;
    }
    const resources = [...(current.affectedResources ?? []), ...(notice.affectedResources ?? [])];
    notices.set(notice.id, {
      ...current,
      affectedResources: Array.from(resources.reduce((byId, resource) => {
        const key = resource.id.toLowerCase();
        const existing = byId.get(key);
        byId.set(key, existing ? {
          ...existing,
          ...resource,
          arn: resource.arn ?? existing.arn,
          accountId: resource.accountId ?? existing.accountId,
          status: resource.status ?? existing.status,
          updateTime: resource.updateTime ?? existing.updateTime,
        } : resource);
        return byId;
      }, new Map<string, ProviderNoticeAffectedResource>()).values()),
    });
  });
  return {
    provider: "aws",
    providerName: "AWS",
    sourceName: "AWS Health events in Grail",
    fetchedAt: now.toISOString(),
    source: "personalized",
    connectionState: "connected",
    delivery: "dynatrace",
    scopeLabel: "Monitored AWS accounts",
    message: `Dynatrace returned ${notices.size} AWS Health event${notices.size === 1 ? "" : "s"} in the selected window.`,
    warning: "These are AWS-owned events ingested by Dynatrace. An event still needs customer-observed impact before it supports a provider follow-up.",
    notices: Array.from(notices.values()),
  };
};
