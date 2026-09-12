import { useEffect, useMemo, useState } from "react";
import {
  serviceLevelObjectivesEvaluationClient,
  type Slo,
  type SloEvaluationResult,
} from "@dynatrace-sdk/client-service-level-objectives";

export type ObjectiveEvaluation = {
  state: "loading" | "complete" | "unavailable";
  result?: SloEvaluationResult;
  message?: string;
};

const evaluationErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.name === "Forbidden") {
    return "Objective evaluation access is required.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "The objective could not be evaluated.";
};

const evaluateObjective = async (objective: Slo): Promise<ObjectiveEvaluation> => {
  try {
    let response = await serviceLevelObjectivesEvaluationClient.startSloEvaluation({
      body: {
        id: objective.id,
        requestTimeoutMilliseconds: 5000,
      },
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = response.evaluationResults?.[0];
      if (result) return { state: "complete", result };
      if (!response.evaluationToken) break;
      response = await serviceLevelObjectivesEvaluationClient.pollSloEvaluation({
        evaluationToken: response.evaluationToken,
        requestTimeoutMilliseconds: 5000,
      });
    }

    const result = response.evaluationResults?.[0];
    return result
      ? { state: "complete", result }
      : {
        state: "unavailable",
        message: "Evaluation is still running. Refresh Performance shortly.",
      };
  } catch (error) {
    return { state: "unavailable", message: evaluationErrorMessage(error) };
  }
};

export const useObjectiveEvaluations = (objectives: Slo[]) => {
  const [evaluations, setEvaluations] = useState<Record<string, ObjectiveEvaluation>>({});
  const objectiveIds = useMemo(
    () => objectives.map((objective) => objective.id).join("|"),
    [objectives],
  );

  useEffect(() => {
    let active = true;
    const initial = Object.fromEntries(
      objectives.map((objective) => [objective.id, { state: "loading" }]),
    ) as Record<string, ObjectiveEvaluation>;
    setEvaluations(initial);
    if (objectives.length === 0) return () => { active = false; };

    let cursor = 0;
    const worker = async () => {
      while (active) {
        const objective = objectives[cursor];
        cursor += 1;
        if (!objective) return;
        const evaluation = await evaluateObjective(objective);
        if (!active) return;
        setEvaluations((current) => ({
          ...current,
          [objective.id]: evaluation,
        }));
      }
    };

    const workerCount = Math.min(4, objectives.length);
    void Promise.all(Array.from({ length: workerCount }, () => worker()));

    return () => {
      active = false;
    };
  }, [objectiveIds, objectives]);

  return evaluations;
};
