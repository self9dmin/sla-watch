export const SERVICES_QUERY = `
fetch dt.entity.service
| fields id, name = entity.name, type = entity.type, tags
| sort name asc
| limit 200
`;

export const SMARTSCAPE_SERVICE_RUNTIME_QUERY = `
smartscapeEdges {runs_on, belongs_to}, from:-72h, to:now()
| filter source_type == "SERVICE"
| fields relationship = type,
    service_node_id = source_id,
    service_classic_id = getNodeField(source_id, "id_classic"),
    service_name = getNodeName(source_id),
    target_node_id = target_id,
    target_classic_id = getNodeField(target_id, "id_classic"),
    target_name = getNodeName(target_id),
    target_type,
    aws_region = getNodeField(target_id, "aws.region"),
    aws_availability_zone = getNodeField(target_id, "aws.availability_zone"),
    azure_location = getNodeField(target_id, "azure.location"),
    gcp_region = getNodeField(target_id, "gcp.region"),
    gcp_location = getNodeField(target_id, "gcp.location"),
    k8s_cluster = getNodeField(target_id, "k8s.cluster.name")
| limit 500
`;

export const createProblemsQuery = (lookbackHours: number): string => `
fetch dt.davis.problems, from:-${lookbackHours}h, to:now()
| filter not(dt.davis.is_duplicate)
| sort event.start desc
| fields display_id, title = event.name, status = event.status, category = event.category, start_time = event.start, end_time = event.end, affected_entity_ids, root_cause_entity_id
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
