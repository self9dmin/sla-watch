const GENAI_CONTRACT_OWNER_BY_IDENTITY: Readonly<Record<string, string>> = {
  amazon: "aws",
  "amazon.bedrock": "aws",
  "aws.bedrock": "aws",
  "azure.ai.openai": "azure",
  "azure.openai": "azure",
  "gcp.gen_ai": "gcp",
  "gcp.gemini": "gcp",
  "google.gemini": "gcp",
  anthropic: "anthropic",
  elevenlabs: "elevenlabs",
  openai: "openai",
};

const normalizeIdentity = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : undefined;

/**
 * Resolves only reviewed Smartscape provider signals to the contract owner whose
 * terms should be displayed. Names of models, services, and frameworks are not
 * provider evidence and deliberately remain unresolved.
 */
export const providerSlugFromSmartscapeIdentity = (
  nodeTypeValue: unknown,
  providerIdentityValue: unknown,
): string | undefined => {
  const nodeType = normalizeIdentity(nodeTypeValue)?.toUpperCase() ?? "";
  if (nodeType.startsWith("DATABRICKS_")) return "databricks";
  if (nodeType !== "GENAI_PROVIDER") return undefined;

  const providerIdentity = normalizeIdentity(providerIdentityValue);
  return providerIdentity
    ? GENAI_CONTRACT_OWNER_BY_IDENTITY[providerIdentity]
    : undefined;
};
