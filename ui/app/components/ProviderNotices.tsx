import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@dynatrace/strato-components/buttons";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import type { EvidenceLookbackHours, ProviderNotice, ProviderNoticesResponse, SmartscapeScopeEdge } from "../types";
import { formatEvidenceLookback } from "../data/lookback";
import { providerConnectionScopeId } from "../data/providerConnections";
import { correlateProviderNoticeToTopology, type ProviderNoticeCorrelation } from "../data/providerNoticeCorrelation";
import { useProviderNoticeSource } from "../hooks/useProviderNoticeSource";

type ProviderNoticesProps = {
  providerSlug: string;
  lookbackHours: EvidenceLookbackHours;
  topology?: SmartscapeScopeEdge[];
  embedded?: boolean;
};

type Tone = "neutral" | "warning" | "positive";

const StatusPill = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => <span className={`status-pill status-pill-${tone}`}>{children}</span>;

const formatDateTime = (value?: string): string => {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
};

const formatEnum = (value?: string): string => value
  ? value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
  : "Not provided";

const SourceLabel = ({ response }: { response: ProviderNoticesResponse }) => {
  if (response.connectionState === "connected") {
    const label = response.provider === "aws"
      ? "Account-specific"
      : response.provider === "azure"
        ? "Subscription-specific"
        : response.provider === "oci"
          ? "Tenancy-specific"
          : "Project-specific";
    return <StatusPill tone="positive">{label}</StatusPill>;
  }
  if (response.connectionState === "fallback") return <StatusPill tone="warning">Public fallback</StatusPill>;
  return <StatusPill tone="neutral">Public status</StatusPill>;
};

const NoticeDetail = ({ notice, providerName, correlation }: { notice: ProviderNotice; providerName: string; correlation: ProviderNoticeCorrelation }) => (
  <article className="provider-notice-detail" aria-label={`Provider notice ${notice.title}`}>
    <div className="provider-notice-detail-heading">
      <div>
        <span className="provider-notice-id">{providerName} notice · {notice.id}</span>
        <Heading level={3}>{notice.title}</Heading>
      </div>
      <StatusPill tone={notice.state === "ACTIVE" ? "warning" : "neutral"}>{formatEnum(notice.state)}</StatusPill>
    </div>
    <Paragraph>{notice.summary}</Paragraph>
    <dl className="provider-notice-facts">
      <div><dt>Relevance</dt><dd>{notice.source === "provider-public" || notice.source === "gcp-public" ? "Not customer-specific" : formatEnum(notice.relevance)}</dd></div>
      <div><dt>Started</dt><dd>{formatDateTime(notice.startTime)}</dd></div>
      <div><dt>Last update</dt><dd>{formatDateTime(notice.updateTime)}</dd></div>
      <div><dt>Locations</dt><dd>{notice.locations.length > 0 ? notice.locations.join(", ") : "Not specified"}</dd></div>
    </dl>
    <div className="provider-notice-products">
      <span className="eyebrow">Affected provider components</span>
      <div>
        {notice.products.length > 0 ? notice.products.map((product) => (
          <span className="provider-product" key={product.id} title={product.directoryServiceIds.length > 0 ? `Directory IDs: ${product.directoryServiceIds.join(", ")}` : "No explicit sla.directory mapping"}>
            {product.name}{product.directoryServiceIds.length > 0 ? <small>{product.directoryServiceIds.join(", ")}</small> : null}
          </span>
        )) : <span className="muted-inline">No product list was provided.</span>}
      </div>
    </div>
    {notice.affectedResources?.length ? (
      <div className="provider-notice-products">
        <span className="eyebrow">Account-affected resources</span>
        <div>
          {notice.affectedResources.slice(0, 6).map((resource) => (
            <span className="provider-product" key={`${resource.id}|${resource.arn ?? ""}`} title={resource.arn ?? resource.id}>
              {resource.id}{resource.status ? <small>{formatEnum(resource.status)}</small> : null}
            </span>
          ))}
          {notice.affectedResources.length > 6 ? <span className="muted-inline">+{notice.affectedResources.length - 6} more</span> : null}
        </div>
      </div>
    ) : null}
    {notice.affectedResources?.length ? (
      <div className={`provider-notice-correlation${correlation.matchedResourceCount > 0 ? " matched" : ""}`}>
        <strong>{correlation.matchedResourceCount > 0 ? "Exact Dynatrace overlap" : "No exact Smartscape resource match"}</strong>
        <span>{correlation.matchedResourceCount > 0
          ? `${correlation.matchedResourceCount} affected resource${correlation.matchedResourceCount === 1 ? "" : "s"} matched ${correlation.matchedServiceNames.length} Dynatrace service${correlation.matchedServiceNames.length === 1 ? "" : "s"}: ${correlation.matchedServiceNames.slice(0, 4).join(", ")}${correlation.matchedServiceNames.length > 4 ? ", …" : ""}.`
          : "AWS returned affected resource identifiers, but none matched the current Smartscape runtime identifiers. Account or region overlap alone is not treated as local impact."}</span>
        {correlation.matchedResourceCount > 0 ? <Link to="/">Review Coverage</Link> : null}
      </div>
    ) : null}
    {notice.url ? <a className="inline-action" href={notice.url} target="_blank" rel="noreferrer">Open provider status record</a> : null}
  </article>
);

export const ProviderNotices = ({ providerSlug, lookbackHours, topology = [], embedded = false }: ProviderNoticesProps) => {
  const source = useProviderNoticeSource(providerSlug, lookbackHours);
  const [selectedId, setSelectedId] = useState<string>();
  const response = source.response;
  const selected = response?.notices.find((notice) => notice.id === selectedId) ?? response?.notices[0];
  const selectedCorrelation = useMemo(
    () => selected ? correlateProviderNoticeToTopology(selected, topology) : { matches: [], matchedResourceCount: 0, matchedServiceNames: [] },
    [selected, topology],
  );

  useEffect(() => {
    if (response?.notices.length && !response.notices.some((notice) => notice.id === selectedId)) setSelectedId(response.notices[0].id);
  }, [response?.notices, selectedId]);

  const activeCount = response?.notices.filter((notice) => notice.state === "ACTIVE").length ?? 0;

  const content = (
    <>
      <div className="provider-notices-heading">
        <div>
          <Heading level={embedded ? 3 : 2}>{embedded ? "Provider reports" : "Evidence"}</Heading>
          <Paragraph>Review provider-owned events as supporting evidence. A report does not establish local impact.</Paragraph>
        </div>
        <div className="provider-notices-actions">
          {response ? <SourceLabel response={response} /> : null}
          {source.accountConnectionSupported && source.savedConnections.length > 0 ? (
            <select className="provider-notice-source-select" value={source.effectiveConnectionKey} onChange={(event) => source.setSourceConnectionKey(event.target.value)} aria-label={`${source.providerName} notice scope`}>
              {source.savedConnections.map((item) => <option key={item.objectId} value={item.connectionKey}>{item.displayName} · {providerConnectionScopeId(item)}{item.providerSlug === "oci" ? ` · ${item.region}` : ""}</option>)}
              {source.hasPublicSource ? <option value="public">Public {source.providerName} status</option> : null}
            </select>
          ) : null}
          {source.showHeaderSourceAction ? <Button as={Link} to="/settings/provider-connections" size="condensed">Manage sources</Button> : null}
        </div>
      </div>

      {!source.supported ? (
        <div className="provider-notices-empty">
          <strong>No provider-owned incident source is configured for this provider.</strong>
          <span>{providerSlug.toUpperCase()} remains available for published terms, service attribution, and Dynatrace incident review. Optional provider connections are managed separately in workspace settings.</span>
          <Button as={Link} to="/settings/provider-connections" size="condensed">Review provider connections</Button>
        </div>
      ) : !source.loading && source.configuredSourceRequired ? (
        <div className="provider-notices-empty"><strong>Connect an account-specific {source.providerName} source.</strong><span>{source.providerName} does not expose a credential-free public incident API used by this app. Add a read-only {source.connectionKind} connection to review provider-owned events. Dynatrace Problems and sla.directory terms remain available without it.</span><Button as={Link} to="/settings/provider-connections" size="condensed">Add {source.providerName} connection</Button></div>
      ) : !source.loading && source.error ? (
        <div className="error-box provider-notice-error"><strong>Provider evidence is unavailable.</strong><span>{source.error.message}</span><Button size="condensed" onClick={() => void source.refetch()}>Try again</Button></div>
      ) : source.loading || !response ? (
        <div className="provider-notices-empty" role="status"><strong>Reading provider evidence</strong><span>{source.connection ? `Checking the configured ${source.connectionKind} source.` : `Checking the public ${source.providerName} status source.`}</span></div>
      ) : response ? (
        <>
          <dl className="provider-notices-summary">
            <div><dt>Source</dt><dd>{response.sourceName}</dd></div>
            <div><dt>Scope</dt><dd>{source.sourceScope}</dd></div>
            <div><dt>Active</dt><dd>{activeCount}</dd></div>
            <div><dt>{source.currentStateOnly ? "Coverage" : "Lookback"}</dt><dd>{source.currentStateOnly ? "Current status" : formatEvidenceLookback(lookbackHours)}</dd></div>
          </dl>
          {response.warning ? <div className="provider-notice-warning" role="status"><strong>Source boundary</strong><span>{response.warning}</span></div> : null}
          {response.notices.length === 0 ? (
            <div className="provider-notices-empty"><strong>{source.currentStateOnly ? "No current public OCI disruptions were returned." : `No ${source.providerName} notices were returned in the selected window.`}</strong><span>This means the provider source returned no matching event. It does not establish that the monitored services were healthy.</span></div>
          ) : (
            <div className="provider-notices-layout">
              <aside className="provider-notice-queue" aria-label={`${source.providerName} provider evidence`}>
                <div className="provider-notice-queue-title"><strong>Notice queue</strong><span>{response.notices.length} returned</span></div>
                <div className="provider-notice-queue-list">
                  {response.notices.slice(0, 20).map((notice) => (
                    <button type="button" key={notice.id} className={`provider-notice-item${selected?.id === notice.id ? " selected" : ""}`} onClick={() => setSelectedId(notice.id)} aria-pressed={selected?.id === notice.id}>
                      <span><strong>{notice.title}</strong><small>{notice.products.slice(0, 2).map((product) => product.name).join(", ") || notice.id}</small></span>
                      <StatusPill tone={notice.state === "ACTIVE" ? "warning" : "neutral"}>{notice.state === "ACTIVE" ? "Active" : "Closed"}</StatusPill>
                    </button>
                  ))}
                </div>
              </aside>
              {selected ? <NoticeDetail notice={selected} providerName={response.providerName} correlation={selectedCorrelation} /> : null}
            </div>
          )}
        </>
      ) : null}

      <div className="provider-notices-boundary"><strong>Correlation boundary</strong><span>Provider-reported evidence can support a review. It does not prove that a Dynatrace service was affected or that a service credit is due.</span></div>
    </>
  );

  return embedded ? (
    <section className="provider-notices-panel provider-notices-embedded">
      {content}
    </section>
  ) : (
    <Surface className="panel-card provider-notices-panel">
      {content}
    </Surface>
  );
};
