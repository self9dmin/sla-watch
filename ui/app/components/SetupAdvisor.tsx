import React from "react";
import { Link } from "react-router-dom";
import { openApp } from "@dynatrace-sdk/navigation";
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
  <section className="setup-checks" data-tour="advisor" aria-labelledby="setup-checks-title">
    <div className="setup-section-heading">
      <div>
        <h3 id="setup-checks-title">Setup checks</h3>
        <p>Resolve telemetry and ownership gaps before reviewing an incident.</p>
      </div>
      {!loading ? <span className="advisor-count">{recommendations.length} open</span> : null}
    </div>
    {loading ? (
      <div className="advisor-empty" role="status">Reading the tenant boundary before making recommendations...</div>
    ) : recommendations.length === 0 ? (
      <div className="advisor-empty">
        <strong>No setup gaps detected in this scan.</strong>
        <span>The current provider boundary is ready for incident review.</span>
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
              : recommendation.platformAction === "ownership-settings"
                ? <button type="button" className="advisor-action advisor-action-button" onClick={() => openApp("dynatrace.settings", "settings/ownership-configure")}>{recommendation.action} <span aria-hidden="true">→</span></button>
              : <span className="advisor-action advisor-action-muted">{recommendation.action}</span>}
          </article>
        ))}
      </div>
    )}
    {limitedContext ? <div className="advisor-footnote">Some Dynatrace context is unavailable. Recommendations are intentionally conservative until the relevant read permission or entity scope is restored.</div> : null}
  </section>
);
