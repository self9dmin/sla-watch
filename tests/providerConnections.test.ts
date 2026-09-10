import {
  createProviderConnectionKey,
  normalizeProviderConnection,
  validateProviderConnection,
} from "../ui/app/data/providerConnections";

describe("provider connection settings", () => {
  const valid = {
    connectionKey: "gcp|example-project-123",
    providerSlug: "gcp",
    displayName: "Production Google Cloud",
    projectId: "example-project-123",
    credentialId: "CREDENTIALS_VAULT-0123456789ABCDEF",
    enabled: true,
  };

  it("normalizes provider and credential identifiers", () => {
    expect(normalizeProviderConnection({
      ...valid,
      providerSlug: "GCP",
      projectId: "Example-Project-123",
      credentialId: "credentials_vault-0123456789abcdef",
    })).toEqual(valid);
  });

  it("creates a stable per-project key", () => {
    expect(createProviderConnectionKey("GCP", "Example-Project-123")).toBe("gcp|example-project-123");
  });

  it("rejects malformed project and Credential Vault identifiers", () => {
    expect(validateProviderConnection({ ...valid, projectId: "Project With Spaces", credentialId: "secret" })).toEqual([
      "Enter a valid Google Cloud project ID.",
      "Enter the full Dynatrace Credential Vault ID shown in Credential Vault.",
    ]);
  });

  it("does not accept incomplete settings records", () => {
    expect(normalizeProviderConnection({ providerSlug: "gcp" })).toBeNull();
  });
});
