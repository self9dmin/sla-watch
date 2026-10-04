import React, { useState } from "react";
import { Link } from "react-router-dom";
import { openApp, sendIntent } from "@dynatrace-sdk/navigation";
import { Button } from "@dynatrace/strato-components/buttons";
import type { ProviderCoverageModel } from "../data/providerCoverage";
import {
  FINOPS_WORKFLOWS,
  createFinopsWorkflowIntent,
  workflowLocalRouter,
  workflowNeedsInspection,
  type FinopsWorkflowKind,
  type LocalRouter,
} from "../data/finopsAutomation";
import { useFinopsRouting } from "../hooks/useFinopsRouting";
import { useFinopsWorkflows } from "../hooks/useFinopsWorkflows";
import type { ServiceRecord, SlaProviderResponse } from "../types";
import { ResourceObjectiveSetup } from "./ResourceObjectiveSetup";

type Props = {
  provider?: SlaProviderResponse;
  providerSlug: string;
  coverageModel: ProviderCoverageModel;
  services: ServiceRecord[];
  coverageLoading: boolean;
  coverageComplete: boolean;
};

const WORKFLOW_KINDS: FinopsWorkflowKind[] = ["route", "feedback"];
const PENDING_PROPOSALS_KEY = "sla-review.workflow-proposals.pending";
const loadPendingProposals = (): FinopsWorkflowKind[] => {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(PENDING_PROPOSALS_KEY) ?? "[]");
    return Array.isArray(parsed) ? WORKFLOW_KINDS.filter((kind) => parsed.includes(kind)) : [];
  } catch {
    return [];
  }
};
const savePendingProposals = (kinds: FinopsWorkflowKind[]): void => {
  try { window.sessionStorage.setItem(PENDING_PROPOSALS_KEY, JSON.stringify(kinds)); } catch { /* Session storage may be unavailable. */ }
};
const dateLabel = (value: Date | undefined): string => {
  if (!value) return "No execution recorded";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Execution time unavailable" : date.toLocaleString();
};

export const FinopsAutomationSetup = ({
  provider,
  providerSlug,
  coverageModel,
  services,
  coverageLoading,
  coverageComplete,
}: Props) => {
  const routing = useFinopsRouting();
  const workflows = useFinopsWorkflows();
  const draftsPresent = Boolean(workflows.workflows.route && workflows.workflows.feedback);
  const anyConfigured = Boolean(workflows.workflows.route || workflows.workflows.feedback);
  const legacyActive = WORKFLOW_KINDS.some((kind) => workflows.legacy[kind]?.isDeployed);
  const [origin, setOrigin] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [router, setRouter] = useState<LocalRouter>("laya");
  const [setupError, setSetupError] = useState<string>();
  const [preparedKinds, setPreparedKinds] = useState<FinopsWorkflowKind[]>(loadPendingProposals);
  const [ownerInventoryChecked, setOwnerInventoryChecked] = useState(false);
  const inAppShell = typeof window !== "undefined" && window.self !== window.top;
  const controlsOff = routing.reliable && !routing.config.autoQueueAfterReady && !routing.config.autoAssignLane;
  const canPrepare = inAppShell && workflows.canRead === true && !workflows.loading && !workflows.collision && !workflows.error && controlsOff && ownerInventoryChecked;
  const prepareWorkflow = (kind: FinopsWorkflowKind) => {
    setSetupError(undefined);
    if (!canPrepare || workflows.workflows[kind] || preparedKinds.includes(kind)) return;
    try {
      const payload = createFinopsWorkflowIntent(kind, { origin, credentialId, router });
      sendIntent(payload, { recommendedAppId: "dynatrace.automations", recommendedIntentId: "create-workflow" });
      const next = [...preparedKinds, kind];
      setPreparedKinds(next);
      savePendingProposals(next);
      setOwnerInventoryChecked(false);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "The Workflow draft could not be prepared.");
    }
  };

  return (
    <section className="finops-setup" aria-labelledby="finops-setup-title">
      <div className="finops-setup-heading">
        <div>
          <h3 id="finops-setup-title">Automation setup</h3>
          <p>Check the provider product scope and evidence, then prepare the local routing Workflows.</p>
        </div>
        <Button size="condensed" onClick={() => openApp("dynatrace.automations")}>Open Workflows</Button>
      </div>
      <div className="finops-controls-status" aria-label="Automatic controls">
        <span>Automatic queueing: <strong>{routing.reliable ? routing.config.autoQueueAfterReady ? "On" : "Off" : "Unavailable, treated as off"}</strong></span>
        <span>Automatic lane assignment: <strong>{routing.reliable ? routing.config.autoAssignLane ? "On" : "Off" : "Unavailable, treated as off"}</strong></span>
        <Link to="/settings/finops">Automation controls</Link>
      </div>
      <div className="finops-setup-grid">
        <ResourceObjectiveSetup provider={provider} providerSlug={providerSlug}
          coverageModel={coverageModel} services={services} coverageLoading={coverageLoading}
          coverageComplete={coverageComplete} />
        <section className="finops-setup-section" aria-labelledby="finops-workflows-heading">
          <div className="finops-section-heading">
            <h4 id="finops-workflows-heading">Decision Workflows</h4>
            <span className={`status-pill ${workflows.collision ? "status-pill-warning" : draftsPresent ? "status-pill-positive" : "status-pill-neutral"}`}>
              {workflows.loading ? "Checking" : workflows.collision ? "Inspect visible pair" : draftsPresent ? "2 visible" : anyConfigured ? "Partial view" : "None visible"}
            </span>
          </div>
          <p>One tenant-wide pair handles reviewed cases, with no Workflow per dependent service. The route Workflow rechecks the saved review, calls the private local gateway, and writes the decision to Grail. The feedback Workflow records the later human outcome for Phoenix.</p>
          {workflows.error ? <p className="finops-setup-warning" role="alert">{workflows.error}</p> : null}
          {workflows.collision ? <p className="finops-setup-warning" role="alert">A Workflow has the expected title but does not match the reviewed template. Inspect it in Workflows before proceeding.</p> : null}
          {legacyActive ? <p className="finops-setup-warning" role="status">Earlier FinOps Agent Workflows are active. Keep the replacement drafts off. Verify a synthetic route and feedback, then retire the old triggers before enabling the replacement. Both pairs must never handle the same event.</p> : null}
          <div className="finops-workflow-list">
            {WORKFLOW_KINDS.map((kind) => {
              const workflow = workflows.workflows[kind];
              const needsInspection = workflow ? workflowNeedsInspection(workflow, kind) : false;
              return (
                <div key={kind} className="finops-workflow-row">
                  <div>
                    <strong>{kind === "route" ? "Route decision" : "Human feedback"}</strong>
                    <small>{FINOPS_WORKFLOWS[kind].eventType}</small>
                  </div>
                  <span className={`status-pill ${needsInspection ? "status-pill-warning" : workflow?.isDeployed ? "status-pill-positive" : "status-pill-neutral"}`}>
                    {workflows.loading ? "Checking" : !workflow ? "Not visible" : needsInspection ? "Inspect" : workflow.isDeployed ? "Deployed" : "Draft"}
                  </span>
                  {workflow ? (
                    <small className="finops-workflow-meta">
                      {kind === "route" ? `Local interface: ${workflowLocalRouter(workflow) === "laya" ? "Laya" : workflowLocalRouter(workflow) === "jev" ? "Jev-compatible" : "Unverified"} · ` : ""}
                      Actor: {workflow.actor || "Default creator"} · {workflow.lastExecution?.state ?? "No run"} · {dateLabel(workflow.lastExecution?.startedAt)}
                    </small>
                  ) : null}
                </div>
              );
            })}
          </div>
          {WORKFLOW_KINDS.some((kind) => workflows.legacy[kind]) ? (
            <details className="finops-legacy-workflows">
              <summary>Earlier Workflows in this tenant</summary>
              {WORKFLOW_KINDS.map((kind) => {
                const previous = workflows.legacy[kind];
                return previous ? <p key={kind}><strong>{kind === "route" ? "Route" : "Feedback"}:</strong> {previous.isDeployed ? "Deployed" : "Not deployed"} · Actor: {previous.actor || "Default creator"} · {previous.lastExecution?.state ?? "No run"} · {dateLabel(previous.lastExecution?.startedAt)}</p> : null;
              })}
            </details>
          ) : null}
          {!draftsPresent ? (
            <div className="finops-workflow-form">
              <strong>Prepare the Workflow drafts</strong>
              <p>Enter the private connection details. Each action opens one proposed Workflow with its reviewed JavaScript task and disabled business-event trigger. Review the source and event filter, then select Create draft in Workflows. Confirm it is private and undeployed before enabling anything. SLA Review cannot save or deploy it.</p>
              <div className="finops-workflow-fields">
                <label className="field-label">Private EdgeConnect HTTPS origin
                  <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Private HTTPS origin" autoComplete="off" />
                </label>
                <label className="field-label">Credential Vault record ID
                  <input value={credentialId} onChange={(event) => setCredentialId(event.target.value)} placeholder="CREDENTIALS_VAULT-..." autoComplete="off" />
                </label>
                <label className="field-label">Local decision interface
                  <select value={router} onChange={(event) => setRouter(event.target.value as LocalRouter)}>
                    <option value="laya">Laya</option>
                    <option value="jev">Jev-compatible</option>
                  </select>
                </label>
              </div>
              <p>Use a Vault record ID, never a token. These fields are not saved in SLA Review. Workflows receives them in the proposed script through AppShell navigation, so the origin and record ID may appear in browser history.</p>
              <label className="finops-workflow-ownership">
                <input type="checkbox" checked={ownerInventoryChecked} onChange={(event) => setOwnerInventoryChecked(event.target.checked)} />
                <span>I am the designated Workflow owner or admin, and I checked the full Workflow inventory, including private SLA Review Workflows I can access. If I cannot verify the full inventory, I will pause setup.</span>
              </label>
              {!routing.reliable ? <p className="finops-setup-warning" role="status">Automation controls cannot be read, so draft preparation is paused. Check Settings &gt; Automation.</p>
                : !controlsOff ? <p className="finops-setup-warning" role="status">Turn off automatic queueing and lane assignment before preparing replacement Workflows.</p> : null}
              {!inAppShell ? <p className="finops-setup-warning" role="status">Open SLA Review inside Dynatrace AppShell to send a Workflow proposal. Intents do not work in detached mode.</p> : null}
              {setupError ? <p className="finops-setup-warning" role="alert">{setupError}</p> : null}
              <div className="finops-workflow-actions">
                {WORKFLOW_KINDS.filter((kind) => !workflows.workflows[kind]).map((kind) => <Button
                  key={kind} size="condensed" variant={kind === "route" ? "emphasized" : undefined}
                  disabled={!canPrepare || preparedKinds.includes(kind)} onClick={() => prepareWorkflow(kind)}>
                  Prepare {kind === "route" ? "route" : "feedback"} draft in Workflows
                </Button>)}
                <Button size="condensed" onClick={() => void workflows.refresh()} disabled={workflows.loading}>Refresh Workflow status</Button>
              </div>
              {preparedKinds.length ? <p className="finops-workflow-feedback" role="status">The {preparedKinds.join(" and ")} proposal was handed to Dynatrace navigation. If an Open with dialog appears, choose Create a new workflow with tasks and an optional trigger. Return here and refresh after you save its draft in Workflows.</p> : null}
              {preparedKinds.filter((kind) => !workflows.workflows[kind]).map((kind) => <Button key={kind} size="condensed" onClick={() => {
                const next = preparedKinds.filter((item) => item !== kind);
                setPreparedKinds(next);
                savePendingProposals(next);
                setOwnerInventoryChecked(false);
              }}>I discarded the {kind} proposal; allow a new one</Button>)}
              {legacyActive ? <p className="finops-setup-warning">The earlier pair is deployed. Keep both new drafts inactive until one synthetic route and feedback are verified and the old triggers are retired.</p> : null}
            </div>
          ) : null}
          {workflows.canRead === false ? <p className="finops-setup-warning">Workflow status is unavailable. Check read access in Workflows before setting up another pair.</p> : null}
          <p className="finops-setup-boundary">Inspect the actor, Credential Vault access, EdgeConnect route, and one synthetic case before changing live triggers. Phoenix stays outside the decision path.</p>
        </section>
      </div>
    </section>
  );
};
