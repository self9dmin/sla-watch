import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppFunction } from "@dynatrace-sdk/react-hooks";
import type {
  AwsProviderNoticesResponse,
  AzureProviderNoticesResponse,
  EvidenceLookbackHours,
  GcpProviderNoticesResponse,
  OciProviderNoticesResponse,
  ProviderNoticesResponse,
  PublicProviderNoticesResponse,
} from "../types";
import { providerConnectionScopeId } from "../data/providerConnections";
import { providerDisplayName } from "../data/providers";
import { useProviderConnections } from "./useProviderConnections";

const PUBLIC_STATUS_PROVIDERS = new Set([
  "oci",
  "openai",
  "anthropic",
  "elevenlabs",
]);

export const useProviderNoticeSource = (
  providerSlug: string,
  lookbackHours: EvidenceLookbackHours,
) => {
  const connectionSettings = useProviderConnections();
  const savedConnections = useMemo(
    () => connectionSettings.connections
      .filter((item) => item.providerSlug === providerSlug && item.enabled)
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    [connectionSettings.connections, providerSlug],
  );
  const [sourceConnectionKey, setSourceConnectionKey] = useState("auto");
  const hasPublicSource = providerSlug === "gcp" ||
    PUBLIC_STATUS_PROVIDERS.has(providerSlug);
  const defaultConnectionKey = savedConnections[0]?.connectionKey ??
    (hasPublicSource ? "public" : "unconfigured");
  const effectiveConnectionKey = sourceConnectionKey === "auto"
    ? defaultConnectionKey
    : (sourceConnectionKey === "public" && hasPublicSource) ||
      savedConnections.some((item) => item.connectionKey === sourceConnectionKey)
      ? sourceConnectionKey
      : defaultConnectionKey;
  const connection = savedConnections.find(
    (item) => item.connectionKey === effectiveConnectionKey,
  );
  const awsSupported = providerSlug === "aws";
  const azureSupported = providerSlug === "azure";
  const gcpSupported = providerSlug === "gcp";
  const ociSupported = providerSlug === "oci";
  const accountConnectionSupported = awsSupported || azureSupported ||
    gcpSupported || ociSupported;
  const publicSupported = PUBLIC_STATUS_PROVIDERS.has(providerSlug);
  const supported = accountConnectionSupported || publicSupported;
  const configuredSourceRequired = (awsSupported || azureSupported) &&
    !connection;
  const providerName = providerDisplayName(providerSlug);
  const connectionKind = awsSupported
    ? "account"
    : azureSupported
      ? "subscription"
      : ociSupported
        ? "tenancy"
        : "project";

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
  }), [
    connection?.credentialId,
    connection?.region,
    connection?.tenancyId,
    lookbackHours,
  ]);
  const publicRequest = useMemo(
    () => ({ providerSlug, lookbackHours }),
    [lookbackHours, providerSlug],
  );
  const gcpQuery = useAppFunction<GcpProviderNoticesResponse>(
    { name: "gcpServiceHealth", data: gcpRequest, responseType: "json" },
    { autoFetch: false, autoFetchOnUpdate: false },
  );
  const publicQuery = useAppFunction<PublicProviderNoticesResponse>(
    {
      name: "providerPublicStatus",
      data: publicRequest,
      responseType: "json",
    },
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
    {
      name: "azureServiceHealth",
      data: azureRequest,
      responseType: "json",
    },
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
  const response = query.data?.provider === providerSlug
    ? query.data as ProviderNoticesResponse
    : undefined;

  const refetch = useCallback(async () => {
    if (awsSupported && connection) await awsQuery.refetch();
    else if (azureSupported && connection) await azureQuery.refetch();
    else if (gcpSupported) await gcpQuery.refetch();
    else if (ociSupported && connection) await ociQuery.refetch();
    else await publicQuery.refetch();
  }, [
    awsQuery,
    awsSupported,
    azureQuery,
    azureSupported,
    connection,
    gcpQuery,
    gcpSupported,
    ociQuery,
    ociSupported,
    publicQuery,
  ]);

  useEffect(() => {
    setSourceConnectionKey("auto");
  }, [providerSlug]);

  useEffect(() => {
    if (
      !supported ||
      configuredSourceRequired ||
      (accountConnectionSupported && connectionSettings.loading) ||
      requestedKey.current === requestKey
    ) return;
    requestedKey.current = requestKey;
    void refetch();
  }, [
    accountConnectionSupported,
    configuredSourceRequired,
    connectionSettings.loading,
    refetch,
    requestKey,
    supported,
  ]);

  return {
    response,
    loading: (accountConnectionSupported && connectionSettings.loading) ||
      query.isLoading,
    error: query.error,
    refetch,
    sourceConnectionKey,
    setSourceConnectionKey,
    effectiveConnectionKey,
    savedConnections,
    connection,
    hasPublicSource,
    accountConnectionSupported,
    supported,
    configuredSourceRequired,
    providerName,
    connectionKind,
    sourceScope: connection?.displayName ?? response?.scopeLabel ??
      response?.projectId ?? "Public provider status",
    sourceScopeId: connection ? providerConnectionScopeId(connection) : null,
    currentStateOnly: providerSlug === "oci" && response?.source === "public",
    showHeaderSourceAction: !configuredSourceRequired && supported && Boolean(
      response || savedConnections.length > 0 || hasPublicSource,
    ),
  };
};
