import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { monitoredEntitiesCustomTagsClient } from "@dynatrace-sdk/client-classic-environment-v2";
import { effectivePermissionsClient } from "@dynatrace-sdk/client-platform-management-service";
import { Button } from "@dynatrace/strato-components/buttons";
import type { ServiceRecord } from "../types";
import { buildEntityIdSelector, providerTagValues } from "../data/providerTags";

type PermissionState = "checking" | "granted" | "conditional" | "denied" | "unavailable";
type ReviewStep = "summary" | "select" | "confirm";
type LastChange = { ids: string[]; count: number; key: string; value: string };

const permissionCopy: Record<PermissionState, string> = {
  checking: "Checking tag permission",
  granted: "Tag changes available",
  conditional: "Tag access is management-zone limited",
  denied: "Read-only for your role",
  unavailable: "Tag permission could not be verified",
};

const friendlyWriteError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : "";
  if (/403|forbidden|permission|unauthor/i.test(message)) {
    return "Dynatrace denied the tag change. Ask an administrator for permission to manage entity settings.";
  }
  return "Dynatrace did not apply the tag. No existing tags were changed. Refresh the service inventory and try again.";
};

export const ProviderTagSetup = ({
  services,
  providerName,
  providerSlug,
  providerTagKey,
  loading,
  onRefresh,
}: {
  services: ServiceRecord[];
  providerName: string;
  providerSlug: string;
  providerTagKey: string;
  loading: boolean;
  onRefresh: () => void | Promise<unknown>;
}) => {
  const [permission, setPermission] = useState<PermissionState>("checking");
  const [step, setStep] = useState<ReviewStep>("summary");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
    setMessage(null);
    setLastChange(null);
  }, [providerSlug, providerTagKey]);

  const rows = useMemo(() => services.map((service) => {
    const values = providerTagValues(service.tags, providerTagKey, providerSlug);
    const matched = values.includes(providerSlug.toLowerCase());
    const conflicting = values.length > 0 && !matched;
    return { service, values, matched, conflicting, selectable: !matched && !conflicting };
  }), [providerSlug, providerTagKey, services]);

  const matchedCount = rows.filter((row) => row.matched).length;
  const selectableRows = rows.filter((row) => row.selectable);
  const selectedRows = rows.filter((row) => selectedIds.includes(row.service.id));
  const canWrite = permission === "granted" || permission === "conditional";
  const tagText = `${providerTagKey}:${providerSlug}`;

  const toggleService = (serviceId: string) => {
    setSelectedIds((current) => current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId]);
    setMessage(null);
  };

  const toggleAll = () => {
    const selectableIds = selectableRows.map((row) => row.service.id);
    setSelectedIds(selectedIds.length === selectableIds.length ? [] : selectableIds);
    setMessage(null);
  };

  const applyTag = async () => {
    if (!canWrite || selectedRows.length === 0 || writing) return;
    const ids = selectedRows.map((row) => row.service.id);
    setWriting(true);
    setMessage(null);
    try {
      const result = await monitoredEntitiesCustomTagsClient.postTags({
        entitySelector: buildEntityIdSelector(ids),
        body: { tags: [{ key: providerTagKey.trim(), value: providerSlug.trim() }] },
      });
      const count = result.matchedEntitiesCount ?? ids.length;
      setLastChange({ ids, count, key: providerTagKey.trim(), value: providerSlug.trim() });
      setMessage(count === ids.length
        ? `${tagText} was added to ${count} service${count === 1 ? "" : "s"}.`
        : `${tagText} was added to ${count} of ${ids.length} selected services. Your access may be limited.`);
      setSelectedIds([]);
      setStep("summary");
      await onRefresh();
    } catch (error) {
      setMessage(friendlyWriteError(error));
    } finally {
      setWriting(false);
    }
  };

  const undoLastChange = async () => {
    if (!lastChange || writing) return;
    setWriting(true);
    setMessage(null);
    try {
      await monitoredEntitiesCustomTagsClient.deleteTags({
        entitySelector: buildEntityIdSelector(lastChange.ids),
        key: lastChange.key,
        value: lastChange.value,
        deleteAllWithKey: false,
      });
      setMessage(`${lastChange.key}:${lastChange.value} was removed from the services changed in the last action.`);
      setLastChange(null);
      await onRefresh();
    } catch (error) {
      setMessage(friendlyWriteError(error));
    } finally {
      setWriting(false);
    }
  };

  return (
    <section className="provider-setup" id="provider-mapping" aria-labelledby="provider-mapping-title">
      <div className="setup-section-heading">
        <div>
          <h3 id="provider-mapping-title">Provider mapping</h3>
          <p>Identify only the services that depend on {providerName}. Service names are not used as proof.</p>
        </div>
        <span className={`status-pill ${matchedCount > 0 ? "status-pill-positive" : "status-pill-warning"}`}>
          {loading ? "Checking" : `${matchedCount} of ${services.length} mapped`}
        </span>
      </div>

      <dl className="provider-rule-summary">
        <div><dt>Dynatrace tag</dt><dd><code>{tagText}</code></dd></div>
        <div><dt>Write access</dt><dd>{permissionCopy[permission]}</dd></div>
      </dl>

      {step === "summary" ? (
        <div className="provider-setup-actions">
          <Button size="condensed" variant="emphasized" disabled={loading || services.length === 0} onClick={() => setStep("select")}>Review services</Button>
          <Link className="text-action" to="/settings/watch">Change matching rule</Link>
          <span>Saving the rule does not modify services.</span>
        </div>
      ) : null}

      {step === "select" ? (
        <div className="provider-service-review">
          <div className="provider-service-toolbar">
            <label>
              <input
                type="checkbox"
                checked={selectableRows.length > 0 && selectedIds.length === selectableRows.length}
                onChange={toggleAll}
                disabled={selectableRows.length === 0}
              />
              Select all unassigned
            </label>
            <span>{selectedIds.length} selected</span>
          </div>
          <div className="provider-service-list" role="list" aria-label={`Services available for ${providerName} mapping`}>
            {rows.map(({ service, values, matched, conflicting, selectable }) => (
              <label className={`provider-service-row${selectable ? "" : " provider-service-row-disabled"}`} key={service.id}>
                <input type="checkbox" checked={selectedIds.includes(service.id)} disabled={!selectable} onChange={() => toggleService(service.id)} />
                <span className="provider-service-name"><strong>{service.name}</strong><small>{service.id}</small></span>
                <span className={`provider-service-state ${matched ? "positive" : conflicting ? "warning" : "neutral"}`}>
                  {matched ? `Mapped to ${providerName}` : conflicting ? `Review existing: ${values.join(", ")}` : "Unassigned"}
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
          <p>Existing tags remain in place. The new tag can be used by Dynatrace dashboards, alerts, maintenance windows, management zones, and workflows.</p>
          {permission === "conditional" ? <p>Your permission is limited by management zone. Dynatrace may update fewer services than selected.</p> : null}
          {!canWrite ? <p>Your current role cannot apply this change. Ask a tenant administrator for entity-settings permission.</p> : null}
          <div className="provider-review-actions">
            <Button size="condensed" onClick={() => setStep("select")}>Back</Button>
            <Button size="condensed" variant="emphasized" disabled={!canWrite || writing} onClick={() => void applyTag()}>{writing ? "Applying tag" : "Apply provider tag"}</Button>
          </div>
        </div>
      ) : null}

      {message ? <div className="provider-write-message" role="status"><span>{message}</span>{lastChange ? <Button size="condensed" disabled={writing} onClick={() => void undoLastChange()}>Undo last change</Button> : null}</div> : null}
    </section>
  );
};
