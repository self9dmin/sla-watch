import type { WorkflowCreate, Workflow } from "@dynatrace-sdk/client-automation";
import {
  FEEDBACK_WORKFLOW_SCRIPT,
  ROUTE_WORKFLOW_SCRIPT,
} from "./finopsWorkflowScripts.generated";

export type LocalRouter = "laya" | "jev";
export type FinopsWorkflowKind = "route" | "feedback";

export const FINOPS_WORKFLOWS = {
  route: {
    title: "SLA Review | Route reviewed case",
    marker: "sla-review/finops-route/v1",
    eventType: "sla.finops.review.ready",
  },
  feedback: {
    title: "SLA Review | Record human outcome",
    marker: "sla-review/finops-feedback/v1",
    eventType: "sla.finops.feedback",
  },
} as const;

export const LEGACY_FINOPS_WORKFLOW_TITLES: Record<FinopsWorkflowKind, string> = {
  route: "SLA FinOps Agent | Route reviewed case",
  feedback: "SLA FinOps Agent | Record human outcome",
};

export const FINOPS_WORKFLOW_TASK_IDS: Record<FinopsWorkflowKind, string> = {
  route: "route_case",
  feedback: "feedback_case",
};

export type PrivateGatewaySettings = {
  origin: string;
  credentialId: string;
  router: LocalRouter;
};

export const validatePrivateGatewaySettings = ({
  origin,
  credentialId,
  router,
}: PrivateGatewaySettings): PrivateGatewaySettings => {
  let url: URL;
  try {
    url = new URL(origin.trim());
  } catch {
    throw new Error("Enter the private EdgeConnect HTTPS origin.");
  }
  if (url.protocol !== "https:" || !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.internal$/i.test(url.hostname) ||
      (url.port && url.port !== "443") || url.pathname !== "/" || url.search || url.hash ||
      url.username || url.password) {
    throw new Error("Use only an HTTPS .internal EdgeConnect origin, with no path, query, or credentials.");
  }
  const normalizedId = credentialId.trim();
  if (!/^CREDENTIALS_VAULT-[A-Za-z0-9-]{8,128}$/.test(normalizedId))
    throw new Error("Enter a Credential Vault record ID, never its token value.");
  if (!["laya", "jev"].includes(router))
    throw new Error("Choose a supported local router.");
  return { origin: url.origin, credentialId: normalizedId, router };
};

export const workflowTriggerQuery = (kind: FinopsWorkflowKind): string =>
  `event.type == "${FINOPS_WORKFLOWS[kind].eventType}" and event.provider == "sla-review"`;

export const createFinopsWorkflowDraft = (
  kind: FinopsWorkflowKind,
  input: PrivateGatewaySettings,
): WorkflowCreate => {
  const settings = validatePrivateGatewaySettings(input);
  const spec = FINOPS_WORKFLOWS[kind];
  const taskId = FINOPS_WORKFLOW_TASK_IDS[kind];
  const script = (kind === "route" ? ROUTE_WORKFLOW_SCRIPT : FEEDBACK_WORKFLOW_SCRIPT)
    .replace("REPLACE_WITH_PRIVATE_EDGE_CONNECT_URL", settings.origin)
    .replace("CREDENTIALS_VAULT-REPLACE_ME", settings.credentialId)
    .replace("REPLACE_WITH_LOCAL_MODEL_SOURCE", settings.router);
  if (script.includes("REPLACE_WITH_PRIVATE_EDGE_CONNECT_URL") ||
      script.includes("CREDENTIALS_VAULT-REPLACE_ME") ||
      script.includes("REPLACE_WITH_LOCAL_MODEL_SOURCE"))
    throw new Error("The Workflow script still contains an unresolved setup value.");
  return {
    title: spec.title,
    description: `${spec.marker} | Private SLA Review decision Workflow. Review actor and permissions before deployment.`,
    type: "STANDARD",
    schemaVersion: 3,
    isPrivate: true,
    isDeployed: false,
    trigger: {
      eventTrigger: {
        isActive: false,
        triggerConfiguration: {
          type: "event",
          value: { eventType: "bizevents", query: workflowTriggerQuery(kind) },
        },
      },
    },
    tasks: {
      [taskId]: {
        name: taskId,
        description: kind === "route" ? "Recheck the review, call the local gateway, and record the route" : "Record the later human outcome for local evaluation",
        action: "dynatrace.automations:run-javascript",
        input: { script },
        position: { x: 0, y: 1 },
        predecessors: [],
      },
    },
  };
};

/** An intent prepares one private draft in Workflows. The receiving app owns the save. */
export const createFinopsWorkflowIntent = (
  kind: FinopsWorkflowKind,
  input: PrivateGatewaySettings,
): WorkflowCreate => {
  const draft = createFinopsWorkflowDraft(kind, input);
  return {
    title: draft.title,
    type: draft.type,
    isPrivate: true,
    tasks: draft.tasks,
    trigger: draft.trigger,
  };
};

export const matchingWorkflow = (workflow: Pick<Workflow, "title" | "description">, kind: FinopsWorkflowKind): boolean =>
  workflow.title === FINOPS_WORKFLOWS[kind].title;

export const workflowLocalRouter = (workflow: Workflow): LocalRouter | null => {
  const script: unknown = workflow.tasks?.[FINOPS_WORKFLOW_TASK_IDS.route]?.input?.script;
  if (typeof script !== "string") return null;
  const source = /const EXPECTED_SOURCE = "(laya|jev)";/.exec(script)?.[1];
  return source === "laya" || source === "jev" ? source : null;
};

export const workflowNeedsInspection = (workflow: Workflow, kind: FinopsWorkflowKind): boolean => {
  const task = workflow.tasks?.[FINOPS_WORKFLOW_TASK_IDS[kind]];
  const trigger = workflow.trigger?.eventTrigger?.triggerConfiguration;
  const script: unknown = task?.input?.script;
  const endpoint = typeof script === "string"
    ? /const (?:ROUTER_URL|FEEDBACK_URL) = "(https:\/\/[^"]+)\/(?:route|feedback)";/.exec(script)?.[1]
    : undefined;
  const credentialId = typeof script === "string"
    ? /const BRIDGE_CREDENTIAL_ID = "(CREDENTIALS_VAULT-[^"]+)";/.exec(script)?.[1]
    : undefined;
  let scriptMatches = false;
  const source = kind === "route" ? workflowLocalRouter(workflow) : "laya";
  if (endpoint && credentialId && typeof script === "string" && source) {
    try {
      const draft = createFinopsWorkflowDraft(kind, {
        origin: endpoint,
        credentialId,
        router: source,
      });
      scriptMatches = draft.tasks?.[FINOPS_WORKFLOW_TASK_IDS[kind]]?.input?.script === script;
    } catch {
      scriptMatches = false;
    }
  }
  return !matchingWorkflow(workflow, kind) ||
    workflow.type !== "STANDARD" ||
    Object.keys(workflow.tasks ?? {}).length !== 1 ||
    workflow.trigger?.schedule != null ||
    (workflow.isDeployed
      ? workflow.trigger?.eventTrigger?.isActive !== true
      : workflow.trigger?.eventTrigger?.isActive !== false) ||
    task?.action !== "dynatrace.automations:run-javascript" ||
    (task?.active !== undefined && task.active !== true) ||
    Boolean(task?.predecessors?.length) ||
    task?.withItems != null ||
    task?.conditions != null ||
    task?.concurrency != null ||
    task?.retry != null ||
    task?.customSampleResult != null ||
    !scriptMatches ||
    trigger?.type !== "event" ||
    trigger.value.eventType !== "bizevents" ||
    trigger.value.query !== workflowTriggerQuery(kind) ||
    workflow.isPrivate !== true;
};
