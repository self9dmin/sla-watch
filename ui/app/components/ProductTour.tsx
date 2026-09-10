import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@dynatrace/strato-components/buttons";

type TourStep = { target: string; title: string; body: string };

const STEPS: TourStep[] = [
  {
    target: '[data-tour="watch"]',
    title: "Review the watch",
    body: "The watch combines tenant telemetry with the selected provider contract. Use the sections to review evidence and configuration.",
  },
  {
    target: '[data-tour="provider"]',
    title: "Review provider records",
    body: "Provider directory contains contract records and targets. Select a provider in Settings, then compare those records with tenant evidence.",
  },
  {
    target: '[data-tour="settings"]',
    title: "Configure the evidence boundary",
    body: "Settings controls the provider slug, label key, lookback window, theme, and walkthrough state. Watch configuration is shared, while theme and walkthrough state stay personal.",
  },
  {
    target: '[data-tour="bugs"]',
    title: "Capture a reproducible issue",
    body: "When data or matching is incorrect, record the evidence context in Bug management for the next responder.",
  },
  {
    target: '[data-tour="changes"]',
    title: "Record a configuration change",
    body: "Use Change management to record provider mapping and evidence-policy changes, including scope and rollback plan.",
  },
  {
    target: '[data-tour="tour"]',
    title: "Review attribution guidance",
    body: "Use the walkthrough icon any time. The help guide explains the difference between a provider candidate and evidence of provider fault.",
  },
];

export const ProductTour = ({ onComplete }: { onComplete: () => void }) => {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[index];

  const measure = useCallback(() => {
    setRect(document.querySelector(step.target)?.getBoundingClientRect() ?? null);
  }, [step.target]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  const next = () => {
    if (index === STEPS.length - 1) onComplete();
    else setIndex((current) => current + 1);
  };

  const panelWidth = Math.min(340, window.innerWidth - 32);
  const top = rect ? Math.min(window.innerHeight - 220, Math.max(16, rect.bottom + 14)) : window.innerHeight / 2 - 100;
  const left = rect
    ? Math.max(16, Math.min(window.innerWidth - panelWidth - 16, rect.right > window.innerWidth - panelWidth - 24 ? rect.right - panelWidth : rect.left))
    : Math.max(16, (window.innerWidth - panelWidth) / 2);

  return (
    <div className="product-tour" role="dialog" aria-label="SLA Watch walkthrough">
      {rect ? (
        <>
          <div className="tour-mask tour-mask-top" style={{ height: Math.max(0, rect.top - 8) }} />
          <div className="tour-mask tour-mask-bottom" style={{ top: rect.bottom + 8 }} />
          <div className="tour-mask" style={{ top: rect.top - 8, left: 0, width: Math.max(0, rect.left - 8), height: rect.height + 16 }} />
          <div className="tour-mask" style={{ top: rect.top - 8, left: rect.right + 8, right: 0, height: rect.height + 16 }} />
          <div className="tour-focus" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} />
        </>
      ) : <div className="tour-mask tour-mask-full" />}
      <div className="tour-panel" style={{ top, left, width: panelWidth }}>
        <div className="eyebrow">SLA Watch walkthrough · {index + 1}/{STEPS.length}</div>
        <button type="button" className="tour-close" onClick={onComplete} aria-label="Close walkthrough">Close</button>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-actions">
          <Button onClick={onComplete}>Skip</Button>
          <Button variant="emphasized" onClick={next}>{index === STEPS.length - 1 ? "Finish" : "Next"}</Button>
        </div>
      </div>
    </div>
  );
};
