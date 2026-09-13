import type {
  EvidenceDecisionRecord,
  EvidenceDecisionStatus,
} from "../types";
import {
  evidenceDecisionMatchesCandidate,
} from "./evidenceCandidates";
import type { IncidentReviewCase } from "./incidentReviewCases";

export type EvidenceReviewState =
  | "needs-review"
  | "needs-evidence"
  | "ready-for-follow-up"
  | "excluded"
  | "mixed";

export type EvidenceReviewStateResult = {
  state: EvidenceReviewState;
  status?: EvidenceDecisionStatus;
  currentDecision?: EvidenceDecisionRecord;
  currentDecisions: EvidenceDecisionRecord[];
  storedDecisions: EvidenceDecisionRecord[];
};

export type EvidenceReviewStatePresentation = {
  label: string;
  tone: "neutral" | "warning" | "positive";
};

export const resolveEvidenceReviewState = (
  reviewCase: IncidentReviewCase,
  decisionsByKey: ReadonlyMap<string, EvidenceDecisionRecord>,
): EvidenceReviewStateResult => {
  const storedDecisions = reviewCase.candidates.flatMap((candidate) => {
    const decision = decisionsByKey.get(candidate.key);
    return decision ? [decision] : [];
  });
  const currentDecisions = reviewCase.candidates.flatMap((candidate) => {
    const decision = decisionsByKey.get(candidate.key);
    return decision && evidenceDecisionMatchesCandidate(decision, candidate)
      ? [decision]
      : [];
  });
  const statuses = Array.from(new Set(
    currentDecisions.map((decision) => decision.status),
  ));
  const complete = reviewCase.candidates.length > 0 &&
    currentDecisions.length === reviewCase.candidates.length &&
    statuses.length === 1;
  const status = complete ? statuses[0] : undefined;

  return {
    state: status === "validated"
      ? "ready-for-follow-up"
      : status === "not-ready"
        ? "needs-evidence"
        : status === "dismissed"
          ? "excluded"
          : storedDecisions.length > 0
            ? "mixed"
            : "needs-review",
    status,
    currentDecision: complete ? currentDecisions[0] : undefined,
    currentDecisions,
    storedDecisions,
  };
};

export const evidenceReviewStatePresentation = (
  state: EvidenceReviewState,
): EvidenceReviewStatePresentation => {
  if (state === "ready-for-follow-up") {
    return { label: "Ready for follow-up", tone: "positive" };
  }
  if (state === "needs-evidence") {
    return { label: "Needs evidence", tone: "warning" };
  }
  if (state === "excluded") {
    return { label: "Excluded", tone: "neutral" };
  }
  if (state === "mixed") {
    return { label: "Mixed review", tone: "warning" };
  }
  return { label: "Needs review", tone: "warning" };
};
