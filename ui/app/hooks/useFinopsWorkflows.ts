import { useCallback, useEffect, useRef, useState } from "react";
import { workflowsClient, type Workflow } from "@dynatrace-sdk/client-automation";
import {
  FINOPS_WORKFLOWS,
  LEGACY_FINOPS_WORKFLOW_TITLES,
  matchingWorkflow,
  type FinopsWorkflowKind,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError(undefined);
    const list = await inspectWorkflowList().then(
      (value) => ({ value, error: undefined }),
      (error: unknown) => ({ value: undefined, error }),
    );
    if (current !== request.current) return;
    if (list.value) {
      setCanRead(true);
      setWorkflows(list.value.workflows);
      setLegacy(list.value.legacy);
      setCollision(list.value.collision);
    } else {
      setCanRead(false);
      setWorkflows({});
      setLegacy({});
      setCollision(false);
      setError(list.error instanceof Error ? list.error.message : "Workflows could not be checked.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    return () => { request.current += 1; };
  }, [refresh]);

  return { workflows, legacy, collision, canRead, loading, error, refresh };
};
