import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAppFunction } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { useProviderConnections } from "../hooks/useProviderConnections";
import type { AwsProviderNoticesResponse, AzureProviderNoticesResponse, EvidenceLookbackHours, GcpProviderNoticesResponse, OciProviderNoticesResponse, ProviderNotice, ProviderNoticesResponse, PublicProviderNoticesResponse } from "../types";
import { formatEvidenceLookback } from "../data/lookback";
import { providerConnectionScopeId } from "../data/providerConnections";
import { providerDisplayName } from "../data/providers";

type ProviderNoticesProps = {
  providerSlug: string;
  lookbackHours: EvidenceLookbackHours;
};

type Tone = "neutral" | "warning" | "positive";

const PUBLIC_STATUS_PROVIDERS = new Set(["oci", "openai", "anthropic", "elevenlabs"]);

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

const NoticeDetail = ({ notice, providerName }: { notice: ProviderNotice; providerName: string }) => (
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
    {notice.url ? <a className="inline-action" href={notice.url} target="_blank" rel="noreferrer">Open provider status record</a> : null}
  </article>
);

export const ProviderNotices = ({ providerSlug, lookbackHours }: ProviderNoticesProps) => {
  const connectionSettings = useProviderConnections();
  const savedConnections = useMemo(() => connectionSettings.connections
    .filter((item) => item.providerSlug === providerSlug && item.enabled)
    .sort((left, right) => left.displayName.localeCompare(right.displayName)), [connectionSettings.connections, providerSlug]);
  const [sourceConnectionKey, setSourceConnectionKey] = useState("auto");
  const hasPublicSource = providerSlug === "gcp" || PUBLIC_STATUS_PROVIDERS.has(providerSlug);
  const defaultConnectionKey = savedConnections[0]?.connectionKey ?? (hasPublicSource ? "public" : "unconfigured");
  const effectiveConnectionKey = sourceConnectionKey === "auto"
    ? defaultConnectionKey
    : (sourceConnectionKey === "public" && hasPublicSource) || savedConnections.some((item) => item.connectionKey === sourceConnectionKey)
      ? sourceConnectionKey
      : defaultConnectionKey;
  const connection = savedConnections.find((item) => item.connectionKey === effectiveConnectionKey);
  const awsSupported = providerSlug === "aws";
  const azureSupported = providerSlug === "azure";
  const gcpSupported = providerSlug === "gcp";
  const ociSupported = providerSlug === "oci";
  const accountConnectionSupported = awsSupported || azureSupported || gcpSupported || ociSupported;
  const publicSupported = PUBLIC_STATUS_PROVIDERS.has(providerSlug);
  const supported = accountConnectionSupported || publicSupported;
  const configuredSourceRequired = (awsSupported || azureSupported) && !connection;
  const providerName = providerDisplayName(providerSlug);
  const awsRequest = useMemo(() => ({
    accountId: connection?.accountId,
    credentialId: connection?.credentialId,
    lookbackHours,
  }), [connection?.accountId, connection?.credentialId, lookbackHours]);
  const azureRequest = useMemo(() => ({
    subscriptionId: connection?.subscriptionId,
    credentialId: connection?.credentialId,
    lookbackHours,
  }), [connection?.credentialId, connection?.subscriptionId, lookbackHours]);
  const gcpRequest = useMemo(() => ({
    projectId: connection?.projectId,
    credentialId: connection?.credentialId,
    lookbackHours,
  }), [connection?.credentialId, connection?.projectId, lookbackHours]);
  const ociRequest = useMemo(() => ({
    tenancyId: connection?.tenancyId,
    region: connection?.region,
    credentialId: connection?.credentialId,
    lookbackHours,
  }), [connection?.credentialId, connection?.region, connection?.tenancyId, lookbackHours]);
  const publicRequest = useMemo(() => ({ providerSlug, lookbackHours }), [lookbackHours, providerSlug]);
  const gcpQuery = useAppFunction<GcpProviderNoticesResponse>(
    { name: "gcpServiceHealth", data: gcpRequest, responseType: "json" },
    { autoFetch: false, autoFetchOnUpdate: false },
  );
  const publicQuery = useAppFunction<PublicProviderNoticesResponse>(
    { name: "providerPublicStatus", data: publicRequest, responseType: "json" },
    { autoFetch: false, autoFetchOnUpdate: false },
  );
  const ociQuery = useAppFunction<OciProviderNoticesResponse>(
    { name: "ociAnnouncements", data: ociRequest, responseType: "json" },
    { autoFetch: false, autoFetchOnUpdate: false },
  );
  const awsQuery = useAppFunction<AwsProviderNoticesResponse>(
    { name: "awsHealth", data: awsRequest, responseType: "json" },
    { autoFetch: false, autoFetchOnUpdate: false },
  );
  const azureQuery = useAppFunction<AzureProviderNoticesResponse>(
    { name: "azureServiceHealth", data: azureRequest, responseType: "json" },
    { autoFetch: false, autoFetchOnUpdate: false },
  );
  const query = awsSupported && connection
    ? awsQuery
    : azureSupported && connection
      ? azureQuery
      : gcpSupported
        ? gcpQuery
        : ociSupported && connection
          ? ociQuery
          : publicQuery;
  const activeRequest = awsSupported && connection
    ? awsRequest
    : azureSupported && connection
      ? azureRequest
      : gcpSupported
        ? gcpRequest
        : ociSupported && connection
          ? ociRequest
          : publicRequest;
  const requestKey = `${providerSlug}:${effectiveConnectionKey}:${JSON.stringify(activeRequest)}`;
  const requestedKey = useRef<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const response = query.data?.provider === providerSlug ? query.data : undefined;
  const selected = response?.notices.find((notice) => notice.id === selectedId) ?? response?.notices[0];

  useEffect(() => {
    setSourceConnectionKey("auto");
  }, [providerSlug]);

  useEffect(() => {
    if (!supported || configuredSourceRequired || (accountConnectionSupported && connectionSettings.loading) || requestedKey.current === requestKey) return;
    requestedKey.current = requestKey;
    if (awsSupported && connection) void awsQuery.refetch();
    else if (azureSupported && connection) void azureQuery.refetch();
    else if (gcpSupported) void gcpQuery.refetch();
    else if (ociSupported && connection) void ociQuery.refetch();
    else void publicQuery.refetch();
  }, [accountConnectionSupported, awsQuery, awsSupported, azureQuery, azureSupported, configuredSourceRequired, connection, connectionSettings.loading, gcpQuery, gcpSupported, ociQuery, ociSupported, publicQuery, requestKey, supported]);

  useEffect(() => {
    if (response?.notices.length && !response.notices.some((notice) => notice.id === selectedId)) setSelectedId(response.notices[0].id);
  }, [response?.notices, selectedId]);

  const activeCount = response?.notices.filter((notice) => notice.state === "ACTIVE").length ?? 0;
  const currentStateOnly = providerSlug === "oci" && response?.source === "public";
  const sourceScope = connection?.displayName ?? response?.scopeLabel ?? response?.projectId ?? "Public provider status";
  const connectionKind = awsSupported ? "account" : azureSupported ? "subscription" : ociSupported ? "tenancy" : "project";

  return (
    <Surface className="panel-card provider-notices-panel">
      <div className="provider-notices-heading">
        <div>
          <Heading level={2}>Provider notices</Heading>
          <Paragraph>Review provider-owned service health separately from Dynatrace-observed Problems.</Paragraph>
        </div>
        <div className="provider-notices-actions">
          {response ? <SourceLabel response={response} /> : null}
          {accountConnectionSupported && savedConnections.length > 0 ? (
            <select className="provider-notice-source-select" value={effectiveConnectionKey} onChange={(event) => setSourceConnectionKey(event.target.value)} aria-label={`${providerName} notice scope`}>
              {savedConnections.map((item) => <option key={item.objectId} value={item.connectionKey}>{item.displayName} · {providerConnectionScopeId(item)}{item.providerSlug === "oci" ? ` · ${item.region}` : ""}</option>)}
              {hasPublicSource ? <option value="public">Public {providerName} status</option> : null}
            </select>
          ) : null}
          <Button as={Link} to="/settings/provider-connections" size="condensed">{accountConnectionSupported ? "Configure source" : "Source details"}</Button>
        </div>
      </div>

      {!supported ? (
        <div className="provider-notices-empty">
          <strong>No provider-owned incident source is configured for this provider.</strong>
          <span>{providerSlug.toUpperCase()} remains available for SLA terms, service attribution, and Dynatrace incident review. Optional provider connections are separate from monitored-provider setup.</span>
          <Button as={Link} to="/settings/provider-connections" size="condensed">Review provider connections</Button>
        </div>
      ) : !(accountConnectionSupported && connectionSettings.loading) && configuredSourceRequired ? (
        <div className="provider-notices-empty"><strong>Connect an account-specific {providerName} source.</strong><span>{providerName} does not expose a credential-free public incident API used by this app. Add a read-only {connectionKind} connection to review provider-owned events. Dynatrace Problems and sla.directory terms remain available without it.</span><Button as={Link} to="/settings/provider-connections" size="condensed">Add {providerName} connection</Button></div>
      ) : !(accountConnectionSupported && connectionSettings.loading) && query.error ? (
        <div className="error-box provider-notice-error"><strong>Provider notices are unavailable.</strong><span>{query.error.message}</span><Button size="condensed" onClick={() => void query.refetch()}>Try again</Button></div>
      ) : (accountConnectionSupported && connectionSettings.loading) || query.isLoading || !response ? (
        <div className="provider-notices-empty" role="status"><strong>Reading provider notices</strong><span>{connection ? `Checking the configured ${connectionKind} source.` : `Checking the public ${providerName} status source.`}</span></div>
      ) : response ? (
        <>
          <dl className="provider-notices-summary">
            <div><dt>Source</dt><dd>{response.sourceName}</dd></div>
            <div><dt>Scope</dt><dd>{sourceScope}</dd></div>
            <div><dt>Active</dt><dd>{activeCount}</dd></div>
            <div><dt>{currentStateOnly ? "Coverage" : "Lookback"}</dt><dd>{currentStateOnly ? "Current status" : formatEvidenceLookback(lookbackHours)}</dd></div>
          </dl>
          {response.warning ? <div className="provider-notice-warning" role="status"><strong>Source boundary</strong><span>{response.warning}</span></div> : null}
          {response.notices.length === 0 ? (
            <div className="provider-notices-empty"><strong>{currentStateOnly ? "No current public OCI disruptions were returned." : `No ${providerName} notices were returned in the selected window.`}</strong><span>This means the provider source returned no matching event. It does not establish that the monitored services were healthy.</span></div>
          ) : (
            <div className="provider-notices-layout">
              <aside className="provider-notice-queue" aria-label={`${providerName} provider notices`}>
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
              {selected ? <NoticeDetail notice={selected} providerName={response.providerName} /> : null}
            </div>
          )}
        </>
      ) : null}

      <div className="provider-notices-boundary"><strong>Correlation boundary</strong><span>A provider notice can support a review. It does not prove that a Dynatrace service was affected or that an SLA credit is due.</span></div>
    </Surface>
  );
};
