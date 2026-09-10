const OCI_SERVICE_MAPPINGS: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [/\bobject storage\b/i, ["object-storage"]],
  [/\bblock (?:volume|storage)\b/i, ["block-volume"]],
  [/\bfile storage\b/i, ["file-storage"]],
  [/\b(?:container engine for kubernetes|oke)\b/i, ["oke"]],
  [/\bfunctions?\b/i, ["functions"]],
  [/\bload balancer\b/i, ["load-balancer"]],
  [/\bfastconnect\b/i, ["fastconnect"]],
  [/\bsite-to-site vpn\b|\bvpn\b/i, ["vpn"]],
  [/\bdomain name system\b|\bdns\b/i, ["dns"]],
  [/\bidentity and access management\b|\biam\b/i, ["iam"]],
  [/\bvault\b|\bkey management\b/i, ["vault"]],
  [/\bcompute\b/i, ["compute-multiad", "compute-single"]],
];

export const mapOciServiceToDirectoryIds = (serviceName: string): string[] => {
  const match = OCI_SERVICE_MAPPINGS.find(([pattern]) => pattern.test(serviceName));
  return match ? [...match[1]] : [];
};
