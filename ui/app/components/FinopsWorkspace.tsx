import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { businessEventsClient } from "@dynatrace-sdk/client-classic-environment-v2";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import type { ProviderCoverageModel } from "../data/providerCoverage";
import { createResourceObjectiveExternalId, resourceObjectiveCandidates } from "../data/resourceObjectives";
import { createEvidenceReviewPath } from "../data/reviewRoutes";
import { isProductScopeObjective } from "../data/serviceObjectives";
import { workflowLocalRouter, workflowNeedsInspection } from "../data/finopsAutomation";
import { useFinopsRouting } from "../hooks/useFinopsRouting";
import { useFinopsWorkflows } from "../hooks/useFinopsWorkflows";
import { useObjectiveEvaluations } from "../hooks/useObjectiveEvaluations";
import { useServiceObjectives } from "../hooks/useServiceObjectives";
import type { ServiceRecord, SlaProviderResponse } from "../types";
import { FinopsAutomationSetup } from "./FinopsAutomationSetup";

const ROUTES = ["prepare_provider_draft", "internal_only", "human_review"] as const;
type Route = typeof ROUTES[number];
type Row = {
  requestId: string;
  caseId: string;
  problemId: string;
  provider: string;
  route: Route;
  reason: string;
  model: string;
  requestHash: string;
  traceId: string;
  spanId: string;
  timestamp: string;
  evaluated: boolean;
  disposition: "continued" | "disqualified" | "needs_review" | null;
  assignedLane: string;
  filingReference: string | null;
};

const QUERY = `fetch bizevents, from:-30d
| filter in(event.type, "sla.finops.route", "sla.finops.feedback.recorded", "sla.finops.filed") and event.provider == "sla-review"
| fields timestamp, event.type, finops_request_id, finops_request_hash, finops_case_id, finops_problem_id, finops_provider, finops_route, finops_reason, finops_model, finops_trace_id, finops_span_id, finops_correct_route, finops_disposition, finops_assigned_lane, finops_filing_reference
| sort timestamp desc
| limit 500`;

const parseRows = (records: unknown): Row[] => {
  if (!Array.isArray(records)) return [];
  const feedbackBySpan = new Map<string, "continued" | "disqualified" | "needs_review">();
  const filingBySpan = new Map<string, string>();
  for (const value of records) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    if (typeof row.finops_span_id !== "string") continue;
    if (row["event.type"] === "sla.finops.feedback.recorded" &&
        typeof row.finops_disposition === "string" &&
        ["continued", "disqualified", "needs_review"].includes(row.finops_disposition)) {
      if (!feedbackBySpan.has(row.finops_span_id))
        feedbackBySpan.set(row.finops_span_id, row.finops_disposition as "continued" | "disqualified" | "needs_review");
    }
    if (row["event.type"] === "sla.finops.filed" && typeof row.finops_filing_reference === "string" &&
        !filingBySpan.has(row.finops_span_id))
      filingBySpan.set(row.finops_span_id, row.finops_filing_reference);
  }
  const seenRequests = new Set<string>();
  return records.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    if (row["event.type"] !== "sla.finops.route" ||
        typeof row.finops_request_id !== "string" ||
        typeof row.finops_case_id !== "string" ||
        typeof row.finops_problem_id !== "string" ||
        typeof row.finops_provider !== "string" ||
        typeof row.finops_route !== "string" ||
        !ROUTES.includes(row.finops_route as Route) ||
        typeof row.finops_request_hash !== "string" ||
        !/^[0-9a-f]{24}$/.test(row.finops_request_hash) ||
        typeof row.finops_trace_id !== "string" ||
        !/^[0-9a-f]{32}$/.test(row.finops_trace_id) ||
        typeof row.finops_span_id !== "string" ||
        !/^[0-9a-f]{16}$/.test(row.finops_span_id) ||
        seenRequests.has(row.finops_request_id)) return [];
    seenRequests.add(row.finops_request_id);
    return [{
      requestId: row.finops_request_id,
      caseId: row.finops_case_id,
      problemId: row.finops_problem_id,
      provider: row.finops_provider,
      route: row.finops_route as Route,
      reason: typeof row.finops_reason === "string" ? row.finops_reason : "",
      model: typeof row.finops_model === "string" ? row.finops_model : "policy",
      requestHash: row.finops_request_hash,
      traceId: row.finops_trace_id,
      spanId: row.finops_span_id,
      timestamp: typeof row.timestamp === "string" ? row.timestamp : "",
      evaluated: feedbackBySpan.has(row.finops_span_id),
      disposition: feedbackBySpan.get(row.finops_span_id) ?? null,
      assignedLane: typeof row.finops_assigned_lane === "string" ? row.finops_assigned_lane : "unassigned",
      filingReference: feedbackBySpan.get(row.finops_span_id) === "continued"
        ? filingBySpan.get(row.finops_span_id) ?? null : null,
    }];
  });
};

const routeDateLabel = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Time unavailable" : parsed.toLocaleString();
};

const RouteReview = ({ row }: { row: Row }) => {
  const [correctRoute, setCorrectRoute] = useState<Route>(row.route);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const [filingReference, setFilingReference] = useState("");
  const [filingChannel, setFilingChannel] = useState("");
  const [filingQueued, setFilingQueued] = useState(false);
  const [filingError, setFilingError] = useState(false);
  const submit = async () => {
    if (submitting || submitted || row.evaluated) return;
    setSubmitting(true);
    setError(false);
    try {
      await businessEventsClient.ingest({
        type: "application/json; charset=utf-8",
        body: {
          "event.type": "sla.finops.feedback",
          "event.provider": "sla-review",
          finops_request_id: row.requestId,
          finops_case_id: row.caseId,
          finops_request_hash: row.requestHash,
          finops_trace_id: row.traceId,
          finops_span_id: row.spanId,
          finops_recommended_route: row.route,
          finops_correct_route: correctRoute,
        },
      });
      setSubmitted(true);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };
  const recordFiling = async () => {
    const reference = filingReference.trim();
    if (row.disposition !== "continued" || row.filingReference || filingQueued ||
        !["portal", "support_ticket", "email", "other"].includes(filingChannel) ||
        reference.length < 4 || reference.length > 160) return;
    setFilingError(false);
    try {
      await businessEventsClient.ingest({
        type: "application/json; charset=utf-8",
        body: {
          "event.type": "sla.finops.filed",
          "event.provider": "sla-review",
          finops_request_id: row.requestId,
          finops_case_id: row.caseId,
          finops_problem_id: row.problemId,
          finops_provider: row.provider,
          finops_span_id: row.spanId,
          finops_filing_reference: reference,
          finops_filing_channel: filingChannel,
          finops_filed_at: new Date().toISOString(),
          finops_filing_source: "operator_attested",
        },
      });
      setFilingQueued(true);
    } catch {
      setFilingError(true);
    }
  };
  return (
    <li className="finops-decision-item">
      <details>
        <summary>
          <strong>{row.problemId} · {row.route.replaceAll("_", " ")}</strong>
          <span>{row.disposition ? `Human outcome: ${row.disposition.replaceAll("_", " ")}` : "Awaiting human outcome"}</span>
          <small>{routeDateLabel(row.timestamp)}</small>
        </summary>
      <div className="candidate-completion">
      <Link to={createEvidenceReviewPath({ providerSlug: row.provider, problemId: row.problemId, caseId: row.caseId })}>Open evidence case</Link>
      <span>Internal routing recommendation: {row.route.replaceAll("_", " ")}</span>
      <small>{row.reason} · {row.model} · {routeDateLabel(row.timestamp)}</small>
      <small>Work lane: {row.assignedLane}. {row.disposition
        ? `Human outcome: ${row.disposition.replaceAll("_", " ")}.`
        : "Awaiting human outcome."}</small>
      <small>{row.filingReference
        ? "External provider filing recorded by an operator. Credit outcome remains undetermined."
        : "No provider submission by this app. Credit eligibility remains undetermined."}</small>
      <label>
        Human outcome{" "}
        <select value={correctRoute} onChange={(event) => setCorrectRoute(event.target.value as Route)}
          disabled={submitting || submitted || row.evaluated}>
          {ROUTES.map((route) => <option key={route} value={route}>{route.replaceAll("_", " ")}</option>)}
        </select>
      </label>
      <Button size="condensed" disabled={submitting || submitted || row.evaluated} onClick={() => void submit()}>
        {row.evaluated ? "Evaluated in Phoenix" : submitted ? "Feedback queued" : submitting ? "Queueing" : "Record outcome for Phoenix"}
      </Button>
      {error ? <small role="alert">Feedback could not be queued.</small> : null}
      {row.filingReference ? <strong>Filed, operator recorded: {row.filingReference}</strong> : null}
      {row.disposition === "continued" && !row.filingReference ? (
        <div>
          <label>Provider submission channel{" "}
            <select value={filingChannel} onChange={(event) => setFilingChannel(event.target.value)} disabled={filingQueued}>
              <option value="">Select a channel</option>
              <option value="portal">Provider portal</option>
              <option value="support_ticket">Support ticket</option>
              <option value="email">Email</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>Provider receipt or ticket reference{" "}
            <input value={filingReference} onChange={(event) => setFilingReference(event.target.value)}
              maxLength={160} disabled={filingQueued} />
          </label>
          <Button size="condensed" disabled={filingQueued || !filingChannel || filingReference.trim().length < 4}
            onClick={() => void recordFiling()}>
            {filingQueued ? "Filing record queued" : "Record filed claim"}
          </Button>
          <small>This records an external filing. It does not submit a claim to the provider.</small>
          {filingError ? <small role="alert">The filing record could not be saved.</small> : null}
        </div>
      ) : null}
      </div>
      </details>
    </li>
  );
};

const objectivePercent = (value?: number): string =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`
    : "No result";

const AutomateOverview = ({ providerSlug, provider, services, coverageModel, coverageLoading, coverageComplete }: {
  providerSlug: string;
  provider?: SlaProviderResponse;
  services: ServiceRecord[];
  coverageModel: ProviderCoverageModel;
  coverageLoading: boolean;
  coverageComplete: boolean;
}) => {
  const managed = useServiceObjectives({ enabled: Boolean(providerSlug), providerSlug, pageSize: 50 });
  const tenant = useServiceObjectives({ enabled: Boolean(providerSlug), managedOnly: false, pageSize: 4 });
  const candidates = useMemo(() => resourceObjectiveCandidates(coverageModel, services, provider),
    [coverageModel, services, provider]);
  const candidateByExternalId = useMemo(() => new Map(candidates.flatMap((candidate) => {
    const externalId = createResourceObjectiveExternalId(
      providerSlug, candidate.providerServiceId, candidate.accountId, candidate.region,
    );
    return externalId ? [[externalId, candidate] as const] : [];
  })), [candidates, providerSlug]);
  const productObjectives = useMemo(() => managed.objectives.filter((objective) =>
    isProductScopeObjective(objective, providerSlug) &&
    objective.externalId && candidateByExternalId.has(objective.externalId)),
    [managed.objectives, providerSlug, candidateByExternalId]);
  const visibleObjectives = useMemo(() => productObjectives.slice(0, 3), [productObjectives]);
  const evaluations = useObjectiveEvaluations(visibleObjectives);
  const otherObjectives = useMemo(() => tenant.objectives.filter((objective) =>
    !candidateByExternalId.has(objective.externalId ?? "")).slice(0, 4),
    [tenant.objectives, candidateByExternalId]);
  const otherEvaluations = useObjectiveEvaluations(otherObjectives);
  const workflows = useFinopsWorkflows();
  const routing = useFinopsRouting();
  const route = workflows.workflows.route;
  const feedback = workflows.workflows.feedback;
  const legacyDeployed = Boolean(workflows.legacy.route?.isDeployed || workflows.legacy.feedback?.isDeployed);
  const routeNeedsInspection = route ? workflowNeedsInspection(route, "route") : false;
  const feedbackNeedsInspection = feedback ? workflowNeedsInspection(feedback, "feedback") : false;
  const workflowState = (item: typeof route, inspect: boolean) =>
    workflows.loading ? "Checking" : workflows.error || workflows.collision ? "Unavailable" :
      !item ? "Not visible" : inspect ? "Inspect" : item.isDeployed ? "Deployed" : "Draft";
  const routeState = workflowState(route, routeNeedsInspection);
  const feedbackState = workflowState(feedback, feedbackNeedsInspection);

  return <>
    <div className="finops-overview-grid">
      <section className="finops-overview-card" aria-labelledby="finops-slos-heading">
        <div className="finops-overview-card-heading">
          <div><h3 id="finops-slos-heading">Existing SLOs</h3><p>Product-scope screening and other native Dynatrace SLOs.</p></div>
          <Link to={`/performance?provider=${encodeURIComponent(providerSlug)}`}>Service health</Link>
        </div>
        {coverageLoading || managed.loading ? <p>Checking product-scope SLOs and Coverage…</p> : managed.error ?
          <p role="status">SLO status unavailable. {managed.error}</p> :
          visibleObjectives.length > 0 ? <>
            <p className="finops-overview-count">{productObjectives.length} product-scope SLO{productObjectives.length === 1 ? "" : "s"} matched in loaded Coverage{managed.totalCount > managed.objectives.length ? " (first 50 records only)" : ""}</p>
            <ul className="finops-overview-slos">{visibleObjectives.map((objective) => {
              const scope = candidateByExternalId.get(objective.externalId ?? "");
              const evaluation = evaluations[objective.id];
              const status = evaluation?.result?.status === "SUCCESS" ? "On target" :
                evaluation?.result?.status === "WARNING" ? "At risk" :
                  evaluation?.result?.status === "FAILURE" ? "Below target" : "No result yet";
              return <li key={objective.id}>
                <strong>{objective.name}</strong>
                <span>{scope?.providerServiceName} · {scope?.region} · account …{scope?.accountId.slice(-4)}</span>
                <small>{status} · Observed {objectivePercent(evaluation?.result?.value)} · Target {objectivePercent(objective.criteria[0]?.target)}</small>
              </li>;
            })}</ul>
          </> : <div className="finops-overview-empty">
            <strong>{managed.totalCount > managed.objectives.length
              ? "No match in loaded SLOs; full inventory not verified"
              : coverageComplete ? "No currently matched product-scope SLO" : "Product-scope check incomplete"}</strong>
            <span>Check the exact product, account, region, and linked services in Setup before creating one.</span>
            <Link to={`/finops?view=setup&provider=${encodeURIComponent(providerSlug)}`}>Review SLO setup</Link>
          </div>}
        {!coverageLoading && !coverageComplete ? <p className="finops-overview-caveat">Coverage inventory is incomplete. Do not use this list to decide whether a product SLO is missing or safe to create.</p> : null}
        {managed.totalCount > managed.objectives.length && !managed.loading ?
          <p className="finops-overview-caveat">The provider SLO inventory exceeds this bounded view. Check Service health and Setup before relying on the count.</p> : null}
        {!tenant.loading && !tenant.error && tenant.totalCount > 0 ? <div className="finops-tenant-slos">
          <strong>Other existing tenant SLOs</strong>
          <span>{tenant.totalCount} total. Provider mapping is unverified for those below.</span>
          <ul>{otherObjectives.map((objective) => {
            const evaluation = otherEvaluations[objective.id];
            const state = evaluation?.result?.status === "SUCCESS" ? "On target" :
              evaluation?.result?.status === "WARNING" ? "At risk" :
                evaluation?.result?.status === "FAILURE" ? "Below target" : "No result yet";
            return <li key={objective.id}><span>{objective.name}</span><small>{state} · Target {objectivePercent(objective.criteria[0]?.target)}</small></li>;
          })}</ul>
        </div> : null}
      </section>
      <section className="finops-overview-card" aria-labelledby="finops-decision-heading">
        <div className="finops-overview-card-heading">
          <div><h3 id="finops-decision-heading">Decision workflow</h3><p>One route and feedback pair for reviewed cases.</p></div>
          <Link to={`/finops?view=setup&provider=${encodeURIComponent(providerSlug)}`}>Setup</Link>
        </div>
        <div className="finops-overview-workflow-status">
          <strong>{routeState === "Deployed" && !legacyDeployed ? "Local routing is deployed" :
            legacyDeployed ? "Earlier Workflow deployed; inspect changeover" :
              routeState === "Draft" ? "Routing is not active" : "Routing status needs review"}</strong>
          <span>Reviewed route Workflow: {routeState}{route && routeState === "Deployed" ? ` · ${workflowLocalRouter(route) === "laya" ? "Laya" : workflowLocalRouter(route) === "jev" ? "Jev-compatible" : "Local router unverified"}` : ""}</span>
          <span>Reviewed feedback Workflow: {feedbackState}</span>
          {legacyDeployed ? <span>Earlier route: {workflows.legacy.route?.isDeployed ? "Deployed" : "Not deployed"} · Earlier feedback: {workflows.legacy.feedback?.isDeployed ? "Deployed" : "Not deployed"}</span> : null}
          <span>Automatic queueing: {routing.reliable ? routing.config.autoQueueAfterReady ? "On" : "Off" : "Unavailable, treated as off"} · Lane assignment: {routing.reliable ? routing.config.autoAssignLane ? "On" : "Off" : "Unavailable, treated as off"}</span>
          {route?.lastExecution ? <small>Last route execution: {route.lastExecution.state ?? "Unknown"} · {route.lastExecution.startedAt ? new Date(route.lastExecution.startedAt).toLocaleString() : "Time unavailable"}</small> : null}
        </div>
        <ol className="finops-decision-flow">
          <li><strong>Human review</strong><span>A person completes Evidence. Routing begins only when the case is queued under the current controls.</span></li>
          <li><strong>Local route</strong><span>When a verified route Workflow runs, it rechecks the review, calls the local model through EdgeConnect, then writes the recommendation to Grail.</span></li>
          <li><strong>Later outcome</strong><span>After a route, a person records the outcome. When configured, the feedback Workflow uses the local gateway to annotate Phoenix after the trace is exported through Bindplane.</span></li>
        </ol>
        <p className="finops-overview-caveat">Phoenix observes the decision, outside the route path. No provider claim is sent and credit eligibility remains undetermined.</p>
      </section>
    </div>
  </>;
};

export const FinopsWorkspace = ({
  view,
  providerSlug,
  provider,
  services,
  coverageModel,
  coverageLoading,
  coverageComplete,
}: {
  view: "overview" | "setup";
  providerSlug: string;
  provider?: SlaProviderResponse;
  services: ServiceRecord[];
  coverageModel: ProviderCoverageModel;
  coverageLoading: boolean;
  coverageComplete: boolean;
}) => {
  return (
    <Surface className="panel-card">
      <Heading level={2}>Automate</Heading>
      <Paragraph>{view === "setup"
        ? "Check the product scope and prepare the local route and feedback Workflows. Nothing is created automatically."
        : "See existing SLOs, the local decision path, and what happened after each reviewed case."}</Paragraph>
      {view === "setup" ? <FinopsAutomationSetup
        providerSlug={providerSlug}
        provider={provider}
        services={services}
        coverageModel={coverageModel}
        coverageLoading={coverageLoading}
        coverageComplete={coverageComplete}
      /> : <FinopsOverviewContent providerSlug={providerSlug} provider={provider}
        services={services} coverageModel={coverageModel}
        coverageLoading={coverageLoading} coverageComplete={coverageComplete} />}
    </Surface>
  );
};

const FinopsOverviewContent = ({ providerSlug, provider, services, coverageModel, coverageLoading, coverageComplete }: {
  providerSlug: string;
  provider?: SlaProviderResponse;
  services: ServiceRecord[];
  coverageModel: ProviderCoverageModel;
  coverageLoading: boolean;
  coverageComplete: boolean;
}) => {
  const query = useDql({ query: QUERY });
  const rows = useMemo(() => parseRows(query.data?.records), [query.data?.records]);
  const visible = rows.filter((row) => row.provider === providerSlug);
  return <>
      <AutomateOverview providerSlug={providerSlug} provider={provider} services={services}
        coverageModel={coverageModel} coverageLoading={coverageLoading} coverageComplete={coverageComplete} />
      <div className="finops-decisions-heading">
        <h3>Recent route decisions</h3>
        <span>Last 30 days · Grail · {visible.length} found</span>
      </div>
      {query.isLoading ? <Paragraph>Loading routing recommendations…</Paragraph> : null}
      {query.error ? <Paragraph>Routing recommendations are unavailable. Check business event read access.</Paragraph> : null}
      {!query.isLoading && !query.error && visible.length === 0
        ? <div className="finops-empty">
          <Paragraph>No cases have been routed for this provider in the last 30 days. Complete an eligible case in Evidence, then choose Queue local route review on its saved human review. Internal routing recommendations and later human outcomes appear here.</Paragraph>
          <Button as={Link} to={`/evidence?provider=${encodeURIComponent(providerSlug)}`} size="condensed">Review cases in Evidence</Button>
        </div> : null}
      {visible.length > 0 ? <ul className="finops-decisions-list">{visible.slice(0, 5).map((row) => <RouteReview key={`${row.spanId}`} row={row} />)}</ul> : null}
      {visible.length > 5 ? <Paragraph>Showing the five most recent decisions for this provider.</Paragraph> : null}
      {Array.isArray(query.data?.records) && query.data.records.length >= 500 ? <Paragraph>Grail returned the query limit of 500 events. Older decisions may be omitted.</Paragraph> : null}
    </>;
};
