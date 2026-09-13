import React, { useEffect, useMemo, useState } from "react";
import { openApp } from "@dynatrace-sdk/navigation";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import {
  createServiceAvailabilityPreviewQuery,
  createServiceObjectiveConfig,
  createServiceObjectiveExternalId,
  OBJECTIVE_EVALUATION_HOURS,
  OBJECTIVE_EVALUATION_WINDOW,
  parseServiceObjectivePreview,
} from "../data/serviceObjectives";
import { useObjectiveEvaluations } from "../hooks/useObjectiveEvaluations";
import { useServiceObjectives } from "../hooks/useServiceObjectives";

type ServiceObjectivePreviewProps = {
  serviceClassicId: string | null;
  serviceName: string;
  providerSlug: string;
  providerName: string;
  providerServiceName: string;
  target: number | null;
  termsSource: "sla.directory" | "tenant override";
};

type PreviewRecord = Record<string, unknown>;

const percent = (value: number | null): string => value === null ? "No data" : `${value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;

export const ServiceObjectivePreview = ({
  serviceClassicId,
  serviceName,
  providerSlug,
  providerName,
  providerServiceName,
  target,
  termsSource,
}: ServiceObjectivePreviewProps) => {
  const [confirming, setConfirming] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const externalId = serviceClassicId
    ? createServiceObjectiveExternalId(providerSlug, serviceClassicId)
    : null;
  const previewQuery = serviceClassicId
    ? createServiceAvailabilityPreviewQuery(serviceClassicId, OBJECTIVE_EVALUATION_HOURS)
    : null;
  const definition = serviceClassicId && target !== null
    ? createServiceObjectiveConfig({
      serviceClassicId,
      serviceName,
      providerSlug,
      providerName,
      providerServiceName,
      target,
    })
    : null;
  const objectives = useServiceObjectives({
    enabled: Boolean(externalId),
    providerSlug,
    serviceClassicId,
    pageSize: 5,
  });
  const existing = useMemo(
    () => objectives.objectives.find((objective) => objective.externalId === externalId),
    [externalId, objectives.objectives],
  );
  const existingObjectives = useMemo(() => existing ? [existing] : [], [existing]);
  const evaluations = useObjectiveEvaluations(existingObjectives);
  const evaluation = existing ? evaluations[existing.id] : undefined;
  const previewResult = useDql<PreviewRecord>(
    { query: previewQuery ?? "data record(noop = true) | limit 0" },
    { enabled: Boolean(previewQuery) && !objectives.loading && !existing },
  );
  const preview = parseServiceObjectivePreview(previewResult.data?.records);
  const existingTarget = existing?.criteria[0]?.target ?? null;
  const targetDiffers = existingTarget !== null && target !== null && Math.abs(existingTarget - target) > 0.0001;

  useEffect(() => {
    setConfirming(false);
    setFeedback(undefined);
  }, [externalId]);

  const createObjective = async () => {
    if (!definition || objectives.creating) return;
    setFeedback(undefined);
    try {
      await objectives.createObjective(definition);
      setConfirming(false);
      setFeedback("Objective created in Dynatrace.");
    } catch {
      setFeedback("The objective was not created. Check objective write access and try again.");
      await objectives.refresh();
    }
  };

  return (
    <section className="service-objective" aria-labelledby="service-objective-title">
      <div className="service-objective-heading">
        <div>
          <strong id="service-objective-title">Customer objective</strong>
          <span>Track this service with Dynatrace request telemetry.</span>
        </div>
        <span className={`status-pill ${existing ? targetDiffers ? "status-pill-warning" : "status-pill-positive" : "status-pill-neutral"}`}>
          {objectives.loading ? "Checking" : existing ? targetDiffers ? "Review target" : "Created" : "Preview"}
        </span>
      </div>
      <div className="service-objective-facts">
        <div><span>Observed</span><strong>{existing
          ? evaluation?.state === "loading" || !evaluation
            ? "Loading"
            : evaluation.state === "complete"
              ? percent(evaluation.result?.value ?? null)
              : "Unavailable"
          : previewResult.isLoading
            ? "Loading"
            : previewResult.error
              ? "Unavailable"
              : percent(preview?.reliability ?? null)}</strong></div>
        <div><span>Target</span><strong>{percent(target)}</strong></div>
        <div><span>Evaluation</span><strong>{OBJECTIVE_EVALUATION_WINDOW === "now-30d" ? "Last 30 days" : OBJECTIVE_EVALUATION_WINDOW}</strong></div>
        <div><span>Terms</span><strong>{termsSource}</strong></div>
      </div>
      <p className="service-objective-note">
        {existing
          ? "Observed value comes from the Dynatrace objective evaluation. Provider corroboration remains optional evidence."
          : "This preview measures customer-observed availability for one Dynatrace service. Provider corroboration remains optional evidence."}
      </p>
      {!existing && preview && preview.totalRequests > 0 ? (
        <p className="service-objective-traffic">{preview.totalRequests.toLocaleString()} requests, {preview.failedRequests.toLocaleString()} failed in the 30-day evaluation window.</p>
      ) : null}
      {!serviceClassicId ? <div className="service-objective-warning">A classic service ID is required before Dynatrace can create this objective.</div> : null}
      {target === null ? <div className="service-objective-warning">No availability target is published for this scope. Add custom terms before creating an objective.</div> : null}
      {previewResult.error ? <div className="service-objective-warning">The scoped Grail query did not validate, so creation is disabled.</div> : null}
      {objectives.error ? <div className="service-objective-warning">{objectives.error}</div> : null}
      {existing && evaluation?.state === "unavailable" ? <div className="service-objective-warning">{evaluation.message ?? "The Dynatrace objective could not be evaluated."}</div> : null}
      {existing && targetDiffers ? (
        <div className="service-objective-warning">The existing target is {percent(existingTarget)}. Current terms suggest {percent(target)}. Review it in Dynatrace before changing anything.</div>
      ) : null}
      {!existing && previewQuery ? (
        <details className="service-objective-query">
          <summary>View scoped query</summary>
          <pre>{definition?.customSli?.indicator ?? previewQuery}</pre>
        </details>
      ) : null}
      <div className="service-objective-actions">
        {existing ? (
          <Button size="condensed" onClick={() => openApp("dynatrace.service.level.objectives")}>Open in SLOs</Button>
        ) : confirming ? (
          <>
            <span>Create one Dynatrace objective for this provider and service?</span>
            <Button size="condensed" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button size="condensed" variant="emphasized" disabled={objectives.creating} onClick={() => void createObjective()}>{objectives.creating ? "Creating" : "Create objective"}</Button>
          </>
        ) : (
          <Button
            size="condensed"
            variant="emphasized"
            disabled={!definition || previewResult.isLoading || Boolean(previewResult.error) || objectives.loading || objectives.canWrite !== true || Boolean(objectives.error)}
            onClick={() => setConfirming(true)}
          >
            Create objective
          </Button>
        )}
        {!existing && !objectives.loading && objectives.canWrite === false ? <span>Objective write access is required to create it.</span> : null}
      </div>
      {feedback ? <div className="scope-map-feedback scope-map-feedback-positive" role="status">{feedback}</div> : null}
    </section>
  );
};
