import { parseAwsHealthEventRecords } from "../ui/app/data/awsHealthEvents";

const EVENT_ARN = "arn:aws:health:us-east-1::event/EC2/test-event";
const ACCOUNT_ID = "123456789012";

describe("Dynatrace-ingested AWS Health events", () => {
  it("normalizes account events and keeps exact affected-resource evidence", () => {
    const response = parseAwsHealthEventRecords({
      records: [{
        timestamp: "2026-09-16T14:00:00Z",
        event_id: "event-1",
        event_arn: EVENT_ARN,
        source_account: ACCOUNT_ID,
        source_region: "us-west-2",
        affected_account: ACCOUNT_ID,
        event_region: "us-east-1",
        service: "EC2",
        event_type_code: "AWS_EC2_OPERATIONAL_ISSUE",
        event_type_category: "issue",
        event_scope_code: "ACCOUNT_SPECIFIC",
        status_code: "open",
        event_start: "Thu, 16 Sep 2026 13:45:00 GMT",
        event_description: " Requests failed for a subset of instances. ",
        affected_entities: [{ entityValue: "i-0123456789abcdef0" }],
        resources: [`arn:aws:ec2:us-east-1:${ACCOUNT_ID}:instance/i-0123456789abcdef0`],
        smartscape_source_id: "AWS_EC2_INSTANCE-ABC",
      }],
    }, new Date("2026-09-16T15:00:00Z"));

    expect(response).toMatchObject({
      provider: "aws",
      sourceName: "AWS Health events in Grail",
      source: "personalized",
      connectionState: "connected",
      delivery: "dynatrace",
      scopeLabel: "Monitored AWS accounts",
      fetchedAt: "2026-09-16T15:00:00.000Z",
    });
    expect(response.notices).toHaveLength(1);
    expect(response.notices[0]).toMatchObject({
      id: EVENT_ARN,
      source: "aws-health",
      sourceScope: ACCOUNT_ID,
      title: "EC2: operational issue",
      summary: "Requests failed for a subset of instances.",
      state: "ACTIVE",
      relevance: "Account-specific event",
      startTime: "2026-09-16T13:45:00.000Z",
      updateTime: "2026-09-16T14:00:00.000Z",
      products: [{ id: "EC2", name: "EC2", directoryServiceIds: ["ec2"] }],
      locations: ["us-east-1", "us-west-2"],
    });
    expect(response.notices[0].affectedResources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "i-0123456789abcdef0",
        arn: `arn:aws:ec2:us-east-1:${ACCOUNT_ID}:instance/i-0123456789abcdef0`,
        accountId: ACCOUNT_ID,
      }),
      { id: "AWS_EC2_INSTANCE-ABC", accountId: ACCOUNT_ID },
    ]));
    expect(response.notices[0].affectedResources).toHaveLength(2);
  });

  it("does not turn an account-linked generic event into resource impact", () => {
    const response = parseAwsHealthEventRecords({ records: [{
      event_id: "event-2",
      event_arn: "arn:aws:health:us-east-1::event/ELB/test-event",
      source_account: ACCOUNT_ID,
      service: "ELASTICLOADBALANCING",
      event_type_code: "AWS_ELASTICLOADBALANCING_API_ISSUE",
      event_scope_code: "ACCOUNT_SPECIFIC",
      smartscape_source_id: "AWS_ACCOUNT-ABC",
    }] });

    expect(response.notices[0].affectedResources).toEqual([]);
    expect(response.notices[0].products[0]).toEqual({
      id: "ELASTICLOADBALANCING",
      name: "ELASTICLOADBALANCING",
      directoryServiceIds: ["elb"],
    });
  });

  it("deduplicates repeated EventBridge pages by Health event ARN and retains their resources", () => {
    const record = {
      event_arn: EVENT_ARN,
      service: "EC2",
      event_type_code: "AWS_EC2_OPERATIONAL_ISSUE",
    };
    const response = parseAwsHealthEventRecords({ records: [
      { ...record, affected_entities: [{ entityValue: "i-first" }] },
      { ...record, affected_entities: [{ entityValue: "i-second" }] },
    ] });
    expect(response.notices).toHaveLength(1);
    expect(response.notices[0].affectedResources).toEqual([
      { id: "i-first" },
      { id: "i-second" },
    ]);
  });
});
