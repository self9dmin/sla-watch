import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { openApp } from "@dynatrace-sdk/navigation";
import { Button } from "@dynatrace/strato-components/buttons";
import { SingleValue } from "@dynatrace/strato-components/charts";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ServiceLevelObjectivesIcon } from "@dynatrace/strato-icons";
import type { SloEvaluationResult } from "@dynatrace-sdk/client-service-level-objectives";
import { formatObjectiveTimeframe } from "../data/serviceObjectives";
import { useObjectiveEvaluations, type ObjectiveEvaluation } from "../hooks/useObjectiveEvaluations";
import { useServiceObjectives } from "../hooks/useServiceObjectives";

type PerformanceWorkspaceProps = {
  providerSlug: string;
  providerName: string;
};

type PerformanceTone = "neutral" | "warning" | "positive" | "danger";

const percent = (value?: number): string =>
  typeof value !== "number" || !Number.isFinite(value)
    ? "No result"
    : `${value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;

const evaluationLabel = (evaluation?: ObjectiveEvaluation): string => {
  if (!evaluation || evaluation.state === "loading") return "Evaluating";
  if (evaluation.state === "unavailable") return "No result";
  switch (evaluation.result?.status) {
    case "SUCCESS":
      return "On target";
    case "WARNING":
      return "At risk";
    case "FAILURE":
      return "Below target";
    default:
      return "Unavailable";
  }
};

const evaluationTone = (evaluation?: ObjectiveEvaluation): PerformanceTone => {
  if (evaluation?.result?.status === "SUCCESS") return "positive";
  if (evaluation?.result?.status === "WARNING") return "warning";
  if (evaluation?.result?.status === "FAILURE") return "danger";
  return "neutral";
};

const PerformanceFact = ({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: PerformanceTone;
}) => (
  <div className="overview-fact">
    <span>{label}</span>
    <strong className={`overview-fact-value overview-fact-value-${tone}`}>
      {value}
    </strong>
    <small>{detail}</small>
  </div>
);

const ObjectiveFacts = ({ result, target, timeframe }: {
  result?: SloEvaluationResult;
  target?: number;
  timeframe?: string;
}) => (
  <dl className="performance-detail-facts">
    <div>
      <dt>Observed</dt>
      <dd>{percent(result?.value)}</dd>
    </div>
    <div>
      <dt>Target</dt>
      <dd>{percent(target)}</dd>
    </div>
    <div>
      <dt>Error budget</dt>
      <dd>{percent(result?.errorBudget)}</dd>
    </div>
    <div>
      <dt>Evaluation</dt>
      <dd>{formatObjectiveTimeframe(timeframe)}</dd>
    </div>
  </dl>
);

export const PerformanceWorkspace = ({
  providerSlug,
  providerName,
}: PerformanceWorkspaceProps) => {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string>();
  const objectives = useServiceObjectives({
    enabled: Boolean(providerSlug),
    providerSlug,
    page,
    pageSize: 8,
  });
  const evaluations = useObjectiveEvaluations(objectives.objectives);
  const pageCount = Math.max(1, Math.ceil(objectives.totalCount / objectives.pageSize));

  useEffect(() => {
    setPage(1);
    setSelectedId(undefined);
  }, [providerSlug]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (
      selectedId &&
      objectives.objectives.some((objective) => objective.id === selectedId)
    ) return;
    setSelectedId(objectives.objectives[0]?.id);
  }, [objectives.objectives, selectedId]);

  const selected = objectives.objectives.find(
    (objective) => objective.id === selectedId,
  );
  const selectedEvaluation = selected ? evaluations[selected.id] : undefined;
  const resultStates = useMemo(
    () => objectives.objectives.map((objective) => evaluations[objective.id]),
    [evaluations, objectives.objectives],
  );
  const meetingTarget = resultStates.filter(
    (evaluation) => evaluation?.result?.status === "SUCCESS",
  ).length;
  const needsAttention = resultStates.filter(
    (evaluation) =>
      evaluation?.result?.status === "WARNING" ||
      evaluation?.result?.status === "FAILURE",
  ).length;
  const noResult = resultStates.length - meetingTarget - needsAttention;

  return (
    <Surface className="panel-card performance-panel">
      <div className="performance-heading">
        <div>
          <Heading level={2}>Performance</Heading>
          <Paragraph>
            Customer objectives for {providerName}, measured from Dynatrace
            service-request telemetry.
          </Paragraph>
        </div>
        <span className="status-pill status-pill-neutral">
          {objectives.loading
            ? "Loading objectives"
            : `${objectives.totalCount.toLocaleString()} objective${objectives.totalCount === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="overview-facts performance-facts" aria-label="Performance status">
        <PerformanceFact
          label="Objectives"
          value={objectives.loading ? "Checking" : objectives.totalCount.toLocaleString()}
          detail={`${providerName} customer services`}
          tone={objectives.totalCount > 0 ? "positive" : "neutral"}
        />
        <PerformanceFact
          label="Meeting target"
          value={objectives.loading ? "Checking" : meetingTarget.toLocaleString()}
          detail="on this page"
          tone={meetingTarget > 0 ? "positive" : "neutral"}
        />
        <PerformanceFact
          label="Needs attention"
          value={objectives.loading ? "Checking" : needsAttention.toLocaleString()}
          detail="at risk or below target"
          tone={needsAttention > 0 ? "warning" : "neutral"}
        />
        <PerformanceFact
          label="No result"
          value={objectives.loading ? "Checking" : noResult.toLocaleString()}
          detail="evaluating or unavailable"
        />
      </div>

      <div className="performance-objective-context">
        <div className="scope-map-toolbar">
          <div className="scope-map-title">
            <ServiceLevelObjectivesIcon />
            <div>
              <strong id="service-objectives-title">Service objectives</strong>
              <span>
                Dynatrace evaluates customer-observed reliability for covered services.
              </span>
            </div>
          </div>
          <div className="scope-map-toolbar-actions">
            <Button
              size="condensed"
              onClick={() => openApp("dynatrace.service.level.objectives")}
            >
              <Button.Prefix>
                <ServiceLevelObjectivesIcon />
              </Button.Prefix>
              Open SLOs
            </Button>
          </div>
        </div>
        <div className="scope-map-boundary">
          <strong>How it is used</strong>
          <span>
            Objective status comes from Dynatrace service telemetry. Incidents
            and Evidence keep provider reports separate from customer-observed
            performance.
          </span>
        </div>
      </div>

      {objectives.error ? (
        <div className="performance-error" role="status">
          {objectives.error}
        </div>
      ) : null}

      {objectives.loading && objectives.objectives.length === 0 ? (
        <div className="performance-empty">
          <strong>Loading customer objectives</strong>
          <span>Reading the objectives managed by SLA Review.</span>
        </div>
      ) : objectives.objectives.length === 0 ? (
        <div className="performance-empty">
          <strong>No customer objectives for {providerName}</strong>
          <span>
            Open a covered service to preview and explicitly create one. Nothing
            is created automatically.
          </span>
          <Button as={Link} to="/" size="condensed" variant="emphasized">
            Open Coverage
          </Button>
        </div>
      ) : (
        <div className="performance-layout">
          <section className="performance-browser" aria-label="Customer objectives">
            <div className="performance-tile-grid">
              {objectives.objectives.map((objective) => {
                const evaluation = evaluations[objective.id];
                const target = objective.criteria[0]?.target;
                return (
                  <button
                    type="button"
                    key={objective.id}
                    className={`performance-tile${selectedId === objective.id ? " active" : ""}`}
                    onClick={() => setSelectedId(objective.id)}
                    aria-pressed={selectedId === objective.id}
                  >
                    <span className="performance-tile-heading">
                      <strong>{objective.name}</strong>
                      <span className={`status-pill status-pill-${evaluationTone(evaluation)}`}>
                        {evaluationLabel(evaluation)}
                      </span>
                    </span>
                    <div className="performance-tile-value">
                      <SingleValue
                        data={evaluation?.state === "loading"
                          ? "Evaluating"
                          : percent(evaluation?.result?.value)}
                        height={34}
                        width="100%"
                        aria-label={`Observed ${evaluation?.state === "loading"
                          ? "value evaluating"
                          : percent(evaluation?.result?.value)}`}
                      />
                    </div>
                    <span className="performance-tile-target">
                      Target {percent(target)} · {formatObjectiveTimeframe(objective.criteria[0]?.timeframeFrom)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="performance-pagination" aria-label="Objective pages">
              <span>
                Page {page} of {pageCount}
              </span>
              <div>
                <Button
                  size="condensed"
                  disabled={page <= 1 || objectives.loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="condensed"
                  disabled={page >= pageCount || objectives.loading}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </section>

          <aside className="performance-detail" aria-label="Selected objective">
            {selected ? (
              <>
                <div className="performance-detail-heading">
                  <div>
                    <span>Customer objective</span>
                    <Heading level={3}>{selected.name}</Heading>
                  </div>
                  <span className={`status-pill status-pill-${evaluationTone(selectedEvaluation)}`}>
                    {evaluationLabel(selectedEvaluation)}
                  </span>
                </div>
                <ObjectiveFacts
                  result={selectedEvaluation?.result}
                  target={selected.criteria[0]?.target}
                  timeframe={selected.criteria[0]?.timeframeFrom}
                />
                {selected.description ? (
                  <Paragraph className="performance-description">
                    {selected.description}
                  </Paragraph>
                ) : null}
                {selectedEvaluation?.message || selectedEvaluation?.result?.message ? (
                  <div className="performance-evaluation-note">
                    {selectedEvaluation.message ?? selectedEvaluation.result?.message}
                  </div>
                ) : null}
                <div className="performance-boundary">
                  <strong>Measurement boundary</strong>
                  <span>
                    Provider reports remain separate evidence and do not change
                    this customer-observed result.
                  </span>
                </div>
              </>
            ) : null}
          </aside>
        </div>
      )}
    </Surface>
  );
};
