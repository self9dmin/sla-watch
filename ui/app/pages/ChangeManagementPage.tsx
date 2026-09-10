import React, { useState } from "react";
import { Button } from "@dynatrace/strato-components/buttons";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";
import { useSlaPreferences } from "../context/SlaPreferencesContext";
import type { ChangeRisk, ChangeStatus, SlaChange } from "../types";

const STATUS_LABELS: Record<ChangeStatus, string> = { planned: "Planned", "in-progress": "In progress", complete: "Complete", "rolled-back": "Rolled back" };

const nextStatus = (status: ChangeStatus): ChangeStatus => status === "planned" ? "in-progress" : status === "in-progress" ? "complete" : status === "complete" ? "rolled-back" : "planned";

const actionLabel = (status: ChangeStatus) => status === "planned" ? "Start change" : status === "in-progress" ? "Mark complete" : status === "complete" ? "Record rollback" : "Replan change";

const formatCreatedAt = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const ChangeRow = ({ change, onStatusChange }: { change: SlaChange; onStatusChange: (change: SlaChange) => void }) => (
  <article className="work-item change-item">
    <div className="work-item-main"><div className="work-item-title-row"><strong>{change.title}</strong><span className={`risk-badge risk-${change.risk}`}>{change.risk} risk</span></div><span className="work-item-id">{change.id} · {change.createdAt === "Baseline" ? "Baseline" : formatCreatedAt(change.createdAt)} · owner {change.owner}</span><p>{change.scope}</p><small><strong>Rollback:</strong> {change.rollbackPlan}</small></div>
    <div className="work-item-actions"><span className={`status-pill status-pill-${change.status === "complete" ? "positive" : change.status === "rolled-back" ? "warning" : "neutral"}`}>{STATUS_LABELS[change.status]}</span><Button onClick={() => onStatusChange(change)}>{actionLabel(change.status)}</Button></div>
  </article>
);

export const ChangeManagementPage = () => {
  const { preferences, updatePreferences } = useSlaPreferences();
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  const [risk, setRisk] = useState<ChangeRisk>("medium");
  const [owner, setOwner] = useState("");
  const [rollbackPlan, setRollbackPlan] = useState("");
  const [saved, setSaved] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !scope.trim() || !rollbackPlan.trim()) return;
    const change: SlaChange = {
      id: `CHG-${Date.now().toString(36).toUpperCase()}`,
      title: title.trim(),
      scope: scope.trim(),
      risk,
      owner: owner.trim() || "Unassigned",
      rollbackPlan: rollbackPlan.trim(),
      status: "planned",
      createdAt: new Date().toISOString(),
    };
    await updatePreferences({ changes: [change, ...preferences.changes] });
    setTitle("");
    setScope("");
    setOwner("");
    setRollbackPlan("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2600);
  };

  const changeStatus = async (change: SlaChange) => {
    await updatePreferences({ changes: preferences.changes.map((item) => item.id === change.id ? { ...item, status: nextStatus(item.status) } : item) });
  };

  return (
    <div className="workflow-page">
      <div className="page-intro"><Text className="eyebrow">Operate · evidence control</Text><Heading level={1}>Change management</Heading><Paragraph>Make the provider boundary and evidence policy reviewable. A change record gives responders the context to tell a real provider signal from a mapping or configuration change.</Paragraph></div>
      <div className="change-banner"><div><span className="eyebrow">Current app baseline</span><strong>Evidence-first attribution</strong><span>Provider labels are a signal, not proof. A change never turns a candidate into a claim on its own.</span></div><div className="change-banner-stats"><span><strong>{preferences.changes.filter((change) => change.status === "in-progress").length}</strong> in progress</span><span><strong>{preferences.changes.filter((change) => change.status === "planned").length}</strong> planned</span><span><strong>{preferences.changes.filter((change) => change.status === "complete").length}</strong> complete</span></div></div>
      <div className="workflow-grid">
        <section className="form-panel"><div className="panel-heading-row"><div><Text className="eyebrow">New record</Text><Heading level={2}>Record a change</Heading></div>{saved ? <span className="saved-note">Saved</span> : null}</div><form onSubmit={(event) => void submit(event)} className="stacked-form"><label className="field-label">Change title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add provider labels to checkout services" maxLength={120} /></label><label className="field-label">Scope<textarea value={scope} onChange={(event) => setScope(event.target.value)} placeholder="What is changing, and which evidence path could it affect?" rows={4} maxLength={900} /></label><div className="form-two-col"><label className="field-label">Risk<select value={risk} onChange={(event) => setRisk(event.target.value as ChangeRisk)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label className="field-label">Owner<input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Team or responder" maxLength={80} /></label></div><label className="field-label">Rollback plan<textarea value={rollbackPlan} onChange={(event) => setRollbackPlan(event.target.value)} placeholder="How do we return to the last known-good evidence path?" rows={3} maxLength={700} /></label><Button variant="emphasized" type="submit" disabled={!title.trim() || !scope.trim() || !rollbackPlan.trim()}>Save change record</Button></form></section>
        <section className="workflow-list-panel"><div className="panel-heading-row"><div><Text className="eyebrow">Reviewable history</Text><Heading level={2}>Change register</Heading></div><span className="status-pill status-pill-neutral">{preferences.changes.length} records</span></div><div className="work-item-list">{preferences.changes.map((change) => <ChangeRow key={change.id} change={change} onStatusChange={(item) => void changeStatus(item)} />)}</div></section>
      </div>
      <div className="workflow-note"><strong>Operational guardrail</strong><span>If you add labels, change the lookback, or switch providers, record the change before you rerun the watch. That chronology is part of the evidence.</span></div>
    </div>
  );
};
