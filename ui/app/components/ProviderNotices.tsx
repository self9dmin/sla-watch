import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAppFunction } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { useProviderConnections } from "../hooks/useProviderConnections";
import type { EvidenceLookbackHours, GcpProviderNoticesResponse, ProviderNotice } from "../types";
import { formatEvidenceLookback } from "../data/lookback";

type ProviderNoticesProps = {
  providerSlug: string;
  lookbackHours: EvidenceLookbackHours;
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

const SourceLabel = ({ response }: { response: GcpProviderNoticesResponse }) => {
  if (response.connectionState === "connected") return <StatusPill tone="positive">Project-specific</StatusPill>;
  if (response.connectionState === "fallback") return <StatusPill tone="warning">Public fallback</StatusPill>;
  return <StatusPill tone="neutral">Public status</StatusPill>;
};

const NoticeDetail = ({ notice }: { notice: ProviderNotice }) => (
  <article className="provider-notice-detail" aria-label={`Provider notice ${notice.title}`}>
    <div className="provider-notice-detail-heading">
      <div>
        <span className="provider-notice-id">Google Cloud notice · {notice.id}</span>
        <Heading level={3}>{notice.title}</Heading>
      </div>
      <StatusPill tone={notice.state === "ACTIVE" ? "warning" : "neutral"}>{formatEnum(notice.state)}</StatusPill>
    </div>
    <Paragraph>{notice.summary}</Paragraph>
    <dl className="provider-notice-facts">
      <div><dt>Relevance</dt><dd>{notice.source === "gcp-personalized" ? formatEnum(notice.relevance) : "Not project-specific"}</dd></div>
      <div><dt>Started</dt><dd>{formatDateTime(notice.startTime)}</dd></div>
      <div><dt>Last update</dt><dd>{formatDateTime(notice.updateTime)}</dd></div>
      <div><dt>Locations</dt><dd>{notice.locations.length > 0 ? notice.locations.join(", ") : "Not specified"}</dd></div>
    </dl>
    <div className="provider-notice-products">
      <span className="eyebrow">Affected Google products</span>
      <div>
        {notice.products.length > 0 ? notice.products.map((product) => (
          <span className="provider-product" key={product.id} title={product.directoryServiceIds.length > 0 ? `Directory IDs: ${product.directoryServiceIds.join(", ")}` : "No explicit sla.directory mapping"}>
            {product.name}{product.directoryServiceIds.length > 0 ? <small>{product.directoryServiceIds.join(", ")}</small> : null}
          </span>
        )) : <span className="muted-inline">No product list was provided.</span>}
      </div>
    </div>
    {notice.url ? <a className="inline-action" href={notice.url} target="_blank" rel="noreferrer">Open Google Cloud status record</a> : null}
  </article>
);

export const ProviderNotices = ({ providerSlug, lookbackHours }: ProviderNoticesProps) => {
  const connectionSettings = useProviderConnections();
  const connection = connectionSettings.connections.find((item) => item.providerSlug === "gcp" && item.enabled);
  const supported = providerSlug === "gcp";
  const request = useMemo(() => ({
    projectId: connection?.projectId,
    credentialId: connection?.credentialId,
    lookbackHours,
  }), [connection?.credentialId, connection?.projectId, lookbackHours]);
  const query = useAppFunction<GcpProviderNoticesResponse>(
    { name: "gcpServiceHealth", data: request, responseType: "json" },
    { autoFetch: false, autoFetchOnUpdate: false },
  );
  const requestKey = JSON.stringify(request);
  const requestedKey = useRef<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const selected = query.data?.notices.find((notice) => notice.id === selectedId) ?? query.data?.notices[0];

  useEffect(() => {
    if (!supported || connectionSettings.loading || requestedKey.current === requestKey) return;
    requestedKey.current = requestKey;
    void query.refetch();
  }, [connectionSettings.loading, query, requestKey, supported]);

  useEffect(() => {
    if (query.data?.notices.length && !query.data.notices.some((notice) => notice.id === selectedId)) setSelectedId(query.data.notices[0].id);
  }, [query.data?.notices, selectedId]);

  const activeCount = query.data?.notices.filter((notice) => notice.state === "ACTIVE").length ?? 0;

  return (
    <Surface className="panel-card provider-notices-panel">
      <div className="provider-notices-heading">
        <div>
          <Heading level={2}>Provider notices</Heading>
          <Paragraph>Review provider-owned service health separately from Dynatrace-observed Problems.</Paragraph>
        </div>
        <div className="provider-notices-actions">
          {query.data ? <SourceLabel response={query.data} /> : null}
          <Button as={Link} to="/settings/provider-connections" size="condensed">Configure source</Button>
        </div>
      </div>

      {!supported ? (
        <div className="provider-notices-empty">
          <strong>No provider-owned incident source is configured for this provider.</strong>
          <span>{providerSlug.toUpperCase()} remains available for SLA terms, service attribution, and Dynatrace incident review. Optional provider connections are separate from monitored-provider setup.</span>
          <Button as={Link} to="/settings/provider-connections" size="condensed">Review provider connections</Button>
        </div>
      ) : connectionSettings.loading || query.isLoading || query.status === "not-requested" ? (
        <div className="provider-notices-empty" role="status"><strong>Reading provider notices</strong><span>Checking the configured project or the public Google Cloud status feed.</span></div>
      ) : query.error ? (
        <div className="error-box provider-notice-error"><strong>Provider notices are unavailable.</strong><span>{query.error.message}</span><Button size="condensed" onClick={() => void query.refetch()}>Try again</Button></div>
      ) : query.data ? (
        <>
          <dl className="provider-notices-summary">
            <div><dt>Source</dt><dd>{query.data.connectionState === "connected" ? "Personalized Service Health" : "Google Cloud Status"}</dd></div>
            <div><dt>Scope</dt><dd>{query.data.projectId ?? "Public"}</dd></div>
            <div><dt>Active</dt><dd>{activeCount}</dd></div>
            <div><dt>Lookback</dt><dd>{formatEvidenceLookback(lookbackHours)}</dd></div>
          </dl>
          {query.data.warning ? <div className="provider-notice-warning" role="status"><strong>Source boundary</strong><span>{query.data.warning}</span></div> : null}
          {query.data.notices.length === 0 ? (
            <div className="provider-notices-empty"><strong>No Google Cloud notices were returned in the selected window.</strong><span>This means the provider source returned no matching event. It does not establish that the monitored services were healthy.</span></div>
          ) : (
            <div className="provider-notices-layout">
              <aside className="provider-notice-queue" aria-label="Google Cloud provider notices">
                <div className="provider-notice-queue-title"><strong>Notice queue</strong><span>{query.data.notices.length} returned</span></div>
                <div className="provider-notice-queue-list">
                  {query.data.notices.slice(0, 20).map((notice) => (
                    <button type="button" key={notice.id} className={`provider-notice-item${selected?.id === notice.id ? " selected" : ""}`} onClick={() => setSelectedId(notice.id)} aria-pressed={selected?.id === notice.id}>
                      <span><strong>{notice.title}</strong><small>{notice.products.slice(0, 2).map((product) => product.name).join(", ") || notice.id}</small></span>
                      <StatusPill tone={notice.state === "ACTIVE" ? "warning" : "neutral"}>{notice.state === "ACTIVE" ? "Active" : "Closed"}</StatusPill>
                    </button>
                  ))}
                </div>
              </aside>
              {selected ? <NoticeDetail notice={selected} /> : null}
            </div>
          )}
        </>
      ) : null}

      <div className="provider-notices-boundary"><strong>Correlation boundary</strong><span>A provider notice can support a review. It does not prove that a Dynatrace service was affected or that an SLA credit is due.</span></div>
    </Surface>
  );
};
