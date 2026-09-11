import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { monitoredEntitiesCustomTagsClient } from "@dynatrace-sdk/client-classic-environment-v2";
import { effectivePermissionsClient } from "@dynatrace-sdk/client-platform-management-service";
import { Button } from "@dynatrace/strato-components/buttons";
import type { ProviderCandidate, ServiceRecord } from "../types";
import { buildEntityIdSelector, providerTagValues, providerTagWriteIssue } from "../data/providerTags";

type PermissionState = "checking" | "granted" | "conditional" | "denied" | "unavailable";
type ReviewStep = "summary" | "select" | "confirm";
type LastChange = { ids: string[]; count: number; key: string; value: string };
type WriteFeedback = { tone: "positive" | "warning"; title: string; detail: string; code?: number };

const permissionCopy: Record<PermissionState, string> = {
  checking: "Checking role access",
  granted: "Role check passed",
  conditional: "Role check is management-zone limited",
  denied: "Read-only for your role",
  unavailable: "Write access is unverified",
};

export const ProviderTagSetup = ({
  services,
  providerName,
  providerSlug,
  providerTagKey,
  providerCandidates,
  topologyLoading,
  topologyError,
  loading,
  onRefresh,
}: {
  services: ServiceRecord[];
  providerName: string;
  providerSlug: string;
  providerTagKey: string;
  providerCandidates: ProviderCandidate[];
  topologyLoading: boolean;
  topologyError?: Error;
  loading: boolean;
  onRefresh: () => void | Promise<unknown>;
}) => {
  const location = useLocation();
  const [permission, setPermission] = useState<PermissionState>("checking");
  const [step, setStep] = useState<ReviewStep>("summary");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [writing, setWriting] = useState(false);
  const [feedback, setFeedback] = useState<WriteFeedback | null>(null);
  const [lastChange, setLastChange] = useState<LastChange | null>(null);

  useEffect(() => {
    let mounted = true;
    void effectivePermissionsClient.resolveEffectivePermissions({
      body: { permissions: [{ permission: "environment-api:entities:write" }] },
    }).then((result) => {
      if (!mounted) return;
      const granted = result[0]?.granted;
      setPermission(granted === "true" ? "granted" : granted === "condition" ? "conditional" : "denied");
    }).catch(() => {
      if (mounted) setPermission("unavailable");
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setStep("summary");
    setSelectedIds([]);
    setFeedback(null);
    setLastChange(null);
  }, [providerSlug, providerTagKey]);

  useEffect(() => {
    const review = new URLSearchParams(location.search).get("review");
    if ((review === "provider" || location.hash === "#provider-mapping" || location.hash === "#provider-service-tags") && services.length > 0) setStep("select");
  }, [location.hash, location.search, services.length]);

  const rows = useMemo(() => services.map((service) => {
    const values = providerTagValues(service.tags, providerTagKey, providerSlug);
    const matched = values.includes(providerSlug.toLowerCase());
    const conflicting = values.length > 0 && !matched;
    const candidate = providerCandidates.find((item) => item.serviceId === service.id);
    return { service, values, matched, conflicting, candidate, selectable: !matched && !conflicting };
  }), [providerCandidates, providerSlug, providerTagKey, services]);

  const matchedCount = rows.filter((row) => row.matched).length;
  const suggestedRows = rows.filter((row) => row.selectable && row.candidate);
  const selectedRows = rows.filter((row) => selectedIds.includes(row.service.id));
  const selectedSuggestedCount = selectedRows.filter((row) => row.candidate).length;
  const canWrite = permission === "granted" || permission === "conditional";
  const tagText = `${providerTagKey}:${providerSlug}`;

  const toggleService = (serviceId: string) => {
    setSelectedIds((current) => current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId]);
    setFeedback(null);
  };

  const toggleAll = () => {
    const suggestedIds = suggestedRows.map((row) => row.service.id);
    setSelectedIds(suggestedIds.length > 0 && suggestedIds.every((id) => selectedIds.includes(id)) ? selectedIds.filter((id) => !suggestedIds.includes(id)) : Array.from(new Set([...selectedIds, ...suggestedIds])));
    setFeedback(null);
  };

  const applyTag = async () => {
    if (!canWrite || selectedRows.length === 0 || writing) return;
    const ids = selectedRows.map((row) => row.service.id);
    setWriting(true);
    setFeedback(null);
    try {
      const result = await monitoredEntitiesCustomTagsClient.postTags({
        entitySelector: buildEntityIdSelector(ids),
        body: { tags: [{ key: providerTagKey.trim(), value: providerSlug.trim() }] },
      });
      const count = result.matchedEntitiesCount;
      if (count === undefined) {
        setFeedback({
          tone: "warning",
          title: "Tag request accepted without a confirmed result",
          detail: "Dynatrace did not report how many services changed. Refresh the inventory and verify the selected services before trying again.",
        });
        await onRefresh();
        return;
      }
      if (count === 0) {
        setFeedback({
          tone: "warning",
          title: "No services were updated",
          detail: "The selected service entities no longer matched the Dynatrace request. Refresh the inventory and review the selection.",
        });
        await onRefresh();
        return;
      }
      setLastChange({ ids, count, key: providerTagKey.trim(), value: providerSlug.trim() });
      setFeedback(count === ids.length
        ? { tone: "positive", title: "Provider tag applied", detail: `${tagText} was added to ${count} service${count === 1 ? "" : "s"}.` }
        : { tone: "warning", title: "Provider tag applied to part of the selection", detail: `${tagText} was added to ${count} of ${ids.length} selected services. Management-zone access may have limited the result.` });
      setSelectedIds([]);
      setStep("summary");
      await onRefresh();
    } catch (error) {
      const issue = providerTagWriteIssue(error);
      setFeedback({ tone: "warning", ...issue });
    } finally {
      setWriting(false);
    }
  };

  const undoLastChange = async () => {
    if (!lastChange || writing) return;
    setWriting(true);
    setFeedback(null);
    try {
      await monitoredEntitiesCustomTagsClient.deleteTags({
        entitySelector: buildEntityIdSelector(lastChange.ids),
        key: lastChange.key,
        value: lastChange.value,
        deleteAllWithKey: false,
      });
      setFeedback({
        tone: "positive",
        title: "Last provider tag change removed",
        detail: `${lastChange.key}:${lastChange.value} was removed from the services changed in the last action.`,
      });
      setLastChange(null);
      await onRefresh();
    } catch (error) {
      const issue = providerTagWriteIssue(error);
      setFeedback({ tone: "warning", ...issue });
    } finally {
      setWriting(false);
    }
  };

  return (
    <section className="provider-setup" id="provider-service-tags" aria-labelledby="provider-service-tags-title">
      <div className="setup-section-heading">
        <div>
          <h3 id="provider-service-tags-title">Provider service tags</h3>
          <p>Add a reusable <code>{tagText}</code> tag only to services that depend on {providerName}. Scope map confirmations already work inside the app.</p>
        </div>
        <span className={`status-pill ${matchedCount > 0 ? "status-pill-positive" : "status-pill-warning"}`}>
          {loading ? "Checking" : `${matchedCount} of ${services.length} mapped`}
        </span>
      </div>

      <dl className="provider-rule-summary">
        <div><dt>Dynatrace tag</dt><dd><code>{tagText}</code></dd></div>
        <div><dt>Smartscape candidates</dt><dd>{topologyLoading ? "Checking" : `${suggestedRows.length} found`}</dd></div>
        <div><dt>Write access</dt><dd>{permissionCopy[permission]}</dd></div>
      </dl>

      {step === "summary" ? (
        <div className="provider-setup-actions">
          <Button size="condensed" variant="emphasized" disabled={loading || services.length === 0} onClick={() => setStep("select")}>{suggestedRows.length > 0 ? `Review ${suggestedRows.length} candidate${suggestedRows.length === 1 ? "" : "s"}` : "Review services"}</Button>
          <Link className="text-action" to="/settings/watch">Change matching rule</Link>
          <span>{topologyError ? "Smartscape suggestions are unavailable. Manual assignment remains available." : "No tag is added until you select exact services and confirm the change."}</span>
        </div>
      ) : null}

      {step === "select" ? (
        <div className="provider-service-review">
          <div className="provider-service-toolbar">
            <label>
              <input
                type="checkbox"
                checked={suggestedRows.length > 0 && suggestedRows.every((row) => selectedIds.includes(row.service.id))}
                onChange={toggleAll}
                disabled={suggestedRows.length === 0}
              />
              {suggestedRows.length > 0 ? `Select ${suggestedRows.length} Smartscape candidate${suggestedRows.length === 1 ? "" : "s"}` : "No Smartscape candidates"}
            </label>
            <span>{selectedIds.length} selected</span>
          </div>
          <div className="provider-service-list" role="list" aria-label={`Services available for ${providerName} mapping`}>
            {rows.map(({ service, values, matched, conflicting, candidate, selectable }) => (
              <label className={`provider-service-row${selectable ? "" : " provider-service-row-disabled"}`} key={service.id}>
                <input type="checkbox" checked={selectedIds.includes(service.id)} disabled={!selectable} onChange={() => toggleService(service.id)} />
                <span className="provider-service-name"><strong>{service.name}</strong><small>{service.id}</small></span>
                <span className={`provider-service-state ${matched ? "positive" : conflicting ? "warning" : candidate ? "candidate" : "neutral"}`}>
                  <strong>{matched ? `Confirmed ${providerName}` : conflicting ? `Review ${values.join(", ")}` : candidate ? `${providerName} candidate` : "Unassigned"}</strong>
                  {candidate ? <small title={candidate.evidence.join("; ")}>{candidate.runtimeNames.slice(0, 2).join(", ")}</small> : null}
                </span>
              </label>
            ))}
          </div>
          <div className="provider-review-actions">
            <Button size="condensed" onClick={() => { setStep("summary"); setSelectedIds([]); }}>Cancel</Button>
            <Button size="condensed" variant="emphasized" disabled={selectedIds.length === 0} onClick={() => setStep("confirm")}>Review change</Button>
          </div>
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="provider-confirmation" role="region" aria-label="Confirm provider tag change">
          <strong>Add <code>{tagText}</code> to {selectedRows.length} selected service{selectedRows.length === 1 ? "" : "s"}?</strong>
          <p>{selectedSuggestedCount > 0 ? `${selectedSuggestedCount} selection${selectedSuggestedCount === 1 ? " has" : "s have"} supporting Smartscape runtime metadata. ` : ""}Review remains required because topology identifies hosting context, not provider fault or credit eligibility.</p>
          <p>Existing tags remain in place. The new tag can be used by Dynatrace dashboards, alerts, maintenance windows, management zones, and workflows.</p>
          {permission === "granted" ? <p>The role check passed. Dynatrace still validates the app scope and Manage monitoring settings permission when the change is submitted.</p> : null}
          {permission === "conditional" ? <p>Your permission is limited by management zone. Dynatrace may update fewer services than selected.</p> : null}
          {!canWrite ? <p>Your current role cannot apply this change. Ask a tenant administrator for entity-settings permission.</p> : null}
          <div className="provider-review-actions">
            <Button size="condensed" onClick={() => setStep("select")}>Back</Button>
            <Button size="condensed" variant="emphasized" disabled={!canWrite || writing} onClick={() => void applyTag()}>{writing ? "Applying tag" : "Apply provider tag"}</Button>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div className={`provider-write-message provider-write-message-${feedback.tone}`} role={feedback.tone === "warning" ? "alert" : "status"}>
          <div><strong>{feedback.title}{feedback.code ? ` (${feedback.code})` : ""}</strong><span>{feedback.detail}</span></div>
          {lastChange ? <Button size="condensed" disabled={writing} onClick={() => void undoLastChange()}>Undo last change</Button> : null}
        </div>
      ) : null}
    </section>
  );
};
