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
    accountId: "",
    subscriptionId: "",
    projectId: "example-project-123",
    tenancyId: "",
    region: "",
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

  it("normalizes and validates an OCI tenancy connection", () => {
    const connection = normalizeProviderConnection({
      providerSlug: "OCI",
      displayName: "Production OCI",
      tenancyId: "ocid1.tenancy.oc1..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      region: "US-ASHBURN-1",
      credentialId: "credentials_vault-0123456789abcdef",
      enabled: true,
    });

    expect(connection).toEqual({
      connectionKey: "oci|ocid1.tenancy.oc1..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      providerSlug: "oci",
      displayName: "Production OCI",
      accountId: "",
      subscriptionId: "",
      projectId: "",
      tenancyId: "ocid1.tenancy.oc1..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      region: "us-ashburn-1",
      credentialId: "CREDENTIALS_VAULT-0123456789ABCDEF",
      enabled: true,
    });
    expect(validateProviderConnection(connection!)).toEqual([]);
  });

  it("normalizes and validates an AWS account connection", () => {
    const connection = normalizeProviderConnection({
      providerSlug: "AWS",
      displayName: "Production AWS",
      accountId: "123456789012",
      credentialId: "credentials_vault-0123456789abcdef",
      enabled: true,
    });

    expect(connection).toEqual({
      connectionKey: "aws|123456789012",
      providerSlug: "aws",
      displayName: "Production AWS",
      accountId: "123456789012",
      subscriptionId: "",
      projectId: "",
      tenancyId: "",
      region: "",
      credentialId: "CREDENTIALS_VAULT-0123456789ABCDEF",
      enabled: true,
    });
    expect(validateProviderConnection(connection!)).toEqual([]);
  });

  it("normalizes and validates an Azure subscription connection", () => {
    const connection = normalizeProviderConnection({
      providerSlug: "AZURE",
      displayName: "Production Azure",
      subscriptionId: "ABCDEF12-3456-7890-ABCD-EF1234567890",
      credentialId: "credentials_vault-0123456789abcdef",
      enabled: true,
    });

    expect(connection).toEqual({
      connectionKey: "azure|abcdef12-3456-7890-abcd-ef1234567890",
      providerSlug: "azure",
      displayName: "Production Azure",
      accountId: "",
      subscriptionId: "abcdef12-3456-7890-abcd-ef1234567890",
      projectId: "",
      tenancyId: "",
      region: "",
      credentialId: "CREDENTIALS_VAULT-0123456789ABCDEF",
      enabled: true,
    });
    expect(validateProviderConnection(connection!)).toEqual([]);
  });

  it("rejects malformed AWS and Azure scope identifiers", () => {
    expect(validateProviderConnection({ ...valid, providerSlug: "aws", accountId: "123" })).toEqual([
      "Enter a valid 12-digit AWS account ID.",
    ]);
    expect(validateProviderConnection({ ...valid, providerSlug: "azure", subscriptionId: "not-a-subscription" })).toEqual([
      "Enter a valid Azure subscription ID.",
    ]);
  });

  it("rejects malformed OCI scope fields", () => {
    expect(validateProviderConnection({
      ...valid,
      providerSlug: "oci",
      projectId: "",
      tenancyId: "not-an-ocid",
      region: "ashburn",
    })).toEqual([
      "Enter a valid OCI tenancy OCID.",
      "Enter a valid commercial OCI region, such as us-ashburn-1.",
    ]);
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
