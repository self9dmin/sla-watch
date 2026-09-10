import React from "react";
import { Link } from "react-router-dom";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import type { SetupRecommendation } from "../types";

const priorityLabel: Record<SetupRecommendation["priority"], string> = {
  high: "Do this first",
  medium: "Improve next",
  low: "Good follow-up",
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
    <div className="advisor-intro">
      <div className="panel-heading-row">
        <div>
          <Heading level={2}>Make this environment SLA-ready</Heading>
          <Paragraph>Evidence-backed recommendations for the next setup move. SLA Watch never changes tags, names, or SLOs without your approval.</Paragraph>
        </div>
        <span className="advisor-badge">Setup advisor</span>
      </div>
    </div>
    {loading ? (
      <div className="advisor-empty" role="status">Reading the tenant boundary before making recommendations...</div>
    ) : recommendations.length === 0 ? (
      <div className="advisor-empty">
        <strong>No setup gaps detected in this scan.</strong>
        <span>Keep the provider boundary and ownership metadata stable as services change. The next review can focus on the contract and error budget.</span>
      </div>
    ) : (
      <div className="advisor-grid">
        {recommendations.map((recommendation) => (
          <article className={`advisor-item advisor-item-${recommendation.priority}`} key={recommendation.id}>
            <div className="advisor-item-top"><span className="advisor-priority">{priorityLabel[recommendation.priority]}</span><span className="advisor-dot" aria-hidden="true" /></div>
            <h3>{recommendation.title}</h3>
            <p>{recommendation.detail}</p>
            <div className="advisor-evidence"><span>Why this is showing</span><strong>{recommendation.evidence}</strong></div>
            {recommendation.href ? <Link className="advisor-action" to={recommendation.href}>{recommendation.action} <span aria-hidden="true">→</span></Link> : <span className="advisor-action advisor-action-muted">{recommendation.action}</span>}
          </article>
        ))}
      </div>
    )}
    {limitedContext ? <div className="advisor-footnote">Some Dynatrace context is unavailable. Recommendations are intentionally conservative until the relevant read permission or entity scope is restored.</div> : null}
  </Surface>
);
