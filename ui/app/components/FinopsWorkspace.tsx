import React, { useMemo, useState } from "react";
import { businessEventsClient } from "@dynatrace-sdk/client-classic-environment-v2";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";

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
    <li className="candidate-completion">
      <strong>{row.provider}: {row.problemId}</strong>
      <span>Recommendation: {row.route.replaceAll("_", " ")}</span>
      <small>{row.reason} · {row.model} · {row.timestamp}</small>
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
    </li>
  );
};

export const FinopsWorkspace = ({ providerSlug }: { providerSlug: string }) => {
  const query = useDql({ query: QUERY });
  const rows = useMemo(() => parseRows(query.data?.records), [query.data?.records]);
  const visible = rows.filter((row) => row.provider === providerSlug);
  return (
    <Surface className="panel-card">
      <Heading level={2}>FinOps Agent</Heading>
      <Paragraph>Reviewed SLA cases are routed for internal follow-up. A person confirms the outcome, which Phoenix uses to score the router.</Paragraph>
      {query.isLoading ? <Paragraph>Loading router decisions…</Paragraph> : null}
      {query.error ? <Paragraph>Router decisions are unavailable. Check business event read access.</Paragraph> : null}
      {!query.isLoading && !query.error && visible.length === 0
        ? <Paragraph>No routed cases for this provider in the last 30 days.</Paragraph> : null}
      {visible.length > 0 ? <ul>{visible.map((row) => <RouteReview key={`${row.spanId}`} row={row} />)}</ul> : null}
    </Surface>
  );
};
