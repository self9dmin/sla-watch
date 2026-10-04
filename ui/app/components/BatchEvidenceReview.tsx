import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@dynatrace/strato-components/buttons";
import type { SlaProviderResponse } from "../types";
import { evidenceDecisionInputError, evidenceDecisionValue, MAX_EVIDENCE_DECISION_NOTE_LENGTH, normalizeEvidenceDecision } from "../data/evidenceCandidates";
import { BATCH_REVIEW_CONFIRMATION, buildBatchReviewTargets } from "../data/batchEvidenceReview";
import type { IncidentReviewCase } from "../data/incidentReviewCases";
import type { EvidenceReviewStateResult } from "../data/evidenceReviewState";
import type { EvidenceDecisionSaveResult } from "../hooks/useEvidenceDecisions";
import { useEvidenceDecisions } from "../hooks/useEvidenceDecisions";

type BatchEvidenceReviewProps = {
  anchor: IncidentReviewCase;
  cases: IncidentReviewCase[];
  states: ReadonlyMap<string, EvidenceReviewStateResult>;
  provider: SlaProviderResponse;
  contractReady: boolean;
  evidenceReadIncomplete: boolean;
  settings: ReturnType<typeof useEvidenceDecisions>;
  onClose: () => void;
};

const formatWindow = (value?: string): string => {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};

export const BatchEvidenceReview = ({
  anchor,
  cases,
  states,
  provider,
  contractReady,
  evidenceReadIncomplete,
  settings,
  onClose,
}: BatchEvidenceReviewProps) => {
  const panelRef = useRef<HTMLElement>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<EvidenceDecisionSaveResult>();
  const [refreshFailed, setRefreshFailed] = useState(false);

  useEffect(() => {
    panelRef.current?.focus();
    setSelectedKeys([]);
    setNote("");
    setPreview(false);
    setConfirmed(false);
    setError(undefined);
    setResult(undefined);
    setRefreshFailed(false);
  }, [anchor.key]);

  const targets = useMemo(() => buildBatchReviewTargets({
    anchor,
    cases,
    states,
    providerSlug: provider.provider.slug,
  }), [anchor, cases, states, provider.provider.slug]);
  const eligible = targets.filter((target) => target.eligible);
  const excluded = targets.filter((target) => !target.eligible);
  const selected = eligible.filter((target) => selectedKeys.includes(target.reviewCase.key));
  const selectedProblems = selected.flatMap((target) => target.reviewCase.problems);
  const blocked = evidenceReadIncomplete || !contractReady || !settings.canWrite || settings.incomplete || refreshFailed;

  const changeSelection = (key: string) => {
    setSelectedKeys((current) => current.includes(key)
      ? current.filter((value) => value !== key)
      : [...current, key]);
    setPreview(false);
    setConfirmed(false);
    setError(undefined);
    setResult(undefined);
  };

  const save = async () => {
    if (blocked || saving || !preview || !confirmed) return;
    const inputError = evidenceDecisionInputError({ status: "not-ready", note, acknowledged: false });
    if (inputError) {
      setError(inputError);
      return;
    }
    const currentTargets = buildBatchReviewTargets({
      anchor,
      cases,
      states,
      providerSlug: provider.provider.slug,
    });
    const currentEligible = new Map(currentTargets.filter((target) => target.eligible)
      .map((target) => [target.reviewCase.key, target.reviewCase]));
    if (selectedKeys.length === 0 || selectedKeys.some((key) => !currentEligible.has(key))) {
      setError("The selected episodes changed. Review the list and select them again.");
      setPreview(false);
      return;
    }
    const values = selectedKeys.flatMap((key) => currentEligible.get(key)?.candidates.map((candidate) =>
      evidenceDecisionValue(candidate, provider.provider.slug, "not-ready", note)) ?? []);
    if (values.length === 0) return;
    setSaving(true);
    setError(undefined);
    setResult(undefined);
    try {
      const fresh = await settings.refetch();
      const freshDecisions = fresh.items.flatMap((item) => {
        const decision = normalizeEvidenceDecision(item.value);
        return decision ? [decision] : [];
      });
      if (fresh.error || fresh.nextPageKey || fresh.totalCount > freshDecisions.length)
        throw new Error("The complete saved review history is unavailable. Reload before changing these episodes.");
      const freshKeys = new Set(freshDecisions.map((decision) => decision.decisionKey));
      const conflicts = values.filter((value) => freshKeys.has(value.decisionKey));
      if (conflicts.length > 0)
        throw new Error(`${conflicts.length} selected Problem decision${conflicts.length === 1 ? " was" : "s were"} saved by another review. Reload and select unresolved episodes again.`);
      const saved = await settings.saveDecisions(values);
      setResult(saved);
      setRefreshFailed(Boolean(saved.refreshError));
      setSelectedKeys((current) => current.filter((key) => {
        const target = currentEligible.get(key);
        return target?.candidates.some((candidate) =>
          saved.failures.some((failure) => failure.decisionKey === candidate.key));
      }));
      setPreview(false);
      setConfirmed(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The selected reviews could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return <article ref={panelRef} id="candidate-selected-detail" tabIndex={-1} className="candidate-batch-review" aria-labelledby="candidate-batch-title">
    <div className="candidate-batch-heading">
      <div>
        <h3 id="candidate-batch-title">Review related episodes</h3>
        <p>{anchor.providerServiceNames[0] ?? provider.provider.name} · {anchor.affectedServices[0]?.name ?? "Service unavailable"}</p>
      </div>
      <Button size="condensed" onClick={onClose}>Back to one episode</Button>
    </div>
    <p className="candidate-batch-intro">These are separate incident episodes for the same confirmed provider product and Dynatrace service. Their provider terms, account, and region may differ. A completed review stays with its own episode. This action shares a missing-evidence reason only after you check that it applies to each selected episode.</p>
    <div className="candidate-batch-summary">
      <strong>{eligible.length} match this product and service</strong>
      <span>{excluded.length} other episode{excluded.length === 1 ? "" : "s"} cannot be changed here.</span>
    </div>
    {!contractReady || evidenceReadIncomplete ? <p className="candidate-batch-warning" role="status">Complete the Dynatrace evidence and contract reads before recording a shared decision.</p> : null}
    {!settings.canWrite ? <p className="candidate-batch-warning" role="status">App Settings write access is required to record decisions.</p> : null}
    {refreshFailed ? <p className="candidate-batch-warning" role="alert">The save completed, but review status could not be refreshed. Reload this page before making another batch change.</p> : null}
    <div className="candidate-batch-select-heading">
      <strong>Select the episodes with the same missing evidence</strong>
      <Button size="condensed" disabled={blocked || saving || eligible.length === 0} onClick={() => {
        setSelectedKeys(eligible.map((target) => target.reviewCase.key));
        setPreview(false);
        setConfirmed(false);
        setResult(undefined);
      }}>Select all {eligible.length} matching episodes</Button>
    </div>
    <div className="candidate-batch-list" role="group" aria-label="Eligible incident episodes">
      {eligible.map(({ reviewCase }) => <label key={reviewCase.key} className="candidate-batch-row">
        <input type="checkbox" checked={selectedKeys.includes(reviewCase.key)} disabled={blocked || saving} onChange={() => changeSelection(reviewCase.key)} />
        <span>
          <strong>{formatWindow(reviewCase.startedAt)} · {reviewCase.problems.length} Problem{reviewCase.problems.length === 1 ? "" : "s"}</strong>
          <small>{reviewCase.problems.map((problem) => problem.id).join(", ")}</small>
          <small>{reviewCase.problems[0]?.rootCause?.name ? `Davis root cause: ${reviewCase.problems[0].rootCause.name}` : "Davis root cause unverified"}</small>
        </span>
      </label>)}
      {eligible.length === 0 ? <p>No unresolved episodes share this exact provider product and Dynatrace service.</p> : null}
    </div>
    {excluded.length > 0 ? <details className="candidate-batch-excluded">
      <summary>Why {excluded.length} other episode{excluded.length === 1 ? " is" : "s are"} unavailable</summary>
      <ul>{excluded.map(({ reviewCase, reason }) => <li key={reviewCase.key}>
        <strong>{reviewCase.problems.map((problem) => problem.id).join(", ")}</strong>: {reason}
      </li>)}</ul>
    </details> : null}
    <label className="candidate-batch-note">
      <strong>Shared evidence gap</strong>
      <textarea value={note} rows={3} maxLength={MAX_EVIDENCE_DECISION_NOTE_LENGTH} disabled={blocked || saving} onChange={(event) => {
        setNote(event.target.value);
        setPreview(false);
        setConfirmed(false);
        setResult(undefined);
      }} placeholder="Name the missing evidence that applies to every selected episode. Do not paste agreement text or customer data." />
    </label>
    <p className="candidate-batch-boundary">Confirm the provider terms, account, region, affected resources, timestamps, and customer impact for each episode before later marking its evidence review complete. This action does not confirm a credit or send a provider claim. No local routing is queued.</p>
    {preview ? <div className="candidate-batch-preview">
      <strong role="status">Record Needs evidence for {selected.length} episode{selected.length === 1 ? "" : "s"} and {selectedProblems.length} Problem{selectedProblems.length === 1 ? "" : "s"}?</strong>
      <p>Each Problem keeps its own decision record. The shared note is: “{note.trim()}”</p>
      <ul>{selectedProblems.map((problem) => <li key={problem.id}>{problem.id} · {formatWindow(problem.startedAt)}</li>)}</ul>
      <p>{BATCH_REVIEW_CONFIRMATION}</p>
      <label className="candidate-batch-confirmation"><input type="checkbox" checked={confirmed} disabled={saving} onChange={(event) => setConfirmed(event.target.checked)} /><span>I checked the shared gap for every selected episode. I understand this does not complete their evidence reviews.</span></label>
      <Button variant="emphasized" color="primary" disabled={blocked || saving || !confirmed || selected.length === 0} onClick={() => void save()}>{saving ? "Saving reviews" : `Record ${selectedProblems.length} Problem decisions`}</Button>
      <Button size="condensed" disabled={saving} onClick={() => { setPreview(false); setConfirmed(false); }}>Change selection</Button>
    </div> : <Button variant="emphasized" color="primary" disabled={blocked || saving || selected.length === 0 || note.trim().length === 0} onClick={() => {
      setError(undefined);
      setPreview(true);
    }}>Preview {selected.length} selected episode{selected.length === 1 ? "" : "s"}</Button>}
    {error ? <p className="candidate-batch-warning" role="alert">{error}</p> : null}
    {result ? <div className="candidate-batch-result">
      <strong role="status">{result.savedDecisionKeys.length} Problem decision{result.savedDecisionKeys.length === 1 ? "" : "s"} saved. {result.failures.length} failed.</strong>
      {result.failures.length > 0 ? <ul>{result.failures.map((failure) => <li key={failure.decisionKey}>{failure.decisionKey}: {failure.message}</li>)}</ul> : null}
      {result.refreshError ? <p>{result.refreshError}</p> : null}
    </div> : null}
  </article>;
};
