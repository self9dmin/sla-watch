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
    service_tags = getNodeField(source_id, "tags"),
    target_node_id = target_id,
    target_classic_id = getNodeField(target_id, "id_classic"),
    target_name = getNodeName(target_id),
    target_type,
    cloud_provider = getNodeField(target_id, "cloud.provider"),
    aws_account_id = getNodeField(target_id, "aws.account.id"),
    aws_region = getNodeField(target_id, "aws.region"),
    aws_availability_zone = getNodeField(target_id, "aws.availability_zone"),
    azure_subscription = getNodeField(target_id, "azure.subscription"),
    azure_location = getNodeField(target_id, "azure.location"),
    gcp_project_id = getNodeField(target_id, "gcp.project.id"),
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
timeseries request_count = sum(dt.service.request.count, scalar: true),
  by:{dt.smartscape.service, dt.service.name, aws.account.id, aws.region, azure.location, azure.subscription, gcp.project.id, gcp.region},
  from:-${lookbackHours}h, to:now(), nonempty:true
| fields request_count,
    service_node_id = dt.smartscape.service,
    service_classic_id = getNodeField(dt.smartscape.service, "id_classic"),
    service_name = dt.service.name,
    service_tags = getNodeField(dt.smartscape.service, "tags"),
    aws_account_id = aws.account.id,
    aws_region = aws.region,
    azure_subscription = azure.subscription,
    azure_location = azure.location,
    gcp_project_id = gcp.project.id,
    gcp_region = gcp.region
| limit 500
`;

export const PROBLEMS_QUERY = createProblemsQuery(24);
export const LOGS_COUNT_QUERY = createLogsCountQuery(24);
export const SPANS_COUNT_QUERY = createSpansCountQuery(24);
export const SERVICE_METRICS_QUERY = createServiceMetricsQuery(24);
