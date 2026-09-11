import React from "react";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";
import { CommunityLink } from "../components/CommunityLink";
import { CHANGE_LOG_ENTRIES } from "../data/changeLog";
import { isCommunityLive } from "../data/externalLinks";

export const ChangeLogPage = () => {
  const communityLive = isCommunityLive();

  return <div className="workflow-page change-log-page">
    <div className="page-intro">
      <Text className="eyebrow">SLA Review · release history</Text>
      <Heading level={1}>Change log</Heading>
      <Paragraph>Versioned application changes are listed here for operational awareness. This page is read-only and does not record tenant changes.</Paragraph>
    </div>

    <section className="change-log-summary" aria-label="Change log scope">
      <div>
        <span className="eyebrow">Scope</span>
        <strong>Application releases</strong>
        <span>Provider settings and tenant evidence remain in the monitor and settings surfaces.</span>
      </div>
      <CommunityLink className="inline-action" />
    </section>

    <section className="change-log-list-panel" aria-labelledby="change-log-heading">
      <div className="panel-heading-row">
        <div>
          <Text className="eyebrow">Release history</Text>
          <Heading level={2} id="change-log-heading">What changed</Heading>
        </div>
        <span className="status-pill status-pill-neutral">{CHANGE_LOG_ENTRIES.length} releases</span>
      </div>
      <div className="change-log-list">
        {CHANGE_LOG_ENTRIES.map((entry) => (
          <article className="change-log-entry" key={entry.version}>
            <div className="change-log-entry-header">
              <div>
                <span className="change-log-version">{entry.version}</span>
                <span className="change-log-label">{entry.label}</span>
              </div>
            </div>
            <h3>{entry.summary}</h3>
            <ul>
              {entry.details.map((detail) => <li key={detail}>{detail}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>

    <div className="workflow-note"><strong>Operational boundary</strong><span>{communityLive ? "Use the monitor to review provider evidence. Use the Dynatrace Community profile for questions, support, or issue discussion." : "Use the monitor to review provider evidence. Dynatrace Community support remains unavailable until public launch."}</span></div>
  </div>
};
