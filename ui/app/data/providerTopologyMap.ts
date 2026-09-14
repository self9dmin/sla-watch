export type ProviderTopologyNodeTypeCount = {
  nodeType: string;
  nodeCount: number;
};

export type ProviderTopologyFamilyId =
  | "scope"
  | "security"
  | "network"
  | "apps"
  | "data"
  | "operations"
  | "compute"
  | "other";

export type ProviderTopologyFamily = {
  id: ProviderTopologyFamilyId;
  label: string;
  color: string;
  nodeCount: number;
  nodeTypes: ProviderTopologyNodeTypeCount[];
};

type ProviderTopologyFamilyDefinition = Pick<ProviderTopologyFamily, "id" | "label" | "color">;

const FAMILY_DEFINITIONS: ProviderTopologyFamilyDefinition[] = [
  { id: "scope", label: "Cloud scope", color: "#8a93ff" },
  { id: "security", label: "Identity & security", color: "#ff7fa4" },
  { id: "network", label: "Network", color: "#5bb5ff" },
  { id: "apps", label: "Apps & AI", color: "#ffb464" },
  { id: "data", label: "Data & messaging", color: "#b38cff" },
  { id: "operations", label: "Operations", color: "#9fd96b" },
  { id: "compute", label: "Compute & runtime", color: "#57d7c8" },
  { id: "other", label: "Other resources", color: "#98a6bd" },
];

const includesOne = (nodeType: string, tokens: readonly string[]): boolean =>
  tokens.some((token) => nodeType.includes(token));

export const providerTopologyFamilyId = (value: string): ProviderTopologyFamilyId => {
  const nodeType = value.trim().toUpperCase();

  if (includesOne(nodeType, [
    "ACCOUNT",
    "SUBSCRIPTION",
    "TENANCY",
    "TENANT",
    "PROJECT",
    "REGION",
    "LOCATION",
    "AVAILABILITY_ZONE",
    "AVAILABILITYZONE",
    "AVAILABILITY_DOMAIN",
    "RESOURCEGROUP",
  ])) return "scope";

  if (includesOne(nodeType, [
    "IAM",
    "IDENTITY",
    "SECURITY",
    "SECRET",
    "KMS",
    "CERTIFICATE",
    "COGNITO",
    "FIREWALL",
    "SHIELD",
    "WAF",
  ])) return "security";

  if (includesOne(nodeType, [
    "NETWORK",
    "VPC",
    "SUBNET",
    "ROUTE",
    "GATEWAY",
    "LOADBALANC",
    "DIRECTCONNECT",
    "PEERING",
    "PUBLICIP",
    "IPCONFIG",
    "CLOUDFRONT",
    "DHCP",
    "DNS",
    "NAT",
  ])) return "network";

  if (includesOne(nodeType, [
    "AMPLIFY",
    "APPRUNNER",
    "APP_RUNNER",
    "APP_SERVICE",
    "BEDROCK",
    "SAGEMAKER",
    "GENAI",
    "OPENAI",
    "ANTHROPIC",
    "DATABRICKS",
    "LAMBDA",
    "FUNCTION",
    "APIGATEWAY",
    "API_GATEWAY",
    "APPSYNC",
    "STEPFUNCTION",
    "REKOGNITION",
    "TEXTRACT",
    "COMPREHEND",
    "TRANSCRIBE",
    "TRANSLATE",
    "POLLY",
    "CONNECT",
    "LEX",
    "WEB_SITES",
  ])) return "apps";

  if (includesOne(nodeType, [
    "DATABASE",
    "DBCLUSTER",
    "DBINSTANCE",
    "DOCUMENTDB",
    "DYNAMO",
    "ELASTICACHE",
    "KEYSPACES",
    "OPENSEARCH",
    "REDSHIFT",
    "STORAGE",
    "TIMESTREAM",
    "ATHENA",
    "NEPTUNE",
    "QLDB",
    "KINESIS",
    "SQL",
    "S3",
    "EBS",
    "EFS",
    "DISK",
    "CACHE",
    "GLUE",
    "MSK",
    "SQS",
    "SNS",
    "MQ",
  ])) return "data";

  if (includesOne(nodeType, [
    "CLOUDWATCH",
    "CLOUDTRAIL",
    "MONITOR",
    "ALARM",
    "BACKUP",
    "SYSTEMSMANAGER",
    "SSM_",
    "CODEBUILD",
    "CODEPIPELINE",
    "CODEDEPLOY",
    "TRANSFER",
    "EVENTBUS",
    "LOGGROUP",
  ])) return "operations";

  if (includesOne(nodeType, [
    "VIRTUALMACHINE",
    "COMPUTE_INSTANCE",
    "AUTOSCAL",
    "KUBERNETES",
    "CONTAINER",
    "FARGATE",
    "PROCESS",
    "HOST",
    "EC2",
    "ECS",
    "EKS",
    "BATCH",
  ])) return "compute";

  return "other";
};

export const buildProviderTopologyFamilies = (
  nodeTypeCounts: readonly ProviderTopologyNodeTypeCount[],
): ProviderTopologyFamily[] => {
  const grouped = new Map<ProviderTopologyFamilyId, ProviderTopologyNodeTypeCount[]>();

  nodeTypeCounts.forEach(({ nodeType, nodeCount }) => {
    if (!nodeType.trim() || !Number.isFinite(nodeCount) || nodeCount <= 0) return;
    const familyId = providerTopologyFamilyId(nodeType);
    const nodes = grouped.get(familyId) ?? [];
    nodes.push({ nodeType, nodeCount });
    grouped.set(familyId, nodes);
  });

  return FAMILY_DEFINITIONS.flatMap((definition) => {
    const nodeTypes = grouped.get(definition.id);
    if (!nodeTypes?.length) return [];
    const sortedNodeTypes = [...nodeTypes].sort(
      (left, right) => right.nodeCount - left.nodeCount || left.nodeType.localeCompare(right.nodeType),
    );
    return [{
      ...definition,
      nodeCount: sortedNodeTypes.reduce((total, node) => total + node.nodeCount, 0),
      nodeTypes: sortedNodeTypes,
    }];
  });
};
