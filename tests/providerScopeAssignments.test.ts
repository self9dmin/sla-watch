import {
  createProviderScopeAssignmentKey,
  createServiceScopeAssignment,
  createServiceScopeAssignmentKey,
  inferProviderServiceCandidate,
  isServiceScopeAssignment,
  normalizeProviderScopeAssignment,
  resolveProviderServiceCandidates,
  resolveUniqueProviderServiceCandidate,
} from "../ui/app/data/providerScopeAssignments";
import type { SlaProviderResponse, SmartscapeScopeEdge } from "../ui/app/types";

const provider = (slug: string, services: Array<{ id: string; name: string }>): SlaProviderResponse => ({
  generatedAt: "2026-09-10T00:00:00.000Z",
  provider: {
    slug,
    name: slug.toUpperCase(),
    category: "Cloud",
    uptime: 99.99,
    status: "verified",
    lastVerified: "2026-09-10",
  },
  services: services.map((service) => ({
    ...service,
    category: "Cloud",
    uptime: 99.99,
    eligible: true,
    slaUrl: `https://sla.directory/${service.id}`,
  })),
});

const edge = (overrides: Partial<SmartscapeScopeEdge> = {}): SmartscapeScopeEdge => ({
  serviceNodeId: "service-node",
  serviceClassicId: "SERVICE-1",
  serviceName: "Checkout",
  serviceTags: [],
  targetNodeId: "runtime-node",
  targetClassicId: "AWS_EC2_INSTANCE-1",
  targetName: "checkout-runtime",
  targetType: "AWS_EC2_INSTANCE",
  relationship: "runs_on",
  location: "us-east-1a",
  providerSlug: "aws",
  providerEvidence: "Smartscape runtime type AWS_EC2_INSTANCE",
  ...overrides,
});

describe("provider scope assignments", () => {
  it("creates a stable key from the exact provider, service, and runtime scope", () => {
    expect(createProviderScopeAssignmentKey(" AWS ", "SERVICE-1", "HOST-1"))
      .toBe("aws|service-1|host-1");
  });

  it("creates a reversible service-level assignment without changing the entity", () => {
    const value = createServiceScopeAssignment({
      providerSlug: " AWS ",
      providerServiceId: "*",
      providerServiceName: "Provider-level terms",
      serviceEntityId: "SERVICE-1",
      serviceEntityName: "Checkout",
    });

    expect(value).toMatchObject({
      assignmentKey: createServiceScopeAssignmentKey("aws", "SERVICE-1"),
      providerSlug: "aws",
      providerServiceId: "*",
      serviceEntityId: "SERVICE-1",
      runtimeEntityId: "SERVICE-1",
      runtimeType: "SERVICE_SCOPE",
      enabled: true,
    });
    expect(isServiceScopeAssignment(value)).toBe(true);
  });

  it("does not confuse a Smartscape runtime assignment with service-level coverage", () => {
    expect(isServiceScopeAssignment({
      serviceEntityId: "SERVICE-1",
      runtimeEntityId: "HOST-1",
      runtimeType: "HOST",
    })).toBe(false);
  });

  it("normalizes a confirmed assignment and rejects incomplete records", () => {
    const value = {
      providerSlug: "AWS",
      providerServiceId: "ec2",
      providerServiceName: "Amazon EC2",
      serviceEntityId: "SERVICE-1",
      serviceEntityName: "Checkout",
      runtimeEntityId: "HOST-1",
      runtimeEntityName: "checkout-runtime",
      runtimeType: "HOST",
      evidence: "Operator confirmed EC2 runtime metadata.",
      enabled: true,
    };
    expect(normalizeProviderScopeAssignment(value)).toMatchObject({
      assignmentKey: "aws|service-1|host-1",
      providerSlug: "aws",
      providerServiceId: "ec2",
    });
    expect(normalizeProviderScopeAssignment({ ...value, runtimeEntityId: "" })).toBeNull();
  });

  it("suggests Amazon EC2 from an explicit Smartscape runtime type", () => {
    expect(inferProviderServiceCandidate(edge(), provider("aws", [
      { id: "ec2", name: "Amazon EC2" },
      { id: "lambda", name: "AWS Lambda" },
    ]))).toEqual({
      providerServiceId: "ec2",
      providerServiceName: "Amazon EC2",
      evidence: "EC2 runtime metadata suggests Amazon EC2",
      confidence: "observed",
    });
  });

  it("recognizes an EC2 private hostname only inside an AWS provider boundary", () => {
    const host = edge({ targetType: "HOST", targetName: "ip-10-20-10-102.ec2.internal" });
    expect(inferProviderServiceCandidate(host, provider("aws", [{ id: "ec2", name: "Amazon EC2" }]))?.providerServiceId).toBe("ec2");
    expect(inferProviderServiceCandidate(host, provider("aws", [{ id: "ec2", name: "Amazon EC2" }]))?.confidence).toBe("review");
    expect(inferProviderServiceCandidate({ ...host, providerSlug: "gcp" }, provider("aws", [{ id: "ec2", name: "Amazon EC2" }]))).toBeNull();
  });

  it("suggests a Google Cloud service only when that service exists in the directory record", () => {
    const compute = edge({ providerSlug: "gcp", targetType: "GCP_COMPUTE_INSTANCE", targetName: "orders-vm" });
    expect(inferProviderServiceCandidate(compute, provider("gcp", [{ id: "compute-engine", name: "Compute Engine" }]))?.providerServiceId).toBe("compute-engine");
    expect(inferProviderServiceCandidate(compute, provider("gcp", [{ id: "cloud-storage", name: "Cloud Storage" }]))).toBeNull();
  });

  it("distinguishes AWS Aurora and Fargate from their parent services", () => {
    const aws = provider("aws", [
      { id: "rds", name: "Amazon RDS" },
      { id: "aurora", name: "Amazon Aurora" },
      { id: "ecs", name: "Amazon ECS" },
      { id: "fargate", name: "AWS Fargate" },
    ]);

    expect(inferProviderServiceCandidate(edge({ targetType: "AWS_RDS_AURORA_CLUSTER" }), aws)?.providerServiceId).toBe("aurora");
    expect(inferProviderServiceCandidate(edge({ targetType: "AWS_ECS_FARGATE_TASK" }), aws)?.providerServiceId).toBe("fargate");
  });

  it("recognizes the Azure virtual machine scale set runtime type", () => {
    const vmss = edge({
      providerSlug: "azure",
      targetType: "AZURE_MICROSOFT_COMPUTE_VIRTUALMACHINESCALESETS",
      targetName: "checkout-vmss",
    });

    expect(inferProviderServiceCandidate(vmss, provider("azure", [
      { id: "virtual-machines", name: "Virtual Machines" },
    ]))).toMatchObject({ providerServiceId: "virtual-machines", confidence: "observed" });
  });

  it("does not classify an OCI database instance as Compute", () => {
    const database = edge({
      providerSlug: "oci",
      targetType: "OCI_AUTONOMOUS_DATABASE_INSTANCE",
      targetName: "orders-database",
    });

    expect(inferProviderServiceCandidate(database, provider("oci", [
      { id: "compute-multiad", name: "Compute Multi-AD" },
    ]))).toBeNull();
  });

  it("collapses matching runtime candidates to one service scope for Incident review", () => {
    expect(resolveUniqueProviderServiceCandidate([
      { providerServiceId: "ec2", scopeKey: "host:SERVICE-1:AWS_EC2_INSTANCE-1", serviceEntityId: "SERVICE-1", evidence: "EC2 instance", confidence: "observed" },
      { providerServiceId: "ec2", scopeKey: "host:SERVICE-1:HOST-1", serviceEntityId: "SERVICE-1", evidence: "EC2 host", confidence: "review" },
    ])).toEqual({
      providerServiceId: "ec2",
      scopeKey: "service:SERVICE-1",
      serviceEntityId: "SERVICE-1",
      evidence: "EC2 instance",
      confidence: "observed",
    });
  });

  it("uses one provider-native service match without requiring one saved mapping per runtime", () => {
    const resolutions = resolveProviderServiceCandidates([
      edge(),
      edge({ targetNodeId: "host-node", targetClassicId: "HOST-1", targetType: "HOST", targetName: "ip-10-20-10-102.ec2.internal" }),
    ], provider("aws", [{ id: "ec2", name: "Amazon EC2" }]));

    expect(resolutions.get("SERVICE-1")).toMatchObject({
      ambiguous: false,
      evidenceCount: 2,
      candidate: { providerServiceId: "ec2", confidence: "observed" },
    });
  });

  it("does not choose between conflicting provider-service candidates", () => {
    expect(resolveUniqueProviderServiceCandidate([
      { providerServiceId: "ec2", scopeKey: "service:SERVICE-1", serviceEntityId: "SERVICE-1", evidence: "EC2", confidence: "observed" },
      { providerServiceId: "lambda", scopeKey: "service:SERVICE-1", serviceEntityId: "SERVICE-1", evidence: "Lambda", confidence: "observed" },
    ])).toBeUndefined();
  });
});
