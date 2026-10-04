import { createEvidenceDecisionKey } from "./evidenceCandidates";
import type { EvidenceReviewStateResult } from "./evidenceReviewState";
import type { IncidentReviewCase } from "./incidentReviewCases";

export type BatchReviewTarget = {
  reviewCase: IncidentReviewCase;
  eligible: boolean;
  reason?: string;
};

type ReviewScope = {
  providerProductId: string;
  affectedServiceId: string;
};

type ScopeResult = { scope: ReviewScope; reason?: never } |
  { scope?: never; reason: string };

/** These matches only permit a shared Needs evidence note, not a shared outage finding. */
export const BATCH_REVIEW_CONFIRMATION =
  "The same provider product and Dynatrace service do not establish one provider outage, account, region, or agreement. Custom terms may differ. Review each episode's timestamps, affected resources, customer impact, and missing evidence before applying a shared Needs evidence note.";

const normalize = (value: string): string => value.trim().toLowerCase();

const unresolved = (state?: EvidenceReviewStateResult): boolean =>
  state?.state === "needs-review" &&
  state.storedDecisions.length === 0 &&
  state.currentDecisions.length === 0;

const savedAndCurrent = (
  state: EvidenceReviewStateResult | undefined,
  reviewCase: IncidentReviewCase,
): boolean => Boolean(
  state?.currentDecision &&
  state.currentDecisions.length === reviewCase.candidates.length &&
  state.storedDecisions.length === reviewCase.candidates.length &&
  state.state !== "mixed" &&
  state.state !== "needs-review"
);

const scopeForCase = (
  reviewCase: IncidentReviewCase,
  providerSlug: string,
): ScopeResult => {
  if (reviewCase.problems.length === 0 ||
      reviewCase.candidates.length !== reviewCase.problems.length ||
      new Set(reviewCase.problems.map((problem) => normalize(problem.id))).size !== reviewCase.problems.length ||
      !reviewCase.problems.every((problem) =>
        reviewCase.candidates.some((candidate) => candidate.problem.id === problem.id)) ||
      !reviewCase.candidates.every((candidate) =>
        candidate.key === createEvidenceDecisionKey(providerSlug, candidate.problem.id)))
    return { reason: "The Problem or provider evidence for this episode is incomplete." };

  if (reviewCase.problems.some((problem) =>
    !problem.startedAt || !Number.isFinite(Date.parse(problem.startedAt)) ||
    problem.affectedEntityIds.length === 0))
    return { reason: "Confirm every Problem start time and affected entity before sharing a review note." };

  const productIds = new Set(reviewCase.candidates.flatMap((candidate) =>
    candidate.providerServiceIds.map(normalize)));
  if (productIds.size !== 1 ||
      reviewCase.providerServiceIds.length !== 1 ||
      !reviewCase.candidates.every((candidate) =>
        candidate.scopeConfirmed && candidate.providerServiceIds.length === 1) ||
      normalize(reviewCase.providerServiceIds[0]) !== [...productIds][0] ||
      [...productIds][0] === "*")
    return { reason: "Confirm one exact provider product for every Problem in this episode." };

  const serviceIds = new Set(reviewCase.candidates.flatMap((candidate) =>
    candidate.affectedServices.map((service) => normalize(service.id))));
  if (serviceIds.size !== 1 ||
      reviewCase.affectedServices.length !== 1 ||
      !reviewCase.candidates.every((candidate) => candidate.affectedServices.length === 1) ||
      normalize(reviewCase.affectedServices[0].id) !== [...serviceIds][0])
    return { reason: "Resolve one affected Dynatrace service for every Problem in this episode." };

  return { scope: {
    providerProductId: [...productIds][0],
    affectedServiceId: [...serviceIds][0],
  } };
};

export const buildBatchReviewTargets = ({
  anchor,
  cases,
  states,
  providerSlug,
}: {
  anchor: IncidentReviewCase;
  cases: IncidentReviewCase[];
  states: ReadonlyMap<string, EvidenceReviewStateResult>;
  providerSlug: string;
}): BatchReviewTarget[] => {
  const anchorState = states.get(anchor.key);
  const anchorUnresolved = unresolved(anchorState);
  const anchorCurrent = savedAndCurrent(anchorState, anchor);
  const anchorScope = anchorUnresolved || anchorCurrent
    ? scopeForCase(anchor, providerSlug)
    : { reason: "The selected episode has a stale or mixed decision, or its review state is unavailable." };
  const distinctCases = Array.from(new Map(
    [anchor, ...cases].map((reviewCase) => [reviewCase.key, reviewCase]),
  ).values());

  return distinctCases.flatMap((reviewCase): BatchReviewTarget[] => {
    const isAnchor = reviewCase.key === anchor.key;
    const state = states.get(reviewCase.key);
    if (isAnchor && !anchorUnresolved) return [{
      reviewCase,
      eligible: false,
      reason: anchorCurrent
        ? "This episode already has a saved human decision and will not be changed."
        : "The selected episode has a stale or mixed decision and cannot define a shared review scope.",
    }];
    if (!unresolved(state)) return [{
      reviewCase,
      eligible: false,
      reason: state
        ? "This episode has a saved, stale, or mixed decision. Reopen and review it separately."
        : "The saved review state for this episode is unavailable.",
    }];

    const result = scopeForCase(reviewCase, providerSlug);
    if (!result.scope) return [{ reviewCase, eligible: false, reason: result.reason }];
    if (!anchorScope.scope) return [{
      reviewCase,
      eligible: false,
      reason: `The selected episode is not eligible: ${anchorScope.reason}`,
    }];
    if (result.scope.providerProductId !== anchorScope.scope.providerProductId)
      return [{ reviewCase, eligible: false, reason: "This episode belongs to a different provider product." }];
    if (result.scope.affectedServiceId !== anchorScope.scope.affectedServiceId)
      return [{ reviewCase, eligible: false, reason: "This episode affects a different Dynatrace service." }];
    return [{ reviewCase, eligible: true }];
  });
};
