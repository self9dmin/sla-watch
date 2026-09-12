import { correlateProviderNoticeToTopology } from "../ui/app/data/providerNoticeCorrelation";
import type { ProviderNotice, SmartscapeScopeEdge } from "../ui/app/types";

const ACCOUNT_ID = "123456789012";

const notice = (overrides: Partial<ProviderNotice> = {}): ProviderNotice => ({
  id: "arn:aws:health:us-east-1::event/EC2/test-event",
  source: "aws-health",
  sourceScope: ACCOUNT_ID,
  title: "EC2 event",
  summary: "AWS reported an event.",
  state: "ACTIVE",
  products: [{ id: "EC2", name: "EC2", directoryServiceIds: ["ec2"] }],
  locations: ["us-east-1"],
  affectedResources: [{
    id: "i-0123456789abcdef0",
    arn: "arn:aws:ec2:us-east-1:123456789012:instance/i-0123456789abcdef0",
    accountId: ACCOUNT_ID,
  }],
  ...overrides,
});

const edge = (overrides: Partial<SmartscapeScopeEdge> = {}): SmartscapeScopeEdge => ({
  serviceNodeId: "service-node",
  serviceClassicId: "SERVICE-1",
  serviceName: "Checkout",
  serviceTags: [],
  targetNodeId: "runtime-node",
  targetClassicId: "AWS_EC2_INSTANCE-1",
  targetName: "i-0123456789abcdef0",
  targetType: "AWS_EC2_INSTANCE",
  relationship: "runs_on",
  location: "us-east-1a",
  region: "us-east-1",
  availabilityZone: "us-east-1a",
  providerSlug: "aws",
  accountId: ACCOUNT_ID,
  ...overrides,
});

describe("provider notice correlation", () => {
  it("matches an AWS affected entity to an exact Smartscape runtime identifier", () => {
    expect(correlateProviderNoticeToTopology(notice(), [edge()])).toEqual({
      matches: [{
        resourceId: "i-0123456789abcdef0",
        serviceEntityId: "SERVICE-1",
        serviceName: "Checkout",
        runtimeEntityId: "AWS_EC2_INSTANCE-1",
        runtimeName: "i-0123456789abcdef0",
      }],
      matchedResourceCount: 1,
      matchedServiceNames: ["Checkout"],
    });
  });

  it("can match an identifier carried only in the affected entity ARN", () => {
    const result = correlateProviderNoticeToTopology(notice({
      affectedResources: [{
        id: "affected-instance",
        arn: "arn:aws:ec2:us-east-1:123456789012:instance/i-0123456789abcdef0",
        accountId: "123456789012",
      }],
    }), [edge()]);
    expect(result.matchedResourceCount).toBe(1);
  });

  it("does not treat a shared region as proof of an affected Dynatrace runtime", () => {
    expect(correlateProviderNoticeToTopology(notice(), [edge({ targetName: "checkout-runtime" })]).matches).toHaveLength(0);
    expect(correlateProviderNoticeToTopology(notice({
      affectedResources: [{ id: ACCOUNT_ID, accountId: ACCOUNT_ID }],
    }), [edge({ targetName: ACCOUNT_ID, targetType: "SERVICE_CLOUD_CONTEXT" })]).matches).toHaveLength(0);
  });

  it("rejects an exact identifier when the AWS account or region conflicts", () => {
    expect(correlateProviderNoticeToTopology(notice(), [edge({ accountId: "210987654321" })]).matches).toHaveLength(0);
    expect(correlateProviderNoticeToTopology(notice(), [edge({ region: "eu-west-1", location: "eu-west-1a" })]).matches).toHaveLength(0);
  });
});
