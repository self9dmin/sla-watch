import React from "react";
import { Link } from "react-router-dom";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import type { SetupRecommendation } from "../types";

const priorityLabel: Record<SetupRecommendation["priority"], string> = {
  high: "Required",
  medium: "Recommended",
  low: "Optional",
};

export const SetupAdvisor = ({
  recommendations,
  loading,
  limitedContext,
}: {
  recommendations: SetupRecommendation[];
  loading: boolean;
  limitedContext: boolean;
}) => (
  <Surface className="panel-card advisor-panel" data-tour="advisor">
    <div className="panel-heading-row">
      <div className="advisor-intro">
        <Heading level={2}>Setup checks</Heading>
        <Paragraph>Resolve required telemetry and identity gaps before an incident review. SLA Watch does not change tags, names, or SLOs.</Paragraph>
      </div>
      {!loading ? <span className="advisor-count">{recommendations.length} open</span> : null}
    </div>
    {loading ? (
      <div className="advisor-empty" role="status">Reading the tenant boundary before making recommendations...</div>
    ) : recommendations.length === 0 ? (
      <div className="advisor-empty">
        <strong>No setup gaps detected in this scan.</strong>
        <span>Keep the provider boundary and ownership metadata stable as services change. The next review can focus on contract records and the error budget.</span>
      </div>
    ) : (
      <div className="advisor-list">
        {recommendations.map((recommendation) => (
          <article className={`advisor-item advisor-item-${recommendation.priority}`} key={recommendation.id}>
            <div className="advisor-item-copy">
              <div className="advisor-item-title">
                <span className="advisor-priority">{priorityLabel[recommendation.priority]}</span>
                <h3>{recommendation.title}</h3>
              </div>
              <p>{recommendation.detail}</p>
              <div className="advisor-evidence"><span>Reason</span><strong>{recommendation.evidence}</strong></div>
            </div>
            {recommendation.href
              ? <Link className="advisor-action" to={recommendation.href}>{recommendation.action} <span aria-hidden="true">→</span></Link>
              : <span className="advisor-action advisor-action-muted">{recommendation.action}</span>}
          </article>
        ))}
      </div>
    )}
    {limitedContext ? <div className="advisor-footnote">Some Dynatrace context is unavailable. Recommendations are intentionally conservative until the relevant read permission or entity scope is restored.</div> : null}
  </Surface>
);
