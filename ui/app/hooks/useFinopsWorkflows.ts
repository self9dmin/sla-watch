import { useCallback, useEffect, useRef, useState } from "react";
import { workflowsClient, type Workflow } from "@dynatrace-sdk/client-automation";
import { effectivePermissionsClient } from "@dynatrace-sdk/client-platform-management-service";
import {
  createFinopsWorkflowDraft,
  FINOPS_WORKFLOWS,
  LEGACY_FINOPS_WORKFLOW_TITLES,
  matchingWorkflow,
  type FinopsWorkflowKind,
  type PrivateGatewaySettings,
} from "../data/finopsAutomation";

type WorkflowState = Partial<Record<FinopsWorkflowKind, Workflow>>;
const KINDS: FinopsWorkflowKind[] = ["route", "feedback"];

const inspectWorkflowList = async (): Promise<{ workflows: WorkflowState; legacy: WorkflowState; collision: boolean }> => {
  const page = await workflowsClient.getWorkflows({ search: "SLA", limit: 100, offset: 0 });
  if (page.count > page.results.length)
    throw new Error("Too many matching Workflows to verify safely. Inspect them in Workflows.");
  const relevant = page.results.filter((item) =>
    KINDS.some((kind) => item.title === FINOPS_WORKFLOWS[kind].title ||
      item.title === LEGACY_FINOPS_WORKFLOW_TITLES[kind]));
  if (relevant.length > 4 || KINDS.some((kind) =>
    relevant.filter((item) => item.title === FINOPS_WORKFLOWS[kind].title).length > 1 ||
    relevant.filter((item) => item.title === LEGACY_FINOPS_WORKFLOW_TITLES[kind]).length > 1))
    return { workflows: {}, legacy: {}, collision: true };
  const detailed = await Promise.all(relevant.map((item) => workflowsClient.getWorkflow({ id: item.id })));
  const workflows: WorkflowState = {};
  const legacy: WorkflowState = {};
  let collision = false;
  for (const item of detailed) {
    const kind = KINDS.find((candidate) => item.title === FINOPS_WORKFLOWS[candidate].title);
    if (kind) {
      if (!matchingWorkflow(item, kind)) collision = true;
      else workflows[kind] = item;
      continue;
    }
    const legacyKind = KINDS.find((candidate) => item.title === LEGACY_FINOPS_WORKFLOW_TITLES[candidate]);
    if (legacyKind) legacy[legacyKind] = item;
  }
  return { workflows, legacy, collision };
};

export const useFinopsWorkflows = () => {
  const [workflows, setWorkflows] = useState<WorkflowState>({});
  const [legacy, setLegacy] = useState<WorkflowState>({});
  const [collision, setCollision] = useState(false);
  const [canRead, setCanRead] = useState<boolean | null>(null);
  const [canWrite, setCanWrite] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError(undefined);
    const [permissions, list] = await Promise.allSettled([
      effectivePermissionsClient.resolveEffectivePermissions({
        body: { permissions: [
          { permission: "automation:workflows:read" },
          { permission: "automation:workflows:write" },
        ] },
      }),
      inspectWorkflowList(),
    ]);
    if (current !== request.current) return;
    setCanWrite(permissions.status === "fulfilled"
      ? permissions.value.find((item) => item.permission === "automation:workflows:write")?.granted === "true"
      : false);
    if (list.status === "fulfilled") {
      setCanRead(true);
      setWorkflows(list.value.workflows);
      setLegacy(list.value.legacy);
      setCollision(list.value.collision);
    } else {
      setCanRead(false);
      setWorkflows({});
      setLegacy({});
      setCollision(false);
      setError(list.reason instanceof Error ? list.reason.message : "Workflows could not be checked.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    return () => { request.current += 1; };
  }, [refresh]);

  const createDrafts = async (settings: PrivateGatewaySettings): Promise<void> => {
    if (creating || loading || canRead !== true || canWrite !== true || collision)
      throw new Error("Workflow access or state is not ready for draft creation.");
    // Validate both scripts and all operator-provided values before the first mutation.
    const drafts = {
      route: createFinopsWorkflowDraft("route", settings),
      feedback: createFinopsWorkflowDraft("feedback", settings),
    };
    setCreating(true);
    setError(undefined);
    try {
      const latest = await inspectWorkflowList();
      if (latest.collision) throw new Error("A Workflow with a matching title needs manual inspection.");
      for (const kind of KINDS) {
        if (latest.workflows[kind]) continue;
        await workflowsClient.createWorkflow({ body: drafts[kind] });
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Workflow drafts could not be created.");
      throw createError;
    } finally {
      setCreating(false);
      await refresh();
    }
  };

  return { workflows, legacy, collision, canRead, canWrite, loading, creating, error, refresh, createDrafts };
};
