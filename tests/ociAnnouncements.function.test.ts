jest.mock("@dynatrace-sdk/client-classic-environment-v2", () => ({
  credentialVaultClient: { getCredentialsDetails: jest.fn() },
}));

import { credentialVaultClient } from "@dynatrace-sdk/client-classic-environment-v2";
import getOciAnnouncements, { buildOciAnnouncementsRequest, parseOciAnnouncements } from "../api/ociAnnouncements.function";

const TENANCY_ID = "ocid1.tenancy.oc1..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const USER_ID = "ocid1.user.oc1..bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const CREDENTIAL_ID = "CREDENTIALS_VAULT-0123456789ABCDEF";

describe("OCI tenancy announcements", () => {
  it("normalizes tenancy notices and maps only explicit OCI service names", () => {
    const notices = parseOciAnnouncements({
      items: [{
        id: "announcement-1",
        referenceTicketNumber: "INC-123",
        summary: "OCI service interruption",
        announcementType: "PRODUCTION_EVENT_NOTIFICATION",
        lifecycleState: "ACTIVE",
        timeOneValue: "2026-09-10T10:00:00Z",
        timeUpdated: "2026-09-10T11:00:00Z",
        services: ["Compute", "Object Storage", "Database"],
        affectedRegions: ["us-ashburn-1"],
      }],
    }, TENANCY_ID, new Date("2026-09-10T12:00:00Z"));

    expect(notices[0]).toMatchObject({
      id: "announcement-1",
      source: "oci-announcement",
      sourceScope: TENANCY_ID,
      state: "ACTIVE",
      locations: ["us-ashburn-1"],
    });
    expect(notices[0].products).toEqual([
      { id: "Compute", name: "Compute", directoryServiceIds: ["compute-multiad", "compute-single"] },
      { id: "Object Storage", name: "Object Storage", directoryServiceIds: ["object-storage"] },
      { id: "Database", name: "Database", directoryServiceIds: [] },
    ]);
  });

  it("builds a fixed commercial regional endpoint and bounded query", () => {
    const request = buildOciAnnouncementsRequest(TENANCY_ID, "us-ashburn-1", new Date("2026-09-01T00:00:00Z"));
    expect(request.host).toBe("announcements.us-ashburn-1.oraclecloud.com");
    expect(request.url).toContain("https://announcements.us-ashburn-1.oraclecloud.com/20180904/announcements?");
    expect(request.requestTarget).toContain(`compartmentId=${encodeURIComponent(TENANCY_ID)}`);
    expect(request.requestTarget).toContain("limit=100");
    expect(request.requestTarget).toContain("shouldShowOnlyLatestInChain=true");
  });

  it("reads a vaulted signing credential and signs the Announcements request", async () => {
    const vaultMock = credentialVaultClient.getCredentialsDetails as jest.Mock;
    vaultMock.mockResolvedValue({
      type: "TOKEN",
      token: JSON.stringify({
        userOcid: USER_ID,
        fingerprint: "00:11:22:33:44:55:66:77:88:99:aa:bb:cc:dd:ee:ff",
        privateKey: "-----BEGIN PRIVATE KEY-----\nAQID\n-----END PRIVATE KEY-----",
      }),
    });
    const importKey = jest.spyOn(crypto.subtle, "importKey").mockResolvedValue({} as CryptoKey);
    const sign = jest.spyOn(crypto.subtle, "sign").mockResolvedValue(Uint8Array.of(1, 2, 3).buffer);
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    try {
      const result = await getOciAnnouncements({
        tenancyId: TENANCY_ID,
        region: "us-ashburn-1",
        credentialId: CREDENTIAL_ID,
        lookbackHours: 24,
      });
      expect(result).toMatchObject({ provider: "oci", source: "personalized", connectionState: "connected", notices: [] });
      expect(vaultMock).toHaveBeenCalledWith({ id: CREDENTIAL_ID });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("announcements.us-ashburn-1.oraclecloud.com/20180904/announcements");
      expect(new Headers(init.headers).get("x-date")).toBeTruthy();
      expect(new Headers(init.headers).get("Authorization")).toContain(`keyId="${TENANCY_ID}/${USER_ID}/00:11:22:33:44:55:66:77:88:99:aa:bb:cc:dd:ee:ff"`);
      expect(importKey).toHaveBeenCalledWith("pkcs8", expect.any(ArrayBuffer), expect.any(Object), false, ["sign"]);
      expect(sign).toHaveBeenCalledTimes(1);
    } finally {
      fetchMock.mockRestore();
      sign.mockRestore();
      importKey.mockRestore();
    }
  });

  it("rejects malformed provider responses", () => {
    expect(() => parseOciAnnouncements({ items: "invalid" }, TENANCY_ID)).toThrow("invalid response");
  });

  it("rejects noncommercial realm identifiers before reading a credential", async () => {
    await expect(getOciAnnouncements({
      tenancyId: "ocid1.tenancy.oc2..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      region: "us-gov-ashburn-1",
      credentialId: CREDENTIAL_ID,
      lookbackHours: 24,
    })).rejects.toThrow("valid OCI tenancy OCID");
    expect(credentialVaultClient.getCredentialsDetails).not.toHaveBeenCalled();
  });
});
