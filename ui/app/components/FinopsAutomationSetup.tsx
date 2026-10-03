import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { openApp } from "@dynatrace-sdk/navigation";
import { Button } from "@dynatrace/strato-components/buttons";
import type { ProviderCoverageModel } from "../data/providerCoverage";
import {
  FINOPS_WORKFLOWS,
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
  const [gatewayOrigin, setGatewayOrigin] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [router, setRouter] = useState<LocalRouter>("laya");
  const [confirming, setConfirming] = useState(false);
  const [workflowFeedback, setWorkflowFeedback] = useState<string>();
  const draftsPresent = Boolean(workflows.workflows.route && workflows.workflows.feedback);
  const anyConfigured = Boolean(workflows.workflows.route || workflows.workflows.feedback);
  const legacyActive = WORKFLOW_KINDS.some((kind) => workflows.legacy[kind]?.isDeployed);

  useEffect(() => {
    setConfirming(false);
    setWorkflowFeedback(undefined);
  }, [providerSlug]);

  const createDrafts = async () => {
    setWorkflowFeedback(undefined);
    try {
      await workflows.createDrafts({ origin: gatewayOrigin, credentialId, router });
      setConfirming(false);
      setWorkflowFeedback("Private Workflow drafts created. Inspect their actor, permissions, and trigger in Workflows before deployment.");
    } catch (error) {
      setWorkflowFeedback(error instanceof Error ? error.message : "Workflow drafts could not be created.");
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
          {workflows.collision ? <p className="finops-setup-warning" role="alert">A Workflow has the expected title but is not an SLA Review draft. Inspect it in Workflows before creating another.</p> : null}
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
          {!draftsPresent && workflows.canRead === true && !workflows.collision ? (
            <div className="finops-workflow-form">
              <label className="field-label" htmlFor="finops-router-model">Local decision interface
                <select id="finops-router-model" value={router}
                  onChange={(event) => { setRouter(event.target.value as LocalRouter); setConfirming(false); }}>
                  <option value="laya">Laya typed decision model</option>
                  <option value="jev">Jev-compatible local model</option>
                </select>
              </label>
              <p>This choice guards the Workflow response. The gateway must already use the matching local model; this app does not install or switch it.</p>
              <label className="field-label" htmlFor="finops-edge-origin">Private EdgeConnect origin
                <input id="finops-edge-origin" type="url" inputMode="url" autoComplete="off" spellCheck={false}
                  placeholder="Private HTTPS EdgeConnect origin" value={gatewayOrigin}
                  onChange={(event) => { setGatewayOrigin(event.target.value); setConfirming(false); }} />
              </label>
              <label className="field-label" htmlFor="finops-vault-id">Credential Vault record ID
                <input id="finops-vault-id" type="text" autoComplete="off" spellCheck={false}
                  placeholder="CREDENTIALS_VAULT-…" value={credentialId}
                  onChange={(event) => { setCredentialId(event.target.value); setConfirming(false); }} />
                <small>Enter the record ID only. Do not paste a bearer token.</small>
              </label>
              {confirming ? (
                <div className="finops-workflow-confirm">
                  <span>Create {anyConfigured ? "the missing" : "two"} private, undeployed Workflow drafts for this tenant?</span>
                  <Button size="condensed" onClick={() => setConfirming(false)}>Cancel</Button>
                  <Button size="condensed" variant="emphasized" disabled={workflows.creating}
                    onClick={() => void createDrafts()}>{workflows.creating ? "Creating" : "Create drafts"}</Button>
                </div>
              ) : (
                <Button size="condensed" variant="emphasized"
                  disabled={workflows.loading || workflows.creating || workflows.canWrite !== true}
                  onClick={() => setConfirming(true)}>Prepare Workflow drafts</Button>
              )}
              {workflows.canWrite === false ? <small className="finops-setup-warning">Workflow write access is required to create drafts.</small> : null}
            </div>
          ) : null}
          {workflows.canRead === false ? <p className="finops-setup-warning">Workflow read access is required to show and safely create the drafts.</p> : null}
          {workflowFeedback ? <p className="finops-workflow-feedback" role="status">{workflowFeedback}</p> : null}
          <p className="finops-setup-boundary">Drafts do not run or incur Workflow executions. Review the actor, Credential Vault access, EdgeConnect route, and one synthetic case in Workflows before deploying. Phoenix stays outside the decision path.</p>
        </section>
      </div>
    </section>
  );
};
