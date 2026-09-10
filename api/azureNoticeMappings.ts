const AZURE_SERVICE_MAPPINGS: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [/\bvirtual machines?\b/i, ["virtual-machines", "virtual-machines-zone"]],
  [/\bblob storage\b/i, ["blob-storage"]],
  [/\bmanaged disks?\b/i, ["managed-disks"]],
  [/\bsql database\b/i, ["sql-database", "sql-database-zone", "sql-database-basic-standard"]],
  [/\bcosmos db\b/i, ["cosmos-db"]],
  [/\bfunctions?\b/i, ["functions", "functions-consumption", "functions-premium"]],
  [/\b(?:kubernetes service|aks)\b/i, ["kubernetes-service", "aks", "aks-zone"]],
  [/\bapp service\b/i, ["app-service", "app-service-standard", "app-service-enterprise"]],
  [/\bcontainer instances?\b/i, ["container-instances"]],
  [/\bcontainer registry\b/i, ["container-registry"]],
  [/\bcdn\b/i, ["cdn"]],
  [/\bfront door\b/i, ["front-door"]],
  [/\bload balancer\b/i, ["load-balancer"]],
  [/\bapplication gateway\b/i, ["application-gateway"]],
  [/\bservice bus\b/i, ["service-bus"]],
  [/\bevent hubs?\b/i, ["event-hubs"]],
  [/\bevent grid\b/i, ["event-grid"]],
  [/\bkey vault\b/i, ["key-vault"]],
  [/\bazure monitor\b/i, ["monitor"]],
  [/\blog analytics\b/i, ["log-analytics"]],
  [/\bapplication insights\b/i, ["application-insights"]],
  [/\btraffic manager\b/i, ["traffic-manager"]],
  [/\bvirtual wan\b/i, ["virtual-wan"]],
  [/\bazure firewall\b/i, ["firewall"]],
  [/\bprivate link\b/i, ["private-link"]],
  [/\bapi management\b/i, ["api-management"]],
];

export const mapAzureServiceToDirectoryIds = (serviceName: string): string[] => {
  const match = AZURE_SERVICE_MAPPINGS.find(([pattern]) => pattern.test(serviceName));
  return match ? [...match[1]] : [];
};
