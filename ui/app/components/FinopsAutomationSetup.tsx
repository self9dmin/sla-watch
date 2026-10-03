import React from "react";
import { Link } from "react-router-dom";
import { openApp } from "@dynatrace-sdk/navigation";
import { Button } from "@dynatrace/strato-components/buttons";
import type { ProviderCoverageModel } from "../data/providerCoverage";
import {
  FINOPS_WORKFLOWS,
  workflowLocalRouter,
  workflowNeedsInspection,
  type FinopsWorkflowKind,
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
        <Link to="/settings/watch">Review controls</Link>
      </div>
      <div className="finops-setup-grid">
        <ResourceObjectiveSetup provider={provider} providerSlug={providerSlug}
          coverageModel={coverageModel} services={services} coverageLoading={coverageLoading}
          coverageComplete={coverageComplete} />
        <section className="finops-setup-section" aria-labelledby="finops-workflows-heading">
          <div className="finops-section-heading">
            <h4 id="finops-workflows-heading">Decision Workflows</h4>
            <span className={`status-pill ${draftsPresent ? "status-pill-positive" : "status-pill-neutral"}`}>
              {workflows.loading ? "Checking" : draftsPresent ? "2 found" : anyConfigured ? "Partial setup" : "Not created"}
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
                    {workflows.loading ? "Checking" : !workflow ? "Missing" : needsInspection ? "Inspect" : workflow.isDeployed ? "Deployed" : "Draft"}
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
              <strong>Set up in Dynatrace Workflows</strong>
              <p>Dynatrace reserves Workflow write access for Dynatrace-provided apps. An authorized operator must create the tenant-wide route and feedback Workflows in Workflows from the reviewed scripts in the repository. Configure the private EdgeConnect origin, Credential Vault record ID, and local Laya or Jev-compatible gateway there. Keep new event triggers undeployed while the earlier pair is active.</p>
              <Button size="condensed" onClick={() => openApp("dynatrace.automations")}>Set up in Workflows</Button>
            </div>
          ) : null}
          {workflows.canRead === false ? <p className="finops-setup-warning">Workflow status is unavailable. Check read access in Workflows before setting up another pair.</p> : null}
          <p className="finops-setup-boundary">Inspect the actor, Credential Vault access, EdgeConnect route, and one synthetic case before changing live triggers. Phoenix stays outside the decision path.</p>
        </section>
      </div>
    </section>
  );
};
