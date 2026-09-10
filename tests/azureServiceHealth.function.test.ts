jest.mock("@dynatrace-sdk/client-classic-environment-v2", () => ({
  credentialVaultClient: { getCredentialsDetails: jest.fn() },
}));

import { credentialVaultClient } from "@dynatrace-sdk/client-classic-environment-v2";
import getAzureServiceHealth, { parseAzureServiceHealthEvents } from "../api/azureServiceHealth.function";

const SUBSCRIPTION_ID = "abcdef12-3456-7890-abcd-ef1234567890";
const TENANT_ID = "11111111-2222-3333-4444-555555555555";
const CLIENT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const CREDENTIAL_ID = "CREDENTIALS_VAULT-0123456789ABCDEF";

const azureEvent = {
  id: `/subscriptions/${SUBSCRIPTION_ID}/providers/Microsoft.ResourceHealth/events/incident-1`,
  name: "incident-1",
  properties: {
    title: "Virtual Machines service degradation",
    summary: "<p>Some virtual machines experienced &amp; recovered from connectivity errors.</p>",
    status: "Active",
    eventType: "ServiceIssue",
    eventLevel: "Warning",
    impactStartTime: "2026-09-10T10:00:00Z",
    lastUpdateTime: "2026-09-10T11:00:00Z",
    impact: [{
      impactedService: "Virtual Machines",
      impactedServiceGuid: "virtual-machines",
      impactedRegions: [{ impactedRegion: "East US" }],
    }],
  },
};

describe("Azure Service Health subscription events", () => {
  it("normalizes subscription events, strips provider markup, and maps explicit services", () => {
    const notices = parseAzureServiceHealthEvents({ value: [azureEvent] }, SUBSCRIPTION_ID);

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      id: "incident-1",
      source: "azure-service-health",
      sourceScope: SUBSCRIPTION_ID,
      title: "Virtual Machines service degradation",
      summary: "Some virtual machines experienced & recovered from connectivity errors.",
      state: "ACTIVE",
      relevance: "Subscription event",
      locations: ["East US"],
    });
    expect(notices[0].products).toEqual([{
      id: "virtual-machines",
      name: "Virtual Machines",
      directoryServiceIds: ["virtual-machines", "virtual-machines-zone"],
    }]);
  });

  it("uses a vaulted client credential and reads the configured subscription", async () => {
    const vaultMock = credentialVaultClient.getCredentialsDetails as jest.Mock;
    vaultMock.mockResolvedValue({
      type: "TOKEN",
      token: JSON.stringify({ tenantId: TENANT_ID, clientId: CLIENT_ID, clientSecret: "test-client-secret" }),
    });
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "test-access-token" }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [azureEvent] }), { status: 200, headers: { "Content-Type": "application/json" } }));

    try {
      const result = await getAzureServiceHealth({ subscriptionId: SUBSCRIPTION_ID, credentialId: CREDENTIAL_ID, lookbackHours: 24 });
      expect(result).toMatchObject({ provider: "azure", source: "personalized", connectionState: "connected", scopeLabel: SUBSCRIPTION_ID });
      expect(result.notices[0]).toMatchObject({ id: "incident-1" });
      expect(vaultMock).toHaveBeenCalledWith({ id: CREDENTIAL_ID });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(tokenUrl).toBe(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`);
      expect(String(tokenInit.body)).toContain("scope=https%3A%2F%2Fmanagement.azure.com%2F.default");

      const [healthUrl, healthInit] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect(healthUrl).toContain(`https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/providers/Microsoft.ResourceHealth/events?`);
      expect(healthUrl).toContain("api-version=2025-05-01");
      expect(new Headers(healthInit.headers).get("Authorization")).toBe("Bearer test-access-token");
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("rejects malformed subscription IDs before reading a credential", async () => {
    await expect(getAzureServiceHealth({ subscriptionId: "not-a-subscription", credentialId: CREDENTIAL_ID })).rejects.toThrow("valid Azure subscription ID");
    expect(credentialVaultClient.getCredentialsDetails).not.toHaveBeenCalled();
  });
});
