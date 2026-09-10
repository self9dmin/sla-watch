export const SERVICES_QUERY = `
fetch dt.entity.service
| fields id, name = entity.name, type = entity.type, tags
| sort name asc
| limit 200
`;

export const createProblemsQuery = (lookbackHours: number): string => `
fetch dt.davis.problems, from:-${lookbackHours}h, to:now()
| filter not(dt.davis.is_duplicate)
| sort event.start desc
| fields display_id, title = event.name, status = event.status, category = event.category, affected_entity_ids, root_cause_entity_id
| limit 100
`;

export const createLogsCountQuery = (lookbackHours: number): string => `
fetch logs, from:-${lookbackHours}h, to:now()
| summarize log_count = count()
`;

export const createSpansCountQuery = (lookbackHours: number): string => `
fetch spans, from:-${lookbackHours}h, to:now()
| summarize span_count = count()
`;

export const createServiceMetricsQuery = (lookbackHours: number): string => `
timeseries request_count = sum(dt.service.request.count), from:-${lookbackHours}h, to:now()
| limit 1
`;

export const PROBLEMS_QUERY = createProblemsQuery(24);
export const LOGS_COUNT_QUERY = createLogsCountQuery(24);
export const SPANS_COUNT_QUERY = createSpansCountQuery(24);
export const SERVICE_METRICS_QUERY = createServiceMetricsQuery(24);
