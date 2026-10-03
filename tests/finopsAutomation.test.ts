import type { Workflow } from "@dynatrace-sdk/client-automation";
import {
  createFinopsWorkflowDraft,
  validatePrivateGatewaySettings,
  workflowNeedsInspection,
  workflowLocalRouter,
} from "../ui/app/data/finopsAutomation";
import type { ProviderCoverageModel } from "../ui/app/data/providerCoverage";
import {
  createResourceAvailabilitySliQuery,
  createResourceObjectiveConfig,
  createResourceObjectiveExternalId,
  resourceObjectiveCandidates,
} from "../ui/app/data/resourceObjectives";
import type { ServiceRecord, SlaProviderResponse } from "../ui/app/types";

const privateOrigin = `https://router.${"internal"}`;
const settings = {
  origin: privateOrigin,
  credentialId: "CREDENTIALS_VAULT-12345678",
  router: "laya" as const,
};

describe("FinOps automation setup", () => {
  it("accepts only a private EdgeConnect origin and a vault record ID", () => {
    expect(validatePrivateGatewaySettings(settings)).toEqual({
      ...settings,
      origin: privateOrigin,
    });
    expect(() => validatePrivateGatewaySettings({ ...settings, origin: "https://api.example.com" })).toThrow();
    expect(() => validatePrivateGatewaySettings({ ...settings, origin: privateOrigin.replace("https:", "http:") })).toThrow();
    expect(() => validatePrivateGatewaySettings({ ...settings, origin: `${privateOrigin}/route` })).toThrow();
    expect(() => validatePrivateGatewaySettings({ ...settings, credentialId: "actual-bearer-token" })).toThrow();
  });

  it("creates private, undeployed business-event drafts with a checked local source", () => {
    const route = createFinopsWorkflowDraft("route", settings);
    const feedback = createFinopsWorkflowDraft("feedback", settings);
    for (const draft of [route, feedback]) {
      const trigger = draft.trigger?.eventTrigger?.triggerConfiguration;
      if (trigger?.type !== "event") throw new Error("Expected a business event trigger.");
      expect(draft.isPrivate).toBe(true);
      expect(draft.isDeployed).toBe(false);
      expect(draft.type).toBe("STANDARD");
      expect(trigger.value.eventType).toBe("bizevents");
      expect(draft.tasks?.run_javascript?.action).toBe("dynatrace.automations:run-javascript");
      expect(draft.tasks?.run_javascript?.input?.script).not.toContain("REPLACE_WITH_PRIVATE_EDGE_CONNECT_URL");
      expect(draft.tasks?.run_javascript?.input?.script).not.toContain("CREDENTIALS_VAULT-REPLACE_ME");
      expect(draft.tasks?.run_javascript?.input?.script).not.toContain("REPLACE_WITH_LOCAL_MODEL_SOURCE");
      expect(draft.tasks?.run_javascript?.input?.script).not.toContain("actual-bearer-token");
    }
    const routeTrigger = route.trigger?.eventTrigger?.triggerConfiguration;
    const feedbackTrigger = feedback.trigger?.eventTrigger?.triggerConfiguration;
    if (routeTrigger?.type !== "event" || feedbackTrigger?.type !== "event")
      throw new Error("Expected business event triggers.");
    expect(routeTrigger.value.query).toContain("sla.finops.review.ready");
    expect(route.tasks?.run_javascript?.input?.script).toContain('const EXPECTED_SOURCE = "laya"');
    expect(route.tasks?.run_javascript?.input?.script).toContain("finopsReviewGate");
    expect(feedbackTrigger.value.query).toContain("sla.finops.feedback");
    expect(feedback.tasks?.run_javascript?.input?.script).toContain("Phoenix did not confirm the annotation");
  });

  it("flags edited or public Workflows for inspection", () => {
    const draft = createFinopsWorkflowDraft("route", settings) as Workflow;
    expect(workflowLocalRouter(draft)).toBe("laya");
    expect(workflowNeedsInspection(draft, "route")).toBe(false);
    expect(workflowNeedsInspection({ ...draft, isPrivate: false }, "route")).toBe(true);
    expect(workflowNeedsInspection({ ...draft, tasks: {
      run_javascript: { ...draft.tasks?.run_javascript!, input: { script: "return true" } },
    } }, "route")).toBe(true);
  });

  it("groups unambiguous product resources once per account and region, with services as evidence", () => {
    const services: ServiceRecord[] = [
      { id: "SERVICE-A0B1", name: "Checkout", type: "SERVICE", tags: [] },
      { id: "SERVICE-C0D1", name: "Payments", type: "SERVICE", tags: [] },
    ];
    const provider = {
      provider: { slug: "aws", name: "AWS" },
      services: [{ id: "rds", name: "RDS" }, { id: "ec2", name: "EC2" }],
    } as SlaProviderResponse;
    const edge = (resourceId: string, service: ServiceRecord, accountId = "111122223333") => ({
      serviceNodeId: service.id,
      serviceClassicId: service.id,
      serviceName: service.name,
      serviceTags: [],
      targetNodeId: resourceId,
      targetClassicId: resourceId,
      targetName: resourceId,
      targetType: "AWS_RDS_DB_INSTANCE",
      relationship: "CALLS",
      providerSlug: "aws",
      accountId,
      region: "us-east-1",
    });
    const row = (resourceId: string, linked: ServiceRecord[], accountId?: string) => ({
      kind: "scope",
      edge: edge(resourceId, linked[0], accountId),
      edges: linked.map((service) => edge(resourceId, service, accountId)),
      assignment: {
        providerServiceId: "rds",
        runtimeType: "AWS_RDS_DB_INSTANCE",
        runtimeEntityId: resourceId,
        serviceEntityId: resourceId,
      },
      observed: true,
      ambiguous: false,
      mixedAssignments: false,
    });
    const model = { resourceRows: [
      row("DATABASE-1", services),
      row("DATABASE-2", [services[0]]),
    ] } as unknown as ProviderCoverageModel;
    const candidates = resourceObjectiveCandidates(model, services, provider);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].resourceIds).toEqual(["DATABASE-1", "DATABASE-2"]);
    expect(candidates[0].serviceIds).toEqual(["SERVICE-A0B1", "SERVICE-C0D1"]);
    const externalId = createResourceObjectiveExternalId("aws", "rds", "111122223333", "us-east-1");
    expect(externalId).toContain("sla-review-product-aws-rds-");
    const config = createResourceObjectiveConfig({ providerSlug: "aws", providerName: "AWS", candidate: candidates[0], target: 99.95 });
    expect(config?.externalId).toBe(externalId);
    expect(config?.customSli?.indicator).toContain("SERVICE-A0B1");
    expect(config?.customSli?.indicator).toContain("SERVICE-C0D1");
    expect(createResourceAvailabilitySliQuery(candidates[0].serviceIds)).toContain("sum(dt.service.request.failure_count)");
    model.resourceRows.push(row("DATABASE-3", [services[0]], "444455556666") as never);
    expect(resourceObjectiveCandidates(model, services, provider)).toHaveLength(2);
    (model.resourceRows[0] as { assignment?: unknown; candidate?: unknown }).assignment = undefined;
    expect(resourceObjectiveCandidates(model, services, provider)[0].resourceIds).not.toContain("DATABASE-1");
    (model.resourceRows[0] as { candidate?: unknown }).candidate = { providerServiceId: "rds", confidence: "observed" };
    expect(resourceObjectiveCandidates(model, services, provider)[0].resourceIds).toContain("DATABASE-1");
    (model.resourceRows[0] as { assignments?: unknown }).assignments = [{
      runtimeType: "SERVICE_SCOPE", runtimeEntityId: "DATABASE-1", serviceEntityId: services[0].id,
    }];
    expect(resourceObjectiveCandidates(model, services, provider)[0].resourceIds).not.toContain("DATABASE-1");
  });
});
