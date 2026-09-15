jest.mock("@dynatrace-sdk/client-classic-environment-v2", () => ({
  credentialVaultClient: { getCredentialsDetails: jest.fn() },
}));

import { credentialVaultClient } from "@dynatrace-sdk/client-classic-environment-v2";
import getAwsHealth, { parseAwsAffectedEntities, parseAwsHealthEvents } from "../api/awsHealth.function";
import { mapAwsServiceToDirectoryIds } from "../api/awsNoticeMappings";

const ACCOUNT_ID = "123456789012";
const OTHER_ACCOUNT_ID = "210987654321";
const CREDENTIAL_ID = "CREDENTIALS_VAULT-0123456789ABCDEF";
const EVENT_ARN = "arn:aws:health:us-east-1::event/EC2/test-event";
const ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/SLAReviewHealthRole`;
const ASSUMED_ACCESS_KEY = `ASIA${"C".repeat(16)}`;

const signingCredential = () => ({
  type: "TOKEN",
  token: JSON.stringify({
    accessKeyId: "A".repeat(20),
    secretAccessKey: "b".repeat(40),
  }),
});

const accountEvent = {
  arn: EVENT_ARN,
  service: "EC2",
  eventTypeCode: "AWS_EC2_OPERATIONAL_ISSUE",
  eventTypeCategory: "issue",
  eventScopeCode: "ACCOUNT_SPECIFIC",
  statusCode: "open",
  region: "us-east-1",
  availabilityZone: "us-east-1a",
  startTime: Date.parse("2026-09-10T10:00:00Z") / 1_000,
  lastUpdatedTime: Date.parse("2026-09-10T11:00:00Z") / 1_000,
};

describe("AWS Health account events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps only account-specific events and maps AWS services to directory records", () => {
    const notices = parseAwsHealthEvents({
      events: [
        accountEvent,
        { ...accountEvent, arn: `${EVENT_ARN}-public`, eventScopeCode: "PUBLIC" },
      ],
    }, ACCOUNT_ID, new Map([[EVENT_ARN, "Requests failed for a subset of instances."]]));

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      id: EVENT_ARN,
      source: "aws-health",
      sourceScope: ACCOUNT_ID,
      state: "ACTIVE",
      relevance: "Account-specific event",
      summary: "Requests failed for a subset of instances.",
      locations: ["us-east-1", "us-east-1a"],
    });
    expect(notices[0].products).toEqual([{ id: "EC2", name: "EC2", directoryServiceIds: ["ec2"] }]);
    expect(mapAwsServiceToDirectoryIds("APP_RUNNER")).toEqual(["app-runner"]);
  });

  it("normalizes affected AWS resources by event without retaining tags", () => {
    const resources = parseAwsAffectedEntities({
      entities: [{
        eventArn: EVENT_ARN,
        entityValue: "i-0123456789abcdef0",
        entityArn: `arn:aws:ec2:us-east-1:${ACCOUNT_ID}:instance/i-0123456789abcdef0`,
        awsAccountId: ACCOUNT_ID,
        statusCode: "IMPAIRED",
        lastUpdatedTime: Date.parse("2026-09-10T11:30:00Z") / 1_000,
        tags: { Owner: "private-team" },
      }],
    });

    expect(resources.get(EVENT_ARN)).toEqual([{
      id: "i-0123456789abcdef0",
      arn: `arn:aws:ec2:us-east-1:${ACCOUNT_ID}:instance/i-0123456789abcdef0`,
      accountId: ACCOUNT_ID,
      status: "IMPAIRED",
      updateTime: "2026-09-10T11:30:00.000Z",
    }]);
  });

  it("verifies the account with STS and reads bounded Health details", async () => {
    const vaultMock = credentialVaultClient.getCredentialsDetails as jest.Mock;
    vaultMock.mockResolvedValue(signingCredential());
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(`<GetCallerIdentityResponse><GetCallerIdentityResult><Account>${ACCOUNT_ID}</Account></GetCallerIdentityResult></GetCallerIdentityResponse>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ events: [accountEvent] }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        successfulSet: [{ event: { arn: EVENT_ARN }, eventDescription: { latestDescription: "AWS reported an account event." } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        entities: [{
          eventArn: EVENT_ARN,
          entityValue: "i-0123456789abcdef0",
          entityArn: `arn:aws:ec2:us-east-1:${ACCOUNT_ID}:instance/i-0123456789abcdef0`,
          awsAccountId: ACCOUNT_ID,
          statusCode: "IMPAIRED",
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));

    try {
      const result = await getAwsHealth({ accountId: ACCOUNT_ID, credentialId: CREDENTIAL_ID, lookbackHours: 24 });
      expect(result).toMatchObject({ provider: "aws", source: "personalized", connectionState: "connected", scopeLabel: ACCOUNT_ID });
      expect(result.notices[0]).toMatchObject({
        id: EVENT_ARN,
        summary: "AWS reported an account event.",
        affectedResources: [{ id: "i-0123456789abcdef0", accountId: ACCOUNT_ID, status: "IMPAIRED" }],
      });
      expect(vaultMock).toHaveBeenCalledWith({ id: CREDENTIAL_ID });
      expect(fetchMock).toHaveBeenCalledTimes(4);

      const [stsUrl, stsInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(stsUrl).toBe("https://sts.us-east-1.amazonaws.com/");
      expect(new Headers(stsInit.headers).get("Authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=/);

      const [healthUrl, healthInit] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect(healthUrl).toBe("https://health.us-east-1.amazonaws.com/");
      expect(new Headers(healthInit.headers).get("x-amz-target")).toBe("AWSHealth_20160804.DescribeEvents");
      expect(JSON.parse(String(healthInit.body))).toEqual(expect.objectContaining({ maxResults: 100 }));

      const [, detailInit] = fetchMock.mock.calls[2] as [string, RequestInit];
      expect(new Headers(detailInit.headers).get("x-amz-target")).toBe("AWSHealth_20160804.DescribeEventDetails");

      const [, affectedInit] = fetchMock.mock.calls[3] as [string, RequestInit];
      expect(new Headers(affectedInit.headers).get("x-amz-target")).toBe("AWSHealth_20160804.DescribeAffectedEntities");
      expect(JSON.parse(String(affectedInit.body))).toEqual(expect.objectContaining({ filter: { eventArns: [EVENT_ARN] }, maxResults: 100 }));
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("assumes a configured role before verifying the account and reading Health", async () => {
    const vaultMock = credentialVaultClient.getCredentialsDetails as jest.Mock;
    vaultMock.mockResolvedValue(signingCredential());
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(`<AssumeRoleResponse><AssumeRoleResult><Credentials><AccessKeyId>${ASSUMED_ACCESS_KEY}</AccessKeyId><SecretAccessKey>${"c".repeat(40)}</SecretAccessKey><SessionToken>temporary-session-token</SessionToken><Expiration>2099-01-01T00:00:00Z</Expiration></Credentials></AssumeRoleResult></AssumeRoleResponse>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(`<GetCallerIdentityResponse><GetCallerIdentityResult><Account>${ACCOUNT_ID}</Account></GetCallerIdentityResult></GetCallerIdentityResponse>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ events: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));

    try {
      const result = await getAwsHealth({ accountId: ACCOUNT_ID, roleArn: ROLE_ARN, credentialId: CREDENTIAL_ID, lookbackHours: 24 });
      expect(result.message).toContain("AWS role assumption succeeded");
      expect(fetchMock).toHaveBeenCalledTimes(3);

      const [assumeUrl, assumeInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(assumeUrl).toBe("https://sts.us-east-1.amazonaws.com/");
      expect(new URLSearchParams(String(assumeInit.body))).toEqual(new URLSearchParams({
        Action: "AssumeRole",
        Version: "2011-06-15",
        RoleArn: ROLE_ARN,
        RoleSessionName: "sla-review-appengine",
        DurationSeconds: "3600",
      }));

      const [, identityInit] = fetchMock.mock.calls[1] as [string, RequestInit];
      const identityHeaders = new Headers(identityInit.headers);
      expect(identityHeaders.get("Authorization")).toContain(`Credential=${ASSUMED_ACCESS_KEY}/`);
      expect(identityHeaders.get("x-amz-security-token")).toBe("temporary-session-token");

      const [, healthInit] = fetchMock.mock.calls[2] as [string, RequestInit];
      expect(new Headers(healthInit.headers).get("Authorization")).toContain(`Credential=${ASSUMED_ACCESS_KEY}/`);
      expect(new Headers(healthInit.headers).get("x-amz-security-token")).toBe("temporary-session-token");
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("rejects a role from a different account before reading the vault", async () => {
    await expect(getAwsHealth({
      accountId: ACCOUNT_ID,
      roleArn: `arn:aws:iam::${OTHER_ACCOUNT_ID}:role/SLAReviewHealthRole`,
      credentialId: CREDENTIAL_ID,
    })).rejects.toThrow("must belong to the configured AWS account");
    expect(credentialVaultClient.getCredentialsDetails).not.toHaveBeenCalled();
  });

  it("explains an AssumeRole access denial without attempting Health", async () => {
    (credentialVaultClient.getCredentialsDetails as jest.Mock).mockResolvedValue(signingCredential());
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(
      "<ErrorResponse><Error><Code>AccessDenied</Code><Message>Denied</Message></Error></ErrorResponse>",
      { status: 403 },
    ));

    try {
      await expect(getAwsHealth({ accountId: ACCOUNT_ID, roleArn: ROLE_ARN, credentialId: CREDENTIAL_ID })).rejects.toThrow(
        "Grant the vaulted base identity sts:AssumeRole",
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("rejects a credential for a different AWS account before reading Health events", async () => {
    (credentialVaultClient.getCredentialsDetails as jest.Mock).mockResolvedValue(signingCredential());
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(
      `<GetCallerIdentityResponse><GetCallerIdentityResult><Account>${OTHER_ACCOUNT_ID}</Account></GetCallerIdentityResult></GetCallerIdentityResponse>`,
      { status: 200 },
    ));

    try {
      await expect(getAwsHealth({ accountId: ACCOUNT_ID, credentialId: CREDENTIAL_ID })).rejects.toThrow(`belongs to account ${OTHER_ACCOUNT_ID}`);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      fetchMock.mockRestore();
    }
  });
});
