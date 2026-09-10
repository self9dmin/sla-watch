import React, { useState } from "react";
import { Button } from "@dynatrace/strato-components/buttons";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";
import { useSlaPreferences } from "../context/SlaPreferencesContext";
import type { BugCategory, BugSeverity, BugStatus, SlaBug } from "../types";

const CATEGORY_LABELS: Record<BugCategory, string> = {
  data: "Telemetry data",
  "provider-matching": "Provider matching",
  access: "Access or permissions",
  ux: "User experience",
};

const STATUS_LABELS: Record<BugStatus, string> = { open: "Open", triaged: "Triaged", resolved: "Resolved" };

const nextStatus = (status: BugStatus): BugStatus => status === "open" ? "triaged" : status === "triaged" ? "resolved" : "open";

const formatCreatedAt = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const BugRow = ({ bug, onStatusChange, onCopy }: { bug: SlaBug; onStatusChange: (bug: SlaBug) => void; onCopy: (bug: SlaBug) => void }) => (
  <article className="work-item">
    <div className="work-item-main"><div className="work-item-title-row"><strong>{bug.title}</strong><span className={`severity-badge severity-${bug.severity}`}>{bug.severity}</span></div><span className="work-item-id">{bug.id} · {formatCreatedAt(bug.createdAt)} · {CATEGORY_LABELS[bug.category]}</span><p>{bug.details}</p><small>Evidence captured: {bug.evidence}</small></div>
    <div className="work-item-actions"><span className={`status-pill status-pill-${bug.status === "resolved" ? "positive" : bug.status === "triaged" ? "neutral" : "warning"}`}>{STATUS_LABELS[bug.status]}</span><Button onClick={() => onStatusChange(bug)}>{bug.status === "resolved" ? "Reopen" : bug.status === "open" ? "Mark triaged" : "Resolve"}</Button><Button onClick={() => onCopy(bug)}>Copy summary</Button></div>
  </article>
);

export const BugReportPage = () => {
  const { preferences, updatePreferences } = useSlaPreferences();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<BugCategory>("provider-matching");
  const [severity, setSeverity] = useState<BugSeverity>("medium");
  const [details, setDetails] = useState("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !details.trim()) return;
    const bug: SlaBug = {
      id: `BUG-${Date.now().toString(36).toUpperCase()}`,
      title: title.trim(),
      category,
      severity,
      details: details.trim(),
      status: "open",
      createdAt: new Date().toISOString(),
      evidence: `provider:${preferences.providerSlug} · lookback:${preferences.lookbackHours}h`,
    };
    await updatePreferences({ bugs: [bug, ...preferences.bugs] });
    setTitle("");
    setDetails("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2600);
  };

  const changeStatus = async (bug: SlaBug) => {
    await updatePreferences({ bugs: preferences.bugs.map((item) => item.id === bug.id ? { ...item, status: nextStatus(item.status) } : item) });
  };

  const copySummary = async (bug: SlaBug) => {
    const summary = `${bug.id}: ${bug.title}\nCategory: ${CATEGORY_LABELS[bug.category]}\nSeverity: ${bug.severity}\nStatus: ${STATUS_LABELS[bug.status]}\nDetails: ${bug.details}\nEvidence: ${bug.evidence}`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="workflow-page">
      <div className="page-intro"><Text className="eyebrow">Operate · quality loop</Text><Heading level={1}>Bug management</Heading><Paragraph>Capture a reproducible issue with the provider and evidence context that were active when you found it. This keeps “matching is wrong” separate from “telemetry is missing.”</Paragraph></div>
      <div className="workflow-summary"><div><span className="eyebrow">Open</span><strong>{preferences.bugs.filter((bug) => bug.status === "open").length}</strong></div><div><span className="eyebrow">Triaged</span><strong>{preferences.bugs.filter((bug) => bug.status === "triaged").length}</strong></div><div><span className="eyebrow">Resolved</span><strong>{preferences.bugs.filter((bug) => bug.status === "resolved").length}</strong></div><div className="workflow-summary-context"><span className="eyebrow">Capture context</span><strong>{preferences.providerSlug} · {preferences.lookbackHours}h</strong></div></div>
      <div className="workflow-grid">
        <section className="form-panel"><div className="panel-heading-row"><div><Text className="eyebrow">New report</Text><Heading level={2}>What went wrong?</Heading></div>{saved ? <span className="saved-note">Saved</span> : null}</div><form onSubmit={(event) => void submit(event)} className="stacked-form"><label className="field-label">Short summary<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Provider label was not recognized" maxLength={120} /></label><div className="form-two-col"><label className="field-label">Category<select value={category} onChange={(event) => setCategory(event.target.value as BugCategory)}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field-label">Severity<select value={severity} onChange={(event) => setSeverity(event.target.value as BugSeverity)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div><label className="field-label">Details<textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="What did you expect, what did the watch show, and how can someone reproduce it?" rows={6} maxLength={1200} /></label><div className="form-hint">The report will include <code>provider:{preferences.providerSlug}</code> and the last {preferences.lookbackHours} hours as evidence context.</div><Button variant="emphasized" type="submit" disabled={!title.trim() || !details.trim()}>Save bug report</Button></form></section>
        <section className="workflow-list-panel"><div className="panel-heading-row"><div><Text className="eyebrow">Your quality loop</Text><Heading level={2}>Reported issues</Heading></div>{copied ? <span className="saved-note">Copied</span> : null}</div>{preferences.bugs.length === 0 ? <div className="empty-state compact-empty"><strong>No bug reports yet.</strong><span>When the watch disagrees with your evidence, start here. The first report becomes the handoff template for the next responder.</span></div> : <div className="work-item-list">{preferences.bugs.map((bug) => <BugRow key={bug.id} bug={bug} onStatusChange={(item) => void changeStatus(item)} onCopy={(item) => void copySummary(item)} />)}</div>}</section>
      </div>
      <div className="workflow-note"><strong>Storage boundary</strong><span>Reports are saved to shared SLA Watch app state when the workspace scope is available. The browser fallback is local, and no external ticket is created automatically.</span></div>
    </div>
  );
};
